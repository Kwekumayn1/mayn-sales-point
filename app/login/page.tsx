"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const RESEND_SECONDS = 60;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Counts down the "Send again" button
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function sendReset(target: string) {
    setError(null);
    setResetBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setResetBusy(false);
    if (error) {
      const msg = error.message || "";
      if (/seconds|rate/i.test(msg)) {
        setError("Please wait a minute before asking for another email, then try again.");
      } else {
        setError(msg);
      }
      return;
    }
    setResetSentTo(target);
    setCooldown(RESEND_SECONDS);
  }

  function handleReset() {
    const target = email.trim();
    if (!target) {
      setError("Enter your email above first, then tap 'Forgot password'.");
      return;
    }
    void sendReset(target);
  }

  // After a reset email has been requested
  if (resetSentTo) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <Link href="/" className="font-display text-lg text-indigo">Mayn Sales Point</Link>

        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h1 className="font-display text-2xl text-indigo">Check your email</h1>
          <p className="mt-3 text-sm">
            If an account exists for <b>{resetSentTo}</b>, we have sent you a message from
            Mayn Sales Point.
          </p>
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm">
            <li>Open your email inbox.</li>
            <li>Open the message from Mayn Sales Point.</li>
            <li>Tap <b>Reset password</b> in the message and choose your new password.</li>
          </ol>
          <p className="mt-4 text-xs text-ink/60">
            Cannot find it? Check your Spam or Promotions folder. The link works for a limited
            time.
          </p>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            onClick={() => void sendReset(resetSentTo)}
            disabled={cooldown > 0 || resetBusy}
            className="mt-5 w-full rounded-pill border border-indigo py-3 text-sm font-medium text-indigo disabled:opacity-50"
          >
            {resetBusy
              ? "Sending…"
              : cooldown > 0
                ? "Send again in " + cooldown + "s"
                : "Send again"}
          </button>
          <button
            onClick={() => {
              setResetSentTo(null);
              setError(null);
            }}
            className="mt-3 w-full text-sm text-indigo underline"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="font-display text-lg text-indigo">Mayn Sales Point</Link>
      <h1 className="mt-8 font-display text-2xl text-indigo">Log in</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            required
            type="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            required
            type="password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-pill bg-indigo py-3 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <button
        onClick={handleReset}
        disabled={resetBusy}
        className="mt-4 text-left text-sm text-indigo underline disabled:opacity-60"
      >
        {resetBusy ? "Sending…" : "Forgot password?"}
      </button>
    </main>
  );
      }

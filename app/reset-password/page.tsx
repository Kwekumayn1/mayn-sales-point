"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [state, setState] = useState("checking");
  const [problem, setProblem] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase: any = createClient();
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get("token_hash");
        const code = params.get("code");

        if (tokenHash) {
          const { error: e1 } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (e1) {
            setProblem(e1.message);
            setState("bad");
            return;
          }
        } else if (code) {
          const { error: e2 } = await supabase.auth.exchangeCodeForSession(code);
          if (e2) {
            setProblem(e2.message);
            setState("bad");
            return;
          }
        }

        // Give the library a moment to read tokens placed in the link itself.
        let found: any = null;
        for (let i = 0; i < 6; i++) {
          const { data } = await supabase.auth.getSession();
          if (data && data.session) {
            found = data.session;
            break;
          }
          await new Promise((r) => setTimeout(r, 400));
        }
        if (found) {
          setState("ready");
        } else {
          setProblem("This reset link is invalid or has expired.");
          setState("bad");
        }
      } catch (err: any) {
        setProblem(err && err.message ? err.message : "Something went wrong.");
        setState("bad");
      }
    })();
  }, []);

  async function save(e: any) {
    e.preventDefault();
    setError("");
    if (password.length === 0 || 6 > password.length) {
      setError("Use a password of at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    const supabase: any = createClient();
    setBusy(true);
    const { error: e3 } = await supabase.auth.updateUser({ password: password });
    setBusy(false);
    if (e3) {
      setError(e3.message);
      return;
    }
    setState("done");
    await supabase.auth.signOut();
    setTimeout(() => {
      window.location.href = "/login";
    }, 2500);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl text-indigo">Set a new password</h1>

      {state === "checking" && (
        <p className="mt-4 text-sm text-ink/60">Checking your reset link...</p>
      )}

      {state === "bad" && (
        <div className="mt-4">
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{problem}</p>
          <p className="mt-3 text-sm text-ink/70">
            Go back to the login page and tap Forgot password to get a fresh link.
          </p>
          <a
            href="/login"
            className="mt-4 inline-block rounded-pill bg-indigo px-5 py-2 text-sm font-bold text-white"
          >
            Back to login
          </a>
        </div>
      )}

      {state === "ready" && (
        <form onSubmit={save} className="mt-5 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e: any) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-xl border border-line bg-white p-3 text-base"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e: any) => setConfirm(e.target.value)}
            placeholder="Type it again"
            className="w-full rounded-xl border border-line bg-white p-3 text-base"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-pill bg-indigo py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save new password"}
          </button>
        </form>
      )}

      {state === "done" && (
        <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
          Password changed. Taking you to the login page...
        </p>
      )}
    </main>
  );
}

// END OF FILE

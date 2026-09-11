"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="font-display text-2xl text-indigo">Check your email</h1>
        <p className="mt-3 text-sm text-ink/70">
          We sent a confirmation link to {email}. Confirm your address, then
          log in to reach your dashboard.
        </p>
        <Link href="/login" className="mt-6 text-sm font-medium text-indigo underline">
          Go to login
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="font-display text-lg text-indigo">Mayn Sales Point</Link>
      <h1 className="mt-8 font-display text-2xl text-indigo">Create your account</h1>
      <p className="mt-2 text-sm text-ink/60">
        Every account can become a vendor later — no separate application needed.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm font-medium">Full name</label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Phone number</label>
          <input
            required
            type="tel"
            placeholder="024XXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            required
            type="email"
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
            minLength={8}
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
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink/60">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo underline">Log in</Link>
      </p>
    </main>
  );
          }

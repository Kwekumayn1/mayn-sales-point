"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function StorePage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, storefront_slug")
      .eq("id", user.id)
      .single();

    setRole(profile?.role ?? "customer");
    setSlug(profile?.storefront_slug ?? "");
    setSavedSlug(profile?.storefront_slug ?? null);
    setLoading(false);
  }

  async function handleBecomeVendor() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("become_vendor");
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  }

  async function handleSaveSlug(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleaned = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!cleaned) {
      setError("Choose a storefront name using only letters, numbers, and hyphens.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ storefront_slug: cleaned })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      setError(
        error.message.includes("duplicate")
          ? "That storefront name is already taken, please try another."
          : error.message
      );
      return;
    }
    setSavedSlug(cleaned);
    setSlug(cleaned);
    setMessage("Storefront link saved.");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-sm text-ink/60">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Dashboard</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">My Storefront</h1>

      {role === "customer" && (
        <div className="mt-8 border border-line bg-white p-6">
          <p className="text-sm text-ink/70">
            You are currently a customer account. Become a vendor to set your
            own prices and get a shareable storefront link.
          </p>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            onClick={handleBecomeVendor}
            className="mt-4 rounded-pill bg-gold px-6 py-2 text-sm font-medium text-indigo hover:bg-gold-dark"
          >
            Become a Vendor
          </button>
        </div>
      )}

      {role !== "customer" && (
        <div className="mt-8 border border-line bg-white p-6">
          <form onSubmit={handleSaveSlug} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Storefront name</label>
              <div className="mt-1 flex items-center border border-line focus-within:border-indigo">
                <span className="pl-3 text-sm text-ink/40">/s/</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-2 py-2 text-sm outline-none"
                  placeholder="yourname"
                />
              </div>
              <p className="mt-1 text-xs text-ink/50">
                Letters, numbers, and hyphens only.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-leaf">{message}</p>}

            <button
              type="submit"
              disabled={saving}
              className="rounded-pill bg-indigo px-6 py-2 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </form>

          {savedSlug && (
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-xs text-ink/50">Your storefront link</p>
              <p className="mt-1 break-all text-sm font-medium text-indigo">
                {origin}/s/{savedSlug}
              </p>
              <Link
                href={`/s/${savedSlug}`}
                className="mt-3 inline-block text-sm text-indigo underline"
              >
                View your storefront
              </Link>
            </div>
          )}
        </div>
      )}
    </main>
  );
    }

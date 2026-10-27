"use client";

import { useEffect, useState } from "react";

const PRESETS = [
  { label: "New prices", title: "New prices are live", body: "Our data bundle prices have been updated. Tap to see the new prices.", url: "/" },
  { label: "Special offer", title: "Special offer today", body: "A limited offer is on for a short time. Tap to see it before it ends.", url: "/" },
  { label: "System update", title: "We have made improvements", body: "Mayn Sales Point has new features to help you sell faster. Tap to see.", url: "/dashboard" },
  { label: "Maintenance", title: "Short maintenance", body: "We are working on the system for a short while. Orders may be a little slow.", url: "/" },
];

export default function NotifyPage() {
  const [stats, setStats] = useState<any>(null);
  const [audience, setAudience] = useState("me");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("/");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [keys, setKeys] = useState<any>(null);

  async function call(payload: any) {
    const res = await fetch("/api/admin/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }

  async function loadStats() {
    try {
      setStats(await call({ action: "stats" }));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  async function makeKeys() {
    setErr("");
    try {
      setKeys(await call({ action: "keys" }));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function send() {
    if (audience !== "me" && !window.confirm("Send this to the selected people now?")) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const j = await call({ action: "send", audience, slug, title, body: text, url });
      setMsg(
        j.note
          ? j.note
          : "Sent to " + j.sent + " device" + (j.sent === 1 ? "" : "s") + (j.failed ? ", " + j.failed + " could not be reached" : "") + "."
      );
      void loadStats();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  const field = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-indigo";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl text-indigo">Send notification</h1>
      <p className="mt-1 text-sm text-ink/60">
        A message that pops up on the phones of people who tapped Get updates. Only you can send these.
      </p>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {stats && !stats.ready && (
        <div className="mt-4 rounded-xl border border-line bg-amber-50 p-4 text-sm">
          <p className="font-semibold">One-time setup needed</p>
          <p className="mt-1">
            Notifications need two secret keys. Tap the button, then copy each key into Vercel (Settings, Environment Variables). Use
            the names shown, then Redeploy.
          </p>
          <button onClick={makeKeys} className="mt-3 rounded-pill bg-indigo px-4 py-2 text-sm font-semibold text-white">
            Create my keys
          </button>
          {keys && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-semibold">Name: VAPID_PUBLIC_KEY</p>
                <textarea readOnly rows={2} value={keys.publicKey} onFocus={(e: any) => e.target.select()} className={field} />
              </div>
              <div>
                <p className="text-xs font-semibold">Name: VAPID_PRIVATE_KEY (keep secret, never send to anyone)</p>
                <textarea readOnly rows={2} value={keys.privateKey} onFocus={(e: any) => e.target.select()} className={field} />
              </div>
              <p className="text-xs text-ink/70">
                Do this once. If you tap Create my keys again you get different keys, so only use one pair.
              </p>
            </div>
          )}
        </div>
      )}

      {stats && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-line bg-white p-3">
            <p className="text-2xl font-bold text-indigo">{stats.all}</p>
            <p className="text-xs text-ink/60">Phones signed up</p>
          </div>
          <div className="rounded-xl border border-line bg-white p-3">
            <p className="text-2xl font-bold text-indigo">{stats.vendors}</p>
            <p className="text-xs text-ink/60">Vendors</p>
          </div>
          <div className="rounded-xl border border-line bg-white p-3">
            <p className="text-2xl font-bold text-indigo">{stats.customers}</p>
            <p className="text-xs text-ink/60">Customers</p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-3">
        <div>
          <p className="mb-1 text-sm font-semibold">Quick messages</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setTitle(p.title);
                  setText(p.body);
                  setUrl(p.url);
                }}
                className="rounded-pill border border-line bg-white px-3 py-1.5 text-xs font-semibold"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold">Who gets it</p>
          <select value={audience} onChange={(e: any) => setAudience(e.target.value)} className={field}>
            <option value="me">Only me (test)</option>
            <option value="all">Everyone</option>
            <option value="vendors">All vendors</option>
            <option value="customers">All customers</option>
            <option value="store">Customers of one store</option>
          </select>
          {audience === "store" && (
            <input
              value={slug}
              onChange={(e: any) => setSlug(e.target.value)}
              placeholder="Store link name, e.g. kofi-data"
              className={field + " mt-2"}
            />
          )}
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold">Title ({title.length}/50)</p>
          <input value={title} maxLength={50} onChange={(e: any) => setTitle(e.target.value)} className={field} />
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">Message ({text.length}/140)</p>
          <textarea value={text} maxLength={140} rows={3} onChange={(e: any) => setText(e.target.value)} className={field} />
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">Page to open when tapped</p>
          <input value={url} onChange={(e: any) => setUrl(e.target.value)} placeholder="/ or /dashboard" className={field} />
        </div>

        {msg && <p className="text-sm font-semibold text-green-700">{msg}</p>}
        <button
          onClick={send}
          disabled={busy || !title.trim() || !text.trim()}
          className="rounded-pill bg-indigo px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Sending..." : audience === "me" ? "Send test to me" : "Send now"}
        </button>
      </div>
    </main>
  );
}

// END OF FILE

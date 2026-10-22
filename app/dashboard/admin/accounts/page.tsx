"use client";

import { useEffect, useState } from "react";

const money = (n: number) => "GHS " + Number(n || 0).toFixed(2);

export default function AccountsPage() {
  const [q, setQ] = useState("");
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [openId, setOpenId] = useState("");
  const [error, setError] = useState("");

  async function call(payload: any) {
    const res = await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }

  async function search(text: string, blockedOnly: boolean) {
    setLoading(true);
    setError("");
    try {
      const j = await call({ action: "list", q: text, onlyBlocked: blockedOnly });
      setRows(j.accounts || []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    void search("", false);
  }, []);

  async function toggleBlock(a: any) {
    let reason = "";
    if (!a.blocked) {
      const r = window.prompt("Why are you blocking " + (a.full_name || "this account") + "? (optional note)", "");
      if (r === null) return;
      reason = r;
    } else if (!window.confirm("Unblock " + (a.full_name || "this account") + "? They will be able to log in again.")) {
      return;
    }
    setBusyId(a.id);
    setError("");
    try {
      await call({ action: a.blocked ? "unblock" : "block", userId: a.id, reason });
      await search(q, onlyBlocked);
    } catch (e: any) {
      setError(e.message);
    }
    setBusyId("");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl text-indigo">Account review</h1>
      <p className="mt-1 text-sm text-ink/60">Search any account, see who it belongs to, and block or unblock it.</p>

      <form
        onSubmit={(e: any) => {
          e.preventDefault();
          void search(q, onlyBlocked);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={q}
          onChange={(e: any) => setQ(e.target.value)}
          placeholder="Name, phone, email, ID number or store name"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-indigo"
        />
        <button type="submit" className="shrink-0 rounded-pill bg-indigo px-5 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </form>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyBlocked}
          onChange={(e: any) => {
            setOnlyBlocked(e.target.checked);
            void search(q, e.target.checked);
          }}
        />
        Show blocked accounts only
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-ink/60">Loading...</p>}
      {!loading && rows.length === 0 && <p className="mt-4 text-sm text-ink/60">No accounts found.</p>}

      <div className="mt-4 divide-y divide-line border-t border-line">
        {rows.map((a) => {
          const open = openId === a.id;
          const isAdmin = a.role === "admin" || a.role === "super_admin";
          return (
            <div key={a.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">
                    {a.full_name || "No name"}{" "}
                    <span className="font-normal text-ink/50">(ID {a.vendor_id ?? "-"})</span>
                  </p>
                  <p className="text-xs text-ink/60">
                    {a.phone || "No phone"} {a.email ? " | " + a.email : ""}
                  </p>
                  <p className="text-xs text-ink/60">
                    {isAdmin ? "Admin" : "Level " + a.level + " vendor"}
                    {a.upline
                      ? " | Under: " + (a.upline.name || "Unknown") + " (ID " + a.upline.vendor_id + ")"
                      : isAdmin
                      ? ""
                      : " | Direct from you"}
                  </p>
                </div>
                <span
                  className={
                    "rounded-full px-3 py-1 text-xs font-semibold " +
                    (a.blocked ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800")
                  }
                >
                  {a.blocked ? "Blocked" : "Active"}
                </span>
              </div>

              {a.blocked && a.blocked_reason && (
                <p className="mt-1 text-xs text-red-600">Reason: {a.blocked_reason}</p>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => setOpenId(open ? "" : a.id)}
                  className="rounded-pill border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  {open ? "Hide details" : "View details"}
                </button>
                {!isAdmin && (
                  <button
                    onClick={() => toggleBlock(a)}
                    disabled={busyId === a.id}
                    className={
                      "rounded-pill px-3 py-1.5 text-xs font-semibold disabled:opacity-60 " +
                      (a.blocked ? "bg-indigo text-white" : "border border-line bg-white text-red-600")
                    }
                  >
                    {busyId === a.id ? "Please wait..." : a.blocked ? "Unblock" : "Block"}
                  </button>
                )}
              </div>

              {open && (
                <div className="mt-3 rounded-xl bg-paper p-3 text-sm text-ink">
                  <p>Joined: {a.created_at ? new Date(a.created_at).toLocaleDateString("en-GB") : "Not recorded"}</p>
                  <p>Store link name: {a.storefront_slug || "Not set"}</p>
                  <p>Purchase wallet: {money(a.purchase_balance)}</p>
                  <p>Profit wallet: {money(a.profit_balance)}</p>
                  <p>
                    Orders: {a.orders_total} total, {a.orders_paid} paid
                  </p>
                  {a.upline && (
                    <p>
                      Upline: {a.upline.name} (ID {a.upline.vendor_id}){a.upline.phone ? ", " + a.upline.phone : ""}
                    </p>
                  )}
                  <p className="mt-1">Sub-vendors under this account: {a.downline_count}</p>
                  {a.downline.map((d: any, i: number) => (
                    <p key={i} className="text-xs text-ink/70">
                      - {d.name || "No name"} (ID {d.vendor_id})
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

// END OF FILE

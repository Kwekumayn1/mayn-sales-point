"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CreateFirstVendorPage() {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [vendors, setVendors] = useState<any[]>([]);

  async function loadVendors() {
    const supabase: any = createClient();
    const res = await supabase
      .from("profiles")
      .select("id, full_name, vendor_id, phone, created_at")
      .eq("role", "vendor")
      .is("parent_vendor_id", null)
      .order("created_at", { ascending: false });
    setVendors(res.data || []);
  }

  useEffect(() => {
    (async () => {
      const supabase: any = createClient();
      const auth = await supabase.auth.getUser();
      const user = auth.data ? auth.data.user : null;
      if (!user) {
        setLoading(false);
        return;
      }
      const prof = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const role = prof.data ? prof.data.role : "";
      const ok = role === "admin" || role === "super_admin";
      setAllowed(ok);
      if (ok) await loadVendors();
      setLoading(false);
    })();
  }, []);

  async function submit() {
    setError("");
    setDone("");
    setBusy(true);
    const res = await fetch("/api/admin/create-vendor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: fullName, phone: phone, email: email, password: password }),
    });
    const json: any = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Something went wrong.");
      return;
    }
    setDone(
      "Done. 1st-level vendor created. ID: " + json.vendorId + " | Email: " + json.email + " | Password: " + password
    );
    setFullName("");
    setPhone("");
    setEmail("");
    setPassword("");
    await loadVendors();
  }

  if (loading) {
    return <div className="mx-auto max-w-2xl p-6 text-sm text-ink/60">Loading...</div>;
  }
  if (!allowed) {
    return <div className="mx-auto max-w-2xl p-6 text-sm text-ink/60">Admins only.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <h1 className="text-xl font-bold text-indigo">Create 1st-level vendor</h1>
      <p className="mt-1 text-sm text-ink/60">
        Enter their details. They can log in straight away with this email and password.
      </p>

      <div className="mt-4 space-y-3 rounded-2xl border border-line bg-white p-4">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          className="w-full rounded-xl border border-line px-3 py-2 text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          inputMode="tel"
          className="w-full rounded-xl border border-line px-3 py-2 text-sm"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full rounded-xl border border-line px-3 py-2 text-sm"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 characters)"
          className="w-full rounded-xl border border-line px-3 py-2 text-sm"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-pill bg-gold py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create 1st vendor"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {done ? <p className="break-words text-sm text-green-700">{done}</p> : null}
      </div>

      <h2 className="mt-8 text-base font-bold text-ink">Current 1st-level vendors</h2>
      <div className="mt-2 space-y-2">
        {vendors.length === 0 ? <p className="text-sm text-ink/60">None yet.</p> : null}
        {vendors.map((v) => (
          <div key={v.id} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
            <span className="font-semibold">{v.full_name || "(no name)"}</span>
            <span className="text-ink/60"> - ID {v.vendor_id}</span>
          </div>
        ))}
      </div>
    </div>
  );
               }
        

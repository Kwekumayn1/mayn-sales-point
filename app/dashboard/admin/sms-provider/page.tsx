"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const OPTIONS: { value: string; title: string; text: string }[] = [
  {
    value: "moolre_first",
    title: "Moolre first, MaynData as backup",
    text: "Cheapest. If Moolre refuses a message batch (for example its SMS balance is empty), MaynData sends it instead.",
  },
  {
    value: "mayndata_first",
    title: "MaynData first, Moolre as backup",
    text: "MaynData sends first. If it refuses a batch, Moolre sends it instead.",
  },
  {
    value: "moolre_only",
    title: "Moolre only",
    text: "No backup. Messages longer than 160 characters, or with symbols like \u20B5 or emoji, cannot be sent in this mode.",
  },
  {
    value: "mayndata_only",
    title: "MaynData only",
    text: "No backup. Moolre is not used at all.",
  },
];

const card = "rounded-2xl border border-line bg-white p-5";
const button =
  "rounded-xl bg-indigo px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";

export default function SmsProviderPage() {
  const supabase: any = useMemo(() => createClient(), []);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [saved, setSaved] = useState("moolre_first");
  const [choice, setChoice] = useState("moolre_first");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAllowed(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const ok = profile && (profile.role === "admin" || profile.role === "super_admin");
      setAllowed(!!ok);
      if (!ok) return;
      const { data } = await supabase
        .from("sms_settings")
        .select("provider_mode")
        .eq("id", 1)
        .maybeSingle();
      if (data && data.provider_mode) {
        setSaved(String(data.provider_mode));
        setChoice(String(data.provider_mode));
      }
    })();
  }, [supabase]);

  async function save() {
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.rpc("admin_set_sms_mode", { p_mode: choice });
    setBusy(false);
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    setSaved(choice);
    setNotice({
      ok: true,
      text: "Saved. It applies to all vendors within about 30 seconds.",
    });
  }

  if (allowed === null) {
    return <main className="mx-auto max-w-4xl px-6 py-10 text-sm text-ink/60">Loading...</main>;
  }
  if (!allowed) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10 text-sm text-red-700">
        This page is for admins only.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-ink/50">Admin</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">SMS provider</h1>
      <p className="mt-2 text-sm text-ink/60">
        Choose which provider sends vendor SMS and USSD payment links. Customers see the sender name of the
        provider that carried their message (Moolre: MaynGroup, MaynData: MaynBrand).
      </p>

      {notice && (
        <div
          className={
            "mt-4 rounded-xl px-4 py-3 text-sm font-semibold " +
            (notice.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900")
          }
        >
          {notice.text}
        </div>
      )}

      <section className={card + " mt-6"}>
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={
              "mb-3 block cursor-pointer rounded-xl border p-3 " +
              (choice === o.value ? "border-indigo bg-paper" : "border-line")
            }
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={choice === o.value}
                onChange={() => setChoice(o.value)}
              />
              <span className="text-sm font-semibold">{o.title}</span>
              {saved === o.value && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-900">
                  Current
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-ink/60">{o.text}</p>
          </label>
        ))}
        <button className={button + " w-full"} onClick={save} disabled={busy || choice === saved}>
          {busy ? "Saving..." : "Save"}
        </button>
      </section>
    </main>
  );
}

// END OF FILE

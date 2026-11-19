"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Pkg = { id: string; price: number; units: number };
type Contact = { id: string; phone: string; name: string | null; source: string };
type Campaign = {
  id: string;
  message: string;
  recipient_count: number;
  units_reserved: number;
  units_charged: number | null;
  status: string;
  created_at: string;
};

const card = "rounded-2xl border border-line bg-white p-5";
const input = "w-full rounded-xl border border-line bg-white px-3 py-3 text-sm";
const button =
  "rounded-xl bg-indigo px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";

export default function SmsPage() {
  const supabase: any = useMemo(() => createClient(), []);

  const [units, setUnits] = useState(0);
  const [wallet, setWallet] = useState(0);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalAll, setTotalAll] = useState(0);
  const [search, setSearch] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [preview, setPreview] = useState("");
  const [parts, setParts] = useState(0);
  const [previewError, setPreviewError] = useState("");
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [oneName, setOneName] = useState("");
  const [onePhone, setOnePhone] = useState("");
  const [manyText, setManyText] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadBalances = useCallback(async () => {
    const { data: u } = await supabase.rpc("my_sms_balance");
    setUnits(typeof u === "number" ? u : 0);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    let total = 0;
    for (let from = 0; ; from += 1000) {
      const { data: rows } = await supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("vendor_id", user.id)
        .eq("wallet_type", "purchase")
        .range(from, from + 999);
      const list = rows ?? [];
      for (const r of list) total += Number(r.amount);
      if (list.length < 1000) break;
    }
    setWallet(total);
  }, [supabase]);

  const loadCampaigns = useCallback(async () => {
    const { data } = await supabase
      .from("sms_campaigns")
      .select("id, message, recipient_count, units_reserved, units_charged, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setCampaigns((data ?? []) as Campaign[]);
  }, [supabase]);

  const loadTotal = useCallback(async () => {
    const { count } = await supabase
      .from("vendor_contacts")
      .select("id", { count: "exact", head: true });
    setTotalAll(typeof count === "number" ? count : 0);
  }, [supabase]);

  const loadPreview = useCallback(async () => {
    try {
      const res = await fetch("/api/sms/send", { cache: "no-store" });
      const json: any = await res.json().catch(() => null);
      if (json && json.ok) {
        setPreview(String(json.preview));
        setParts(Number(json.parts) || 1);
        setPreviewError("");
      } else {
        setPreview("");
        setParts(0);
        setPreviewError((json && json.error) || "Could not load the message.");
      }
    } catch {
      setPreview("");
      setParts(0);
      setPreviewError("Could not load the message. Check your connection.");
    }
    setPreviewLoaded(true);
  }, []);

  const loadContacts = useCallback(
    async (term: string) => {
      let q = supabase
        .from("vendor_contacts")
        .select("id, phone, name, source")
        .order("created_at", { ascending: false })
        .range(0, 49);
      const s = term.trim().replace(/[%,()*]/g, "");
      if (s) {
        const digits = s.replace(/\D/g, "");
        const phonePart = digits.length > 0 && digits.charAt(0) === "0" ? digits.slice(1) : digits;
        if (phonePart.length > 0 && phonePart.length === s.replace(/[\s+]/g, "").length) {
          q = q.ilike("phone", "%" + phonePart + "%");
        } else {
          q = q.ilike("name", "%" + s + "%");
        }
      }
      const { data } = await q;
      setContacts((data ?? []) as Contact[]);
    },
    [supabase]
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sms_packages")
        .select("id, price, units")
        .order("price", { ascending: true });
      setPackages(
        ((data ?? []) as any[]).map((p) => ({
          id: p.id,
          price: Number(p.price),
          units: Number(p.units),
        }))
      );
    })();
    void loadBalances();
    void loadCampaigns();
    void loadTotal();
    void loadPreview();
  }, [supabase, loadBalances, loadCampaigns, loadTotal, loadPreview]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadContacts(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search, loadContacts]);

  async function buy(p: Pkg) {
    if (
      !window.confirm(
        "Buy " + p.units.toLocaleString() + " SMS units for GHS " + p.price + " from your Purchase Wallet?"
      )
    )
      return;
    setBusy("buy" + p.id);
    setNotice(null);
    const { error } = await supabase.rpc("buy_sms_package", { p_package_id: p.id });
    setBusy("");
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    setNotice({ ok: true, text: "Bought " + p.units.toLocaleString() + " SMS units." });
    await loadBalances();
  }

  async function addOne() {
    if (!onePhone.trim()) return;
    setBusy("one");
    setNotice(null);
    const { data, error } = await supabase.rpc("add_my_contact", {
      p_phone: onePhone,
      p_name: oneName,
    });
    setBusy("");
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    if (data === true) {
      setNotice({ ok: true, text: "Contact saved." });
      setOnePhone("");
      setOneName("");
      await loadTotal();
      await loadContacts(search);
    } else {
      setNotice({ ok: false, text: "That is not a valid Ghana number." });
    }
  }

  async function addMany() {
    if (!manyText.trim()) return;
    setBusy("many");
    setNotice(null);
    const { data, error } = await supabase.rpc("add_my_contacts", { p_text: manyText });
    setBusy("");
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    const valid = data && typeof data.valid === "number" ? data.valid : 0;
    const invalid = data && typeof data.invalid === "number" ? data.invalid : 0;
    setNotice({
      ok: true,
      text: valid + " number(s) saved" + (invalid > 0 ? ", " + invalid + " not valid and skipped." : "."),
    });
    setManyText("");
    await loadTotal();
    await loadContacts(search);
  }

  async function removeContact(c: Contact) {
    if (!window.confirm("Remove " + c.phone + " from your contacts?")) return;
    const { error } = await supabase.from("vendor_contacts").delete().eq("id", c.id);
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    await loadTotal();
    await loadContacts(search);
  }

  const cost = parts * totalAll;
  const tooFew = cost > units;

  async function send() {
    if (!preview) {
      setNotice({ ok: false, text: previewError || "The message is not ready." });
      return;
    }
    if (totalAll === 0) {
      setNotice({ ok: false, text: "You have no contacts yet." });
      return;
    }
    if (
      !window.confirm(
        "Send this message to " +
          totalAll.toLocaleString() +
          " contact(s)? It will use " +
          cost.toLocaleString() +
          " SMS units."
      )
    )
      return;
    setBusy("send");
    setNotice(null);
    try {
      const res = await fetch("/api/sms/send", { method: "POST" });
      const json: any = await res.json().catch(() => null);
      if (!res.ok || !json || !json.ok) {
        setNotice({ ok: false, text: (json && json.error) || "Could not send. Try again." });
      } else {
        setNotice({
          ok: true,
          text:
            "Sent to " +
            json.sent +
            " contact(s). Units used: " +
            json.unitsCharged +
            (json.invalid > 0 ? ". Skipped invalid numbers: " + json.invalid : "") +
            (json.failed > 0 ? ". Not sent: " + json.failed + " (refunded)" : "") +
            ".",
        });
      }
    } catch {
      setNotice({ ok: false, text: "Network problem. Check your connection and try again." });
    }
    setBusy("");
    await loadBalances();
    await loadCampaigns();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-ink/50">Mayn Sales Point</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">SMS Marketing</h1>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className={card}>
          <p className="text-xs text-ink/50">SMS units</p>
          <p className="mt-1 font-display text-2xl">{units.toLocaleString()}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-ink/50">Purchase Wallet</p>
          <p className="mt-1 font-display text-2xl">GHS {wallet.toFixed(2)}</p>
        </div>
      </div>

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
        <h2 className="font-display text-lg text-indigo">Buy SMS units</h2>
        <p className="mt-1 text-xs text-ink/50">Paid from your Purchase Wallet. One unit = one SMS part.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {packages.map((p) => (
            <button
              key={p.id}
              onClick={() => buy(p)}
              disabled={busy !== "" || wallet < p.price}
              className="rounded-xl border border-line px-3 py-4 text-left disabled:opacity-40"
            >
              <div className="font-display text-lg">GHS {p.price}</div>
              <div className="text-sm text-ink/70">{p.units.toLocaleString()} units</div>
            </button>
          ))}
        </div>
        {packages.length > 0 && wallet < packages[0].price && (
          <p className="mt-3 text-xs text-red-700">Top up your Purchase Wallet first to buy units.</p>
        )}
      </section>

      <section className={card + " mt-6"}>
        <h2 className="font-display text-lg text-indigo">Send our advert to your contacts</h2>
        <p className="mt-1 text-xs text-ink/50">
          To keep the platform safe, only this approved message can be sent. It goes to all{" "}
          {totalAll.toLocaleString()} of your contacts and carries your own store link.
        </p>

        {!previewLoaded && <p className="mt-3 text-sm text-ink/50">Loading message...</p>}
        {previewLoaded && previewError && (
          <div className="mt-3 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
            {previewError}
          </div>
        )}
        {preview && (
          <div className="mt-3 rounded-xl border border-line bg-paper px-4 py-3 text-sm">{preview}</div>
        )}
        {preview && (
          <p className="mt-2 text-xs text-ink/60">
            {parts} SMS part(s) per contact. Cost: {cost.toLocaleString()} units.
          </p>
        )}
        {preview && tooFew && totalAll > 0 && (
          <p className="mt-1 text-xs text-red-700">
            You need {cost.toLocaleString()} units but have {units.toLocaleString()}. Buy more above.
          </p>
        )}
        <button
          className={button + " mt-3 w-full"}
          onClick={send}
          disabled={busy !== "" || !preview || totalAll === 0 || tooFew}
        >
          {busy === "send" ? "Sending..." : "Send SMS"}
        </button>
      </section>

      <section className={card + " mt-6"}>
        <h2 className="font-display text-lg text-indigo">My contacts ({totalAll.toLocaleString()})</h2>
        <p className="mt-1 text-xs text-ink/50">
          Your buyers are added here automatically. You can also add your own numbers.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <input
            className={input}
            placeholder="Name (optional)"
            value={oneName}
            onChange={(e) => setOneName(e.target.value)}
          />
          <input
            className={input}
            placeholder="Phone, e.g. 0551300186"
            inputMode="tel"
            value={onePhone}
            onChange={(e) => setOnePhone(e.target.value)}
          />
          <button className={button} onClick={addOne} disabled={busy !== ""}>
            Add contact
          </button>
        </div>

        <textarea
          className={input + " mt-4 min-h-[90px]"}
          placeholder="Or paste many numbers here (separated by commas, spaces or new lines)"
          value={manyText}
          onChange={(e) => setManyText(e.target.value)}
        />
        <button className={button + " mt-2"} onClick={addMany} disabled={busy !== ""}>
          Save pasted numbers
        </button>

        <input
          className={input + " mt-6"}
          placeholder="Search by name or number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-3 divide-y divide-line">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-semibold">{c.name || c.phone}</div>
                <div className="text-xs text-ink/50">
                  {c.name ? c.phone + " \u00B7 " : ""}
                  {c.source === "order" ? "From a purchase" : "Added by you"}
                </div>
              </div>
              <button className="text-xs font-semibold text-red-700" onClick={() => removeContact(c)}>
                Remove
              </button>
            </div>
          ))}
          {contacts.length === 0 && <p className="py-3 text-sm text-ink/50">No contacts found.</p>}
        </div>
        {totalAll > 50 && !search && (
          <p className="mt-2 text-xs text-ink/50">Showing the newest 50. Use search to find others.</p>
        )}
      </section>

      <section className={card + " mt-6"}>
        <h2 className="font-display text-lg text-indigo">Recent campaigns</h2>
        <div className="mt-3 divide-y divide-line">
          {campaigns.map((c) => (
            <div key={c.id} className="py-3 text-sm">
              <div className="line-clamp-2">{c.message}</div>
              <div className="mt-1 text-xs text-ink/50">
                {new Date(c.created_at).toLocaleString()} &middot; {c.recipient_count} contact(s) &middot;{" "}
                {c.units_charged ?? c.units_reserved} units &middot; {c.status}
              </div>
            </div>
          ))}
          {campaigns.length === 0 && <p className="py-3 text-sm text-ink/50">No messages sent yet.</p>}
        </div>
      </section>
    </main>
  );
}

// END OF FILE

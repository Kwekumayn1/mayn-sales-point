"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CommunityLinkPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

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
      if (ok) {
        const res = await supabase.rpc("get_community_link");
        setLink(typeof res.data === "string" ? res.data : "");
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setError("");
    setDone("");
    setBusy(true);
    const supabase: any = createClient();
    const res = await supabase.rpc("admin_set_community_link", { p_link: link });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setDone(link.trim() === "" ? "Link removed. The WhatsApp button is now hidden." : "Saved. The WhatsApp button now shows on every account page.");
  }

  if (loading) {
    return <div className="mx-auto max-w-2xl p-6 text-sm text-ink/60">Loading...</div>;
  }
  if (!allowed) {
    return <div className="mx-auto max-w-2xl p-6 text-sm text-ink/60">Admins only.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <h1 className="text-xl font-bold text-indigo">WhatsApp community link</h1>
      <p className="mt-1 text-sm text-ink/60">
        Paste your WhatsApp group or community invite link. A green WhatsApp button then floats on
        every vendor and admin page. Leave it empty and save to hide the button.
      </p>

      <div className="mt-4 space-y-3 rounded-2xl border border-line bg-white p-4">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://chat.whatsapp.com/..."
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl border border-line px-3 py-2 text-sm"
        />
        <button
          onClick={save}
          disabled={busy}
          className="w-full rounded-pill bg-gold py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save link"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {done ? <p className="text-sm text-green-700">{done}</p> : null}
      </div>
    </div>
  );
        }

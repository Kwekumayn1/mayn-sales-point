import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cleanUrl(raw: string): string {
  const u = String(raw || "").trim();
  if (u === "") return "/";
  if (u.startsWith("/") && !u.startsWith("//")) return u.slice(0, 300);
  if (u.startsWith("https://")) return u.slice(0, 300);
  return "/";
}

export async function POST(request: Request) {
  const supabase: any = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u || !u.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const admin: any = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (!me || (me.role !== "admin" && me.role !== "super_admin")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const body: any = await request.json().catch(() => ({}));
  const pub = process.env.VAPID_PUBLIC_KEY || "";
  const priv = process.env.VAPID_PRIVATE_KEY || "";

  // ---- Make a new pair of keys (shown only to the admin on screen) ----
  if (body.action === "keys") {
    const k = webpush.generateVAPIDKeys();
    return NextResponse.json({ publicKey: k.publicKey, privateKey: k.privateKey });
  }

  // ---- How many people can be reached ----
  if (body.action === "stats") {
    const count = async (f: (q: any) => any) => {
      const r: any = await f(admin.from("push_subscriptions").select("id", { count: "exact", head: true }));
      return typeof r.count === "number" ? r.count : 0;
    };
    const all = await count((q) => q);
    const vendors = await count((q) => q.in("kind", ["vendor", "admin"]));
    const customers = await count((q) => q.eq("kind", "visitor"));
    return NextResponse.json({ ready: !!(pub && priv), all, vendors, customers });
  }

  // ---- Send ----
  if (body.action === "send") {
    if (!pub || !priv) {
      return NextResponse.json({ error: "Notification keys are not set up yet." }, { status: 400 });
    }
    const title = String(body.title || "").trim().slice(0, 50);
    const text = String(body.body || "").trim().slice(0, 140);
    if (!title || !text) return NextResponse.json({ error: "Write a title and a message." }, { status: 400 });
    const url = cleanUrl(body.url);
    const audience = String(body.audience || "me");
    const slug = String(body.slug || "").trim().toLowerCase();

    let q: any = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").limit(5000);
    if (audience === "me") q = q.eq("user_id", u.user.id);
    else if (audience === "vendors") q = q.in("kind", ["vendor", "admin"]);
    else if (audience === "customers") q = q.eq("kind", "visitor");
    else if (audience === "store") {
      if (!/^[a-z0-9_-]{1,60}$/.test(slug)) {
        return NextResponse.json({ error: "Type the store link name." }, { status: 400 });
      }
      q = q.eq("store_slug", slug);
    } else if (audience !== "all") {
      return NextResponse.json({ error: "Unknown audience." }, { status: 400 });
    }
    const { data: subs, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const list: any[] = subs || [];
    if (list.length === 0) return NextResponse.json({ sent: 0, failed: 0, removed: 0, note: "Nobody to send to yet." });

    let subject = process.env.SITE_URL || "";
    if (!subject.startsWith("https://")) subject = "https://mayn-sales-point-j59b.vercel.app";
    webpush.setVapidDetails(subject, pub, priv);
    const payload = JSON.stringify({ title, body: text, url });

    let sent = 0;
    let failed = 0;
    const dead: string[] = [];
    const okIds: string[] = [];
    for (let i = 0; i < list.length; i += 25) {
      const chunk = list.slice(i, i + 25);
      await Promise.all(
        chunk.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
              { TTL: 86400 }
            );
            sent++;
            okIds.push(s.id);
          } catch (e: any) {
            failed++;
            if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.push(s.id);
          }
        })
      );
    }
    if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
    if (okIds.length) {
      await admin.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).in("id", okIds.slice(0, 1000));
    }
    await admin.from("push_log").insert({ title, body: text, url, audience, sent, failed });
    return NextResponse.json({ sent, failed, removed: dead.length });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

// END OF FILE

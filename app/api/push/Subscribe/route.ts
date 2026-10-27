import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body: any = await request.json().catch(() => ({}));
  const sub = body && body.subscription ? body.subscription : {};
  const endpoint = String(sub.endpoint || "");
  const p256dh = String((sub.keys && sub.keys.p256dh) || "");
  const auth = String((sub.keys && sub.keys.auth) || "");
  if (!endpoint.startsWith("https://") || endpoint.length > 1000 || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }
  const slugRaw = String(body.storeSlug || "").toLowerCase();
  const storeSlug = /^[a-z0-9_-]{1,60}$/.test(slugRaw) ? slugRaw : null;

  let userId: string | null = null;
  let kind = "visitor";
  const admin: any = createAdminClient();
  try {
    const supabase: any = createClient();
    const { data: u } = await supabase.auth.getUser();
    if (u && u.user) {
      userId = u.user.id;
      const { data: p } = await admin.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
      kind = p && (p.role === "admin" || p.role === "super_admin") ? "admin" : "vendor";
    }
  } catch (e) {
    // Not signed in: stays a visitor.
  }

  const row: any = { endpoint, p256dh, auth, kind };
  if (userId) row.user_id = userId;
  if (storeSlug) row.store_slug = storeSlug;
  const { error } = await admin.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// END OF FILE

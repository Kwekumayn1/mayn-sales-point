import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createClient();
  const auth = await supabase.auth.getUser();
  const user = auth.data ? auth.data.user : null;
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  const prof: any = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = prof.data ? prof.data.role : "";
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const fullName = String(body.fullName || "").trim();
  const phone = String(body.phone || "").trim();

  if (!email || email.indexOf("@") < 1) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ error: "Enter the vendor's full name." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    return NextResponse.json({ error: "Server keys are missing." }, { status: 500 });
  }
  const headers: any = {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
  };

  const created = await fetch(url + "/auth/v1/admin/users", {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: phone },
    }),
  });
  const createdJson: any = await created.json().catch(() => ({}));
  if (!created.ok) {
    const msg = createdJson.msg || createdJson.message || createdJson.error_description || "Could not create the account.";
    return NextResponse.json({ error: String(msg) }, { status: 400 });
  }
  const newId = createdJson.id;

  // make them a 1st-level vendor (no parent)
  const patchHeaders: any = { ...headers, Prefer: "return=representation" };
  const upd = await fetch(url + "/rest/v1/profiles?id=eq." + newId, {
    method: "PATCH",
    headers: patchHeaders,
    body: JSON.stringify({ role: "vendor", parent_vendor_id: null, full_name: fullName, phone: phone || null }),
  });
  const updJson: any = await upd.json().catch(() => []);
  if (!upd.ok || !Array.isArray(updJson) || updJson.length === 0) {
    const m = (updJson && (updJson.message || updJson.hint)) || "Profile was not updated.";
    return NextResponse.json(
      { error: "Account created, but making it a vendor failed: " + m, userId: newId },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, vendorId: updJson[0].vendor_id, email: email });
}

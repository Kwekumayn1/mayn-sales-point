import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function levelOf(id: string, parentOf: Map<string, string | null>): number {
  let lvl = 1;
  let cur = parentOf.get(id) || null;
  const seen = new Set<string>([id]);
  while (cur && !seen.has(cur) && lvl < 20) {
    seen.add(cur);
    lvl++;
    cur = parentOf.get(cur) || null;
  }
  return lvl;
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

  // ---- Move a vendor under a different upline ----
  if (body.action === "preview_move" || body.action === "move") {
    const id = String(body.userId || "");
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return NextResponse.json({ error: "Account not found." }, { status: 400 });
    const rawParent = String(body.newParentId == null ? "" : body.newParentId).trim();
    if (!/^[0-9]{1,10}$/.test(rawParent)) {
      return NextResponse.json({ error: "Type the ID number of the new upline, or 0 for no upline." }, { status: 400 });
    }
    const { data: target } = await admin
      .from("profiles")
      .select("id, full_name, vendor_id, role, parent_vendor_id")
      .eq("id", id)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (target.role === "admin" || target.role === "super_admin") {
      return NextResponse.json({ error: "Admin accounts cannot be moved." }, { status: 400 });
    }

    const { data: everyone } = await admin.from("profiles").select("id, parent_vendor_id").limit(10000);
    const pOf = new Map<string, string | null>();
    const kidsOf = new Map<string, string[]>();
    (everyone || []).forEach((r: any) => {
      pOf.set(r.id, r.parent_vendor_id || null);
      if (r.parent_vendor_id) {
        const arr = kidsOf.get(r.parent_vendor_id) || [];
        arr.push(r.id);
        kidsOf.set(r.parent_vendor_id, arr);
      }
    });

    let np: any = null;
    if (rawParent !== "0") {
      const found = await admin
        .from("profiles")
        .select("id, full_name, vendor_id, role, blocked")
        .eq("vendor_id", rawParent)
        .limit(2);
      const list2: any[] = found.data || [];
      if (list2.length === 0) return NextResponse.json({ error: "No vendor has that ID number." }, { status: 404 });
      if (list2.length > 1) return NextResponse.json({ error: "More than one account has that ID number." }, { status: 400 });
      np = list2[0];
      if (np.role === "admin" || np.role === "super_admin") {
        return NextResponse.json({ error: "That is an admin account. Type 0 to place them directly under you." }, { status: 400 });
      }
      if (np.id === id) return NextResponse.json({ error: "A vendor cannot be under themselves." }, { status: 400 });
      // The new upline must not be someone who is already below this vendor.
      let cur: string | null = np.id;
      let guard = 0;
      while (cur && guard < 30) {
        if (cur === id) {
          return NextResponse.json(
            { error: "That vendor is already under this account, so it cannot become their upline." },
            { status: 400 }
          );
        }
        cur = pOf.get(cur) || null;
        guard++;
      }
    }
    const oldParentId: string | null = target.parent_vendor_id || null;
    if ((np ? np.id : null) === oldParentId) {
      return NextResponse.json({ error: "They are already under that upline." }, { status: 400 });
    }

    // Count everyone who moves along with this vendor.
    let moving = 0;
    const seen = new Set<string>([id]);
    const queue: string[] = [id];
    while (queue.length) {
      const cur = queue.shift() as string;
      (kidsOf.get(cur) || []).forEach((k) => {
        if (!seen.has(k)) {
          seen.add(k);
          moving++;
          queue.push(k);
        }
      });
    }
    const newLevel = np ? levelOf(np.id, pOf) + 1 : 1;

    if (body.action === "preview_move") {
      let oldName = "";
      if (oldParentId) {
        const { data: op } = await admin.from("profiles").select("full_name, vendor_id").eq("id", oldParentId).maybeSingle();
        oldName = op ? (op.full_name || "No name") + " (ID " + op.vendor_id + ")" : "Unknown";
      }
      return NextResponse.json({
        ok: true,
        preview: {
          name: target.full_name,
          vendor_id: target.vendor_id,
          from: oldParentId ? oldName : "Direct from you (no upline)",
          to: np ? (np.full_name || "No name") + " (ID " + np.vendor_id + ")" : "Direct from you (no upline)",
          new_level: newLevel,
          moving_with: moving,
          to_blocked: !!(np && np.blocked),
        },
      });
    }

    const { error: mErr } = await admin
      .from("profiles")
      .update({ parent_vendor_id: np ? np.id : null })
      .eq("id", id);
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    try {
      await admin.from("account_moves").insert({
        vendor_id: id,
        old_parent: oldParentId,
        new_parent: np ? np.id : null,
        moved_by: u.user.id,
        reason: String(body.reason || "").trim().slice(0, 200) || null,
      });
    } catch (e) {
      // The move itself succeeded; the history note is best effort.
    }
    return NextResponse.json({ ok: true, new_level: newLevel, moving_with: moving });
  }

  // ---- Block or unblock ----
  if (body.action === "block" || body.action === "unblock") {
    const id = String(body.userId || "");
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return NextResponse.json({ error: "Account not found." }, { status: 400 });
    if (id === u.user.id) return NextResponse.json({ error: "You cannot block your own account." }, { status: 400 });
    const { data: target } = await admin.from("profiles").select("id, role").eq("id", id).maybeSingle();
    if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (target.role === "admin" || target.role === "super_admin") {
      return NextResponse.json({ error: "Admin accounts cannot be blocked here." }, { status: 400 });
    }
    const block = body.action === "block";
    const reason = String(body.reason || "").trim().slice(0, 200);
    const { error: pErr } = await admin
      .from("profiles")
      .update({
        blocked: block,
        blocked_reason: block ? reason || null : null,
        blocked_at: block ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    const { error: aErr } = await admin.auth.admin.updateUserById(id, {
      ban_duration: block ? "876000h" : "none",
    });
    if (aErr) {
      return NextResponse.json(
        { error: "Marked in the system, but the login lock failed: " + aErr.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ---- Search / list ----
  const q = String(body.q || "").replace(/[%,()*\\]/g, " ").trim().slice(0, 60);
  const onlyBlocked = !!body.onlyBlocked;

  const { data: all } = await admin.from("profiles").select("id, parent_vendor_id").limit(10000);
  const parentOf = new Map<string, string | null>();
  const childCount = new Map<string, number>();
  (all || []).forEach((r: any) => {
    parentOf.set(r.id, r.parent_vendor_id || null);
    if (r.parent_vendor_id) childCount.set(r.parent_vendor_id, (childCount.get(r.parent_vendor_id) || 0) + 1);
  });

  function build(withOrder: boolean): any {
    let b = admin.from("profiles").select("*").limit(25);
    if (withOrder) b = b.order("created_at", { ascending: false });
    if (onlyBlocked) b = b.eq("blocked", true);
    return b;
  }
  let ids0: string[] | null = null;
  let orFilter = "";
  if (q) {
    if (q.includes("@")) {
      const { data: lu } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const ids = ((lu && lu.users) || [])
        .filter((x: any) => String(x.email || "").toLowerCase().includes(q.toLowerCase()))
        .map((x: any) => x.id);
      if (ids.length === 0) return NextResponse.json({ accounts: [] });
      ids0 = ids;
    } else {
      const parts = ["full_name.ilike.%" + q + "%", "phone.ilike.%" + q + "%", "storefront_slug.ilike.%" + q + "%"];
      if (/^[0-9]+$/.test(q)) parts.push("vendor_id.eq." + q);
      orFilter = parts.join(",");
    }
  }
  function finish(withOrder: boolean): any {
    let b = build(withOrder);
    if (ids0) b = b.in("id", ids0);
    if (orFilter) b = b.or(orFilter);
    return b;
  }
  let res: any = await finish(true);
  if (res.error) res = await finish(false);
  const { data: rows, error } = res;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const list: any[] = rows || [];
  const ids = list.map((r) => r.id);
  if (ids.length === 0) return NextResponse.json({ accounts: [] });

  const parentIds = Array.from(new Set(list.map((r) => r.parent_vendor_id).filter(Boolean)));
  const [parents, kids, wallets, orders] = await Promise.all([
    parentIds.length
      ? admin.from("profiles").select("id, full_name, vendor_id, phone").in("id", parentIds)
      : Promise.resolve({ data: [] }),
    admin.from("profiles").select("id, full_name, vendor_id, parent_vendor_id").in("parent_vendor_id", ids).limit(500),
    admin.from("wallet_transactions").select("vendor_id, wallet_type, amount").in("vendor_id", ids).limit(20000),
    admin.from("orders").select("vendor_id, status").in("vendor_id", ids).limit(20000),
  ]);

  const parentMap = new Map<string, any>();
  (parents.data || []).forEach((p: any) => parentMap.set(p.id, p));

  const emails = new Map<string, string>();
  await Promise.all(
    ids.slice(0, 25).map(async (id) => {
      const r = await admin.auth.admin.getUserById(id);
      if (r && r.data && r.data.user) emails.set(id, r.data.user.email || "");
    })
  );

  const out = list.map((r) => {
    const w = (wallets.data || []).filter((x: any) => x.vendor_id === r.id);
    const sum = (t: string) => w.filter((x: any) => x.wallet_type === t).reduce((a: number, x: any) => a + Number(x.amount || 0), 0);
    const o = (orders.data || []).filter((x: any) => x.vendor_id === r.id);
    const paidStatuses = ["paid", "processed", "delivered"];
    const par = r.parent_vendor_id ? parentMap.get(r.parent_vendor_id) : null;
    return {
      id: r.id,
      full_name: r.full_name,
      phone: r.phone,
      email: emails.get(r.id) || "",
      role: r.role,
      vendor_id: r.vendor_id,
      storefront_slug: r.storefront_slug,
      created_at: r.created_at || null,
      blocked: !!r.blocked,
      blocked_reason: r.blocked_reason || null,
      level: levelOf(r.id, parentOf),
      upline: par ? { name: par.full_name, vendor_id: par.vendor_id, phone: par.phone } : null,
      downline_count: childCount.get(r.id) || 0,
      downline: (kids.data || [])
        .filter((k: any) => k.parent_vendor_id === r.id)
        .slice(0, 15)
        .map((k: any) => ({ name: k.full_name, vendor_id: k.vendor_id })),
      purchase_balance: sum("purchase"),
      profit_balance: sum("profit"),
      orders_total: o.length,
      orders_paid: o.filter((x: any) => paidStatuses.includes(x.status)).length,
    };
  });

  return NextResponse.json({ accounts: out });
}

// END OF FILE

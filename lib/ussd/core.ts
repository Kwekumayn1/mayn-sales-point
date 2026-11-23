import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms as sendSmsViaProviders } from "@/lib/sms/provider";

export const PAGE_SIZE = 5;
export const MAX_ORDERS_PER_HOUR = 5;

export type Item = {
  kind: "variant" | "product";
  id: string;
  label: string;
  price: number;
  field: string;
};
export type Step = { message: string; end: boolean; state: string; data: any };

// Uzo: 2 = continuing response, 17 = final response
export function reply(message: string, end: boolean) {
  return NextResponse.json({
    message: message.slice(0, 182),
    ussdServiceOp: end ? 17 : 2,
  });
}

export function keyOk(given: string | null): boolean {
  const secret = process.env.USSD_SECRET || "";
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getAdmin(): any {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

// 233XXXXXXXXX, or "" when not a valid Ghana number
export function normalizePhone(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.indexOf("00233") === 0) d = d.slice(2);
  if (d.indexOf("233") === 0 && d.length === 12) return d;
  if (d.charAt(0) === "0" && d.length === 10) return "233" + d.slice(1);
  if (d.length === 9) return "233" + d;
  return "";
}

// 0XXXXXXXXX, or null
export function localPhone(raw: string): string | null {
  const n = normalizePhone(raw);
  return n ? "0" + n.slice(3) : null;
}

export function siteShort(): string {
  const raw = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

// The vendor's extension from the dialled code, e.g. *426*116# gives 116
export function extractExtension(body: any): string {
  const candidates = [String(body?.ussdString ?? ""), String(body?.code ?? "")];
  for (const c of candidates) {
    const m = c.trim().match(/^\*\d+\*(\d{1,8})#?$/);
    if (m) return m[1];
  }
  return "";
}

export async function lookupVendor(
  admin: any,
  code: string
): Promise<{ id: string; name: string } | null> {
  const digits = String(code || "").trim();
  if (!/^[0-9]{1,8}$/.test(digits)) return null;
  const { data: p } = await admin
    .from("profiles")
    .select("id, full_name, blocked")
    .eq("vendor_id", digits)
    .maybeSingle();
  if (!p || p.blocked === true) return null;
  const name = String(p.full_name || "Mayn Sales Point").trim().slice(0, 24);
  return { id: String(p.id), name: name || "Mayn Sales Point" };
}

export async function getCategories(
  admin: any
): Promise<{ id: string; label: string }[]> {
  const { data } = await admin
    .from("product_categories")
    .select("id, ussd_label, ussd_sort")
    .not("ussd_label", "is", null)
    .order("ussd_sort", { ascending: true });
  return ((data ?? []) as any[])
    .filter((c) => c.ussd_label && String(c.ussd_label).trim() !== "")
    .map((c) => ({ id: String(c.id), label: String(c.ussd_label).trim() }));
}

function isPhoneField(f: any): boolean {
  const label = String(f.label || "");
  if (/card/i.test(label)) return false;
  return (
    f.field_type === "tel" ||
    /(number|phone|tel|beneficiary|mobile|contact|recipient)/i.test(label)
  );
}

// Everything this vendor sells in one network category, cheapest first
async function getItems(
  admin: any,
  vendorId: string,
  categoryId: string
): Promise<Item[]> {
  const { data: prods } = await admin
    .from("products")
    .select("id, name")
    .eq("category_id", categoryId)
    .eq("is_active", true);
  const products: any[] = prods ?? [];
  if (products.length === 0) return [];
  const pids = products.map((p) => p.id);

  // Only products that ask for exactly one thing: a phone number
  const { data: fieldRows } = await admin
    .from("product_fields")
    .select("product_id, label, field_type")
    .in("product_id", pids);
  const fieldCount: Record<string, number> = {};
  const phoneLabel: Record<string, string> = {};
  for (const f of (fieldRows ?? []) as any[]) {
    const pid = String(f.product_id);
    fieldCount[pid] = (fieldCount[pid] || 0) + 1;
    if (isPhoneField(f)) phoneLabel[pid] = String(f.label);
  }
  const eligible = products.filter(
    (p) => fieldCount[String(p.id)] === 1 && phoneLabel[String(p.id)]
  );
  if (eligible.length === 0) return [];
  const eids = eligible.map((p) => p.id);

  const { data: variantRows } = await admin
    .from("product_variants")
    .select("id, name, product_id, is_active")
    .in("product_id", eids);
  const variants: any[] = variantRows ?? [];

  const vprice: Record<string, number> = {};
  if (variants.length > 0) {
    const { data: vp } = await admin
      .from("vendor_variant_prices")
      .select("variant_id, selling_price")
      .eq("vendor_id", vendorId)
      .in(
        "variant_id",
        variants.map((v) => v.id)
      );
    for (const r of (vp ?? []) as any[]) {
      vprice[String(r.variant_id)] = Number(r.selling_price);
    }
  }
  const pprice: Record<string, number> = {};
  const { data: pp } = await admin
    .from("vendor_prices")
    .select("product_id, selling_price")
    .eq("vendor_id", vendorId)
    .in("product_id", eids);
  for (const r of (pp ?? []) as any[]) {
    pprice[String(r.product_id)] = Number(r.selling_price);
  }

  const items: Item[] = [];
  for (const p of eligible) {
    const pid = String(p.id);
    const field = phoneLabel[pid];
    const vs = variants.filter((v) => String(v.product_id) === pid);
    if (vs.length > 0) {
      for (const v of vs) {
        const price = vprice[String(v.id)];
        if (v.is_active === true && price > 0) {
          items.push({
            kind: "variant",
            id: String(v.id),
            label: String(v.name).trim().slice(0, 22),
            price,
            field,
          });
        }
      }
    } else {
      const price = pprice[pid];
      if (price > 0) {
        items.push({
          kind: "product",
          id: pid,
          label: String(p.name).trim().slice(0, 22),
          price,
          field,
        });
      }
    }
  }
  items.sort((a, b) => a.price - b.price || a.label.localeCompare(b.label));
  return items;
}

export async function renderPackages(admin: any, data: any, page: number) {
  const items = await getItems(admin, data.vendorId, data.categoryId);
  if (items.length === 0) return null;
  const pages = Math.ceil(items.length / PAGE_SIZE);
  const p = Math.min(Math.max(page, 1), pages);
  const slice = items.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  const hasMore = p < pages;
  // "1GB" is shown as "1", "2GB" as "2", "1.5GB" as "1.5"
  const lines = slice.map(
    (it, i) =>
      i + 1 + " " + it.label.replace(/(\d+(?:\.\d+)?)\s*gb\b/gi, "$1") + " " + it.price.toFixed(2)
  );
  const text =
    "Select package\n" + lines.join("\n") + "\n" + (hasMore ? "0 More" : "0 Back");
  return { text, pageItems: slice, page: p, hasMore };
}

function statusLabel(s: string): string {
  if (s === "pending_payment") return "Awaiting payment";
  if (s === "paid" || s === "processed") return "Processing";
  if (s === "delivered" || s === "completed") return "Delivered";
  return s;
}

export async function orderStatusText(
  admin: any,
  msisdn: string
): Promise<string> {
  const none = "No orders found for this number.";
  if (!msisdn) return none;
  const { data: rows } = await admin
    .from("ussd_orders")
    .select("order_number")
    .eq("msisdn", msisdn)
    .order("created_at", { ascending: false })
    .limit(3);
  const nums = ((rows ?? []) as any[]).map((r) => String(r.order_number));
  if (nums.length === 0) return none;
  const { data: orders } = await admin
    .from("orders")
    .select("order_number, status, unit_price")
    .in("order_number", nums);
  const byNumber: Record<string, any> = {};
  for (const o of (orders ?? []) as any[]) {
    byNumber[String(o.order_number)] = o;
  }
  const lines: string[] = [];
  for (const n of nums) {
    const o = byNumber[n];
    if (!o) continue;
    lines.push(
      n.slice(-6) + " " + Number(o.unit_price).toFixed(2) + " " + statusLabel(String(o.status))
    );
  }
  return lines.length > 0 ? "Your recent orders\n" + lines.join("\n") : none;
}

// Sends through the SMS providers (Moolre first, MaynData as backup,
// in the order the admin chose on the SMS provider page)
export async function sendSms(
  phone: string,
  message: string,
  ref: string
): Promise<boolean> {
  if (!phone) return false;
  return await sendSmsViaProviders(phone, message, ref);
}

// END OF FILE

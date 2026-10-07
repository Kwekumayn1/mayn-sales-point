"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUS_OPTIONS = [
  "pending_payment",
  "paid",
  "processing",
  "awaiting_fulfillment",
  "completed",
  "delivered",
  "cancelled",
  "refunded",
  "failed",
];

// Statuses that count as "paid" when no specific status filter is chosen —
// anything the customer actually completed payment for, regardless of how
// far along fulfillment is.
const PAID_STATUSES = ["paid", "processing", "awaiting_fulfillment", "completed", "delivered"];

function sanitizeSheetName(name: string, used: Set<string>) {
  let base = name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Product";
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
    setAllowed(isAdmin);

    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_phone, unit_price, base_price, status, created_at, custom_field_values, products(name), product_variants(name), profiles(full_name)"
      )
      .order("created_at", { ascending: false });

    setOrders(data ?? []);
    setLoading(false);
  }

  async function handleStatusChange(orderId: string, status: string) {
    setUpdatingId(orderId);
    const supabase = createClient();
    await supabase.from("orders").update({ status }).eq("id", orderId);
    setUpdatingId(null);
    void load();
  }

  const productOptions = useMemo(() => {
    const names = new Set<string>();
    orders.forEach((o) => {
      if (o.products?.name) names.add(o.products.name);
    });
    return Array.from(names).sort();
  }, [orders]);

  function getFilteredOrders() {
    return orders.filter((o) => {
      if (productFilter !== "all" && o.products?.name !== productFilter) return false;

      if (statusFilter === "all") {
        if (!PAID_STATUSES.includes(o.status)) return false;
      } else if (o.status !== statusFilter) {
        return false;
      }

      if (dateFrom && new Date(o.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(o.created_at) > to) return false;
      }

      return true;
    });
  }

  async function handleExport() {
    setExportError(null);
    const filtered = getFilteredOrders();

    if (filtered.length === 0) {
      setExportError("No orders match the current filters.");
      return;
    }

    setExporting(true);
    try {
      const XLSX = await import("xlsx");

      // Group by product name — each product gets its own sheet, since
      // different products collect different custom fields.
      const byProduct: Record<string, any[]> = {};
      filtered.forEach((o) => {
        const name = o.products?.name ?? "Unknown product";
        byProduct[name] = byProduct[name] ?? [];
        byProduct[name].push(o);
      });

      const workbook = XLSX.utils.book_new();
      const usedNames = new Set<string>();

      Object.entries(byProduct).forEach(([productName, productOrders]) => {
        const fieldLabels: string[] = [];
        productOrders.forEach((o) => {
          const values = o.custom_field_values || {};
          Object.keys(values).forEach((label) => {
            if (!fieldLabels.includes(label)) fieldLabels.push(label);
          });
        });

        const rows = productOrders.map((o) => {
          const row: Record<string, any> = {
            "Order Number": o.order_number,
            Date: new Date(o.created_at).toLocaleDateString(),
            Status: o.status.replace(/_/g, " "),
            "Sub-product": o.product_variants?.name ?? "",
          };
          const values = o.custom_field_values || {};
          fieldLabels.forEach((label) => {
            row[label] = values[label] ?? "";
          });
          return row;
        });

        const sheet = XLSX.utils.json_to_sheet(rows);
        const sheetName = sanitizeSheetName(productName, usedNames);
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      });

      const dateStamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `mayn-sales-point-orders-${dateStamp}.xlsx`);
    } catch (e: any) {
      setExportError(e?.message || "Could not export orders.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-sm text-ink/60">
        Loading…
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-sm text-ink/60">
        You do not have access to this page.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Admin</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">All Orders</h1>

      <div className="mt-6 border border-line bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-ink/50">
          Export filters
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="text-xs text-ink/50">Product</label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            >
              <option value="all">All products</option>
              {productOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink/50">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            >
              <option value="all">Any paid status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink/50">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            />
          </div>
          <div>
            <label className="text-xs text-ink/50">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            />
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="mt-4 rounded-pill bg-indigo px-5 py-2 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
        >
          {exporting ? "Exporting…" : "Export to Excel"}
        </button>
        {exportError && <p className="mt-2 text-sm text-red-600">{exportError}</p>}
      </div>

      {orders.length === 0 && (
        <p className="mt-8 text-sm text-ink/60">No orders yet.</p>
      )}

      <div className="mt-8 divide-y divide-line border-t border-line">
        {orders.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium">
                {o.products?.name ?? "Product"}
                {o.product_variants?.name ? ` — ${o.product_variants.name}` : ""}
              </p>
              <p className="text-xs text-ink/50">
                {o.order_number} · Vendor: {o.profiles?.full_name ?? "Unknown"}
              </p>
              {(o.customer_name || o.customer_phone) && (
                <p className="text-xs text-ink/50">
                  {[o.customer_name, o.customer_phone].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="text-xs text-ink/50">
                Base GH₵{Number(o.base_price).toFixed(2)} · Sold GH₵
                {Number(o.unit_price).toFixed(2)} ·{" "}
                {new Date(o.created_at).toLocaleDateString()}
              </p>
              {o.custom_field_values && Object.keys(o.custom_field_values).length > 0 && (
                <p className="mt-1 text-xs text-ink/50">
                  {Object.entries(o.custom_field_values)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </p>
              )}
            </div>
            <select
              value={o.status}
              disabled={updatingId === o.id}
              onChange={(e) => handleStatusChange(o.id, e.target.value)}
              className="border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </main>
  );
         }

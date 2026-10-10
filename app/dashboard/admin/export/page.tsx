"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { order_id: string; phone: string; item: string };
type Cat = { id: string; name: string };

export default function ExportOrdersPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [cat, setCat] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const supabase: any = createClient();
    (async () => {
      const { data } = await supabase
        .from("product_categories")
        .select("id, name")
        .order("name", { ascending: true });
      setCats((data as Cat[]) || []);
    })();
  }, []);

  async function loadRows() {
    const supabase: any = createClient();
    setBusy(true);
    setErr("");
    setMsg("");
    const { data, error } = await supabase.rpc("admin_export_orders", {
      p_category: cat ? cat : null,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setRows((data as Row[]) || []);
    setLoaded(true);
  }

  async function exportNow() {
    if (rows.length === 0) return;
    const supabase: any = createClient();
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const XLSX = await import("xlsx");
      const heading = "Number : data size";
      const aoa: string[][] = [[heading]];
      rows.forEach((r) => aoa.push([r.phone + " : " + r.item]));
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [{ wch: 34 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders");
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      XLSX.writeFile(wb, "orders-" + stamp + ".xlsx");

      const ids = rows.map((r) => r.order_id);
      const { data, error } = await supabase.rpc("admin_mark_orders_processed", {
        p_ids: ids,
      });
      if (error) throw new Error(error.message);
      setMsg(
        "Exported " + rows.length + " orders. " + String(data) + " marked as processed."
      );
      setRows([]);
      setLoaded(false);
    } catch (e: any) {
      setErr(e && e.message ? e.message : "Export failed");
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold">Export orders</h1>
      <p className="text-sm">
        Only orders paid successfully and not exported before are included. After
        export they are marked as processed.
      </p>

      <div className="space-y-2 rounded-xl border p-4">
        <label className="block text-sm font-semibold">Product category</label>
        <select
          value={cat}
          onChange={(e) => {
            setCat(e.target.value);
            setLoaded(false);
            setRows([]);
          }}
          className="w-full rounded-lg border p-2"
        >
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={loadRows}
          disabled={busy}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Please wait..." : "Check new paid orders"}
        </button>
      </div>

      {err && <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700">{err}</div>}
      {msg && <div className="rounded-lg bg-green-100 p-3 text-sm text-green-800">{msg}</div>}

      {loaded && (
        <div className="space-y-3 rounded-xl border p-4">
          <div className="text-sm font-semibold">
            {rows.length} new paid order{rows.length === 1 ? "" : "s"} ready
          </div>
          {rows.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg bg-gray-50 p-2 text-sm">
              {rows.map((r) => (
                <div key={r.order_id}>
                  {r.phone} : {r.item}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={exportNow}
            disabled={busy || rows.length === 0}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Download Excel and mark processed
          </button>
        </div>
      )}
    </main>
  );
    }

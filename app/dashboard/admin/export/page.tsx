"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function cleanNumber(raw: any): string {
  let d = String(raw || "").replace(/[^0-9]/g, "");
  if (d.length === 12 && d.startsWith("233")) d = "0" + d.slice(3);
  if (d.length === 9) d = "0" + d;
  return d;
}

function readGb(item: any): any {
  const m = String(item || "").match(/(\d+(?:\.\d+)?)\s*(tb|gb|mb)/i);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u === "tb") return n * 1000;
  if (u === "mb") return n / 1000;
  return n;
}

function sheetName(name: string, used: any): string {
  let base = String(name || "Orders").replace(/[\[\]:*?\/\\]/g, " ").trim();
  if (base === "") base = "Orders";
  base = base.slice(0, 28);
  let out = base;
  let i = 2;
  while (used[out]) {
    out = base + " " + i;
    i = i + 1;
  }
  used[out] = true;
  return out;
}

export default function ExportOrdersPage() {
  const [cats, setCats] = useState<any>([]);
  const [cat, setCat] = useState("");
  const [rows, setRows] = useState<any>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [lastFile, setLastFile] = useState<any>(null);

  useEffect(() => {
    const supabase: any = createClient();
    (async () => {
      const { data } = await supabase
        .from("product_categories")
        .select("id, name")
        .order("name", { ascending: true });
      setCats(data || []);
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
    setRows(data || []);
    setLoaded(true);
  }

  function saveBlob(blob: any, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function exportNow() {
    if (rows.length === 0) return;
    const supabase: any = createClient();
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const XLSX: any = await import("xlsx");
      const groups: any = {};
      const order: any = [];
      rows.forEach((r: any) => {
        const key = r.product || "Orders";
        if (!groups[key]) {
          groups[key] = [];
          order.push(key);
        }
        groups[key].push(r);
      });
      const wb = XLSX.utils.book_new();
      const used: any = {};
      order.forEach((key: string) => {
        const list = groups[key];
        const allGb = list.every((r: any) => readGb(r.item) !== null);
        const aoa: any = [["NUMBER", allGb ? "DATA(GB)" : "ITEM"]];
        list.forEach((r: any) => {
          const gb = readGb(r.item);
          aoa.push([cleanNumber(r.phone), allGb ? gb : String(r.item || "")]);
        });
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws["!cols"] = [{ wch: 16 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, ws, sheetName(key, used));
      });
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const fileName = "agent_orders-" + stamp + ".xlsx";
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const ids = rows.map((r: any) => r.order_id);
      const { data, error } = await supabase.rpc("admin_mark_orders_processed", {
        p_ids: ids,
      });
      if (error) throw new Error(error.message);

      const count = rows.length;
      setLastFile({ blob: blob, name: fileName });
      setRows([]);
      setLoaded(false);
      setMsg(
        "Exported " + count + " orders. " + String(data) + " marked as processed. If the download did not start, tap Download again below."
      );
      saveBlob(blob, fileName);
    } catch (e: any) {
      setErr(e && e.message ? e.message : "Export failed");
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold">Export orders</h1>
      <p className="text-sm">
        Only orders paid successfully and not exported before are included. Each
        product gets its own sheet with NUMBER and DATA(GB). After export the orders
        are marked as processed.
      </p>

      <div className="space-y-2 rounded-xl border p-4">
        <label className="block text-sm font-semibold">Product category</label>
        <select
          value={cat}
          onChange={(e: any) => {
            setCat(e.target.value);
            setLoaded(false);
            setRows([]);
          }}
          className="w-full rounded-lg border p-2"
        >
          <option value="">All categories</option>
          {cats.map((c: any) => (
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

      {lastFile && (
        <div className="rounded-xl border p-4">
          <button
            onClick={() => saveBlob(lastFile.blob, lastFile.name)}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white"
          >
            Download again ({lastFile.name})
          </button>
        </div>
      )}

      {loaded && (
        <div className="space-y-3 rounded-xl border p-4">
          <div className="text-sm font-semibold">
            {rows.length} new paid order{rows.length === 1 ? "" : "s"} ready
          </div>
          {rows.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg bg-gray-50 p-2 text-sm">
              {rows.map((r: any) => (
                <div key={r.order_id}>
                  {r.product} | {cleanNumber(r.phone)} | {r.item}
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

// END OF FILE

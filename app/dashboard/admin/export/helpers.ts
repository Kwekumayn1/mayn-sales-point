export function cleanNumber(raw: any): string {
  let d = String(raw || "").replace(/[^0-9]/g, "");
  if (d.length === 12 && d.startsWith("233")) d = "0" + d.slice(3);
  if (d.length === 9) d = "0" + d;
  return d;
}

export function isPhoneKey(k: string): boolean {
  return /(number|phone|beneficiary|recipient|msisdn|contact|mobile|tel)/i.test(k);
}

export function fieldKeys(list: any): any {
  const keys: any = [];
  list.forEach((r: any) => {
    const f = r.fields || {};
    Object.keys(f).forEach((k: string) => {
      if (keys.indexOf(k) < 0) keys.push(k);
    });
  });
  const phones = keys.filter((k: string) => isPhoneKey(k));
  const others = keys.filter((k: string) => !isPhoneKey(k));
  return phones.concat(others);
}

export function headerName(k: string, i: number): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(k)) return "DETAIL " + (i + 1);
  return String(k).toUpperCase();
}

export function allValues(r: any): string {
  const f = r.fields || {};
  const vals = Object.keys(f)
    .map((k: string) => (isPhoneKey(k) ? cleanNumber(f[k]) : String(f[k] || "")))
    .filter((v: string) => v !== "");
  return vals.length > 0 ? vals.join(" | ") : cleanNumber(r.phone);
}

export function readGb(item: any): any {
  const m = String(item || "").match(/(\d+(?:\.\d+)?)\s*(tb|gb|mb)/i);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u === "tb") return n * 1000;
  if (u === "mb") return n / 1000;
  return n;
}

export function sheetName(name: string, used: any): string {
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

// END OF FILE

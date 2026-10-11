// Puts options in a sensible order: data sizes from smallest to largest
// (1GB, 2GB, 10GB, 100GB), then by price, then by name.

function sizeInGb(name: string) {
  const m = String(name || "").match(/([0-9]+(?:\.[0-9]+)?)\s*(tb|gb|mb)/i);
  if (!m) return -1;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "tb") return n * 1024;
  if (unit === "mb") return n / 1024;
  return n;
}

export function sortVariants(list: any[], costOf: (v: any) => number) {
  const copy = list.slice();
  copy.sort((a: any, b: any) => {
    const sa = sizeInGb(a.name);
    const sb = sizeInGb(b.name);
    if (sa !== sb) {
      if (sa === -1) return 1;
      if (sb === -1) return -1;
      return sa - sb;
    }
    const pa = costOf(a);
    const pb = costOf(b);
    if (pa !== pb) return pa - pb;
    return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
  });
  return copy;
}

// END OF FILE

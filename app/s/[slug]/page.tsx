"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Variant = { id: string; name: string; price: number };
type Card = {
  key: string;
  productId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  directPrice: number | null;
  variants: Variant[];
};

function pick(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

const PRICE_KEYS = ["selling_price", "price", "vendor_price", "custom_price", "sell_price"];

export default function StorefrontPage({ params }: { params: { slug: string } }) {
  const [vendor, setVendor] = useState<any>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [debug, setDebug] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const wanted = decodeURIComponent(params.slug).trim().toLowerCase();
      let v: any = null;

      const all = await supabase.from("storefronts").select("*").limit(1000);
      if (all.error) {
        setDebug("storefronts: " + all.error.message);
        setNotFound(true);
        setLoading(false);
        return;
      }
      const rows: any[] = all.data || [];
      v =
        rows.find((r) =>
          Object.values(r).some(
            (x) => typeof x === "string" && x.trim().toLowerCase() === wanted
          )
        ) || null;

      if (!v) {
        const cols = rows.length > 0 ? Object.keys(rows[0]).join(", ") : "none";
        setDebug("rows: " + rows.length + " | columns: " + cols + " | looking for: " + wanted);
        setNotFound(true);
        setLoading(false);
        return;
      }
      setVendor(v);
      const vendorId = pick(v, ["vendor_id", "user_id", "profile_id", "id"]);

      const map = new Map<string, Card>();

      const { data: vp, error: vpErr } = await supabase
        .from("vendor_prices")
        .select("*, products(*)")
        .eq("vendor_id", vendorId);
      if (vpErr) setDebug("prices: " + vpErr.message);
      (vp || []).forEach((row: any) => {
        const p = row.products;
        if (!p || p.is_active === false) return;
        const price = Number(pick(row, PRICE_KEYS));
        map.set(p.id, {
          key: p.id,
          productId: p.id,
          name: p.name,
          description: p.description ?? null,
          imageUrl: p.image_url ?? null,
          directPrice: price,
          variants: [],
        });
      });

      const { data: vv, error: vvErr } = await supabase
        .from("vendor_variant_prices")
        .select("*, product_variants(*, products(*))")
        .eq("vendor_id", vendorId);
      if (vvErr) setDebug((d) => d + " variants: " + vvErr.message);
      (vv || []).forEach((row: any) => {
        const pv = row.product_variants;
        const p = pv?.products;
        if (!pv || !p || p.is_active === false || pv.is_active === false) return;
        const price = Number(pick(row, PRICE_KEYS));
        const existing: Card = map.get(p.id) || {
          key: p.id,
          productId: p.id,
          name: p.name,
          description: p.description ?? null,
          imageUrl: p.image_url ?? null,
          directPrice: null,
          variants: [],
        };
        existing.variants.push({
          id: pv.id,
          name: pick(pv, ["name", "label", "title"]) ?? "Option",
          price,
        });
        map.set(p.id, existing);
      });

      setCards(Array.from(map.values()));
      setLoading(false);
    })();
  }, [params.slug]);

  if (loading) return <main className="p-8 text-center text-indigo-light">Loading…</main>;
  if (notFound)
    return (
      <main className="p-8 text-center">
        <div>This store was not found.</div>
        {debug && <div className="mt-3 break-words text-xs text-ink/50">{debug}</div>}
      </main>
    );

  const vendorId = pick(vendor, ["vendor_id", "user_id", "profile_id", "id"]);
  const storeName = pick(vendor, ["full_name", "store_name", "name", "display_name", "storefront_slug"]);
  const open = cards.find((c) => c.key === openKey) || null;

  function selectedVariant(c: Card): Variant | undefined {
    return c.variants.find((x) => x.id === variantId[c.key]) || c.variants[0];
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      <header className="-mx-4 mb-5 bg-indigo px-5 py-6 text-white shadow-md">
        <h1 className="text-2xl">{storeName}</h1>
        <p className="mt-1 text-sm text-white/80">Tap a product to choose and buy</p>
      </header>

      {cards.length === 0 && (
        <p className="py-10 text-center text-sm text-ink/60">
          No products available yet.
          {debug && <span className="mt-2 block break-words text-xs">{debug}</span>}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => {
          const fromPrice = c.variants.length
            ? Math.min(...c.variants.map((x) => x.price))
            : c.directPrice;
          const active = openKey === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setOpenKey(active ? null : c.key)}
              className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition active:scale-95 ${
                active ? "border-gold ring-2 ring-gold" : "border-line"
              }`}
            >
              <div className="aspect-square w-full bg-paper">
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl text-indigo-light/40">▢</div>
                )}
              </div>
              <div className="p-2.5">
                <div className="line-clamp-2 text-sm font-semibold leading-tight">{c.name}</div>
                <div className="mt-1 text-sm font-bold text-indigo">
                  {c.variants.length ? "From " : ""}GH₵ {Number(fromPrice).toFixed(2)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white p-4 shadow-2xl">
          <div className="mx-auto flex max-w-xl flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold">{open.name}</div>
                {open.description && (
                  <div className="mt-0.5 text-xs text-ink/60">{open.description}</div>
                )}
              </div>
              <button
                onClick={() => setOpenKey(null)}
                className="rounded-pill bg-paper px-3 py-1 text-sm"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {open.variants.length > 0 && (
              <select
                value={selectedVariant(open)?.id}
                onChange={(e) => setVariantId({ ...variantId, [open.key]: e.target.value })}
                className="w-full rounded-xl border border-line bg-white p-3 text-base"
              >
                {open.variants.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} — GH₵ {x.price.toFixed(2)}
                  </option>
                ))}
              </select>
            )}

            {(() => {
              const sv = open.variants.length ? selectedVariant(open) : undefined;
              const price = sv ? sv.price : open.directPrice;
              const href = sv
                ? `/checkout?vendor=${vendorId}&variant=${sv.id}`
                : `/checkout?vendor=${vendorId}&product=${open.productId}`;
              return (
                <a
                  href={href}
                  className="block rounded-pill bg-gold py-3 text-center text-base font-bold text-white shadow"
                >
                  Buy now · GH₵ {Number(price).toFixed(2)}
                </a>
              );
            })()}
          </div>
        </div>
      )}
    </main>
  );
    }

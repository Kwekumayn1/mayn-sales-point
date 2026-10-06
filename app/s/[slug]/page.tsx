"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Variant = { variantId: string; name: string; price: number };
type Card = {
  productId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  variants: Variant[];
  directPrice: number | null;
};

export default function StorefrontPage({ params }: { params: { slug: string } }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();

    const { data: vendorRow } = await supabase
      .from("storefronts")
      .select("vendor_id, full_name, storefront_slug")
      .eq("storefront_slug", params.slug)
      .single();

    if (!vendorRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setVendorId(vendorRow.vendor_id);
    setVendorName(vendorRow.full_name ?? "Vendor");

    const cardMap: Record<string, Card> = {};

    const { data: directPrices } = await supabase
      .from("vendor_prices")
      .select("selling_price, products(id, name, description, image_url, is_active)")
      .eq("vendor_id", vendorRow.vendor_id);

    (directPrices ?? []).forEach((row: any) => {
      const p = row.products;
      if (!p || !p.is_active) return;
      cardMap[p.id] = {
        productId: p.id,
        name: p.name,
        description: p.description,
        imageUrl: p.image_url,
        variants: [],
        directPrice: Number(row.selling_price),
      };
    });

    const { data: variantPrices } = await supabase
      .from("vendor_variant_prices")
      .select(
        "selling_price, product_variants(id, name, is_active, product_id, products(id, name, description, image_url, is_active))"
      )
      .eq("vendor_id", vendorRow.vendor_id);

    (variantPrices ?? []).forEach((row: any) => {
      const v = row.product_variants;
      const p = v?.products;
      if (!v || !v.is_active || !p || !p.is_active) return;

      if (!cardMap[p.id]) {
        cardMap[p.id] = {
          productId: p.id,
          name: p.name,
          description: p.description,
          imageUrl: p.image_url,
          variants: [],
          directPrice: null,
        };
      }
      cardMap[p.id].variants.push({
        variantId: v.id,
        name: v.name,
        price: Number(row.selling_price),
      });
    });

    const cardList = Object.values(cardMap);
    setCards(cardList);

    const defaults: Record<string, string> = {};
    cardList.forEach((c) => {
      if (c.variants.length > 0) defaults[c.productId] = c.variants[0].variantId;
    });
    setSelectedVariant(defaults);

    setLoading(false);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink/60">
        Loading…
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-2xl text-indigo">Storefront not found</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">
        Mayn Sales Point Vendor
      </p>
      <h1 className="mt-1 font-display text-2xl text-indigo">
        {vendorName} — Storefront
      </h1>

      {cards.length === 0 && (
        <p className="mt-8 text-sm text-ink/60">
          This vendor has not added any products yet.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const hasVariants = card.variants.length > 0;
          const currentVariantId = selectedVariant[card.productId];
          const currentVariant = card.variants.find((v) => v.variantId === currentVariantId);
          const displayPrice = hasVariants ? currentVariant?.price : card.directPrice;

          const buyHref = hasVariants
            ? `/checkout?vendor=${vendorId}&variant=${currentVariantId}`
            : `/checkout?vendor=${vendorId}&product=${card.productId}`;

          return (
            <div key={card.productId} className="border border-line bg-white">
              {card.imageUrl && (
                <img src={card.imageUrl} alt="" className="h-40 w-full object-cover" />
              )}
              <div className="p-5">
                <p className="font-medium">{card.name}</p>
                {card.description && (
                  <p className="mt-1 text-sm text-ink/60">{card.description}</p>
                )}

                {hasVariants && (
                  <select
                    value={currentVariantId}
                    onChange={(e) =>
                      setSelectedVariant((prev) => ({
                        ...prev,
                        [card.productId]: e.target.value,
                      }))
                    }
                    className="mt-3 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
                  >
                    {card.variants.map((v) => (
                      <option key={v.variantId} value={v.variantId}>
                        {v.name} — GH₵{v.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                )}

                {displayPrice !== undefined && displayPrice !== null && (
                  <p className="mt-3 font-display text-lg text-indigo">
                    GH₵{displayPrice.toFixed(2)}
                  </p>
                )}

                <a
                  href={buyHref}
                  className="mt-3 block w-full rounded-pill bg-indigo px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-light"
                >
                  Buy
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
            }

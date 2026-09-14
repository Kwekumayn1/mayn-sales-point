import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function StorefrontPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createClient();

  const { data: vendor } = await supabase
    .from("storefronts")
    .select("vendor_id, full_name, storefront_slug")
    .eq("storefront_slug", params.slug)
    .single();

  if (!vendor) {
    notFound();
  }

  const { data: items } = await supabase
    .from("vendor_prices")
    .select("selling_price, products(id, name, description, base_price, is_active)")
    .eq("vendor_id", vendor.vendor_id);

  const activeItems = (items ?? []).filter((i: any) => i.products?.is_active);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">
        Mayn Sales Point Vendor
      </p>
      <h1 className="mt-1 font-display text-2xl text-indigo">
        {vendor.full_name ?? "Vendor"} — Storefront
      </h1>

      {activeItems.length === 0 && (
        <p className="mt-8 text-sm text-ink/60">
          This vendor has not added any products yet.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {activeItems.map((item: any) => (
          <div key={item.products.id} className="border border-line bg-white p-5">
            <p className="font-medium">{item.products.name}</p>
            {item.products.description && (
              <p className="mt-1 text-sm text-ink/60">{item.products.description}</p>
            )}
            <p className="mt-3 font-display text-lg text-indigo">
              GH₵{Number(item.selling_price).toFixed(2)}
            </p>
            <a
              href={`/checkout?vendor=${vendor.vendor_id}&product=${item.products.id}`}
              className="mt-3 block w-full rounded-pill bg-indigo px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-light"
            >
              Buy
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewProductForm from "./new-product-form";

export default async function AdminProductsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Server-side role check — never trust the frontend alone for this.
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name")
    .order("name");

  const { data: products } = await supabase
    .from("products")
    .select("id, name, base_price, product_type, is_active, sku, product_categories(name)")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Admin</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">Products</h1>

      <div className="mt-8 border border-line bg-white p-6">
        <h2 className="font-display text-lg text-indigo">Add a product</h2>
        <NewProductForm categories={categories ?? []} />
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg text-indigo">All products</h2>
        {(!products || products.length === 0) && (
          <p className="mt-3 text-sm text-ink/60">
            No products yet — add your first one above.
          </p>
        )}
        <div className="mt-4 divide-y divide-line border-t border-line">
          {products?.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-ink/50">
                  {p.product_categories?.name ?? "Uncategorized"} · {p.sku || "no SKU"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">GH₵{Number(p.base_price).toFixed(2)}</p>
                <p className={p.is_active ? "text-leaf" : "text-ink/40"}>
                  {p.is_active ? "Active" : "Inactive"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
    }

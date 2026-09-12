import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewCategoryForm from "./new-category-form";

export default async function AdminCategoriesPage() {
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

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name")
    .order("name");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Admin</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">Categories</h1>

      <div className="mt-8 border border-line bg-white p-6">
        <h2 className="font-display text-lg text-indigo">Add a category</h2>
        <NewCategoryForm />
      </div>

      <div className="mt-10 divide-y divide-line border-t border-line">
        {(!categories || categories.length === 0) && (
          <p className="py-4 text-sm text-ink/60">No categories yet.</p>
        )}
        {categories?.map((c) => (
          <div key={c.id} className="py-3 text-sm">
            {c.name}
          </div>
        ))}
      </div>
    </main>
  );
}

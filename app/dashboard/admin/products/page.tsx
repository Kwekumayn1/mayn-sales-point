"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string };
type CustomField = { label: string; fieldType: string; required: boolean };

export default function AdminProductsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [productType, setProductType] = useState("digital");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [variantsCache, setVariantsCache] = useState<Record<string, any[]>>({});
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState("");
  const [variantBusy, setVariantBusy] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

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

    const { data: cats } = await supabase
      .from("product_categories")
      .select("id, name")
      .order("name");
    setCategories(cats ?? []);

    const { data: prods } = await supabase
      .from("products")
      .select("id, name, base_price, product_type, is_active, image_url, product_categories(name)")
      .order("created_at", { ascending: false });
    setProducts(prods ?? []);

    setLoading(false);
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const price = basePrice.trim() === "" ? 0 : Number(basePrice);
    if (Number.isNaN(price) || price < 0) {
      setFormError("Enter a valid price.");
      return;
    }

    setFormLoading(true);
    const supabase = createClient();

    let imageUrl: string | null = null;
    if (imageFile) {
      setUploading(true);
      const ext = imageFile.name.split(".").pop() || "jpg";
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, imageFile);
      setUploading(false);

      if (uploadError) {
        setFormLoading(false);
        setFormError(uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    const { data: newProduct, error } = await supabase
      .from("products")
      .insert({
        name,
        description,
        category_id: categoryId || null,
        base_price: price,
        product_type: productType,
        is_active: true,
        image_url: imageUrl,
      })
      .select("id")
      .single();

    if (error || !newProduct) {
      setFormLoading(false);
      setFormError(error?.message || "Could not create product.");
      return;
    }

    const fieldsToInsert = customFields
      .filter((f) => f.label.trim())
      .map((f, i) => ({
        product_id: newProduct.id,
        label: f.label.trim(),
        field_type: f.fieldType,
        is_required: f.required,
        sort_order: i,
      }));

    if (fieldsToInsert.length > 0) {
      const { error: fieldsError } = await supabase
        .from("product_fields")
        .insert(fieldsToInsert);
      if (fieldsError) {
        setFormLoading(false);
        setFormError(
          `Product created, but custom fields failed to save: ${fieldsError.message}`
        );
        return;
      }
    }

    setName("");
    setDescription("");
    setBasePrice("");
    setImageFile(null);
    setCustomFields([]);
    setFormLoading(false);
    void load();
  }

  async function handleToggleActive(id: string, current: boolean) {
    setActionId(id);
    const supabase = createClient();
    await supabase.from("products").update({ is_active: !current }).eq("id", id);
    setActionId(null);
    void load();
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Delete this product and all its sub-products? Past orders stay in your records. This cannot be undone."
      )
    )
      return;
    setActionId(id);
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", id);
    setActionId(null);
    if (error) {
      alert(error.message);
      return;
    }
    void load();
  }

  async function loadVariants(productId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("product_variants")
      .select("id, name, base_price, is_active")
      .eq("product_id", productId)
      .order("sort_order");
    setVariantsCache((prev) => ({ ...prev, [productId]: data ?? [] }));
  }

  async function handleToggleExpand(productId: string) {
    if (expandedId === productId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(productId);
    setVariantError(null);
    setNewVariantName("");
    setNewVariantPrice("");
    if (!variantsCache[productId]) {
      await loadVariants(productId);
    }
  }

  async function handleAddVariant(productId: string) {
    setVariantError(null);
    const price = Number(newVariantPrice);
    if (!newVariantName.trim()) {
      setVariantError("Enter a name for this sub-product.");
      return;
    }
    if (newVariantPrice.trim() === "" || Number.isNaN(price) || price < 0) {
      setVariantError("Enter a valid price.");
      return;
    }

    setVariantBusy(true);
    const supabase = createClient();
    const existing = variantsCache[productId] ?? [];
    const { error } = await supabase.from("product_variants").insert({
      product_id: productId,
      name: newVariantName.trim(),
      base_price: price,
      is_active: true,
      sort_order: existing.length,
    });
    setVariantBusy(false);

    if (error) {
      setVariantError(error.message);
      return;
    }

    setNewVariantName("");
    setNewVariantPrice("");
    await loadVariants(productId);
  }

  async function handleDeleteVariant(variantId: string, productId: string) {
    if (!confirm("Delete this sub-product? Past orders stay in your records. This cannot be undone."))
      return;
    setVariantBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("product_variants").delete().eq("id", variantId);
    setVariantBusy(false);
    if (error) {
      setVariantError(error.message);
      return;
    }
    await loadVariants(productId);
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
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Admin</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">Products</h1>

      <div className="mt-8 border border-line bg-white p-6">
        <h2 className="font-display text-lg text-indigo">Add a product</h2>
        <form onSubmit={handleCreateProduct} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Product name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
              >
                <option value="digital">Digital</option>
                <option value="physical">Physical</option>
                <option value="service">Service</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Base price (GH₵) (optional)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            />
            <p className="mt-1 text-xs text-ink/50">
              Leave empty if you will add sub-products below.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Product photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
            {uploading && <p className="mt-1 text-xs text-ink/50">Uploading photo…</p>}
          </div>

          <div>
            <label className="text-sm font-medium">
              Extra info to collect from customers (optional)
            </label>
            <p className="mt-1 text-xs text-ink/50">
              e.g. "Account Number" for a top-up, "Size" for clothing.
            </p>
            <div className="mt-2 space-y-2">
              {customFields.map((field, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    value={field.label}
                    onChange={(e) => {
                      const next = [...customFields];
                      next[i] = { ...next[i], label: e.target.value };
                      setCustomFields(next);
                    }}
                    placeholder="Field label"
                    className="flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
                  />
                  <select
                    value={field.fieldType}
                    onChange={(e) => {
                      const next = [...customFields];
                      next[i] = { ...next[i], fieldType: e.target.value };
                      setCustomFields(next);
                    }}
                    className="border border-line px-2 py-2 text-sm outline-none focus:border-indigo"
                  >
                    <option value="text">Text</option>
                    <option value="tel">Phone</option>
                    <option value="email">Email</option>
                    <option value="number">Number</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs text-ink/60">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => {
                        const next = [...customFields];
                        next[i] = { ...next[i], required: e.target.checked };
                        setCustomFields(next);
                      }}
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomFields(customFields.filter((_, j) => j !== i))}
                    className="text-xs text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setCustomFields([
                  ...customFields,
                  { label: "", fieldType: "text", required: true },
                ])
              }
              className="mt-2 text-sm text-indigo underline"
            >
              + Add a field
            </button>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <button
            type="submit"
            disabled={formLoading}
            className="rounded-pill bg-indigo px-6 py-2 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
          >
            {formLoading ? "Adding…" : "Add product"}
          </button>
        </form>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg text-indigo">All products</h2>
        {products.length === 0 && (
          <p className="mt-3 text-sm text-ink/60">
            No products yet — add your first one above.
          </p>
        )}
        <div className="mt-4 divide-y divide-line border-t border-line">
          {products.map((p: any) => (
            <div key={p.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-paper" />
                  )}
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-ink/50">
                      {p.product_categories?.name ?? "Uncategorized"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-medium">
                      {Number(p.base_price) > 0
                        ? "GH₵" + Number(p.base_price).toFixed(2)
                        : "Sub-products only"}
                    </p>
                    <p className={p.is_active ? "text-leaf" : "text-ink/40"}>
                      {p.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleExpand(p.id)}
                    className="rounded-pill border border-line px-3 py-1 text-xs"
                  >
                    {expandedId === p.id ? "Hide sub-products" : "Sub-products"}
                  </button>
                  <button
                    onClick={() => handleToggleActive(p.id, p.is_active)}
                    disabled={actionId === p.id}
                    className="rounded-pill border border-line px-3 py-1 text-xs disabled:opacity-60"
                  >
                    {p.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={actionId === p.id}
                    className="rounded-pill border border-red-200 px-3 py-1 text-xs text-red-600 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedId === p.id && (
                <div className="mt-3 border border-line bg-paper p-4">
                  <p className="text-xs uppercase tracking-wide text-ink/50">
                    Sub-products for {p.name}
                  </p>
                  <p className="mt-1 text-xs text-ink/50">
                    If this product has any sub-products listed here, customers pick one on
                    your storefront instead of buying the base product directly.
                  </p>

                  <div className="mt-3 space-y-2">
                    {(variantsCache[p.id] ?? []).length === 0 && (
                      <p className="text-xs text-ink/50">No sub-products yet.</p>
                    )}
                    {(variantsCache[p.id] ?? []).map((v: any) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between border border-line bg-white px-3 py-2"
                      >
                        <span>
                          {v.name} — GH₵{Number(v.base_price).toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleDeleteVariant(v.id, p.id)}
                          disabled={variantBusy}
                          className="text-xs text-red-600 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      value={newVariantName}
                      onChange={(e) => setNewVariantName(e.target.value)}
                      placeholder="e.g. 10GB - 30 days"
                      className="flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
                    />
                    <input
                      value={newVariantPrice}
                      onChange={(e) => setNewVariantPrice(e.target.value)}
                      placeholder="Price (GH₵)"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      className="w-32 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
                    />
                    <button
                      onClick={() => handleAddVariant(p.id)}
                      disabled={variantBusy}
                      className="rounded-pill bg-indigo px-4 py-2 text-xs font-medium text-white hover:bg-indigo-l

                    

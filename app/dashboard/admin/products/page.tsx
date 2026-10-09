"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo";

function MessageBox(props: { text: string }) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 text-sm text-ink/60">
      {props.text}
    </div>
  );
}

function AddProductForm(props: { categories: any[]; onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [productType, setProductType] = useState("digital");
  const [imageFile, setImageFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [fields, setFields] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function changeField(i: number, key: string, value: any) {
    const next = fields.slice();
    next[i] = Object.assign({}, next[i], { [key]: value });
    setFields(next);
  }

  async function submit(e: any) {
    e.preventDefault();
    setError("");

    let price = 0;
    if (basePrice.trim() !== "") {
      price = Number(basePrice);
    }
    if (isNaN(price) || price < 0) {
      setError("Enter a valid price.");
      return;
    }

    setBusy(true);
    const supabase = createClient();

    let imageUrl: string | null = null;
    if (imageFile) {
      setUploading(true);
      const parts = String(imageFile.name).split(".");
      const ext = parts.length > 1 ? parts[parts.length - 1] : "jpg";
      const fileName = crypto.randomUUID() + "." + ext;
      const up = await supabase.storage.from("product-images").upload(fileName, imageFile);
      setUploading(false);
      if (up.error) {
        setBusy(false);
        setError(up.error.message);
        return;
      }
      const urlData = supabase.storage.from("product-images").getPublicUrl(fileName);
      imageUrl = urlData.data.publicUrl;
    }

    const created = await supabase
      .from("products")
      .insert({
        name: name,
        description: description,
        category_id: categoryId || null,
        base_price: price,
        product_type: productType,
        is_active: true,
        image_url: imageUrl,
      })
      .select("id")
      .single();

    if (created.error || !created.data) {
      setBusy(false);
      setError(created.error ? created.error.message : "Could not create product.");
      return;
    }

    const rows = fields
      .filter((f) => String(f.label).trim() !== "")
      .map((f, i) => ({
        product_id: created.data.id,
        label: String(f.label).trim(),
        field_type: f.fieldType,
        is_required: f.required,
        sort_order: i,
      }));

    if (rows.length > 0) {
      const fr = await supabase.from("product_fields").insert(rows);
      if (fr.error) {
        setBusy(false);
        setError("Product created, but extra fields failed to save: " + fr.error.message);
        return;
      }
    }

    setName("");
    setDescription("");
    setBasePrice("");
    setImageFile(null);
    setFields([]);
    setBusy(false);
    props.onDone();
  }

  return (
    <div className="mt-8 border border-line bg-white p-6">
      <h2 className="font-display text-lg text-indigo">Add a product</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Product name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">No category</option>
              {props.categories.map((c) => (
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
              className={inputClass}
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
            className={inputClass}
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
            onChange={(e) => setImageFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
            className="mt-1 w-full text-sm"
          />
          {uploading ? <p className="mt-1 text-xs text-ink/50">Uploading photo...</p> : null}
        </div>

        <div>
          <label className="text-sm font-medium">
            Extra info to collect from customers (optional)
          </label>
          <p className="mt-1 text-xs text-ink/50">
            Example: Account Number for a top-up, Size for clothing.
          </p>
          <div className="mt-2 space-y-2">
            {fields.map((field, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  value={field.label}
                  onChange={(e) => changeField(i, "label", e.target.value)}
                  placeholder="Field label"
                  className="flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
                />
                <select
                  value={field.fieldType}
                  onChange={(e) => changeField(i, "fieldType", e.target.value)}
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
                    onChange={(e) => changeField(i, "required", e.target.checked)}
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => setFields(fields.filter((_, j) => j !== i))}
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
              setFields(fields.concat([{ label: "", fieldType: "text", required: true }]))
            }
            className="mt-2 text-sm text-indigo underline"
          >
            + Add a field
          </button>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded-pill bg-indigo px-6 py-2 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
        >
          {busy ? "Adding..." : "Add product"}
        </button>
      </form>
    </div>
  );
}

function SubProducts(props: { product: any }) {
  const productId = props.product.id;
  const [items, setItems] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  async function loadItems() {
    const supabase = createClient();
    const res = await supabase
      .from("product_variants")
      .select("id, name, base_price, is_active")
      .eq("product_id", productId)
      .order("base_price", { ascending: true });
    setItems(res.data || []);
  }

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addItem() {
    setError("");
    const price = Number(newPrice);
    if (newName.trim() === "") {
      setError("Enter a name for this sub-product.");
      return;
    }
    if (newPrice.trim() === "" || isNaN(price) || price < 0) {
      setError("Enter a valid price.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const res = await supabase.from("product_variants").insert({
      product_id: productId,
      name: newName.trim(),
      base_price: price,
      is_active: true,
      sort_order: items.length,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setNewName("");
    setNewPrice("");
    await loadItems();
  }

  function startEdit(v: any) {
    setError("");
    setEditId(v.id);
    setEditName(v.name);
    setEditPrice(String(v.base_price));
  }

  async function saveEdit() {
    setError("");
    const price = Number(editPrice);
    if (editName.trim() === "") {
      setError("Name cannot be empty.");
      return;
    }
    if (editPrice.trim() === "" || isNaN(price) || price < 0) {
      setError("Enter a valid price.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const res = await supabase
      .from("product_variants")
      .update({ name: editName.trim(), base_price: price })
      .eq("id", editId);
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setEditId("");
    await loadItems();
  }

  async function removeItem(id: string) {
    if (!confirm("Delete this sub-product? Past orders stay in your records. This cannot be undone.")) {
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const res = await supabase.from("product_variants").delete().eq("id", id);
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    await loadItems();
  }

  return (
    <div className="mt-3 border border-line bg-paper p-4">
      <p className="text-xs uppercase tracking-wide text-ink/50">
        Sub-products for {props.product.name}
      </p>
      <p className="mt-1 text-xs text-ink/50">
        If this product has any sub-products listed here, customers pick one on your
        storefront instead of buying the base product directly.
      </p>

      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-ink/50">No sub-products yet.</p>
        ) : null}
        {items.map((v) =>
          editId === v.id ? (
            <div
              key={v.id}
              className="flex flex-wrap items-center gap-2 border border-line bg-white px-3 py-2"
            >
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="min-w-0 flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
              />
              <input
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="w-28 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
              />
              <button
                onClick={saveEdit}
                disabled={busy}
                className="text-xs font-medium text-indigo disabled:opacity-60"
              >
                Save
              </button>
              <button
                onClick={() => setEditId("")}
                disabled={busy}
                className="text-xs text-ink/60"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div
              key={v.id}
              className="flex items-center justify-between border border-line bg-white px-3 py-2"
            >
              <span>
                {v.name} - GH₵{Number(v.base_price).toFixed(2)}
              </span>
              <span className="flex gap-3">
                <button
                  onClick={() => startEdit(v)}
                  disabled={busy}
                  className="text-xs text-indigo disabled:opacity-60"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeItem(v.id)}
                  disabled={busy}
                  className="text-xs text-red-600 disabled:opacity-60"
                >
                  Delete
                </button>
              </span>
            </div>
          )
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. 10GB - 30 days"
          className="flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
        />
        <input
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
          placeholder="Price (GH₵)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          className="w-32 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
        />
        <button
          onClick={addItem}
          disabled={busy}
          className="rounded-pill bg-indigo px-4 py-2 text-xs font-medium text-white hover:bg-indigo-light disabled:opacity-60"
        >
          {busy ? "Adding..." : "Add sub-product"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function ProductRow(props: { product: any; onChanged: () => void }) {
  const p = props.product;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    setBusy(false);
    props.onChanged();
  }

  async function removeProduct() {
    if (
      !confirm(
        "Delete this product and all its sub-products? Past orders stay in your records. This cannot be undone."
      )
    ) {
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const res = await supabase.from("products").delete().eq("id", p.id);
    setBusy(false);
    if (res.error) {
      alert(res.error.message);
      return;
    }
    props.onChanged();
  }

  const hasPrice = Number(p.base_price) > 0;
  const categoryName =
    p.product_categories && p.product_categories.name ? p.product_categories.name : "Uncategorized";

  return (
    <div className="py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {p.image_url ? (
            <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover" />
          ) : (
            <div className="h-10 w-10 rounded bg-paper" />
          )}
          <div>
            <p className="font-medium">{p.name}</p>
            <p className="text-ink/50">{categoryName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-medium">
              {hasPrice ? "GH₵" + Number(p.base_price).toFixed(2) : "Sub-products only"}
            </p>
            <p className={p.is_active ? "text-leaf" : "text-ink/40"}>
              {p.is_active ? "Active" : "Inactive"}
            </p>
          </div>
          <button
            onClick={() => setOpen(!open)}
            className="rounded-pill border border-line px-3 py-1 text-xs"
          >
            {open ? "Hide sub-products" : "Sub-products"}
          </button>
          <button
            onClick={toggleActive}
            disabled={busy}
            className="rounded-pill border border-line px-3 py-1 text-xs disabled:opacity-60"
          >
            {p.is_active ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={removeProduct}
            disabled={busy}
            className="rounded-pill border border-red-200 px-3 py-1 text-xs text-red-600 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>
      {open ? <SubProducts product={p} /> : null}
    </div>
  );
}

export default function AdminProductsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  async function load() {
    const supabase = createClient();
    const auth = await supabase.auth.getUser();
    const user = auth.data ? auth.data.user : null;
    if (!user) {
      setLoading(false);
      return;
    }

    const prof = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const role = prof.data ? prof.data.role : "";
    const isAdmin = role === "admin" || role === "super_admin";
    setAllowed(isAdmin);
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const cats = await supabase.from("product_categories").select("id, name").order("name");
    setCategories(cats.data || []);

    const prods = await supabase
      .from("products")
      .select("id, name, base_price, product_type, is_active, image_url, product_categories(name)")
      .order("created_at", { ascending: false });
    setProducts(prods.data || []);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <MessageBox text="Loading..." />;
  }

  if (!allowed) {
    return <MessageBox text="You do not have access to this page." />;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Admin</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">Products</h1>

      <AddProductForm categories={categories} onDone={load} />

      <div className="mt-10">
        <h2 className="font-display text-lg text-indigo">All products</h2>
        {products.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">No products yet. Add your first one above.</p>
        ) : null}
        <div className="mt-4 divide-y divide-line border-t border-line">
          {products.map((p) => (
            <Prod

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string };
type CustomField = { label: string; fieldType: string; required: boolean };

export default function NewProductForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sku, setSku] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [productType, setProductType] = useState("digital");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const price = Number(basePrice);
    if (Number.isNaN(price) || price < 0) {
      setError("Enter a valid price.");
      return;
    }

    setLoading(true);
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
        setLoading(false);
        setError(uploadError.message);
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
        sku: sku || null,
        base_price: price,
        product_type: productType,
        is_active: true,
        image_url: imageUrl,
      })
      .select("id")
      .single();

    if (error || !newProduct) {
      setLoading(false);
      setError(error?.message || "Could not create product.");
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
        setLoading(false);
        setError(
          `Product created, but custom fields failed to save: ${fieldsError.message}`
        );
        return;
      }
    }

    setName("");
    setDescription("");
    setSku("");
    setBasePrice("");
    setImageFile(null);
    setCustomFields([]);
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
          <label className="text-sm font-medium">SKU / product code</label>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Base price (GH₵)</label>
          <input
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
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
            setCustomFields([...customFields, { label: "", fieldType: "text", required: true }])
          }
          className="mt-2 text-sm text-indigo underline"
        >
          + Add a field
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-pill bg-indigo px-6 py-2 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
      >
        {loading ? "Adding…" : "Add product"}
      </button>
    </form>
  );
}

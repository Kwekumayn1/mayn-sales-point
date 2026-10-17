"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type FieldDef = { label: string; required: boolean };
export type ListingValues = {
  name: string;
  desc: string;
  price: string;
  imageUrl: string;
  fields: FieldDef[];
};

const FEE_PERCENT = 4;
const money = (n: number) => "GHS " + Number(n).toFixed(2);
const withFee = (cost: number) => Math.round(cost * (1 + FEE_PERCENT / 100) * 100) / 100;
const PRESETS = ["Delivery address", "Size", "Colour", "Notes"];

function priceOf(v: string): number | null {
  const n = Number(v);
  if (!v.trim() || Number.isNaN(n) || n <= 0) return null;
  if (Math.abs(Math.round(n * 100) - n * 100) > 0.0001) return null;
  return n;
}

// Shrinks a photo to at most 1000px so uploads are fast on mobile data.
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img: HTMLImageElement = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("That file is not a picture."));
      i.src = url;
    });
    const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Could not read the picture.");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("Could not read the picture."))), "image/jpeg", 0.82)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Props = {
  initial: ListingValues;
  submitLabel: string;
  busy: boolean;
  error: string;
  onSubmit: (v: ListingValues) => void;
  onCancel?: () => void;
};

export default function ListingForm({ initial, submitLabel, busy, error, onSubmit, onCancel }: Props) {
  const supabase: any = createClient();
  const [name, setName] = useState(initial.name);
  const [desc, setDesc] = useState(initial.desc);
  const [price, setPrice] = useState(initial.price);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [fields, setFields] = useState<FieldDef[]>(initial.fields);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");

  const box = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-indigo";
  const preview = priceOf(price);

  async function pickPhoto(e: any) {
    const file: File | undefined = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setLocalError("");
    setUploading(true);
    try {
      const blob = await shrink(file);
      const { data: u } = await supabase.auth.getUser();
      if (!u || !u.user) throw new Error("Please sign in again.");
      const path = u.user.id + "/" + Date.now() + ".jpg";
      const up = await supabase.storage.from("listing-images").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      const pub = supabase.storage.from("listing-images").getPublicUrl(path);
      setImageUrl(pub.data.publicUrl);
    } catch (err: any) {
      setLocalError(err && err.message ? err.message : "Photo upload failed. Try again.");
    }
    setUploading(false);
  }

  function addField(label: string) {
    if (fields.length >= 8) {
      setLocalError("You can ask for at most 8 things.");
      return;
    }
    setLocalError("");
    setFields([...fields, { label, required: true }]);
  }

  function setField(i: number, patch: Partial<FieldDef>) {
    setFields(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function submit(e: any) {
    e.preventDefault();
    setLocalError("");
    if (name.trim().length < 3) {
      setLocalError("Give the product a name (at least 3 letters).");
      return;
    }
    const n = priceOf(price);
    if (n === null) {
      setLocalError("Enter a price above 0, with at most 2 decimals.");
      return;
    }
    const clean = fields.map((f) => ({ label: f.label.trim(), required: f.required }));
    if (clean.some((f) => f.label.length === 0)) {
      setLocalError("Fill in every question, or remove the empty ones.");
      return;
    }
    const seen = new Set<string>();
    for (const f of clean) {
      const k = f.label.toLowerCase();
      if (seen.has(k)) {
        setLocalError("Two questions have the same name: " + f.label);
        return;
      }
      seen.add(k);
    }
    if (uploading) {
      setLocalError("Wait for the photo to finish uploading.");
      return;
    }
    onSubmit({ name: name.trim(), desc: desc.trim(), price: String(n), imageUrl, fields: clean });
  }

  const shown = localError || error;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Product name</label>
        <input value={name} onChange={(e: any) => setName(e.target.value)} className={box} maxLength={80} />
      </div>

      <div>
        <label className="text-sm font-medium">Photo (optional)</label>
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Product" className="mt-1 h-32 w-32 rounded-xl border border-line object-cover" />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={pickPhoto}
          disabled={uploading}
          className="mt-1 block w-full text-sm"
        />
        {uploading && <p className="mt-1 text-xs text-ink/60">Uploading photo...</p>}
        {imageUrl && !uploading && (
          <button type="button" onClick={() => setImageUrl("")} className="mt-1 text-xs text-red-600">
            Remove photo
          </button>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">Details (optional)</label>
        <textarea
          value={desc}
          onChange={(e: any) => setDesc(e.target.value)}
          className={box}
          rows={3}
          maxLength={500}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Your price (what you receive), GHS</label>
        <input inputMode="decimal" value={price} onChange={(e: any) => setPrice(e.target.value)} className={box} />
        {preview !== null && (
          <p className="mt-1 text-xs text-leaf">
            Customers will pay {money(withFee(preview))} (includes {FEE_PERCENT}% service charge).
          </p>
        )}
      </div>

      <div className="rounded-xl border border-line bg-paper p-3">
        <p className="text-sm font-medium">What should customers tell you when they buy?</p>
        <p className="text-xs text-ink/60">
          Add questions you need answered to deliver, such as an address or size. Their name and phone number are
          always collected.
        </p>
        {fields.map((f, i) => (
          <div key={i} className="mt-2 flex items-center gap-2">
            <input
              value={f.label}
              onChange={(e: any) => setField(i, { label: e.target.value })}
              placeholder="Question, e.g. Delivery address"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-indigo"
              maxLength={40}
            />
            <label className="flex shrink-0 items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e: any) => setField(i, { required: e.target.checked })}
              />
              Required
            </label>
            <button
              type="button"
              onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
              className="shrink-0 rounded-pill border border-line bg-white px-3 py-1 text-xs text-red-600"
            >
              Remove
            </button>
          </div>
        ))}
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.filter((p) => !fields.some((f) => f.label.toLowerCase() === p.toLowerCase())).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => addField(p)}
              className="rounded-pill border border-line bg-white px-3 py-1 text-xs"
            >
              + {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => addField("")}
            className="rounded-pill border border-line bg-white px-3 py-1 text-xs font-semibold"
          >
            + Other question
          </button>
        </div>
      </div>

      {shown && <p className="text-sm text-red-600">{shown}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || uploading}
          className="rounded-pill bg-indigo px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-pill border border-line px-5 py-2 text-sm font-semibold text-ink"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// END OF FILE

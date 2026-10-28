"use client";

import { useState } from "react";

export default function MovePanel({
  account,
  call,
  onDone,
}: {
  account: any;
  call: (payload: any) => Promise<any>;
  onDone: (newLevel: number) => void;
}) {
  const [parent, setParent] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function check() {
    setBusy(true);
    setMsg("");
    setPreview(null);
    try {
      const j = await call({ action: "preview_move", userId: account.id, newParentId: parent });
      setPreview(j.preview);
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy(false);
  }

  async function confirmMove() {
    setBusy(true);
    setMsg("");
    try {
      const j = await call({ action: "move", userId: account.id, newParentId: parent, reason: reason });
      onDone(j.new_level);
    } catch (e: any) {
      setMsg(e.message);
      setBusy(false);
    }
  }

  const field = "mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-indigo";

  return (
    <div className="mt-3 rounded-xl border border-line bg-white p-3 text-sm text-ink">
      <p className="font-semibold">Move {account.full_name || "this vendor"} under a different upline</p>
      <p className="mt-1 text-xs text-ink/60">
        Type the ID number of the new upline. Type 0 to place them directly under you (no upline). Everyone under this vendor moves
        with them. Past earnings stay as they are.
      </p>
      <input
        value={parent}
        inputMode="numeric"
        onChange={(e: any) => {
          setParent(e.target.value.replace(/[^0-9]/g, ""));
          setPreview(null);
          setMsg("");
        }}
        placeholder="New upline ID number"
        className={field}
      />
      <input value={reason} onChange={(e: any) => setReason(e.target.value)} placeholder="Reason (optional)" className={field} />
      {msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
      {!preview && (
        <button
          onClick={check}
          disabled={busy || parent === ""}
          className="mt-2 rounded-pill bg-indigo px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Checking..." : "Check"}
        </button>
      )}
      {preview && (
        <div className="mt-3 rounded-lg bg-paper p-3 text-xs">
          <p>
            {preview.name} (ID {preview.vendor_id})
          </p>
          <p>From: {preview.from}</p>
          <p>To: {preview.to}</p>
          <p>They will become Level {preview.new_level}.</p>
          <p>{preview.moving_with} sub-vendor(s) under them will move along.</p>
          {preview.to_blocked && <p className="text-red-600">Note: the new upline is currently blocked.</p>}
          <button
            onClick={confirmMove}
            disabled={busy}
            className="mt-2 rounded-pill bg-indigo px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Moving..." : "Confirm move"}
          </button>
        </div>
      )}
    </div>
  );
}

// END OF FILE

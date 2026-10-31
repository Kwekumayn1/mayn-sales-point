// Confirms an instant wallet top-up with Moolre and credits the Purchase wallet once.
import { lookupMoolre, judge } from "@/lib/payments/moolre-lookup";

export type TopupCheck = { code: string; changed: boolean };

export async function confirmWalletTopup(admin: any, row: any): Promise<TopupCheck> {
  if (!row || row.status !== "pending_payment") return { code: "already_done", changed: false };

  const look: any = await lookupMoolre(row.reference);
  const verdict: any = judge(look, row.total);
  const code: string = typeof verdict === "string" ? verdict : (verdict && verdict.code) || "error";
  if (code !== "paid_ok") return { code, changed: false };

  const payer = look && look.payer ? String(look.payer) : null;
  const { data, error } = await admin.rpc("credit_online_topup", {
    p_reference: row.reference,
    p_payer: payer,
  });
  if (error) return { code: "error", changed: false };
  return { code: "paid_ok", changed: data === true };
}

// END OF FILE

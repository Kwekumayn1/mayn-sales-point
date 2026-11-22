import { NextResponse } from "next/server";
import type { Step } from "@/lib/ussd/core";
import {
  keyOk,
  reply,
  getAdmin,
  normalizePhone,
  extractExtension,
  lookupVendor,
} from "@/lib/ussd/core";
import { advance, menuText } from "@/lib/ussd/flow";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Health check: open this in a browser with ?key=YOUR_SECRET
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!keyOk(url.searchParams.get("key"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.json({ status: "ok", service: "ussd" });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!keyOk(url.searchParams.get("key"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return reply("Service unavailable. Please try again later.", true);
  }

  const op = Number(body?.ussdServiceOp);
  const sessionId = String(body?.sessionID ?? "").trim();
  const input = String(body?.ussdString ?? "").trim();
  const msisdn = normalizePhone(String(body?.msisdn ?? ""));

  if (!sessionId) {
    return reply("Service unavailable. Please try again later.", true);
  }
  console.log("USSD", { op, sessionId, input: input.slice(0, 20) });

  const admin = getAdmin();
  if (!admin) {
    return reply("Service unavailable. Please try again later.", true);
  }

  try {
    // 29 or greater: the session ended (user cancelled or timed out)
    if (op >= 29) {
      await admin.from("ussd_sessions").delete().eq("session_id", sessionId);
      return reply("Goodbye.", true);
    }

    let step: Step;

    if (op === 1) {
      if (Math.random() < 0.05) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await admin.from("ussd_sessions").delete().lt("updated_at", cutoff);
      }
      const ext = extractExtension(body);
      const vendor = ext ? await lookupVendor(admin, ext) : null;
      if (vendor) {
        const text = menuText(vendor.name);
        step = {
          message: text,
          end: false,
          state: "menu",
          data: { vendorId: vendor.id, vendorName: vendor.name, last: text },
        };
      } else {
        const text = "Mayn Sales Point\nEnter vendor code:";
        step = { message: text, end: false, state: "code", data: { last: text } };
      }
    } else {
      const { data: row } = await admin
        .from("ussd_sessions")
        .select("state, data")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (!row) {
        const text = "Session expired.\nEnter vendor code:";
        step = { message: text, end: false, state: "code", data: { last: text } };
      } else {
        step = await advance(
          admin,
          String(row.state || "code"),
          row.data || {},
          input,
          msisdn,
          sessionId
        );
      }
    }

    if (step.end) {
      await admin.from("ussd_sessions").delete().eq("session_id", sessionId);
    } else {
      await admin.from("ussd_sessions").upsert(
        {
          session_id: sessionId,
          msisdn,
          state: step.state,
          data: step.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_id" }
      );
    }
    return reply(step.message, step.end);
  } catch (e) {
    console.error("USSD error", e);
    return reply("Service unavailable. Please try again later.", true);
  }
}

// END OF FILE

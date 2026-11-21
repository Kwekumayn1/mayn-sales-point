import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// ---------------------------------------------------------------
// Menu text. Keep every message under about 160 characters.
// ---------------------------------------------------------------
const MAIN_MENU = "Welcome to Mayn Sales Point\n1 About us\n2 Exit";

type Step = { message: string; end: boolean; state: string };

function siteShort(): string {
  const raw = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

// Decides what to show next, based on where the user is and what they pressed.
// Add new menus here later.
function handle(state: string, input: string): Step {
  if (state === "main") {
    if (input === "1") {
      return {
        message:
          "Mayn Sales Point: buy data, airtime and more from trusted vendors. Visit " +
          siteShort(),
        end: true,
        state: "main",
      };
    }
    if (input === "2") {
      return { message: "Thank you. Goodbye.", end: true, state: "main" };
    }
    return { message: "Invalid choice.\n" + MAIN_MENU, end: false, state: "main" };
  }
  return { message: MAIN_MENU, end: false, state: "main" };
}

// ---------------------------------------------------------------
// Plumbing: security, sessions, Uzo's request and reply format
// ---------------------------------------------------------------
function reply(message: string, end: boolean) {
  // Uzo: 2 = continuing response, 17 = final response
  return NextResponse.json({ message, ussdServiceOp: end ? 17 : 2 });
}

function keyOk(given: string | null): boolean {
  const secret = process.env.USSD_SECRET || "";
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createAdminClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.indexOf("00233") === 0) d = d.slice(2);
  if (d.indexOf("233") === 0 && d.length === 12) return d;
  if (d.charAt(0) === "0" && d.length === 10) return "233" + d.slice(1);
  if (d.length === 9) return "233" + d;
  return "";
}

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

    let state = "main";
    let isNew = false;

    if (op === 1) {
      // Initiating request: the text is the dialled code, not a menu choice
      isNew = true;
      if (Math.random() < 0.05) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await admin.from("ussd_sessions").delete().lt("updated_at", cutoff);
      }
    } else {
      const { data: row } = await admin
        .from("ussd_sessions")
        .select("state")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (row && row.state) {
        state = String(row.state);
      } else {
        isNew = true; // lost session: start again from the main menu
      }
    }

    const step: Step = isNew
      ? { message: MAIN_MENU, end: false, state: "main" }
      : handle(state, input);

    if (step.end) {
      await admin.from("ussd_sessions").delete().eq("session_id", sessionId);
    } else {
      await admin.from("ussd_sessions").upsert(
        {
          session_id: sessionId,
          msisdn,
          state: step.state,
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

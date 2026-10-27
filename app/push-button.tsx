"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function toBytes(b64: string): any {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushButton() {
  const pathname = usePathname() || "";
  const [mode, setMode] = useState<"hidden" | "ask" | "ios" | "busy">("hidden");
  const [key, setKey] = useState("");

  const m = pathname.match(/^\/s\/([^/]+)/);
  const storeSlug = m ? m[1] : "";

  async function sendToServer(sub: any) {
    try {
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), storeSlug }),
      });
    } catch (e) {
      // Ignore: it will retry on the next visit.
    }
  }

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        let dismissed = false;
        try {
          dismissed = window.localStorage.getItem("msp_push_dismissed") === "1";
        } catch (e) {
          dismissed = false;
        }
        const ua = navigator.userAgent || "";
        const isIos = /iphone|ipad|ipod/i.test(ua);
        const standalone = (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
        const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
        const r = await fetch("/api/push/key", { cache: "no-store" });
        const j: any = await r.json().catch(() => ({}));
        const k = String(j.key || "");
        if (!k || dead) return;
        setKey(k);
        if (!supported) {
          if (isIos && !standalone && !dismissed) setMode("ios");
          return;
        }
        if (Notification.permission === "denied") return;
        if (Notification.permission === "granted") {
          const reg = await navigator.serviceWorker.register("/sw.js");
          await navigator.serviceWorker.ready;
          let sub = await reg.pushManager.getSubscription();
          if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(k) });
          await sendToServer(sub);
          return;
        }
        if (!dismissed && !dead) setMode("ask");
      } catch (e) {
        // Stay hidden.
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function dismiss() {
    try {
      window.localStorage.setItem("msp_push_dismissed", "1");
    } catch (e) {
      // Ignore.
    }
    setMode("hidden");
  }

  async function turnOn() {
    setMode("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMode("hidden");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) });
      await sendToServer(sub);
      setMode("hidden");
    } catch (e) {
      setMode("hidden");
    }
  }

  if (mode === "hidden" || pathname.startsWith("/dashboard/admin")) return null;

  return (
    <div className="fixed bottom-4 left-4 z-30 flex max-w-[85vw] items-center gap-2 rounded-full bg-indigo py-2 pl-4 pr-2 text-sm text-white shadow-lg">
      {mode === "ios" ? (
        <span className="text-xs">For updates on iPhone: tap Share, then Add to Home Screen.</span>
      ) : (
        <button onClick={turnOn} disabled={mode === "busy"} className="font-semibold disabled:opacity-60">
          &#128276; {mode === "busy" ? "Please wait..." : "Get updates"}
        </button>
      )}
      <button onClick={dismiss} aria-label="Hide" className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
        &#10005;
      </button>
    </div>
  );
}

// END OF FILE

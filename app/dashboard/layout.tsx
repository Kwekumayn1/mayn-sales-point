"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoutButton from "./logout-button";

type Item = { href: string; label: string };

const HOME_ITEMS: Item[] = [{ href: "/dashboard", label: "Home" }];

const VENDOR_ITEMS: Item[] = [
  { href: "/dashboard/store", label: "My Storefront" },
  { href: "/dashboard/products", label: "My Prices" },
  { href: "/dashboard/orders", label: "My Orders" },
  { href: "/dashboard/wallet", label: "My Wallet" },
  { href: "/dashboard/wallet-order", label: "Buy for Customer" },
  { href: "/dashboard/affiliates", label: "My Affiliates" },
];

const ADMIN_ITEMS: Item[] = [
  { href: "/dashboard/admin/vendors", label: "Create 1st vendor" },
  { href: "/dashboard/admin/community", label: "Community link" },
  { href: "/dashboard/admin/products", label: "Manage products" },
  { href: "/dashboard/admin/categories", label: "Manage categories" },
  { href: "/dashboard/admin/export", label: "Export orders" },
  { href: "/dashboard/admin/vendor-prices", label: "Set vendor prices" },
  { href: "/dashboard/admin/wallets", label: "Wallet top-ups" },
  { href: "/dashboard/admin/withdrawals", label: "Withdrawals" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [waLink, setWaLink] = useState("");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();
      if (data) {
        setRole(data.role ?? null);
        setName(data.full_name ?? "");
      }
      const { data: lvl } = await supabase.rpc("my_vendor_level");
      setLevel(typeof lvl === "number" ? lvl : null);
      const { data: wl } = await supabase.rpc("get_community_link");
      setWaLink(typeof wl === "string" ? wl : "");
      setReady(true);
    })();
  }, []);

  const isAdmin = role === "admin" || role === "super_admin";
  // Affiliates are only for 1st-level vendors (and admins).
  // Hidden by default until we know the level, so 2nd-level vendors never see it.
  const hideAffiliates = !isAdmin && level !== 1;

  useEffect(() => {
    if (ready && hideAffiliates && pathname.startsWith("/dashboard/affiliates")) {
      router.replace("/dashboard");
    }
  }, [ready, hideAffiliates, pathname, router]);

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  }

  function renderItems(list: Item[]) {
    return list.map((it) => (
      <Link
        key={it.href}
        href={it.href}
        className={`block rounded-xl px-4 py-3 text-sm ${
          isActive(it.href)
            ? "bg-gold/20 font-semibold text-indigo"
            : "text-ink hover:bg-paper"
        }`}
      >
        {it.label}
      </Link>
    ));
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-indigo px-4 py-3 text-white shadow md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg bg-white/15 px-3 py-2 text-lg leading-none"
        >
          ☰
        </button>
        <span className="font-bold">Mayn Sales Point</span>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto border-r border-line bg-white shadow-xl transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between bg-indigo px-5 py-5 text-white">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-white/70">
              Mayn Sales Point
            </div>
            <div className="mt-1 truncate font-bold">{name || "Welcome"}</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-lg bg-white/15 px-3 py-1.5 text-lg leading-none md:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {renderItems(HOME_ITEMS)}

          <div className="px-4 pb-1 pt-4 text-xs uppercase tracking-wide text-ink/50">
            Vendor tools
          </div>
          {renderItems(
            hideAffiliates
              ? VENDOR_ITEMS.filter((it) => it.href !== "/dashboard/affiliates")
              : VENDOR_ITEMS
          )}

          {isAdmin && (
            <>
              <div className="px-4 pb-1 pt-4 text-xs uppercase tracking-wide text-ink/50">
                Admin tools
              </div>
              {renderItems(ADMIN_ITEMS)}
            </>
          )}
        </nav>

        <div className="border-t border-line px-5 py-4">
          <LogoutButton />
        </div>
      </aside>

      <div className="md:pl-72">{children}</div>

      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Join our WhatsApp community"
          className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg active:scale-95"
        >
          <svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor" aria-hidden="true">
            <path d="M16.04 3C9.4 3 4.02 8.37 4.02 15c0 2.12.56 4.19 1.61 6.01L4 29l8.19-1.6A12 12 0 0 0 16.04 27C22.68 27 28 21.63 28 15S22.68 3 16.04 3zm0 21.9c-1.8 0-3.57-.48-5.11-1.4l-.37-.22-4.86.95.99-4.73-.24-.39A9.9 9.9 0 0 1 6.1 15c0-5.46 4.46-9.9 9.94-9.9 5.47 0 9.93 4.44 9.93 9.9s-4.46 9.9-9.93 9.9zm5.44-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35z" />
          </svg>
        </a>
      )}
    </div>
  );
  }

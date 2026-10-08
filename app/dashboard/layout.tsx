"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { href: "/dashboard/admin/products", label: "Manage products" },
  { href: "/dashboard/admin/categories", label: "Manage categories" },
  { href: "/dashboard/admin/orders", label: "Manage orders" },
  { href: "/dashboard/admin/vendor-prices", label: "Set vendor prices" },
  { href: "/dashboard/admin/wallets", label: "Wallet top-ups" },
  { href: "/dashboard/admin/withdrawals", label: "Withdrawals" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState("");

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
    })();
  }, []);

  const isAdmin = role === "admin" || role === "super_admin";

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
          {renderItems(VENDOR_ITEMS)}

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
    </div>
  );
  }

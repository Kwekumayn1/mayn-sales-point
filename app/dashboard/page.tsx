import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects unauthenticated visitors, but a server
  // component should never assume — check again before rendering anything.
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, role, vendor_id")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/50">
            Mayn Sales Point
          </p>
          <h1 className="mt-1 font-display text-2xl text-indigo">
            Welcome, {profile?.full_name ?? user.email}
          </h1>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="border border-line bg-white p-5">
          <p className="text-xs text-ink/50">Role</p>
          <p className="mt-1 font-display text-lg capitalize">
            {profile?.role ?? "customer"}
          </p>
        </div>
        <div className="border border-line bg-white p-5">
          <p className="text-xs text-ink/50">Vendor ID</p>
          <p className="mt-1 font-display text-lg">
            {profile?.vendor_id ?? "Not assigned yet"}
          </p>
        </div>
        <div className="border border-line bg-white p-5">
          <p className="text-xs text-ink/50">Wallet balance</p>
          <p className="mt-1 font-display text-lg">GH₵0.00</p>
        </div>
      </div>

      <div className="mt-10 border border-line bg-white p-6">
        <p className="text-xs uppercase tracking-wide text-ink/50">
          Vendor tools
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/dashboard/store"
            className="rounded-pill border border-indigo px-5 py-2 text-sm text-indigo hover:bg-indigo hover:text-white"
          >
            My Storefront
          </Link>
          <Link
            href="/dashboard/products"
            className="rounded-pill border border-indigo px-5 py-2 text-sm text-indigo hover:bg-indigo hover:text-white"
          >
            My Prices
          </Link>
          <Link
            href="/dashboard/orders"
            className="rounded-pill border border-indigo px-5 py-2 text-sm text-indigo hover:bg-indigo hover:text-white"
          >
            My Orders
          </Link>
        </div>
      </div>

      {(profile?.role === "admin" || profile?.role === "super_admin") && (
        <div className="mt-10 border border-line bg-white p-6">
          <p className="text-xs uppercase tracking-wide text-ink/50">
            Admin tools
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/dashboard/admin/products"
              className="rounded-pill border border-indigo px-5 py-2 text-sm text-indigo hover:bg-indigo hover:text-white"
            >
              Manage products
            </Link>
            <Link
              href="/dashboard/admin/categories"
              className="rounded-pill border border-indigo px-5 py-2 text-sm text-indigo hover:bg-indigo hover:text-white"
            >
              Manage categories
            </Link>
            <Link
              href="/dashboard/admin/orders"
              className="rounded-pill border border-indigo px-5 py-2 text-sm text-indigo hover:bg-indigo hover:text-white"
            >
              Manage orders
            </Link>
          </div>
        </div>
      )}

      <div className="mt-10 border border-dashed border-line p-6 text-sm text-ink/60">
        Vendor storefronts, orders, and wallet tools arrive in the next
        build phases.
      </div>
    </main>
  );
}

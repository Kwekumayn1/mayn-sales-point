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

      <div className="mt-10 border border-dashed border-line p-6 text-sm text-ink/60">
        Products, storefront, orders, and wallet tools arrive in the next
        build phases. This dashboard confirms your account, role, and
        session are working end-to-end.
      </div>
    </main>
  );
}

import { createClient } from "@/lib/supabase/server";

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

  const { data: walletTxns } = await supabase
    .from("wallet_transactions")
    .select("amount")
    .eq("vendor_id", user.id);

  const walletTotal = (walletTxns ?? []).reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-ink/50">
        Mayn Sales Point
      </p>
      <h1 className="mt-1 font-display text-2xl text-indigo">
        Welcome, {profile?.full_name ?? user.email}
      </h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs text-ink/50">Role</p>
          <p className="mt-1 font-display text-lg capitalize">
            {profile?.role ?? "customer"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs text-ink/50">Vendor ID</p>
          <p className="mt-1 font-display text-lg">
            {profile?.vendor_id ?? "Not assigned yet"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs text-ink/50">Combined wallet balance</p>
          <p className="mt-1 font-display text-lg">GH₵{walletTotal.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-line p-6 text-sm text-ink/60">
        Open the menu (☰ at the top left) to reach your tools.
      </div>
    </main>
  );
}

import { createClient } from "@/lib/supabase/server";
import ProfitCard from "./profit-card";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects unauthenticated visitors, but a server
  // component should never assume - check again before rendering anything.
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, role, vendor_id")
    .eq("id", user.id)
    .single();

  // Read every wallet row in pages, so balances stay correct even when
  // a vendor has more than 1000 transactions.
  let profit = 0;
  let purchase = 0;
  for (let from = 0; ; from += 1000) {
    const { data: rows } = await supabase
      .from("wallet_transactions")
      .select("amount, wallet_type")
      .eq("vendor_id", user.id)
      .range(from, from + 999);
    const list = rows ?? [];
    for (const t of list) {
      if (t.wallet_type === "profit") profit += Number(t.amount);
      else if (t.wallet_type === "purchase") purchase += Number(t.amount);
    }
    if (list.length < 1000) break;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-ink/50">
        Mayn Sales Point
      </p>
      <h1 className="mt-1 font-display text-2xl text-indigo">
        Welcome, {profile?.full_name ?? user.email}
      </h1>

      <ProfitCard profit={profit} purchase={purchase} />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-line p-6 text-sm text-ink/60">
        Open the menu (the three lines at the top left) to reach your tools.
      </div>
    </main>
  );
}

// END OF FILE

export default function HomePage() {
  return (
    <main>
      {/* Header */}
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-display text-lg text-indigo">
            Mayn Sales Point
          </span>
          <nav className="hidden items-center gap-8 text-sm md:flex">
            <a href="#how-it-works" className="hover:text-indigo">How it works</a>
            <a href="#vendors" className="hover:text-indigo">Become a vendor</a>
            <a href="#faq" className="hover:text-indigo">FAQ</a>
            <a href="/login" className="hover:text-indigo">Log in</a>
          </nav>
          <a href="/signup"
            className="rounded-pill bg-indigo px-5 py-2 text-sm text-white hover:bg-indigo-light"
          >
            Create account
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div>
          <h1 className="font-display text-4xl leading-tight text-indigo md:text-5xl">
            Set your own price. Build your own storefront. Keep the profit.
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-ink/80">
            Mayn Sales Point lets anyone in Ghana become a vendor — buy at the
            platform price, sell at yours, share your own storefront link,
            and get paid straight to Mobile Money.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a href="/signup"
              className="rounded-pill bg-gold px-6 py-3 text-sm font-medium text-indigo hover:bg-gold-dark"
            >
              Become a Mayn Sales Point Vendor
            </a>
            <a href="/signup"
              className="rounded-pill border border-indigo px-6 py-3 text-sm font-medium text-indigo hover:bg-indigo hover:text-white"
            >
              Start Shopping
            </a>
          </div>
        </div>

        {/* Ledger-style example card instead of a generic gradient card */}
        <div className="border border-line bg-white">
          <div className="border-b border-line px-6 py-4">
            <p className="text-xs uppercase tracking-wide text-ink/50">
              Example sale
            </p>
          </div>
          <dl className="divide-y divide-line px-6">
            <div className="flex items-center justify-between py-4">
              <dt className="text-sm text-ink/70">Platform price</dt>
              <dd className="font-display text-base">GH₵50.00</dd>
            </div>
            <div className="flex items-center justify-between py-4">
              <dt className="text-sm text-ink/70">Your selling price</dt>
              <dd className="font-display text-base">GH₵60.00</dd>
            </div>
            <div className="flex items-center justify-between py-4">
              <dt className="text-sm font-medium text-leaf">Your profit</dt>
              <dd className="font-display text-base font-medium text-leaf">
                GH₵10.00
              </dd>
            </div>
          </dl>
          <p className="border-t border-line px-6 py-4 text-xs text-ink/50">
            Paid to your Mobile Money wallet once the sale is confirmed.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-line bg-indigo py-20 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl">How it works</h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {[
              {
                n: "1",
                title: "Create your storefront",
                body: "Sign up and get your own vendor page — maynsalespoint.com/s/yourname — ready to share on WhatsApp or Facebook.",
              },
              {
                n: "2",
                title: "Set your price",
                body: "Pick from products already loaded on the platform and decide your own selling price above the base cost.",
              },
              {
                n: "3",
                title: "Get paid",
                body: "When a customer pays by Mobile Money, your profit lands in your Profit Wallet — ready to withdraw.",
              },
            ].map((step) => (
              <div key={step.n} className="border border-white/20 p-6">
                <span className="font-display text-2xl text-gold">{step.n}</span>
                <h3 className="mt-3 text-lg font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vendor / affiliate network */}
      <section id="vendors" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="font-display text-3xl text-indigo">
              Build a team, not just a storefront
            </h2>
            <p className="mt-4 leading-relaxed text-ink/80">
              As a vendor, you can invite others to sell under you as
              sub-vendors. They set their own price on top of yours — and you
              still earn your profit on every sale they make, automatically.
            </p>
          </div>
          <div className="border border-line bg-white p-6">
            <p className="text-xs uppercase tracking-wide text-ink/50">
              Multi-level example
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex justify-between border-b border-line pb-3">
                <span>Platform price</span>
                <span className="font-medium">GH₵50.00</span>
              </li>
              <li className="flex justify-between border-b border-line pb-3">
                <span>Vendor A price (earns GH₵10)</span>
                <span className="font-medium">GH₵60.00</span>
              </li>
              <li className="flex justify-between border-b border-line pb-3">
                <span>Sub-vendor B price (earns GH₵5)</span>
                <span className="font-medium">GH₵65.00</span>
              </li>
              <li className="flex justify-between pt-1 text-leaf">
                <span>Customer pays</span>
                <span className="font-medium">GH₵65.00</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Mobile Money / USSD */}
      <section className="border-t border-line bg-paper py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl text-indigo">
            Built for how Ghana pays
          </h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div className="border border-line bg-white p-6">
              <h3 className="text-lg font-medium">Mobile Money</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">
                Customers pay with MTN Mobile Money, Telecel Cash, or
                AirtelTigo Money. Vendors withdraw profit the same way.
              </p>
            </div>
            <div className="border border-line bg-white p-6">
              <h3 className="text-lg font-medium">USSD access</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">
                No smartphone needed — customers without internet access will
                be able to shop through a USSD code on any phone.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl text-indigo">Questions</h2>
        <div className="mt-8 divide-y divide-line border-t border-line">
          {[
            {
              q: "Do I need money to start selling?",
              a: "No upfront stock purchase is required — you set your price and only pay the base cost once a customer's order is confirmed and paid.",
            },
            {
              q: "How do I get paid?",
              a: "Your profit is added to your Profit Wallet after a sale is confirmed. You can request a withdrawal to your Mobile Money number.",
            },
            {
              q: "Can I recruit other sellers?",
              a: "Yes. Invite sub-vendors to sell under you — you keep your profit on every sale they make.",
            },
          ].map((item) => (
            <div key={item.q} className="py-5">
              <p className="font-medium text-indigo">{item.q}</p>
              <p className="mt-2 text-sm text-ink/70">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 text-sm text-ink/60 md:flex-row md:items-center">
          <span>© {new Date().getFullYear()} Mayn Sales Point</span>
          <div className="flex gap-6">
            <a href="/login" className="hover:text-indigo">Log in</a>
            <a href="/signup" className="hover:text-indigo">Create account</a>
          </div>
        </div>
      </footer>
    </main>
  );
          }

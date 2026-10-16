import Link from "@/components/Link";
import { getCurrentUser } from "@/lib/auth";
import { getVoucherProducts } from "@/lib/scheduling";
import { ActionForm } from "@/components/ActionForm";
import { Badge, SectionHeading } from "@/components/ui";
import { purchaseVoucherAction } from "@/app/actions/booking";
import { formatMoney } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function VouchersPage() {
  const products = await getVoucherProducts();
  const user = await getCurrentUser();
  const perClass = (cents: number, count: number) => formatMoney(Math.round(cents / Math.max(count, 1)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <SectionHeading
        eyebrow="Class vouchers"
        title="Buy credits once, book any class"
        description="Vouchers are stored on your member account. One credit = one class, any style, any teacher. Cancel more than 4 hours before class and the credit returns automatically."
        action={user ? <Link href="/dashboard#vouchers" className="btn btn-outline btn-sm">My vouchers</Link> : undefined}
      />

      <div className="grid gap-5 md:grid-cols-3">
        {products.map((product) => (
          <article
            key={product.id}
            className={`card flex flex-col p-6 ${product.isFeatured ? "ring-2 ring-clay" : ""}`}
          >
            <div className="flex items-center justify-between">
              <p className="display text-xl">{product.name}</p>
              {product.isFeatured ? <Badge tone="clay">Best value</Badge> : null}
            </div>
            <p className="mt-4 text-4xl">{formatMoney(product.priceCents)}</p>
            <p className="text-xs text-ink-soft">
              ≈ {perClass(product.priceCents, product.classCount)} per class · {product.classCount} credits ·{" "}
              {product.validityDays} days validity
            </p>
            <p className="mt-4 text-sm text-ink-soft">{product.description}</p>
            <ul className="mt-4 space-y-1.5 text-xs text-ink-soft">
              {product.perks.split(",").filter(Boolean).map((perk) => (
                <li key={perk} className="flex gap-2">
                  <span className="text-sage">✓</span>
                  {perk.trim()}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {user ? (
                <ActionForm
                  action={purchaseVoucherAction}
                  submitLabel={`Pay ${formatMoney(product.priceCents)}`}
                  pendingLabel="Processing payment…"
                  submitClassName="btn btn-primary w-full"
                  className="space-y-3"
                >
                  <input type="hidden" name="productId" value={product.id} />
                  <div>
                    <label className="label" htmlFor={`method-${product.id}`}>Payment method</label>
                    <select id={`method-${product.id}`} name="method" className="field" defaultValue="card">
                      <option value="card">Credit / debit card</option>
                      <option value="online_banking">Online banking (FPX)</option>
                      <option value="ewallet">e-Wallet</option>
                      <option value="studio">Pay at studio reception</option>
                    </select>
                  </div>
                </ActionForm>
              ) : (
                <Link href={`/register?next=${encodeURIComponent("/vouchers")}`} className="btn btn-primary w-full">
                  Create account to buy
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="card grain mt-10 p-8">
        <h2 className="display text-2xl">Voucher terms, in plain language</h2>
        <div className="mt-4 grid gap-4 text-sm text-ink-soft sm:grid-cols-2">
          <p>· Credits never expire silently — you get an email-style in-app notification 7 days before expiry.</p>
          <p>· Cancel more than 4 hours before a class and the credit returns to your voucher instantly.</p>
          <p>· Late cancellations and no-shows keep the credit, as the mat was held for you.</p>
          <p>· If the studio cancels or moves a class, credits are refunded automatically.</p>
          <p>· Vouchers are transferable once — ask reception before the class.</p>
          <p>· Workshops and events may require two credits, always shown on the class card.</p>
        </div>
      </div>
    </div>
  );
}

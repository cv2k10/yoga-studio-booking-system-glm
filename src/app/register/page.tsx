import Link from "@/components/Link";
import { ActionForm } from "@/components/ActionForm";
import { registerAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2">
      <div className="card grain p-8">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-clay">Join the studio</p>
        <h1 className="mt-2 text-3xl">Create your member account</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Free to join. Add a class voucher whenever you are ready and start booking.
        </p>

        <div className="mt-6">
          <ActionForm action={registerAction} submitLabel="Create account" pendingLabel="Creating account…" submitClassName="btn btn-primary w-full" className="space-y-4">
            <input type="hidden" name="next" value={next ?? "/dashboard"} />
            <div>
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" name="name" required className="field" placeholder="Aisyah Rahman" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required className="field" placeholder="you@example.com" />
            </div>
            <div>
              <label className="label" htmlFor="phone">Mobile (optional)</label>
              <input id="phone" name="phone" className="field" placeholder="+60 12 345 6789" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" required minLength={6} className="field" placeholder="At least 6 characters" />
            </div>
          </ActionForm>
        </div>

        <p className="mt-5 text-sm text-ink-soft">
          Already a member?{" "}
          <Link href={`/login?next=${encodeURIComponent(next ?? "/dashboard")}`} className="font-semibold text-clay link-underline">
            Sign in
          </Link>
        </p>
      </div>

      <div className="space-y-4">
        {[
          { t: "Fixed weekly timetable", d: "Classes repeat weekly so you can lock in your rhythm." },
          { t: "Class vouchers, not contracts", d: "Buy 5, 10 or 20 credits. No monthly lock-in." },
          { t: "Instant booking proof", d: "Every booking issues a reference and QR code you can show at the door." },
          { t: "Change notifications", d: "If a time, teacher or room changes you hear it from us first." },
        ].map((item) => (
          <div key={item.t} className="card p-5">
            <p className="display text-lg">{item.t}</p>
            <p className="mt-1 text-sm text-ink-soft">{item.d}</p>
          </div>
        ))}
        <div className="overflow-hidden rounded-3xl">
          <img
            src="https://images.pexels.com/photos/4148928/pexels-photo-4148928.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900"
            alt="Member stretching on a yoga mat"
            className="h-56 w-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}

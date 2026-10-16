import Link from "@/components/Link";
import { ActionForm } from "@/components/ActionForm";
import { loginAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2">
      <div className="card grain p-8">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-clay">Member sign in</p>
        <h1 className="mt-2 text-3xl">Welcome back to the studio</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Sign in to book classes from the weekly timetable, view your vouchers and download booking
          proofs.
        </p>

        <div className="mt-6">
          <ActionForm action={loginAction} submitLabel="Sign in" pendingLabel="Signing in…" submitClassName="btn btn-primary w-full" className="space-y-4">
            <input type="hidden" name="next" value={next ?? ""} />
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required className="field" placeholder="you@example.com" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" required className="field" placeholder="••••••" />
            </div>
          </ActionForm>
        </div>

        <p className="mt-5 text-sm text-ink-soft">
          New here?{" "}
          <Link href={`/register?next=${encodeURIComponent(next ?? "/dashboard")}`} className="font-semibold text-clay link-underline">
            Create a member account
          </Link>
        </p>

        <div className="mt-6 rounded-2xl bg-sand-deep/60 p-4 text-xs text-ink-soft">
          <p className="font-bold text-ink">Demo accounts</p>
          <p className="mt-1">Member: <span className="font-mono">maya@sattva.fit</span> / <span className="font-mono">studio123</span></p>
          <p>Studio admin: <span className="font-mono">admin@sattva.fit</span> / <span className="font-mono">studio123</span></p>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-3xl md:block">
        <img
          src="https://images.pexels.com/photos/8436469/pexels-photo-8436469.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=800"
          alt="Members in a yoga class"
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

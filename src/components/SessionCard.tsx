import Link from "@/components/Link";
import { ActionForm } from "@/components/ActionForm";
import { Badge, CATEGORY_STYLES } from "@/components/ui";
import { bookClassAction } from "@/app/actions/booking";
import { formatRange, isPast } from "@/lib/dates";
import type { SessionView } from "@/lib/scheduling";

export function CapacityBar({ booked, capacity }: { booked: number; capacity: number }) {
  const pct = Math.min(100, Math.round((booked / Math.max(capacity, 1)) * 100));
  const tone = pct >= 100 ? "bg-clay" : pct >= 75 ? "bg-amber-500" : "bg-sage";
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/8">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[0.68rem] font-semibold text-ink-soft">
        {booked}/{capacity} mats booked
      </p>
    </div>
  );
}

export function SessionCard({
  session,
  signedIn,
  vouchers,
  compact = false,
}: {
  session: SessionView;
  signedIn: boolean;
  vouchers: { id: number; code: string; creditsRemaining: number }[];
  compact?: boolean;
}) {
  const category = CATEGORY_STYLES[session.category] ?? CATEGORY_STYLES.yoga;
  const past = isPast(session.sessionDate, session.startTime);
  const cancelled = session.status !== "scheduled";
  const full = session.booked >= session.capacity;
  const mine = Boolean(session.myBookingId);

  return (
    <article
      className={`card flex h-full flex-col gap-3 p-4 ${cancelled ? "opacity-70" : ""} ${
        mine ? "ring-1 ring-sage/50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold tabular-nums text-clay">
            {formatRange(session.startTime, session.durationMinutes)}
          </p>
          <Link href={`/classes/${session.classTypeSlug}`} className="display text-lg leading-tight hover:text-clay">
            {session.classTypeName}
          </Link>
          <p className="text-xs text-ink-soft">{session.intensity}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`pill ${category.chip}`}>{category.label}</span>
          {session.isExtra ? <Badge tone="clay">Extra class</Badge> : null}
          {session.changeCount > 0 ? <Badge tone="warn">Updated</Badge> : null}
          {mine ? <Badge tone="sage">Booked</Badge> : null}
        </div>
      </div>

      <div className="space-y-1 text-xs text-ink-soft">
        <p>
          with{" "}
          <Link href={`/teachers/${session.teacherSlug}`} className="font-semibold text-ink hover:text-clay">
            {session.teacherName}
          </Link>
        </p>
        <p>
          <Link href={`/rooms/${session.roomSlug}`} className="hover:text-clay">
            {session.roomName}
          </Link>{" "}
          · {session.roomView}
        </p>
      </div>

      {session.note && !compact ? (
        <p className="rounded-xl bg-sand-deep/60 px-3 py-2 text-[0.7rem] text-ink-soft">{session.note}</p>
      ) : null}

      <div className="mt-auto space-y-3">
        <CapacityBar booked={session.booked} capacity={session.capacity} />

        {cancelled ? <p className="pill bg-clay/12 text-clay">Cancelled by studio</p> : null}
        {past && !cancelled ? <p className="pill bg-black/5 text-ink-soft">Class finished</p> : null}

        {cancelled || past ? null : mine ? (
          <Link href={`/dashboard`} className="btn btn-sage btn-sm w-full">
            Booking confirmed · view proof
          </Link>
        ) : !signedIn ? (
          <Link
            href={`/login?next=${encodeURIComponent(`/timetable?date=${session.sessionDate}`)}`}
            className="btn btn-outline btn-sm w-full"
          >
            Sign in to book
          </Link>
        ) : full ? (
          <span className="btn btn-outline btn-sm w-full cursor-not-allowed opacity-60">Fully booked</span>
        ) : vouchers.length === 0 ? (
          <Link href="/vouchers" className="btn btn-outline btn-sm w-full">
            Buy credits to book
          </Link>
        ) : (
          <ActionForm
            action={bookClassAction}
            submitLabel="Book this class"
            pendingLabel="Reserving…"
            submitClassName="btn btn-primary btn-sm w-full"
            className="space-y-2"
          >
            <input type="hidden" name="sessionId" value={session.id} />
            {vouchers.length > 1 ? (
              <select name="voucherId" className="field" defaultValue={vouchers[0].id}>
                {vouchers.map((voucher) => (
                  <option key={voucher.id} value={voucher.id}>
                    {voucher.code} · {voucher.creditsRemaining} credit
                    {voucher.creditsRemaining === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            ) : (
              <input type="hidden" name="voucherId" value={vouchers[0]?.id ?? ""} />
            )}
          </ActionForm>
        )}
      </div>
    </article>
  );
}

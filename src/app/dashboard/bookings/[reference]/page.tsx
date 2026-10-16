import Link from "@/components/Link";
import { notFound } from "@/lib/next";
import QRCode from "qrcode";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, classSessions, classTypes, payments, rooms, teachers, vouchers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { getSessionChanges } from "@/lib/scheduling";
import {
  formatDateLong,
  formatDateTime,
  formatMoney,
  formatRange,
  hoursUntil,
  isPast,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function BookingProofPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const user = await requireUser(`/dashboard/bookings/${reference}`);

  const [row] = await db
    .select({
      booking: bookings,
      session: classSessions,
      classType: classTypes,
      teacher: teachers,
      room: rooms,
      voucher: vouchers,
    })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .innerJoin(teachers, eq(classSessions.teacherId, teachers.id))
    .innerJoin(rooms, eq(classSessions.roomId, rooms.id))
    .leftJoin(vouchers, eq(bookings.voucherId, vouchers.id))
    .where(and(eq(bookings.reference, reference), eq(bookings.userId, user.id)))
    .limit(1);

  if (!row) notFound();

  const changes = await getSessionChanges(row.session.id);
  const payment = row.voucher
    ? (
        await db
          .select()
          .from(payments)
          .where(and(eq(payments.voucherId, row.voucher.id), eq(payments.userId, user.id)))
          .limit(1)
      )[0]
    : undefined;

  const payload = `SATVASTUDIO|${row.booking.reference}|${row.session.sessionDate}|${row.session.startTime}|${row.classType.name}`;
  const qrSvg = await QRCode.toString(payload, {
    type: "svg",
    margin: 0,
    width: 200,
    color: { dark: "#17150f", light: "#00000000" },
  });

  const cancelled = row.booking.status === "cancelled" || row.session.status === "cancelled";
  const attended = row.booking.status === "attended";
  const past = isPast(row.session.sessionDate, row.session.startTime);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="btn btn-ghost btn-sm">← Back to my bookings</Link>
        <div className="flex gap-2">
          <PrintButton />
          <Link href="/timetable" className="btn btn-outline btn-sm">Book another class</Link>
        </div>
      </div>

      <article className="print-sheet card overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-4 bg-ink px-6 py-5 text-sand sm:px-8">
          <div>
            <p className="display text-2xl">Sattva Studio</p>
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">Proof of class booking</p>
          </div>
          <div className="text-right">
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-white/60">Booking reference</p>
            <p className="font-mono text-lg font-bold">{row.booking.reference}</p>
          </div>
        </header>

        <div className="grid gap-6 px-6 py-6 sm:grid-cols-[1fr_200px] sm:px-8">
          <div>
            <h1 className="display text-3xl">{row.classType.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">{row.classType.tagline}</p>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { k: "Date", v: formatDateLong(row.session.sessionDate) },
                { k: "Time", v: formatRange(row.session.startTime, row.session.durationMinutes) },
                { k: "Teacher", v: row.teacher.name },
                { k: "Studio room", v: `${row.room.name} · ${row.room.viewName}` },
                { k: "Booked by", v: `${user.name} (${user.email})` },
                { k: "Booked on", v: formatDateTime(row.booking.createdAt) },
                { k: "Voucher", v: row.voucher ? `${row.voucher.code} · 1 credit` : "Complimentary" },
                {
                  k: "Paid",
                  v: payment ? `${formatMoney(payment.amountCents)} via ${payment.method.replace("_", " ")}` : "—",
                },
              ].map((item) => (
                <div key={item.k} className="rounded-2xl bg-sand-deep/50 px-4 py-3">
                  <dt className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-soft">{item.k}</dt>
                  <dd className="mt-0.5 text-sm font-semibold">{item.v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {cancelled ? <Badge tone="clay">Cancelled</Badge> : null}
              {attended ? <Badge tone="sage">Attended · checked in</Badge> : null}
              {!cancelled && !attended && past ? <Badge tone="warn">Completed · not checked in</Badge> : null}
              {!cancelled && !attended && !past ? <Badge tone="sage">Confirmed</Badge> : null}
              {row.booking.checkedInAt ? (
                <span className="text-xs text-ink-soft">Checked in {formatDateTime(row.booking.checkedInAt)}</span>
              ) : null}
            </div>

            <p className="mt-5 rounded-2xl border border-dashed border-ink/20 px-4 py-3 text-xs text-ink-soft">
              Show this QR code at reception. Cancellations close 4 hours before class; later
              cancellations keep the credit. If the studio changes the time, teacher or room you will
              be notified in your inbox.
            </p>
          </div>

          <aside className="flex flex-col items-center justify-start gap-3 rounded-2xl border border-ink/10 p-4">
            <div
              className="h-40 w-40 [&>svg]:h-full [&>svg]:w-full"
              aria-label={`QR code for booking ${row.booking.reference}`}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="text-center font-mono text-xs font-bold">{row.booking.reference}</p>
            <p className="text-center text-[0.65rem] uppercase tracking-[0.12em] text-ink-soft">
              Scan at the studio door
            </p>
          </aside>
        </div>

        <section className="border-t border-ink/10 bg-white px-6 py-5 sm:px-8">
          <h2 className="display text-lg">Class schedule history</h2>
          <p className="text-xs text-ink-soft">
            Every change the studio made to this class, newest first.
          </p>
          <ul className="mt-3 space-y-2">
            {changes.map((change) => (
              <li key={change.id} className="rounded-xl bg-sand-deep/40 px-4 py-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={change.changeType === "cancellation" ? "clay" : "warn"}>{change.changeType}</Badge>
                  <span className="font-semibold">{change.label}</span>
                  <span className="ml-auto text-ink-soft">{formatDateTime(change.createdAt)}</span>
                </div>
                <p className="mt-1 text-ink-soft">
                  {change.oldValue ? `Was: ${change.oldValue}. ` : ""}
                  {change.newValue ? `Now: ${change.newValue}.` : ""}
                  {change.note ? ` ${change.note}` : ""}
                </p>
              </li>
            ))}
            {changes.length === 0 ? (
              <li className="rounded-xl bg-sand-deep/40 px-4 py-2.5 text-xs text-ink-soft">
                No changes — the class is exactly as originally scheduled.
              </li>
            ) : null}
          </ul>
        </section>
      </article>

      {!cancelled && !past ? (
        <p className="no-print mt-4 text-center text-xs text-ink-soft">
          This class starts in {Math.max(hoursUntil(row.session.sessionDate, row.session.startTime), 0).toFixed(1)} hours.
        </p>
      ) : null}
    </div>
  );
}

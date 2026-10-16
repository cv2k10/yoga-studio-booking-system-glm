"use server";

import { and, asc, eq, gt, ne, sql } from "drizzle-orm";
import { revalidatePath } from "@/lib/next";
import { db, runBatch } from "@/db";
import { bookings, classSessions, notifications, payments, vouchers, voucherProducts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, type ActionState } from "@/lib/actions";
import { addDaysISO, formatMoney, hoursUntil, isPast, todayISO } from "@/lib/dates";
import { getSessionById } from "@/lib/scheduling";

const CANCELLATION_WINDOW_HOURS = 4;

function reference(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${hex.toUpperCase()}`;
}

function str(data: FormData, key: string): string {
  return `${data.get(key) ?? ""}`.trim();
}

export async function bookClassAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in or register to book this class.");

  const sessionId = Number(data.get("sessionId"));
  const session = await getSessionById(sessionId, user.id);
  if (!session) return fail("That class is no longer on the timetable.");
  if (session.status !== "scheduled") return fail("This class has been cancelled by the studio.");
  if (isPast(session.sessionDate, session.startTime)) return fail("This class has already started.");

  const existing = session.myBookingId;
  if (existing) return fail("You already have a spot in this class.");

  if (session.booked >= session.capacity) {
    return fail("This class is fully booked. Choose another slot or contact the studio.");
  }

  // Pick an active voucher with credit (explicit choice wins).
  const requestedVoucherId = Number(data.get("voucherId")) || null;
  const candidates = await db
    .select()
    .from(vouchers)
    .where(
      and(
        eq(vouchers.userId, user.id),
        eq(vouchers.status, "active"),
        gt(vouchers.creditsRemaining, 0),
        gt(vouchers.expiresAt, todayISO()),
      ),
    )
    .orderBy(asc(vouchers.expiresAt));

  const voucher = requestedVoucherId
    ? candidates.find((v) => v.id === requestedVoucherId)
    : candidates[0];

  if (!voucher) {
    return fail("You need class credits to book. Purchase a class voucher first.");
  }

  // D1 has no interactive transactions. The batch runs atomically, and each
  // statement re-checks its precondition so concurrent requests cannot
  // overfill the class or spend the same credit twice. The partial unique
  // index on (user_id, session_id) rejects a second active booking.
  const bookingRef = reference("SAT");
  const today = todayISO();
  let inserted: D1Result;
  try {
    [inserted] = (await runBatch([
      sql`
        insert into ${bookings} (reference, user_id, session_id, voucher_id, status, credits_used)
        select ${bookingRef}, ${user.id}, ${sessionId}, ${voucher.id}, 'confirmed', 1
        where (
          select count(*) from ${bookings}
          where session_id = ${sessionId} and status <> 'cancelled'
        ) < (select capacity from ${classSessions} where id = ${sessionId} and status = 'scheduled')
          and exists (
            select 1 from ${vouchers}
            where id = ${voucher.id} and status = 'active' and credits_remaining > 0 and expires_at > ${today}
          )
      `,
      sql`
        update ${vouchers}
        set credits_remaining = credits_remaining - 1,
            status = case when credits_remaining - 1 <= 0 then 'depleted' else 'active' end
        where id = ${voucher.id}
          and exists (select 1 from ${bookings} where reference = ${bookingRef})
      `,
    ])) as [D1Result, D1Result];
  } catch (error) {
    if (`${error}`.includes("UNIQUE")) return fail("You already have a spot in this class.");
    throw error;
  }
  if (!inserted.meta.changes) {
    return fail("This class just filled up or your voucher has no credits left. Please refresh and try again.");
  }

  const [booking] = await db.select().from(bookings).where(eq(bookings.reference, bookingRef)).limit(1);
  const [updatedVoucher] = await db.select().from(vouchers).where(eq(vouchers.id, voucher.id)).limit(1);
  const remaining = updatedVoucher?.creditsRemaining ?? voucher.creditsRemaining - 1;

  await db.insert(notifications).values({
    userId: user.id,
    type: "booking",
    title: `Booking confirmed · ${session.classTypeName}`,
    body: `${session.classTypeName} with ${session.teacherName} on ${session.sessionDate} at ${session.startTime}, ${session.roomName}. Booking reference ${booking.reference}. ${remaining} credit${remaining === 1 ? "" : "s"} left on ${voucher.code}.`,
    sessionId,
    bookingId: booking.id,
    actionHref: `/dashboard/bookings/${booking.reference}`,
  });

  revalidatePath("/timetable");
  revalidatePath("/dashboard");
  return ok(
    `Spot confirmed! Reference ${booking.reference}. ${remaining} credit${remaining === 1 ? "" : "s"} remaining on ${voucher.code}.`,
  );
}

export async function cancelBookingAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in first.");
  const bookingId = Number(data.get("bookingId"));

  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, user.id)))
    .limit(1);
  if (!booking) return fail("Booking not found.");
  if (booking.status !== "confirmed") return fail("This booking is no longer active.");

  const session = await getSessionById(booking.sessionId, user.id);
  if (!session) return fail("Class not found.");

  const hours = hoursUntil(session.sessionDate, session.startTime);
  if (hours < CANCELLATION_WINDOW_HOURS) {
    return fail(
      `Late cancellation: this class starts in ${Math.max(hours, 0).toFixed(1)}h. Cancellations close 4 hours before class and the credit is retained.`,
    );
  }

  // Refund and cancel in one atomic batch. The refund only applies while the
  // booking is still confirmed, so a double submit cannot refund twice.
  const [, cancelled] = (await runBatch([
    sql`
      update ${vouchers}
      set credits_remaining = min(credits_total, credits_remaining + ${booking.creditsUsed}),
          status = 'active'
      where id = ${booking.voucherId ?? 0} and status <> 'expired'
        and exists (select 1 from ${bookings} where id = ${booking.id} and status = 'confirmed')
    `,
    sql`
      update ${bookings} set status = 'cancelled', cancelled_at = unixepoch()
      where id = ${booking.id} and status = 'confirmed'
    `,
  ])) as [D1Result, D1Result];
  if (!cancelled.meta.changes) return fail("This booking is no longer active.");

  await db.insert(notifications).values({
    userId: user.id,
    type: "booking",
    title: `Booking cancelled · ${session.classTypeName}`,
    body: `Your spot in ${session.classTypeName} on ${session.sessionDate} at ${session.startTime} was released and 1 credit returned to your account.`,
    sessionId: session.id,
    actionHref: "/dashboard",
  });

  revalidatePath("/dashboard");
  revalidatePath("/timetable");
  return ok("Booking cancelled and your class credit was returned.");
}

export async function purchaseVoucherAction(
  _prev: ActionState,
  data: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in or register to purchase a voucher.");

  const productId = Number(data.get("productId"));
  const method = str(data, "method") || "card";
  const [product] = await db
    .select()
    .from(voucherProducts)
    .where(and(eq(voucherProducts.id, productId), eq(voucherProducts.isActive, true)))
    .limit(1);
  if (!product) return fail("That voucher pack is unavailable.");

  const code = reference("VCH");
  const [voucher] = await db
    .insert(vouchers)
    .values({
      code,
      userId: user.id,
      productId: product.id,
      productName: product.name,
      creditsTotal: product.classCount,
      creditsRemaining: product.classCount,
      priceCents: product.priceCents,
      expiresAt: addDaysISO(todayISO(), product.validityDays),
      status: "active",
    })
    .returning();

  await db.insert(payments).values({
    userId: user.id,
    voucherId: voucher.id,
    reference: reference("PAY"),
    amountCents: product.priceCents,
    method,
    status: "paid",
  });

  await db.insert(notifications).values({
    userId: user.id,
    type: "voucher",
    title: `${product.classCount}-class voucher added`,
    body: `${product.name} · ${formatMoney(product.priceCents)} paid by ${method}. Voucher ${code} is valid until ${voucher.expiresAt}.`,
    actionHref: "/dashboard#vouchers",
  });

  revalidatePath("/dashboard");
  revalidatePath("/vouchers");
  return ok(`Payment successful. Voucher ${code} with ${product.classCount} credits is ready to use.`);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, user.id), ne(notifications.isRead, true)));
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markNotificationReadAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in first.");
  const id = Number(data.get("notificationId"));
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
  revalidatePath("/notifications");
  return ok("Marked as read.");
}

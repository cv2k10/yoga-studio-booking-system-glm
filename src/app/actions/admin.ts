"use server";

import { and, eq, gte, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  bookings,
  classSessions,
  classTemplates,
  classTypes,
  notifications,
  rooms,
  sessionChanges,
  teachers,
  users,
  voucherProducts,
  vouchers,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, type ActionState } from "@/lib/actions";
import { addDaysISO, formatTime, todayISO } from "@/lib/dates";
import {
  ensureSessionHorizon,
  notifyMany,
  notifySessionChange,
  rebuildFutureSessions,
} from "@/lib/scheduling";

function str(data: FormData, key: string): string {
  return `${data.get(key) ?? ""}`.trim();
}
function num(data: FormData, key: string): number {
  return Number(data.get(key) ?? 0);
}

async function adminName(): Promise<string> {
  const user = await getCurrentUser();
  return user?.name ?? "Studio admin";
}

function refreshAll() {
  revalidatePath("/", "layout");
  revalidatePath("/timetable");
  revalidatePath("/admin");
  revalidatePath("/admin/timetable");
  revalidatePath("/admin/sessions");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}

/* --------------------------- weekly templates --------------------------- */
export async function saveTemplateAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const id = num(data, "templateId");
  const payload = {
    classTypeId: num(data, "classTypeId"),
    teacherId: num(data, "teacherId"),
    roomId: num(data, "roomId"),
    dayOfWeek: num(data, "dayOfWeek"),
    startTime: str(data, "startTime"),
    durationMinutes: num(data, "durationMinutes") || 60,
    capacity: num(data, "capacity") || 12,
    isPublished: str(data, "isPublished") === "on",
  };
  if (!payload.classTypeId || !payload.teacherId || !payload.roomId) {
    return fail("Select a class type, teacher and studio room.");
  }
  if (!/^\d{2}:\d{2}$/.test(payload.startTime)) return fail("Enter a start time such as 07:00.");

  if (id) {
    await db.update(classTemplates).set(payload).where(eq(classTemplates.id, id));
  } else {
    await db.insert(classTemplates).values(payload);
  }
  await ensureSessionHorizon();
  refreshAll();
  return ok(id ? "Weekly slot updated. Sync the timetable to apply to upcoming dates." : "Weekly slot added to the timetable.");
}

export async function deleteTemplateAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const id = num(data, "templateId");
  await db.delete(classTemplates).where(eq(classTemplates.id, id));
  await rebuildFutureSessions(await adminName());
  refreshAll();
  return ok("Weekly slot removed and future unbooked classes cleared.");
}

export async function syncTimetableAction(): Promise<void> {
  const who = await adminName();
  await rebuildFutureSessions(who);
  refreshAll();
}

export async function extendTimetableAction(): Promise<void> {
  await ensureSessionHorizon();
  refreshAll();
}

/* ------------------------- single session changes ------------------------ */
export async function updateSessionAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const actor = await adminName();
  const sessionId = num(data, "sessionId");
  const [session] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId)).limit(1);
  if (!session) return fail("Class not found.");

  const teacherId = num(data, "teacherId");
  const roomId = num(data, "roomId");
  const startTime = str(data, "startTime");
  const durationMinutes = num(data, "durationMinutes") || session.durationMinutes;
  const capacity = num(data, "capacity") || session.capacity;
  const note = str(data, "note");

  const [teacher] = await db.select().from(teachers).where(eq(teachers.id, teacherId)).limit(1);
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const [originalTeacher] = await db.select().from(teachers).where(eq(teachers.id, session.teacherId)).limit(1);
  const [originalRoom] = await db.select().from(rooms).where(eq(rooms.id, session.roomId)).limit(1);
  if (!teacher || !room) return fail("Select a teacher and a room.");

  const changes: string[] = [];

  if (startTime !== session.startTime) {
    await notifySessionChange({
      sessionId,
      changeType: "time",
      label: `Time changed · ${session.sessionDate}`,
      oldValue: formatTime(session.startTime),
      newValue: formatTime(startTime),
      note: note || `Please arrive 10 minutes before the new start time.`,
      actorName: actor,
    });
    changes.push(`time → ${startTime}`);
  }

  if (teacherId !== session.teacherId) {
    await notifySessionChange({
      sessionId,
      changeType: "teacher",
      label: `Substitute teacher · ${session.sessionDate}`,
      oldValue: originalTeacher?.name ?? "—",
      newValue: teacher.name,
      note: note || `${teacher.name} will take this class.`,
      actorName: actor,
    });
    changes.push(`teacher → ${teacher.name}`);
  }

  if (roomId !== session.roomId) {
    await notifySessionChange({
      sessionId,
      changeType: "room",
      label: `Room changed · ${session.sessionDate}`,
      oldValue: originalRoom?.name ?? "—",
      newValue: `${room.name} (${room.viewName})`,
      note: note || `Head to ${room.name} on the ${room.floor}.`,
      actorName: actor,
    });
    changes.push(`room → ${room.name}`);
  }

  await db
    .update(classSessions)
    .set({
      teacherId,
      roomId,
      startTime,
      durationMinutes,
      capacity,
      note: note || session.note,
    })
    .where(eq(classSessions.id, sessionId));

  if (changes.length === 0) {
    refreshAll();
    return ok("Saved. No schedule-affecting changes were detected.");
  }

  await db.insert(sessionChanges).values({
    sessionId,
    changeType: "update",
    label: `Class updated · ${session.sessionDate}`,
    oldValue: null,
    newValue: changes.join(", "),
    note,
    actorName: actor,
  });

  refreshAll();
  await ensureSessionHorizon();
  return ok(`Updated and notified booked members: ${changes.join(", ")}.`);
}

export async function cancelSessionAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const actor = await adminName();
  const sessionId = num(data, "sessionId");
  const reason = str(data, "reason") || "Cancelled by the studio.";
  const [session] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId)).limit(1);
  if (!session) return fail("Class not found.");
  if (session.status === "cancelled") return fail("This class is already cancelled.");

  await db.update(classSessions).set({ status: "cancelled" }).where(eq(classSessions.id, sessionId));

  await notifySessionChange({
    sessionId,
    changeType: "cancellation",
    label: `Class cancelled · ${session.sessionDate}`,
    oldValue: `${formatTime(session.startTime)} · ${session.durationMinutes} min`,
    newValue: "Cancelled",
    note: reason,
    actorName: actor,
  });

  // Refund credits for cancelled class.
  const affected = await db
    .select({ id: bookings.id, userId: bookings.userId, voucherId: bookings.voucherId })
    .from(bookings)
    .where(and(eq(bookings.sessionId, sessionId), eq(bookings.status, "confirmed")));

  for (const booking of affected) {
    await db
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(bookings.id, booking.id));
    if (booking.voucherId) {
      const [voucher] = await db
        .select()
        .from(vouchers)
        .where(eq(vouchers.id, booking.voucherId))
        .limit(1);
      if (voucher && voucher.status !== "expired") {
        const credits = Math.min(voucher.creditsTotal, voucher.creditsRemaining + 1);
        await db
          .update(vouchers)
          .set({ creditsRemaining: credits, status: "active" })
          .where(eq(vouchers.id, voucher.id));
      }
    }
  }

  refreshAll();
  return ok(`Class cancelled. ${affected.length} booking(s) refunded and members notified.`);
}

export async function reinstateSessionAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const sessionId = num(data, "sessionId");
  const [session] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId)).limit(1);
  if (!session) return fail("Class not found.");
  await db.update(classSessions).set({ status: "scheduled" }).where(eq(classSessions.id, sessionId));
  await notifySessionChange({
    sessionId,
    changeType: "reinstated",
    label: `Class back on · ${session.sessionDate}`,
    oldValue: "Cancelled",
    newValue: `${formatTime(session.startTime)} · ${session.durationMinutes} min`,
    note: "The class is running again. Your booking is active.",
  });
  refreshAll();
  return ok("Class reinstated.");
}

export async function addExtraClassAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const actor = await adminName();
  const payload = {
    classTypeId: num(data, "classTypeId"),
    teacherId: num(data, "teacherId"),
    roomId: num(data, "roomId"),
    sessionDate: str(data, "sessionDate"),
    startTime: str(data, "startTime"),
    durationMinutes: num(data, "durationMinutes") || 60,
    capacity: num(data, "capacity") || 12,
    note: str(data, "note") || null,
    isExtra: true,
  };
  if (!payload.classTypeId || !payload.teacherId || !payload.roomId) {
    return fail("Select a class type, teacher and studio room.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.sessionDate)) return fail("Choose a date for the extra class.");
  if (!/^\d{2}:\d{2}$/.test(payload.startTime)) return fail("Enter a start time such as 19:30.");

  const [created] = await db.insert(classSessions).values(payload).returning();
  await db.insert(sessionChanges).values({
    sessionId: created.id,
    changeType: "extra",
    label: `Extra class added · ${payload.sessionDate}`,
    newValue: `${formatTime(payload.startTime)} · ${payload.durationMinutes} min`,
    note: payload.note,
    actorName: actor,
  });

  const members = await db.select({ id: users.id }).from(users).where(eq(users.role, "member"));
  await notifyMany(
    members.map((m) => m.id),
    {
      type: "change",
      title: "New extra class added",
      body: `An extra class was added on ${payload.sessionDate} at ${formatTime(payload.startTime)}. Book your spot from the timetable.`,
      actionHref: `/timetable?date=${payload.sessionDate}`,
    },
  );

  refreshAll();
  return ok("Extra class published and announced to members.");
}

export async function setAttendanceAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const bookingId = num(data, "bookingId");
  const status = str(data, "status");
  if (!["attended", "no_show", "confirmed"].includes(status)) return fail("Unknown status.");
  await db
    .update(bookings)
    .set({ status, checkedInAt: status === "attended" ? new Date() : null })
    .where(eq(bookings.id, bookingId));
  revalidatePath("/admin/bookings");
  return ok("Attendance updated.");
}

/* ------------------------------- catalogues ----------------------------- */
export async function saveTeacherAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const id = num(data, "teacherId");
  const name = str(data, "name");
  if (name.length < 2) return fail("Enter the teacher's name.");
  const slug =
    str(data, "slug") ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const payload = {
    name,
    slug,
    title: str(data, "title") || "Yoga & Pilates teacher",
    bio: str(data, "bio"),
    photoUrl:
      str(data, "photoUrl") ||
      "https://images.pexels.com/photos/4056723/pexels-photo-4056723.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    specialties: str(data, "specialties"),
    certifications: str(data, "certifications"),
    yearsExperience: num(data, "yearsExperience") || 1,
    instagram: str(data, "instagram") || null,
    isActive: str(data, "isActive") === "on",
  };
  if (id) {
    await db.update(teachers).set(payload).where(eq(teachers.id, id));
  } else {
    await db.insert(teachers).values(payload);
  }
  revalidatePath("/teachers");
  revalidatePath("/admin/teachers");
  revalidatePath("/", "layout");
  return ok(id ? "Teacher profile updated." : "Teacher added to the studio roster.");
}

export async function saveRoomAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const id = num(data, "roomId");
  const name = str(data, "name");
  if (name.length < 2) return fail("Enter the room name.");
  const slug =
    str(data, "slug") ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const payload = {
    name,
    slug,
    viewName: str(data, "viewName") || "Garden view",
    description: str(data, "description"),
    imageUrl:
      str(data, "imageUrl") ||
      "https://images.pexels.com/photos/8143699/pexels-photo-8143699.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    capacity: num(data, "capacity") || 12,
    floor: str(data, "floor") || "Ground floor",
    amenities: str(data, "amenities"),
    isActive: str(data, "isActive") === "on",
  };
  if (id) {
    await db.update(rooms).set(payload).where(eq(rooms.id, id));
  } else {
    await db.insert(rooms).values(payload);
  }
  revalidatePath("/rooms");
  revalidatePath("/admin/rooms");
  revalidatePath("/", "layout");
  return ok(id ? "Studio room updated." : "Studio room added.");
}

export async function saveProductAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const id = num(data, "productId");
  const payload = {
    name: str(data, "name"),
    classCount: num(data, "classCount"),
    priceCents: Math.round(Number(data.get("price") ?? 0) * 100),
    validityDays: num(data, "validityDays") || 180,
    description: str(data, "description"),
    perks: str(data, "perks"),
    isFeatured: str(data, "isFeatured") === "on",
    isActive: str(data, "isActive") === "on",
  };
  if (!payload.name || payload.classCount < 1 || payload.priceCents <= 0) {
    return fail("Enter a name, class count and price.");
  }
  if (id) {
    await db.update(voucherProducts).set(payload).where(eq(voucherProducts.id, id));
  } else {
    await db.insert(voucherProducts).values(payload);
  }
  revalidatePath("/vouchers");
  revalidatePath("/admin/vouchers");
  return ok(id ? "Voucher pack updated." : "Voucher pack created.");
}

/* ------------------------------ member admin ---------------------------- */
export async function toggleMemberAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const id = num(data, "userId");
  const [member] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!member) return fail("Member not found.");
  if (member.role === "admin") return fail("Admin accounts cannot be deactivated here.");
  await db.update(users).set({ isActive: !member.isActive }).where(eq(users.id, id));
  revalidatePath("/admin/members");
  return ok(member.isActive ? "Member deactivated." : "Member reactivated.");
}

export async function grantCreditsAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const userId = num(data, "userId");
  const credits = num(data, "credits");
  const note = str(data, "note");
  if (credits <= 0) return fail("Enter how many credits to grant.");
  const [voucher] = await db
    .insert(vouchers)
    .values({
      code: `VCH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId,
      productName: note || "Studio complimentary credit",
      creditsTotal: credits,
      creditsRemaining: credits,
      priceCents: 0,
      expiresAt: addDaysISO(todayISO(), 180),
      status: "active",
    })
    .returning();
  await notifyMany([userId], {
    type: "voucher",
    title: `${credits} complimentary class credit${credits === 1 ? "" : "s"} added`,
    body: `The studio added ${credits} credit(s) to your account on voucher ${voucher.code}, valid until ${voucher.expiresAt}.`,
    actionHref: "/dashboard#vouchers",
  });
  revalidatePath("/admin/members");
  refreshAll();
  return ok(`Granted ${credits} credit(s) to the member.`);
}

export async function broadcastAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const title = str(data, "title");
  const body = str(data, "body");
  const sessionId = num(data, "sessionId");
  const href = str(data, "actionHref") || "/timetable";
  if (title.length < 3 || body.length < 3) return fail("Add a title and a message.");

  let recipients: number[] = [];
  if (sessionId) {
    const rows = await db
      .select({ userId: bookings.userId })
      .from(bookings)
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .where(and(eq(bookings.sessionId, sessionId), or(eq(bookings.status, "confirmed"), eq(bookings.status, "attended"))));
    recipients = [...new Set(rows.map((r) => r.userId))];
  } else {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "member"), eq(users.isActive, true)));
    recipients = rows.map((r) => r.id);
  }

  const count = await notifyMany(recipients, { type: "info", title, body, actionHref: href });
  refreshAll();
  return ok(count === 0 ? "No recipients matched." : `Notification sent to ${count} member(s).`);
}

export async function announceClassTypeAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  const id = num(data, "classTypeId");
  const [type] = await db.select().from(classTypes).where(eq(classTypes.id, id)).limit(1);
  if (!type) return fail("Class type not found.");
  const rows = await db
    .select({ userId: bookings.userId })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .where(
      and(
        eq(classSessions.classTypeId, id),
        gte(classSessions.sessionDate, todayISO()),
        ne(bookings.status, "cancelled"),
      ),
    );
  const count = await notifyMany([...new Set(rows.map((r) => r.userId))], {
    type: "info",
    title: `Update on ${type.name} classes`,
    body: `A note from the studio about your upcoming ${type.name} classes: check the timetable for the latest times, teachers and rooms.`,
    actionHref: `/classes/${type.slug}`,
  });
  refreshAll();
  return ok(count === 0 ? "No upcoming bookings for this class." : `Notified ${count} booked member(s).`);
}

export async function expireStaleVouchersAction(): Promise<void> {
  await db.execute(sql`
    update vouchers set status = 'expired'
    where expires_at < current_date and status <> 'expired'
  `);
  await db.execute(sql`
    update vouchers set status = 'depleted'
    where credits_remaining <= 0 and status = 'active'
  `);
  refreshAll();
}

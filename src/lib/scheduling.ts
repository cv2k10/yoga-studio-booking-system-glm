import { and, asc, desc, eq, gte, inArray, isNotNull, lte, ne, or, sql } from "drizzle-orm";
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
  type SessionChange,
} from "@/db/schema";

export type SessionView = {
  id: number;
  templateId: number | null;
  sessionDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  isExtra: boolean;
  status: string;
  note: string | null;
  classTypeId: number;
  classTypeName: string;
  classTypeSlug: string;
  category: string;
  intensity: string;
  accent: string;
  tagline: string;
  teacherId: number;
  teacherName: string;
  teacherSlug: string;
  teacherTitle: string;
  teacherPhoto: string;
  roomId: number;
  roomName: string;
  roomSlug: string;
  roomView: string;
  roomImage: string;
  booked: number;
  changeCount: number;
  myBookingId: number | null;
  myBookingStatus: string | null;
};

const bookedCountSql = sql<number>`(
  select count(*) from ${bookings}
  where ${bookings.sessionId} = ${classSessions.id} and ${bookings.status} <> 'cancelled'
)`.mapWith(Number);

function baseSelection(userId?: number) {
  return {
    id: classSessions.id,
    templateId: classSessions.templateId,
    sessionDate: classSessions.sessionDate,
    startTime: classSessions.startTime,
    durationMinutes: classSessions.durationMinutes,
    capacity: classSessions.capacity,
    isExtra: classSessions.isExtra,
    status: classSessions.status,
    note: classSessions.note,
    classTypeId: classTypes.id,
    classTypeName: classTypes.name,
    classTypeSlug: classTypes.slug,
    category: classTypes.category,
    intensity: classTypes.intensity,
    accent: classTypes.accent,
    tagline: classTypes.tagline,
    teacherId: teachers.id,
    teacherName: teachers.name,
    teacherSlug: teachers.slug,
    teacherTitle: teachers.title,
    teacherPhoto: teachers.photoUrl,
    roomId: rooms.id,
    roomName: rooms.name,
    roomSlug: rooms.slug,
    roomView: rooms.viewName,
    roomImage: rooms.imageUrl,
    booked: bookedCountSql,
    changeCount: sql<number>`(
      select count(*) from ${sessionChanges}
      where ${sessionChanges.sessionId} = ${classSessions.id}
    )`.mapWith(Number),
    myBookingId: userId
      ? sql<
          number | null
        >`(select b.id from ${bookings} b where b.session_id = ${classSessions.id} and b.user_id = ${userId} and b.status <> 'cancelled' limit 1)`
      : sql<number | null>`null::integer`,
    myBookingStatus: userId
      ? sql<
          string | null
        >`(select b.status from ${bookings} b where b.session_id = ${classSessions.id} and b.user_id = ${userId} and b.status <> 'cancelled' limit 1)`
      : sql<string | null>`null::text`,
  };
}

function rowsToViews(rows: Awaited<ReturnType<typeof runSessionQuery>>): SessionView[] {
  return rows.map((row) => ({ ...row }));
}

function runSessionQuery() {
  return db
    .select(baseSelection())
    .from(classSessions)
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .innerJoin(teachers, eq(classSessions.teacherId, teachers.id))
    .innerJoin(rooms, eq(classSessions.roomId, rooms.id));
}

export async function getSessionsBetween(
  fromISO: string,
  toISO: string,
  userId?: number,
): Promise<SessionView[]> {
  const rows = await runSessionQuery()
    .where(and(gte(classSessions.sessionDate, fromISO), lte(classSessions.sessionDate, toISO)))
    .orderBy(asc(classSessions.sessionDate), asc(classSessions.startTime));
  return rowsToViews(rows);
}

export async function getWeekSessions(
  weekStartISO: string,
  userId?: number,
): Promise<SessionView[]> {
  const rows = await runSessionQuery()
    .where(
      and(
        gte(classSessions.sessionDate, weekStartISO),
        lte(classSessions.sessionDate, addDaysLocal(weekStartISO, 6)),
      ),
    )
    .orderBy(asc(classSessions.sessionDate), asc(classSessions.startTime));
  return rowsToViews(rows);
}

export async function getSessionById(id: number, userId?: number): Promise<SessionView | null> {
  const rows = await runSessionQuery().where(eq(classSessions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getSessionsForTeacher(teacherId: number, fromISO: string): Promise<SessionView[]> {
  const rows = await runSessionQuery()
    .where(and(eq(classSessions.teacherId, teacherId), gte(classSessions.sessionDate, fromISO)))
    .orderBy(asc(classSessions.sessionDate), asc(classSessions.startTime))
    .limit(120);
  return rowsToViews(rows);
}

export async function getSessionsForRoom(roomId: number, fromISO: string): Promise<SessionView[]> {
  const rows = await runSessionQuery()
    .where(and(eq(classSessions.roomId, roomId), gte(classSessions.sessionDate, fromISO)))
    .orderBy(asc(classSessions.sessionDate), asc(classSessions.startTime))
    .limit(60);
  return rowsToViews(rows);
}

export async function getUpcomingSessions(limit = 6, userId?: number): Promise<SessionView[]> {
  const rows = await runSessionQuery()
    .where(
      and(
        gte(classSessions.sessionDate, addDaysLocal(todayLocal(), 0)),
        eq(classSessions.status, "scheduled"),
      ),
    )
    .orderBy(asc(classSessions.sessionDate), asc(classSessions.startTime))
    .limit(limit);
  return rowsToViews(rows);
}

function addDaysLocal(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1, 12);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayLocal(): string {
  const date = new Date();
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/* ------------------------------------------------------------------ */
/* Horizon generation                                                  */
/* ------------------------------------------------------------------ */
export const HORIZON_WEEKS = 5;

/**
 * Makes sure the rolling timetable window is populated from the weekly
 * templates. Safe to call on every timetable render.
 */
export async function ensureSessionHorizon(): Promise<void> {
  const templates = await db.select().from(classTemplates).where(eq(classTemplates.isPublished, true));
  if (templates.length === 0) return;

  const today = todayLocal();
  const horizonEnd = addDaysLocal(today, HORIZON_WEEKS * 7);
  const existing = await db
    .select({ templateId: classSessions.templateId, sessionDate: classSessions.sessionDate })
    .from(classSessions)
    .where(and(gte(classSessions.sessionDate, today), lte(classSessions.sessionDate, horizonEnd)))
    .orderBy(asc(classSessions.sessionDate));

  const keys = new Set(existing.map((row) => `${row.templateId ?? 0}|${row.sessionDate}`));
  const values: (typeof classSessions.$inferInsert)[] = [];

  for (const template of templates) {
    for (let week = 0; week <= HORIZON_WEEKS; week += 1) {
      for (let day = 0; day < 7; day += 1) {
        const cursor = addDaysLocal(startOfWeekLocal(today), week * 7 + day);
        if (cursor < today || cursor > horizonEnd) continue;
        const jsDow = new Date(
          Number(cursor.slice(0, 4)),
          Number(cursor.slice(5, 7)) - 1,
          Number(cursor.slice(8, 10)),
          12,
        ).getDay();
        const dow = jsDow === 0 ? 7 : jsDow;
        if (dow !== template.dayOfWeek) continue;
        const key = `${template.id}|${cursor}`;
        if (keys.has(key)) continue;
        keys.add(key);
        values.push({
          templateId: template.id,
          classTypeId: template.classTypeId,
          teacherId: template.teacherId,
          roomId: template.roomId,
          sessionDate: cursor,
          startTime: template.startTime,
          durationMinutes: template.durationMinutes,
          capacity: template.capacity,
          isExtra: false,
        });
      }
    }
  }

  if (values.length > 0) {
    await db.insert(classSessions).values(values).onConflictDoNothing();
  }
}

function startOfWeekLocal(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1, 12);
  const jsDow = date.getDay();
  const shift = (jsDow === 0 ? 7 : jsDow) - 1;
  date.setDate(date.getDate() - shift);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayOffsetFromMonday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const jsDow = new Date(y, (m ?? 1) - 1, d ?? 1, 12).getDay();
  return jsDow === 0 ? 7 : jsDow;
}

export type RebuildResult = { updated: number; cancelled: number; created: number; deleted: number };

/**
 * Pushes template edits into the future. Only sessions without active
 * bookings are rewritten; booked sessions keep their shape and members are
 * notified instead.
 */
export async function rebuildFutureSessions(actorName: string): Promise<RebuildResult> {
  const today = todayLocal();
  const horizonEnd = addDaysLocal(today, HORIZON_WEEKS * 7);
  const templates = await db.select().from(classTemplates);
  const byId = new Map(templates.map((t) => [t.id, t]));

  const result: RebuildResult = { updated: 0, cancelled: 0, created: 0, deleted: 0 };

  const future = await db
    .select({
      session: classSessions,
      booked: bookedCountSql,
    })
    .from(classSessions)
    .where(
      and(
        gte(classSessions.sessionDate, today),
        lte(classSessions.sessionDate, horizonEnd),
        isNotNull(classSessions.templateId),
      ),
    );

  for (const { session, booked } of future) {
    const template = session.templateId ? byId.get(session.templateId) : undefined;
    if (!template || !template.isPublished) {
      if (booked === 0) {
        await db.delete(classSessions).where(eq(classSessions.id, session.id));
        result.deleted += 1;
      }
      continue;
    }

    const sessionDow = dayOffsetFromMonday(session.sessionDate);
    const dayChanged = sessionDow !== template.dayOfWeek;
    const shapeChanged =
      session.classTypeId !== template.classTypeId ||
      session.teacherId !== template.teacherId ||
      session.roomId !== template.roomId ||
      session.startTime !== template.startTime ||
      session.durationMinutes !== template.durationMinutes ||
      session.capacity !== template.capacity;

    if (!shapeChanged && !dayChanged) continue;
    if (booked > 0) {
      await notifySessionChange({
        sessionId: session.id,
        changeType: "template",
        label: "Weekly schedule updated",
        oldValue: describeSession(session),
        newValue: describeTemplate(template),
        note: "This class is part of the updated weekly timetable.",
        actorName,
      });
      result.cancelled += 1;
      continue;
    }

    if (dayChanged) {
      await db.delete(classSessions).where(eq(classSessions.id, session.id));
      result.deleted += 1;
      continue;
    }

    await db
      .update(classSessions)
      .set({
        classTypeId: template.classTypeId,
        teacherId: template.teacherId,
        roomId: template.roomId,
        startTime: template.startTime,
        durationMinutes: template.durationMinutes,
        capacity: template.capacity,
      })
      .where(eq(classSessions.id, session.id));
    result.updated += 1;
  }

  await ensureSessionHorizon();
  const createdRows = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(classSessions)
    .where(and(gte(classSessions.sessionDate, today), lte(classSessions.sessionDate, horizonEnd)));
  result.created = createdRows[0]?.count ?? 0;
  return result;
}

function describeSession(session: typeof classSessions.$inferSelect): string {
  return `${session.sessionDate} ${session.startTime}`;
}

function describeTemplate(template: typeof classTemplates.$inferSelect): string {
  return `${template.startTime} · ${template.durationMinutes} min`;
}

/* ------------------------------------------------------------------ */
/* Change log + notifications                                          */
/* ------------------------------------------------------------------ */
export async function notifySessionChange(input: {
  sessionId: number;
  changeType: string;
  label: string;
  oldValue?: string | null;
  newValue?: string | null;
  note?: string | null;
  actorName?: string;
  excludeUserId?: number;
}): Promise<void> {
  await db.insert(sessionChanges).values({
    sessionId: input.sessionId,
    changeType: input.changeType,
    label: input.label,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    note: input.note ?? null,
    actorName: input.actorName ?? "Studio admin",
  });

  const booked = await db
    .select({ userId: bookings.userId })
    .from(bookings)
    .where(
      and(
        eq(bookings.sessionId, input.sessionId),
        or(eq(bookings.status, "confirmed"), eq(bookings.status, "attended")),
      ),
    );

  const recipients = [...new Set(booked.map((b) => b.userId))].filter(
    (id) => id !== input.excludeUserId,
  );
  if (recipients.length === 0) return;

  await db.insert(notifications).values(
    recipients.map((userId) => ({
      userId,
      type: "change",
      title: input.label,
      body: [
        input.oldValue ? `Before: ${input.oldValue}.` : null,
        input.newValue ? `Now: ${input.newValue}.` : null,
        input.note ?? "",
      ]
        .filter(Boolean)
        .join(" "),
      sessionId: input.sessionId,
      actionHref: "/dashboard",
    })),
  );
}

export async function notifyMany(
  userIds: number[],
  payload: { type: string; title: string; body: string; actionHref?: string },
): Promise<number> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return 0;
  await db.insert(notifications).values(
    unique.map((userId) => ({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      actionHref: payload.actionHref ?? null,
    })),
  );
  return unique.length;
}

export async function getSessionChanges(sessionId: number) {
  return db
    .select()
    .from(sessionChanges)
    .where(eq(sessionChanges.sessionId, sessionId))
    .orderBy(desc(sessionChanges.createdAt))
    .limit(12);
}

export async function getRecentChanges(limit = 12): Promise<(SessionChange & {
  className: string;
  sessionDate: string;
  startTime: string;
})[]> {
  return db
    .select({
      id: sessionChanges.id,
      sessionId: sessionChanges.sessionId,
      changeType: sessionChanges.changeType,
      label: sessionChanges.label,
      oldValue: sessionChanges.oldValue,
      newValue: sessionChanges.newValue,
      note: sessionChanges.note,
      actorName: sessionChanges.actorName,
      createdAt: sessionChanges.createdAt,
      className: classTypes.name,
      sessionDate: classSessions.sessionDate,
      startTime: classSessions.startTime,
    })
    .from(sessionChanges)
    .innerJoin(classSessions, eq(sessionChanges.sessionId, classSessions.id))
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .orderBy(desc(sessionChanges.createdAt))
    .limit(limit);
}

/* ------------------------------------------------------------------ */
/* Catalogue helpers                                                   */
/* ------------------------------------------------------------------ */
export async function getTeachers() {
  return db.select().from(teachers).where(eq(teachers.isActive, true)).orderBy(asc(teachers.name));
}

export async function getRooms() {
  return db.select().from(rooms).where(eq(rooms.isActive, true)).orderBy(asc(rooms.name));
}

export async function getClassTypes() {
  return db
    .select()
    .from(classTypes)
    .where(eq(classTypes.isActive, true))
    .orderBy(asc(classTypes.name));
}

export async function getVoucherProducts() {
  return db
    .select()
    .from(voucherProducts)
    .where(eq(voucherProducts.isActive, true))
    .orderBy(asc(voucherProducts.priceCents));
}

export async function getTeacherBySlug(slug: string) {
  const [row] = await db.select().from(teachers).where(eq(teachers.slug, slug)).limit(1);
  return row ?? null;
}

export async function getRoomBySlug(slug: string) {
  const [row] = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
  return row ?? null;
}

export async function getClassTypeBySlug(slug: string) {
  const [row] = await db.select().from(classTypes).where(eq(classTypes.slug, slug)).limit(1);
  return row ?? null;
}

export async function getClassTypeCounts(): Promise<Record<number, number>> {
  const rows = await db
    .select({ classTypeId: classTypes.id, count: sql<number>`count(*)`.mapWith(Number) })
    .from(classSessions)
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .where(and(gte(classSessions.sessionDate, todayLocal()), eq(classSessions.status, "scheduled")))
    .groupBy(classTypes.id);
  return Object.fromEntries(rows.map((r) => [r.classTypeId, r.count]));
}

export async function getSessionBookingList(sessionId: number) {
  return db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      status: bookings.status,
      createdAt: bookings.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(eq(bookings.sessionId, sessionId))
    .orderBy(asc(bookings.createdAt));
}

export async function getSessionsByIds(ids: number[], userId?: number) {
  if (ids.length === 0) return [];
  const rows = await runSessionQuery().where(inArray(classSessions.id, ids));
  return rowsToViews(rows);
}

export async function hasActiveBookingForSession(userId: number, sessionId: number) {
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, userId),
        eq(bookings.sessionId, sessionId),
        ne(bookings.status, "cancelled"),
      ),
    )
    .limit(1);
  return row ?? null;
}

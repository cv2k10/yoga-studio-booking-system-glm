import Link from "next/link";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { vouchers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTeachers, getRooms, getClassTypes, getWeekSessions, ensureSessionHorizon } from "@/lib/scheduling";
import {
  addDaysISO,
  currentWeekStart,
  formatDateLong,
  isValidISODate,
  startOfWeekISO,
  todayISO,
} from "@/lib/dates";
import { TimetableWeek } from "@/components/TimetableWeek";
import { SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  date?: string;
  type?: string;
  teacher?: string;
  room?: string;
}>;

export default async function TimetablePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await ensureSessionHorizon();

  const requested = isValidISODate(params.date) ? (params.date as string) : todayISO();
  const weekStart = startOfWeekISO(requested);
  const weekEnd = addDaysISO(weekStart, 6);

  const user = await getCurrentUser();
  const [teachers, rooms, classTypes] = await Promise.all([getTeachers(), getRooms(), getClassTypes()]);

  const allSessions = await getWeekSessions(weekStart, user?.id);
  const sessions = allSessions.filter((session) => {
    if (params.type && session.classTypeSlug !== params.type) return false;
    if (params.teacher && session.teacherSlug !== params.teacher) return false;
    if (params.room && session.roomSlug !== params.room) return false;
    return true;
  });

  const activeVouchers = user
    ? await db
        .select({
          id: vouchers.id,
          code: vouchers.code,
          creditsRemaining: vouchers.creditsRemaining,
        })
        .from(vouchers)
        .where(
          and(
            eq(vouchers.userId, user.id),
            eq(vouchers.status, "active"),
            gt(vouchers.creditsRemaining, 0),
            gt(vouchers.expiresAt, todayISO()),
          ),
        )
        .orderBy(asc(vouchers.expiresAt))
    : [];

  const baseQuery = (date: string) => {
    const search = new URLSearchParams({ date });
    if (params.type) search.set("type", params.type);
    if (params.teacher) search.set("teacher", params.teacher);
    if (params.room) search.set("room", params.room);
    return `/timetable?${search.toString()}`;
  };

  const isCurrentWeek = weekStart === currentWeekStart();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeading
        eyebrow="Weekly timetable"
        title="This week at Sattva Studio"
        description="Classes repeat every week unless the studio makes a change. Any time, teacher or room change appears here instantly and booked members are notified."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={baseQuery(addDaysISO(weekStart, -7))} className="btn btn-outline btn-sm">
              ← Previous week
            </Link>
            <Link href="/timetable" className="btn btn-outline btn-sm">
              This week
            </Link>
            <Link href={baseQuery(addDaysISO(weekStart, 7))} className="btn btn-outline btn-sm">
              Next week →
            </Link>
          </div>
        }
      />

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-soft">Viewing</p>
          <p className="display text-xl">
            {formatDateLong(weekStart)} → {formatDateLong(weekEnd)}
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <input type="hidden" name="date" value={weekStart} />
          <div>
            <label className="label" htmlFor="type">Class</label>
            <select id="type" name="type" defaultValue={params.type ?? ""} className="field min-w-40">
              <option value="">All class styles</option>
              {classTypes.map((type) => (
                <option key={type.id} value={type.slug}>{type.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="teacher">Teacher</label>
            <select id="teacher" name="teacher" defaultValue={params.teacher ?? ""} className="field min-w-40">
              <option value="">All teachers</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.slug}>{teacher.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="room">Room</label>
            <select id="room" name="room" defaultValue={params.room ?? ""} className="field min-w-40">
              <option value="">All rooms</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.slug}>{room.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-sm">Apply filters</button>
          <Link href={`/timetable?date=${weekStart}`} className="btn btn-ghost btn-sm">Reset</Link>
        </form>
      </div>

      {!isCurrentWeek ? (
        <p className="mb-4 rounded-2xl bg-sage/10 px-4 py-2.5 text-xs font-semibold text-sage">
          You are viewing a future or past week. Bookings open for all published dates.
        </p>
      ) : null}

      {user && activeVouchers.length === 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-clay/10 px-4 py-3 text-sm">
          <span>You have no active class credits.</span>
          <Link href="/vouchers" className="btn btn-primary btn-sm">Purchase a class voucher</Link>
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="display text-xl">No classes match these filters</p>
          <p className="mt-2 text-sm text-ink-soft">Try another week or reset the filters.</p>
          <Link href="/timetable" className="btn btn-outline btn-sm mt-4">Reset filters</Link>
        </div>
      ) : (
        <TimetableWeek
          sessions={sessions}
          weekStart={weekStart}
          signedIn={Boolean(user)}
          vouchers={activeVouchers}
        />
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Fixed weekly schedule",
            body: "Your favourite slots repeat every week so you can build a routine.",
          },
          {
            title: "Changes announced",
            body: "Time, teacher or room changes create an instant notification for booked members.",
          },
          {
            title: "Extra classes",
            body: "One-off workshops and pop-up classes are published as extra sessions.",
          },
        ].map((item) => (
          <div key={item.title} className="card p-5">
            <p className="display text-base">{item.title}</p>
            <p className="mt-1 text-xs text-ink-soft">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

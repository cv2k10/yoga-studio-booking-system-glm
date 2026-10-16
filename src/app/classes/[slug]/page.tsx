import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { vouchers } from "@/db/schema";
import {
  getClassTypeBySlug,
  getSessionsBetween,
  getTeachers,
  getRooms,
  HORIZON_WEEKS,
} from "@/lib/scheduling";
import { SessionCard } from "@/components/SessionCard";
import { Breadcrumbs, CATEGORY_STYLES, SectionHeading } from "@/components/ui";
import { addDaysISO, formatDateShort, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const type = await getClassTypeBySlug(slug);
  if (!type) notFound();

  const user = await getCurrentUser();
  const style = CATEGORY_STYLES[type.category] ?? CATEGORY_STYLES.yoga;
  const [all, teachers, rooms] = await Promise.all([
    getSessionsBetween(todayISO(), addDaysISO(todayISO(), HORIZON_WEEKS * 7), user?.id),
    getTeachers(),
    getRooms(),
  ]);
  const sessions = all.filter((s) => s.classTypeId === type.id).slice(0, 12);
  const teachingTeachers = teachers.filter((t) => sessions.some((s) => s.teacherId === t.id));
  const usedRooms = rooms.filter((r) => sessions.some((s) => s.roomId === r.id));

  const activeVouchers = user
    ? await db
        .select({ id: vouchers.id, code: vouchers.code, creditsRemaining: vouchers.creditsRemaining })
        .from(vouchers)
        .where(
          and(
            eq(vouchers.userId, user.id),
            eq(vouchers.status, "active"),
            gt(vouchers.creditsRemaining, 0),
          ),
        )
        .orderBy(asc(vouchers.expiresAt))
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/classes", label: "Classes" }, { label: type.name }]} />

      <div className="card grain overflow-hidden p-8 sm:p-10">
        <span className={`pill ${style.chip}`}>{style.label}</span>
        <h1 className="mt-3 text-3xl sm:text-4xl">{type.name}</h1>
        <p className="mt-3 max-w-3xl text-sm text-ink-soft sm:text-base">{type.description}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <span className="pill bg-white text-ink">{type.durationMinutes} minutes</span>
          <span className="pill bg-white text-ink">{type.intensity}</span>
          <span className="pill bg-white text-ink">{sessions.length} upcoming dates</span>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <SectionHeading
            title="Upcoming dates"
            description={`Runs for the next ${HORIZON_WEEKS} weeks on the fixed weekly timetable.`}
            action={<Link href={`/timetable?type=${type.slug}`} className="btn btn-outline btn-sm">Open in timetable</Link>}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {sessions.map((session) => (
              <div key={session.id}>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
                  {formatDateShort(session.sessionDate)}
                </p>
                <SessionCard session={session} signedIn={Boolean(user)} vouchers={activeVouchers} />
              </div>
            ))}
            {sessions.length === 0 ? (
              <p className="card p-6 text-sm text-ink-soft">
                No dates published yet — check the timetable for updates.
              </p>
            ) : null}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="card p-6">
            <p className="display text-lg">Who teaches {type.name}</p>
            <ul className="mt-3 space-y-3">
              {teachingTeachers.map((teacher) => (
                <li key={teacher.id} className="flex items-center gap-3">
                  <img src={teacher.photoUrl} alt={teacher.name} className="h-11 w-11 rounded-full object-cover" />
                  <div>
                    <Link href={`/teachers/${teacher.slug}`} className="text-sm font-semibold hover:text-clay">
                      {teacher.name}
                    </Link>
                    <p className="text-xs text-ink-soft">{teacher.title}</p>
                  </div>
                </li>
              ))}
              {teachingTeachers.length === 0 ? <li className="text-sm text-ink-soft">To be announced.</li> : null}
            </ul>
          </div>

          <div className="card p-6">
            <p className="display text-lg">Where it happens</p>
            <ul className="mt-3 space-y-3">
              {usedRooms.map((room) => (
                <li key={room.id}>
                  <Link href={`/rooms/${room.slug}`} className="flex items-center gap-3 rounded-2xl p-1 hover:bg-sand">
                    <img src={room.imageUrl} alt={room.name} className="h-11 w-11 rounded-xl object-cover" />
                    <div>
                      <p className="text-sm font-semibold">{room.name}</p>
                      <p className="text-xs text-ink-soft">{room.viewName}</p>
                    </div>
                  </Link>
                </li>
              ))}
              {usedRooms.length === 0 ? <li className="text-sm text-ink-soft">To be confirmed.</li> : null}
            </ul>
          </div>

          <div className="card bg-ink p-6 text-sand">
            <p className="display text-lg">Need credits?</p>
            <p className="mt-2 text-xs text-white/70">
              Every booking uses one credit from your class voucher. Cancel up to 4 hours before class
              and the credit returns to your account.
            </p>
            <Link href="/vouchers" className="btn btn-primary mt-4 w-full">Buy a class voucher</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

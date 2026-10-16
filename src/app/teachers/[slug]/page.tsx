import Link from "@/components/Link";
import { notFound } from "@/lib/next";
import { getSessionsForTeacher, getTeacherBySlug } from "@/lib/scheduling";
import { Breadcrumbs, Badge } from "@/components/ui";
import { formatDateShort, formatRange, isPast, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const teacher = await getTeacherBySlug(slug);
  if (!teacher) notFound();

  const sessions = await getSessionsForTeacher(teacher.id, todayISO());
  const grouped = sessions.reduce<Record<string, typeof sessions>>((acc, session) => {
    acc[session.sessionDate] = acc[session.sessionDate] ?? [];
    acc[session.sessionDate].push(session);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/teachers", label: "Teachers" }, { label: teacher.name }]} />

      <div className="grid gap-8 md:grid-cols-[320px_1fr]">
        <div className="card overflow-hidden">
          <img src={teacher.photoUrl} alt={teacher.name} className="aspect-[3/4] w-full object-cover" />
          <div className="p-5">
            <p className="display text-2xl">{teacher.name}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-clay">{teacher.title}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Experience</dt>
                <dd className="font-semibold">{teacher.yearsExperience} years</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Upcoming classes</dt>
                <dd className="font-semibold">{sessions.length}</dd>
              </div>
              {teacher.instagram ? (
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Instagram</dt>
                  <dd className="font-semibold">{teacher.instagram}</dd>
                </div>
              ) : null}
            </dl>
            <Link href={`/timetable?teacher=${teacher.slug}`} className="btn btn-primary btn-sm mt-4 w-full">
              Book with {teacher.name.split(" ")[0]}
            </Link>
          </div>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl">{teacher.name}</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft sm:text-base">{teacher.bio}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-soft">Specialties</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {teacher.specialties.split(",").filter(Boolean).map((item) => (
                  <Badge key={item} tone="sage">{item.trim()}</Badge>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-soft">Certifications</p>
              <ul className="mt-2 space-y-1 text-xs text-ink-soft">
                {teacher.certifications.split(",").filter(Boolean).map((item) => (
                  <li key={item}>· {item.trim()}</li>
                ))}
              </ul>
            </div>
          </div>

          <h2 className="display mt-10 text-2xl">Teacher timetable</h2>
          <p className="mt-1 text-sm text-ink-soft">
            All classes {teacher.name.split(" ")[0]} is scheduled to teach. Changes are announced to
            booked members automatically.
          </p>

          <div className="mt-5 space-y-3">
            {Object.entries(grouped).map(([date, daySessions]) => (
              <div key={date} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{formatDateShort(date)}</p>
                  <span className="text-xs text-ink-soft">{daySessions.length} class(es)</span>
                </div>
                <ul className="mt-3 divide-y divide-ink/8">
                  {daySessions.map((session) => (
                    <li key={session.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                      <span className="w-36 font-semibold tabular-nums text-clay">
                        {formatRange(session.startTime, session.durationMinutes)}
                      </span>
                      <Link href={`/classes/${session.classTypeSlug}`} className="font-medium hover:text-clay">
                        {session.classTypeName}
                      </Link>
                      <Link href={`/rooms/${session.roomSlug}`} className="text-xs text-ink-soft hover:text-clay">
                        {session.roomName} · {session.roomView}
                      </Link>
                      <span className="ml-auto flex items-center gap-2">
                        {session.isExtra ? <Badge tone="clay">Extra</Badge> : null}
                        {session.changeCount > 0 ? <Badge tone="warn">Updated</Badge> : null}
                        {session.status !== "scheduled" ? <Badge tone="clay">Cancelled</Badge> : null}
                        {isPast(session.sessionDate, session.startTime) ? <Badge tone="muted">Done</Badge> : null}
                        <span className="text-xs text-ink-soft">
                          {session.booked}/{session.capacity}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {sessions.length === 0 ? (
              <p className="card p-6 text-sm text-ink-soft">No upcoming classes on the timetable.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "@/components/Link";
import { notFound } from "@/lib/next";
import { getRoomBySlug, getSessionsForRoom } from "@/lib/scheduling";
import { Breadcrumbs, Badge } from "@/components/ui";
import { formatDateShort, formatRange, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function RoomDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) notFound();

  const sessions = await getSessionsForRoom(room.id, todayISO());
  const byDate = sessions.reduce<Record<string, typeof sessions>>((acc, session) => {
    acc[session.sessionDate] = acc[session.sessionDate] ?? [];
    acc[session.sessionDate].push(session);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/rooms", label: "Studio rooms" }, { label: room.name }]} />

      <div className="card overflow-hidden">
        <div className="relative h-80 w-full">
          <img src={room.imageUrl} alt={`${room.name} — ${room.viewName}`} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 text-white">
            <span className="pill bg-white/90 text-ink">{room.viewName}</span>
            <h1 className="mt-3 text-3xl sm:text-4xl">{room.name}</h1>
            <p className="mt-1 text-sm text-white/80">{room.floor} · up to {room.capacity} mats</p>
          </div>
        </div>
        <div className="grid gap-6 p-6 sm:grid-cols-[2fr_1fr] sm:p-8">
          <div>
            <p className="text-sm leading-relaxed text-ink-soft">{room.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {room.amenities.split(",").filter(Boolean).map((item) => (
                <span key={item} className="pill bg-sand-deep/70 text-ink-soft">{item.trim()}</span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-sand-deep/50 p-5">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-soft">Room facts</p>
            <dl className="mt-2 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Outlook</dt>
                <dd className="text-right font-semibold">{room.viewName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Capacity</dt>
                <dd className="font-semibold">{room.capacity} mats</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Classes listed</dt>
                <dd className="font-semibold">{sessions.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <h2 className="display mt-10 text-2xl">Classes in {room.name}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Live from the timetable. If a class is moved to another room, booked members are notified.
      </p>

      <div className="mt-5 space-y-3">
        {Object.entries(byDate).map(([date, daySessions]) => (
          <div key={date} className="card p-4">
            <p className="text-sm font-bold">{formatDateShort(date)}</p>
            <ul className="mt-2 divide-y divide-ink/8">
              {daySessions.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="w-36 font-semibold tabular-nums text-clay">
                    {formatRange(session.startTime, session.durationMinutes)}
                  </span>
                  <Link href={`/classes/${session.classTypeSlug}`} className="font-medium hover:text-clay">
                    {session.classTypeName}
                  </Link>
                  <Link href={`/teachers/${session.teacherSlug}`} className="text-xs text-ink-soft hover:text-clay">
                    with {session.teacherName}
                  </Link>
                  <span className="ml-auto flex items-center gap-2">
                    {session.isExtra ? <Badge tone="clay">Extra</Badge> : null}
                    {session.changeCount > 0 ? <Badge tone="warn">Updated</Badge> : null}
                    {session.status !== "scheduled" ? <Badge tone="clay">Cancelled</Badge> : null}
                    <span className="text-xs text-ink-soft">{session.booked}/{session.capacity}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {sessions.length === 0 ? (
          <p className="card p-6 text-sm text-ink-soft">Nothing scheduled in this room right now.</p>
        ) : null}
      </div>
    </div>
  );
}

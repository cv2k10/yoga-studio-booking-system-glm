import { SessionCard } from "@/components/SessionCard";
import { WEEKDAY_SHORT, parseISODate, todayISO } from "@/lib/dates";
import type { SessionView } from "@/lib/scheduling";

export function TimetableWeek({
  sessions,
  weekStart,
  signedIn,
  vouchers,
}: {
  sessions: SessionView[];
  weekStart: string;
  signedIn: boolean;
  vouchers: { id: number; code: string; creditsRemaining: number }[];
}) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = parseISODate(weekStart);
    date.setDate(date.getDate() + index);
    const pad = (n: number) => `${n}`.padStart(2, "0");
    const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return { iso, sessions: sessions.filter((s) => s.sessionDate === iso) };
  });
  const today = todayISO();

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {days.map((day, index) => (
        <section
          key={day.iso}
          className={`rounded-3xl border p-3 ${
            day.iso === today ? "border-clay/40 bg-clay/5" : "border-ink/8 bg-white/50"
          }`}
        >
          <header className="mb-3 flex items-baseline justify-between">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-soft">
                {WEEKDAY_SHORT[index]}
              </p>
              <p className="display text-lg">{day.iso.slice(8)}/{day.iso.slice(5, 7)}</p>
            </div>
            {day.iso === today ? <span className="pill bg-clay text-white">Today</span> : null}
          </header>
          <div className="space-y-3">
            {day.sessions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-ink/15 px-3 py-6 text-center text-xs text-ink-soft">
                No classes scheduled
              </p>
            ) : (
              day.sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  signedIn={signedIn}
                  vouchers={vouchers}
                  compact
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

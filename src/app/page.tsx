import Link from "next/link";
import {
  getClassTypes,
  getRooms,
  getSessionsForTeacher,
  getTeachers,
  getUpcomingSessions,
  getVoucherProducts,
  ensureSessionHorizon,
} from "@/lib/scheduling";
import { Badge, CATEGORY_STYLES, SectionHeading } from "@/components/ui";
import { formatMoney, formatRange, formatDateShort, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

const HERO_IMAGE =
  "https://images.pexels.com/photos/35215411/pexels-photo-35215411.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1600";

export default async function HomePage() {
  await ensureSessionHorizon();
  const [classTypes, teachers, rooms, products, upcoming] = await Promise.all([
    getClassTypes(),
    getTeachers(),
    getRooms(),
    getVoucherProducts(),
    getUpcomingSessions(6),
  ]);

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt="Light-filled yoga studio with wooden floors"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/60 to-ink/20" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">
          <p className="pill bg-white/15 text-white backdrop-blur">Now booking · week of {formatDateShort(todayISO())}</p>
          <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] text-white sm:text-6xl">
            A calm, light-filled home for your <em className="text-clay-soft">yoga</em> &amp;{" "}
            <em className="text-clay-soft">pilates</em> practice.
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/80">
            Reserve your mat in seconds from a fixed weekly timetable, pay once with a class voucher,
            and get notified the moment a time, teacher or room changes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/timetable" className="btn btn-primary">Book a class</Link>
            <Link href="/vouchers" className="btn btn-outline bg-white/90">View class vouchers</Link>
            <Link href="/rooms" className="btn btn-ghost text-white/80 hover:text-white">See the studio rooms →</Link>
          </div>
          <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-6 border-t border-white/20 pt-6 text-white sm:grid-cols-4">
            {[
              { k: "Weekly classes", v: `${upcoming.length ? "20+" : "20+"}` },
              { k: "Certified teachers", v: `${teachers.length}` },
              { k: "Studio rooms", v: `${rooms.length}` },
              { k: "Avg. class size", v: "11 mats" },
            ].map((item) => (
              <div key={item.k}>
                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/60">{item.k}</dt>
                <dd className="display text-2xl">{item.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Class styles */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Class styles"
          title="Find the practice that fits your week"
          description="From slow yin to dynamic reformer pilates — every class is capped so teachers can keep an eye on your form."
          action={<Link href="/classes" className="btn btn-outline btn-sm">All class styles</Link>}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classTypes.slice(0, 6).map((type) => {
            const style = CATEGORY_STYLES[type.category] ?? CATEGORY_STYLES.yoga;
            return (
              <Link
                key={type.id}
                href={`/classes/${type.slug}`}
                className="card group flex flex-col gap-3 p-6 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className={`pill ${style.chip}`}>{style.label}</span>
                  <span className="text-xs font-semibold text-ink-soft">{type.durationMinutes} min</span>
                </div>
                <p className="display text-xl">{type.name}</p>
                <p className="text-sm text-ink-soft">{type.tagline}</p>
                <span className="mt-auto text-xs font-bold uppercase tracking-[0.12em] text-clay">
                  {type.intensity} →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Next classes */}
      <section className="bg-white/70 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Next on the mat"
            title="Classes you can book right now"
            action={<Link href="/timetable" className="btn btn-primary btn-sm">Open timetable</Link>}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((session) => (
              <article key={session.id} className="card p-5">
                <div className="flex items-center justify-between">
                  <Badge tone="muted">{formatDateShort(session.sessionDate)}</Badge>
                  <span className="text-xs font-bold text-clay">{formatRange(session.startTime, session.durationMinutes)}</span>
                </div>
                <p className="display mt-3 text-lg">{session.classTypeName}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {session.teacherName} · {session.roomName} ({session.roomView})
                </p>
                <div className="mt-4">
                  <Link href={`/timetable?date=${session.sessionDate}`} className="btn btn-outline btn-sm w-full">
                    Reserve a mat
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Studio rooms"
          title="Three rooms, three very different views"
          description="Every class is assigned a room — check where you are heading before you arrive."
          action={<Link href="/rooms" className="btn btn-outline btn-sm">Room views &amp; details</Link>}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {rooms.slice(0, 3).map((room) => (
            <Link key={room.id} href={`/rooms/${room.slug}`} className="group overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="relative h-48 overflow-hidden">
                <img
                  src={room.imageUrl}
                  alt={`${room.name} — ${room.viewName}`}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="pill absolute left-3 top-3 bg-white/90 text-ink">{room.viewName}</span>
              </div>
              <div className="p-5">
                <p className="display text-lg">{room.name}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {room.floor} · up to {room.capacity} mats
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Teachers */}
      <section className="bg-white/70 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Teachers"
            title="Learn from teachers who actually know your name"
            action={<Link href="/teachers" className="btn btn-outline btn-sm">Meet the team</Link>}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {teachers.slice(0, 5).map((teacher) => (
              <Link key={teacher.id} href={`/teachers/${teacher.slug}`} className="group">
                <div className="overflow-hidden rounded-3xl">
                  <img
                    src={teacher.photoUrl}
                    alt={teacher.name}
                    className="aspect-[3/4] w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="display mt-3 text-base">{teacher.name}</p>
                <p className="text-xs text-ink-soft">{teacher.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Vouchers */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Class vouchers"
          title="One voucher, any class"
          description="Credits work across yoga, pilates and meditation classes. Vouchers are valid for months, not weeks."
          action={<Link href="/vouchers" className="btn btn-primary btn-sm">Buy a voucher</Link>}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {products.slice(0, 3).map((product) => (
            <div
              key={product.id}
              className={`card p-6 ${product.isFeatured ? "ring-2 ring-clay" : ""}`}
            >
              <div className="flex items-center justify-between">
                <p className="display text-lg">{product.name}</p>
                {product.isFeatured ? <Badge tone="clay">Most popular</Badge> : null}
              </div>
              <p className="mt-3 text-3xl">{formatMoney(product.priceCents)}</p>
              <p className="text-xs text-ink-soft">
                {product.classCount} credits · valid {product.validityDays} days
              </p>
              <p className="mt-3 text-sm text-ink-soft">{product.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="grain rounded-4xl border border-ink/10 bg-white p-8 sm:p-12">
          <SectionHeading eyebrow="How booking works" title="Four steps from sign-up to savasana" />
          <ol className="grid gap-6 md:grid-cols-4">
            {[
              { n: "01", t: "Create your member account", d: "Register with your email — no joining fee, no contract." },
              { n: "02", t: "Buy a class voucher", d: "Choose 5, 10 or 20 credits. Each class uses one credit." },
              { n: "03", t: "Book from the weekly timetable", d: "Pick a slot, get an instant booking proof with a QR code." },
              { n: "04", t: "Stay in the loop", d: "If a time, teacher or room changes you are notified right away." },
            ].map((step) => (
              <li key={step.n}>
                <span className="display text-3xl text-clay">{step.n}</span>
                <p className="mt-2 font-semibold">{step.t}</p>
                <p className="mt-1 text-xs text-ink-soft">{step.d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn btn-primary">Create member account</Link>
            <Link href="/teachers" className="btn btn-outline">Browse teacher timetables</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

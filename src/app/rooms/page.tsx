import Link from "@/components/Link";
import { getRooms } from "@/lib/scheduling";
import { SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const rooms = await getRooms();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeading
        eyebrow="Studio rooms"
        title="Room views at Sattva Studio"
        description="Two light-filled studios and a meditation room, each with its own outlook. Open a room to see its facilities and the classes scheduled inside it."
      />
      <div className="grid gap-6 md:grid-cols-2">
        {rooms.map((room) => (
          <article key={room.id} className="card overflow-hidden">
            <div className="relative">
              <img src={room.imageUrl} alt={`${room.name} — ${room.viewName}`} className="h-64 w-full object-cover" />
              <span className="pill absolute left-4 top-4 bg-white/92 text-ink">{room.viewName}</span>
            </div>
            <div className="p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="display text-2xl">{room.name}</h3>
                <span className="text-xs font-semibold text-ink-soft">{room.floor}</span>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{room.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {room.amenities.split(",").filter(Boolean).map((item) => (
                  <span key={item} className="pill bg-sand-deep/70 text-ink-soft">{item.trim()}</span>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-sm font-semibold">Up to {room.capacity} mats</span>
                <Link href={`/rooms/${room.slug}`} className="btn btn-outline btn-sm">View room &amp; classes</Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

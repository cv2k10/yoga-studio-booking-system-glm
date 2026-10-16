import Link from "@/components/Link";
import { getTeachers } from "@/lib/scheduling";
import { SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeachersPage() {
  const teachers = await getTeachers();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeading
        eyebrow="Teachers"
        title="The Sattva teaching team"
        description="Every teacher is certified, insured and obsessed with safe alignment. Open a profile to see their personal timetable."
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {teachers.map((teacher) => (
          <article key={teacher.id} className="card overflow-hidden">
            <img src={teacher.photoUrl} alt={teacher.name} className="aspect-[4/5] w-full object-cover" />
            <div className="p-5">
              <p className="display text-xl">{teacher.name}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-clay">{teacher.title}</p>
              <p className="mt-3 line-clamp-3 text-sm text-ink-soft">{teacher.bio}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {teacher.specialties
                  .split(",")
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((item) => (
                    <span key={item} className="pill bg-sand-deep/70 text-ink-soft">{item.trim()}</span>
                  ))}
              </div>
              <Link href={`/teachers/${teacher.slug}`} className="btn btn-outline btn-sm mt-4 w-full">
                Profile &amp; timetable
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

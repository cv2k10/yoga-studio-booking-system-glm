import Link from "@/components/Link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { classTemplates } from "@/db/schema";
import { getClassTypes, getClassTypeCounts } from "@/lib/scheduling";
import { CATEGORY_STYLES, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const types = await getClassTypes();
  const counts = await getClassTypeCounts();
  const weekly = await db
    .select({ classTypeId: classTemplates.classTypeId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(classTemplates)
    .where(eq(classTemplates.isPublished, true))
    .groupBy(classTemplates.classTypeId);

  const weeklyMap = Object.fromEntries(weekly.map((row) => [row.classTypeId, row.count]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeading
        eyebrow="Class styles"
        title="Yoga, pilates and meditation classes"
        description="Each style runs on the fixed weekly timetable. Tap a class to see the teachers, rooms and upcoming dates."
      />

      <div className="grid gap-5 md:grid-cols-2">
        {types.map((type) => {
          const style = CATEGORY_STYLES[type.category] ?? CATEGORY_STYLES.yoga;
          return (
            <article key={type.id} className="card flex flex-col gap-3 p-6">
              <div className="flex items-center justify-between">
                <span className={`pill ${style.chip}`}>{style.label}</span>
                <span className="text-xs font-semibold text-ink-soft">
                  {weeklyMap[type.id] ?? 0}× weekly · {type.durationMinutes} min
                </span>
              </div>
              <h3 className="display text-2xl">{type.name}</h3>
              <p className="text-sm text-ink-soft">{type.description}</p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-clay">
                  {type.intensity} · {counts[type.id] ?? 0} upcoming
                </span>
                <div className="flex gap-2">
                  <Link href={`/classes/${type.slug}`} className="btn btn-outline btn-sm">Details</Link>
                  <Link href={`/timetable?type=${type.slug}`} className="btn btn-primary btn-sm">Book</Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export async function generateMetadata() {
  return { title: "Class styles · Sattva Studio" };
}

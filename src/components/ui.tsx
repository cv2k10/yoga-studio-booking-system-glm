import Link from "@/components/Link";
import type { ReactNode } from "@/lib/next";

export const CATEGORY_STYLES: Record<string, { chip: string; dot: string; label: string }> = {
  yoga: { chip: "bg-sage/12 text-sage", dot: "bg-sage", label: "Yoga" },
  pilates: { chip: "bg-clay/12 text-clay", dot: "bg-clay", label: "Pilates" },
  meditation: { chip: "bg-ink/10 text-ink-soft", dot: "bg-ink-soft", label: "Meditation" },
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "sage" | "clay" | "warn" | "muted";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink/8 text-ink",
    sage: "bg-sage/12 text-sage",
    clay: "bg-clay/12 text-clay",
    warn: "bg-amber-100 text-amber-800",
    muted: "bg-black/5 text-ink-soft",
  };
  return <span className={`pill ${tones[tone]}`}>{children}</span>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-clay">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl sm:text-3xl">{title}</h2>
        {description ? <p className="mt-2 text-sm text-ink-soft">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-8 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <div className="card p-5">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <p className="mt-2 text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="hover:text-clay">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink">{item.label}</span>
          )}
          {index < items.length - 1 ? <span aria-hidden>/</span> : null}
        </span>
      ))}
    </nav>
  );
}

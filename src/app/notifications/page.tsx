import Link from "@/components/Link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/actions/booking";
import { formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

const TONE: Record<string, "sage" | "clay" | "warn" | "muted"> = {
  booking: "sage",
  change: "warn",
  voucher: "clay",
  info: "muted",
};

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(80);

  const unread = items.filter((item) => !item.isRead).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-clay">Inbox</p>
          <h1 className="mt-1 text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {unread > 0 ? `${unread} unread` : "All caught up"} · schedule changes, bookings and
            voucher updates.
          </p>
        </div>
        <form action={markAllNotificationsReadAction}>
          <button type="submit" className="btn btn-outline btn-sm" disabled={unread === 0}>
            Mark all as read
          </button>
        </form>
      </div>

      <div className="mt-8 space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className={`card p-5 ${item.isRead ? "opacity-75" : "ring-1 ring-clay/30"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TONE[item.type] ?? "muted"}>{item.type}</Badge>
              <h2 className="display text-lg">{item.title}</h2>
              {!item.isRead ? <span className="h-2 w-2 rounded-full bg-clay" /> : null}
              <span className="ml-auto text-xs text-ink-soft">{formatDateTime(item.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm text-ink-soft">{item.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.actionHref ? (
                <Link href={item.actionHref} className="btn btn-outline btn-sm">
                  {item.bookingId ? "View booking proof" : "Open"}
                </Link>
              ) : null}
              {!item.isRead ? (
                <ActionForm
                  action={markNotificationReadAction}
                  submitLabel="Mark as read"
                  submitClassName="btn btn-ghost btn-sm"
                  showMessage={false}
                  className="inline"
                >
                  <input type="hidden" name="notificationId" value={item.id} />
                </ActionForm>
              ) : null}
            </div>
          </article>
        ))}
        {items.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="display text-xl">Nothing here yet</p>
            <p className="mt-2 text-sm text-ink-soft">
              Book a class or buy a voucher and updates will appear in this inbox.
            </p>
            <Link href="/timetable" className="btn btn-primary btn-sm mt-4">Browse the timetable</Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

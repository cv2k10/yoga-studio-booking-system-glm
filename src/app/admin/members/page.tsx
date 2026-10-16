import Link from "@/components/Link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, classSessions, classTypes, teachers, users, vouchers } from "@/db/schema";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Stat } from "@/components/ui";
import { grantCreditsAction, setAttendanceAction, toggleMemberAction } from "@/app/actions/admin";
import { formatDateShort, formatDateTime, formatRange } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const memberRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      credits: sql<number>`coalesce((
        select sum(v.credits_remaining) from vouchers v
        where v.user_id = ${users.id} and v.status = 'active'
      ), 0)`.mapWith(Number),
      bookingCount: sql<number>`(
        select count(*) from bookings b where b.user_id = ${users.id}
      )`.mapWith(Number),
    })
    .from(users)
    .orderBy(asc(users.name));

  const bookingRows = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      status: bookings.status,
      createdAt: bookings.createdAt,
      memberName: users.name,
      memberEmail: users.email,
      sessionDate: classSessions.sessionDate,
      startTime: classSessions.startTime,
      durationMinutes: classSessions.durationMinutes,
      className: classTypes.name,
      teacherName: teachers.name,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .innerJoin(teachers, eq(classSessions.teacherId, teachers.id))
    .orderBy(desc(classSessions.sessionDate), desc(classSessions.startTime))
    .limit(40);

  const totalCredits = memberRows.reduce((sum, row) => sum + row.credits, 0);
  const activeMembers = memberRows.filter((row) => row.isActive && row.role === "member").length;

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active members" value={`${activeMembers}`} hint={`${memberRows.length} accounts total`} />
        <Stat label="Credits held by members" value={`${totalCredits}`} hint="On active vouchers" />
        <Stat label="Recent bookings" value={`${bookingRows.length}`} hint="Latest 40 shown" />
      </div>

      <section>
        <h2 className="display text-2xl">Members</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Grant complimentary credits or deactivate an account. Deactivated members cannot sign in.
        </p>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-sand-deep/50 text-left text-[0.68rem] uppercase tracking-[0.12em] text-ink-soft">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Bookings</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {memberRows.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-xs text-ink-soft">
                      {member.role === "admin" ? "Studio admin" : "Member"} ·{" "}
                      {member.isActive ? "active" : "deactivated"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {member.email}
                    <br />
                    {member.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{member.credits}</td>
                  <td className="px-4 py-3 tabular-nums">{member.bookingCount}</td>
                  <td className="px-4 py-3 text-xs text-ink-soft">{formatDateTime(member.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <ActionForm
                        action={grantCreditsAction}
                        submitLabel="Grant"
                        submitClassName="btn btn-outline btn-sm"
                        showMessage={false}
                        className="flex items-end gap-1"
                      >
                        <input type="hidden" name="userId" value={member.id} />
                        <input
                          name="credits"
                          type="number"
                          min={1}
                          max={20}
                          defaultValue={1}
                          className="field w-16 px-2 py-1"
                          aria-label="Credits to grant"
                        />
                      </ActionForm>
                      {member.role !== "admin" ? (
                        <ActionForm
                          action={toggleMemberAction}
                          submitLabel={member.isActive ? "Deactivate" : "Reactivate"}
                          submitClassName={`btn btn-sm ${member.isActive ? "text-clay" : "btn-sage"}`}
                          showMessage={false}
                          className="inline"
                        >
                          <input type="hidden" name="userId" value={member.id} />
                        </ActionForm>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="display text-2xl">Bookings &amp; attendance</h2>
        <p className="mt-1 text-sm text-ink-soft">Mark attendance after class. Booking references are the member&apos;s proof.</p>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-sand-deep/50 text-left text-[0.68rem] uppercase tracking-[0.12em] text-ink-soft">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {bookingRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDateShort(row.sessionDate)}
                    <span className="block text-xs text-ink-soft">
                      {formatRange(row.startTime, row.durationMinutes)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.className}
                    <span className="block text-xs text-ink-soft">{row.teacherName}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.memberName}
                    <span className="block text-xs text-ink-soft">{row.memberEmail}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.reference}</td>
                  <td className="px-4 py-3">
                    {row.status === "confirmed" ? <Badge tone="sage">Confirmed</Badge> : null}
                    {row.status === "attended" ? <Badge tone="sage">Attended</Badge> : null}
                    {row.status === "no_show" ? <Badge tone="clay">No show</Badge> : null}
                    {row.status === "cancelled" ? <Badge tone="muted">Cancelled</Badge> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {["attended", "no_show", "confirmed"].map((status) => (
                        <ActionForm
                          key={status}
                          action={setAttendanceAction}
                          submitLabel={status === "attended" ? "✓" : status === "no_show" ? "✗" : "Reset"}
                          submitClassName="btn btn-outline btn-sm px-2.5"
                          showMessage={false}
                          className="inline"
                        >
                          <input type="hidden" name="bookingId" value={row.id} />
                          <input type="hidden" name="status" value={status} />
                        </ActionForm>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {bookingRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-soft">No bookings yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-ink-soft">
          Need to see a member&apos;s proof of booking? Open their reference link from the timetable or
          ask them to show the QR code from <Link href="/dashboard" className="link-underline">their dashboard</Link>.
        </p>
      </section>
    </div>
  );
}

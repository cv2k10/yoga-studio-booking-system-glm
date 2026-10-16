import Link from "@/components/Link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classTemplates, classTypes } from "@/db/schema";
import { getRooms, getTeachers, getWeekSessions, ensureSessionHorizon } from "@/lib/scheduling";
import { ActionForm } from "@/components/ActionForm";
import { Badge } from "@/components/ui";
import {
  addExtraClassAction,
  cancelSessionAction,
  deleteTemplateAction,
  reinstateSessionAction,
  saveTemplateAction,
  syncTimetableAction,
  updateSessionAction,
} from "@/app/actions/admin";
import {
  WEEKDAY_LABELS,
  addDaysISO,
  formatDateShort,
  formatRange,
  isValidISODate,
  startOfWeekISO,
  todayISO,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

type SlotFormProps = {
  teachers: { id: number; name: string }[];
  rooms: { id: number; name: string }[];
  types: { id: number; name: string }[];
};

function TemplateFields({
  teachers,
  rooms,
  types,
  template,
}: SlotFormProps & { template?: typeof classTemplates.$inferSelect }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {template ? <input type="hidden" name="templateId" value={template.id} /> : null}
      <div>
        <label className="label">Class type</label>
        <select name="classTypeId" className="field" defaultValue={template?.classTypeId ?? types[0]?.id}>
          {types.map((type) => (
            <option key={type.id} value={type.id}>{type.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Teacher</label>
        <select name="teacherId" className="field" defaultValue={template?.teacherId ?? teachers[0]?.id}>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Studio room</label>
        <select name="roomId" className="field" defaultValue={template?.roomId ?? rooms[0]?.id}>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Day of week</label>
        <select name="dayOfWeek" className="field" defaultValue={template?.dayOfWeek ?? 1}>
          {WEEKDAY_LABELS.map((label, index) => (
            <option key={label} value={index + 1}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Start time</label>
        <input name="startTime" type="time" className="field" defaultValue={template?.startTime ?? "07:00"} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Minutes</label>
          <input name="durationMinutes" type="number" min={30} max={180} step={5} className="field" defaultValue={template?.durationMinutes ?? 60} />
        </div>
        <div>
          <label className="label">Capacity</label>
          <input name="capacity" type="number" min={1} max={40} className="field" defaultValue={template?.capacity ?? 12} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={template ? template.isPublished : true} />
        Published on the member timetable
      </label>
    </div>
  );
}

export default async function AdminTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  await ensureSessionHorizon();

  const weekStart = isValidISODate(params.date) ? startOfWeekISO(params.date as string) : startOfWeekISO(todayISO());
  const [templates, types, teachers, rooms, sessions] = await Promise.all([
    db.select().from(classTemplates).orderBy(asc(classTemplates.dayOfWeek), asc(classTemplates.startTime)),
    db.select().from(classTypes).orderBy(asc(classTypes.name)),
    getTeachers(),
    getRooms(),
    getWeekSessions(weekStart),
  ]);

  const typeById = new Map(types.map((t) => [t.id, t]));
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  return (
    <div className="space-y-10">
      {/* Weekly templates */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display text-2xl">Weekly timetable (recurring slots)</h2>
            <p className="mt-1 text-sm text-ink-soft">
              These slots repeat every week. Sessions for the next 5 weeks are generated automatically.
            </p>
          </div>
          <form action={syncTimetableAction}>
            <button type="submit" className="btn btn-primary btn-sm">Sync future classes</button>
          </form>
        </div>

        <div className="mt-4 grid gap-3">
          {templates.map((template) => (
            <details key={template.id} className="card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                <span className="pill bg-ink text-sand">{WEEKDAY_LABELS[template.dayOfWeek - 1]}</span>
                <span className="font-semibold tabular-nums">{template.startTime}</span>
                <span className="font-medium">{typeById.get(template.classTypeId)?.name}</span>
                <span className="text-xs text-ink-soft">
                  {teacherById.get(template.teacherId)?.name} · {roomById.get(template.roomId)?.name}
                </span>
                <span className="text-xs text-ink-soft">
                  {template.durationMinutes} min · cap {template.capacity}
                </span>
                <span className="ml-auto">
                  {template.isPublished ? <Badge tone="sage">Published</Badge> : <Badge tone="muted">Hidden</Badge>}
                </span>
              </summary>
              <div className="mt-4 space-y-4 border-t border-ink/8 pt-4">
                <ActionForm
                  action={saveTemplateAction}
                  submitLabel="Save weekly slot"
                  submitClassName="btn btn-primary btn-sm"
                  className="space-y-3"
                >
                  <TemplateFields teachers={teachers} rooms={rooms} types={types} template={template} />
                </ActionForm>
                <ActionForm
                  action={deleteTemplateAction}
                  submitLabel="Delete slot"
                  submitClassName="btn btn-outline btn-sm text-clay"
                  confirmText="Delete this weekly slot? Future unbooked classes are removed."
                  showMessage={false}
                  className="inline"
                >
                  <input type="hidden" name="templateId" value={template.id} />
                </ActionForm>
              </div>
            </details>
          ))}
          {templates.length === 0 ? (
            <p className="card p-6 text-sm text-ink-soft">No weekly slots yet — add the first one below.</p>
          ) : null}
        </div>

        <details className="card mt-4 p-4">
          <summary className="cursor-pointer text-sm font-semibold">+ Add a weekly slot</summary>
          <ActionForm
            action={saveTemplateAction}
            submitLabel="Add to weekly timetable"
            submitClassName="btn btn-primary btn-sm mt-3"
            className="mt-4 space-y-3"
          >
            <TemplateFields teachers={teachers} rooms={rooms} types={types} />
          </ActionForm>
        </details>
      </section>

      {/* Week editor */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display text-2xl">Week of {formatDateShort(weekStart)}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Change the time, teacher or room for a single date. Booked members are notified
              automatically and the change is logged.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/timetable?date=${addDaysISO(weekStart, -7)}`} className="btn btn-outline btn-sm">← Previous</Link>
            <Link href={`/admin/timetable?date=${addDaysISO(weekStart, 7)}`} className="btn btn-outline btn-sm">Next →</Link>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {sessions.map((session) => (
            <details key={session.id} className="card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                <span className="pill bg-sand-deep text-ink-soft">{formatDateShort(session.sessionDate)}</span>
                <span className="font-semibold tabular-nums">{session.startTime}</span>
                <span className="font-medium">{session.classTypeName}</span>
                <span className="text-xs text-ink-soft">
                  {session.teacherName} · {session.roomName} · {session.booked}/{session.capacity} booked
                </span>
                <span className="ml-auto flex gap-1.5">
                  {session.isExtra ? <Badge tone="clay">Extra</Badge> : null}
                  {session.changeCount > 0 ? <Badge tone="warn">{session.changeCount} change(s)</Badge> : null}
                  {session.status !== "scheduled" ? <Badge tone="clay">Cancelled</Badge> : null}
                </span>
              </summary>

              <div className="mt-4 space-y-4 border-t border-ink/8 pt-4">
                <ActionForm
                  action={updateSessionAction}
                  submitLabel="Save & notify members"
                  submitClassName="btn btn-primary btn-sm"
                  className="space-y-3"
                >
                  <input type="hidden" name="sessionId" value={session.id} />
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <label className="label">Start time</label>
                      <input name="startTime" type="time" className="field" defaultValue={session.startTime} />
                    </div>
                    <div>
                      <label className="label">Teacher</label>
                      <select name="teacherId" className="field" defaultValue={session.teacherId}>
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Room</label>
                      <select name="roomId" className="field" defaultValue={session.roomId}>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>{room.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Minutes</label>
                        <input name="durationMinutes" type="number" min={30} max={180} step={5} className="field" defaultValue={session.durationMinutes} />
                      </div>
                      <div>
                        <label className="label">Capacity</label>
                        <input name="capacity" type="number" min={1} max={40} className="field" defaultValue={session.capacity} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="label">Note to members (optional)</label>
                    <input name="note" className="field" defaultValue={session.note ?? ""} placeholder="e.g. Temporary swap while Maya is away" />
                  </div>
                </ActionForm>

                <div className="flex flex-wrap gap-3">
                  {session.status === "scheduled" ? (
                    <ActionForm
                      action={cancelSessionAction}
                      submitLabel="Cancel this class"
                      submitClassName="btn btn-outline btn-sm text-clay"
                      confirmText="Cancel this class? Credits are refunded and members notified."
                      className="flex-1 space-y-2"
                    >
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input name="reason" className="field" placeholder="Reason shown to members (e.g. teacher unwell)" />
                    </ActionForm>
                  ) : (
                    <ActionForm
                      action={reinstateSessionAction}
                      submitLabel="Reinstate class"
                      submitClassName="btn btn-sage btn-sm"
                      className="inline"
                    >
                      <input type="hidden" name="sessionId" value={session.id} />
                    </ActionForm>
                  )}
                  <Link href={`/rooms/${session.roomSlug}`} className="btn btn-ghost btn-sm">
                    Room: {formatRange(session.startTime, session.durationMinutes)}
                  </Link>
                </div>
              </div>
            </details>
          ))}
          {sessions.length === 0 ? (
            <p className="card p-6 text-sm text-ink-soft">No classes this week.</p>
          ) : null}
        </div>
      </section>

      {/* Extra class */}
      <section id="extra" className="card grain p-6">
        <h2 className="display text-2xl">Add an extra (one-off) class</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Workshops, pop-ups and cover classes. All active members are notified as soon as it is
          published.
        </p>
        <ActionForm
          action={addExtraClassAction}
          submitLabel="Publish extra class"
          submitClassName="btn btn-primary btn-sm mt-3"
          className="mt-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Class type</label>
              <select name="classTypeId" className="field" defaultValue={types[0]?.id}>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Teacher</label>
              <select name="teacherId" className="field" defaultValue={teachers[0]?.id}>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Studio room</label>
              <select name="roomId" className="field" defaultValue={rooms[0]?.id}>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input name="sessionDate" type="date" className="field" defaultValue={todayISO()} required />
            </div>
            <div>
              <label className="label">Start time</label>
              <input name="startTime" type="time" className="field" defaultValue="19:30" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Minutes</label>
                <input name="durationMinutes" type="number" min={30} max={240} step={5} className="field" defaultValue={75} />
              </div>
              <div>
                <label className="label">Capacity</label>
                <input name="capacity" type="number" min={1} max={40} className="field" defaultValue={14} />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Announcement note</label>
            <input name="note" className="field" placeholder="Candlelight yin with live sound bath" />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}

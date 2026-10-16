import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { classTypes, rooms, teachers, voucherProducts } from "@/db/schema";
import { ActionForm } from "@/components/ActionForm";
import { Badge } from "@/components/ui";
import { saveProductAction, saveRoomAction, saveTeacherAction } from "@/app/actions/admin";
import { formatMoney } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AdminCataloguePage() {
  const [teacherRows, roomRows, productRows, typeRows] = await Promise.all([
    db.select().from(teachers).orderBy(asc(teachers.name)),
    db.select().from(rooms).orderBy(asc(rooms.name)),
    db.select().from(voucherProducts).orderBy(asc(voucherProducts.priceCents)),
    db.select().from(classTypes).orderBy(asc(classTypes.name)),
  ]);

  const usage = await db
    .select({ teacherId: sql<number>`teacher_id`, count: sql<number>`count(*)`.mapWith(Number) })
    .from(sql`class_sessions`)
    .groupBy(sql`teacher_id`);

  return (
    <div className="space-y-12">
      {/* Teachers */}
      <section>
        <h2 className="display text-2xl">Teachers</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Profiles power the public teacher pages and the teacher timetable.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {teacherRows.map((teacher) => (
            <details key={teacher.id} className="card p-4">
              <summary className="flex cursor-pointer items-center gap-3">
                <img src={teacher.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                <div>
                  <p className="text-sm font-semibold">{teacher.name}</p>
                  <p className="text-xs text-ink-soft">{teacher.title}</p>
                </div>
                <span className="ml-auto">
                  {teacher.isActive ? <Badge tone="sage">Active</Badge> : <Badge tone="muted">Hidden</Badge>}
                </span>
              </summary>
              <ActionForm
                action={saveTeacherAction}
                submitLabel="Save teacher"
                submitClassName="btn btn-primary btn-sm mt-2"
                className="mt-4 space-y-3 border-t border-ink/8 pt-4"
              >
                <input type="hidden" name="teacherId" value={teacher.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="label">Name</label><input name="name" className="field" defaultValue={teacher.name} /></div>
                  <div><label className="label">Title</label><input name="title" className="field" defaultValue={teacher.title} /></div>
                  <div className="sm:col-span-2"><label className="label">Photo URL</label><input name="photoUrl" className="field" defaultValue={teacher.photoUrl} /></div>
                  <div className="sm:col-span-2"><label className="label">Bio</label><textarea name="bio" rows={3} className="field" defaultValue={teacher.bio} /></div>
                  <div><label className="label">Specialties (comma separated)</label><input name="specialties" className="field" defaultValue={teacher.specialties} /></div>
                  <div><label className="label">Certifications (comma separated)</label><input name="certifications" className="field" defaultValue={teacher.certifications} /></div>
                  <div><label className="label">Years experience</label><input name="yearsExperience" type="number" min={0} max={60} className="field" defaultValue={teacher.yearsExperience} /></div>
                  <div><label className="label">Instagram</label><input name="instagram" className="field" defaultValue={teacher.instagram ?? ""} /></div>
                  <div><label className="label">Slug</label><input name="slug" className="field" defaultValue={teacher.slug} /></div>
                  <label className="flex items-end gap-2 text-sm">
                    <input type="checkbox" name="isActive" defaultChecked={teacher.isActive} /> Visible on site
                  </label>
                </div>
              </ActionForm>
            </details>
          ))}
        </div>

        <details className="card mt-4 p-4">
          <summary className="cursor-pointer text-sm font-semibold">+ Add a teacher</summary>
          <ActionForm action={saveTeacherAction} submitLabel="Create teacher" submitClassName="btn btn-primary btn-sm mt-3" className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Name</label><input name="name" className="field" required /></div>
              <div><label className="label">Title</label><input name="title" className="field" placeholder="Senior Yoga Teacher" /></div>
              <div className="sm:col-span-2"><label className="label">Photo URL</label><input name="photoUrl" className="field" placeholder="https://…" /></div>
              <div className="sm:col-span-2"><label className="label">Bio</label><textarea name="bio" rows={3} className="field" /></div>
              <div><label className="label">Specialties</label><input name="specialties" className="field" placeholder="Vinyasa, Yin, Prenatal" /></div>
              <div><label className="label">Certifications</label><input name="certifications" className="field" placeholder="RYT-500, Pilates Mat I & II" /></div>
              <div><label className="label">Years experience</label><input name="yearsExperience" type="number" min={0} className="field" defaultValue={5} /></div>
              <label className="flex items-end gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked /> Visible on site</label>
            </div>
          </ActionForm>
        </details>
      </section>

      {/* Rooms */}
      <section>
        <h2 className="display text-2xl">Studio rooms &amp; views</h2>
        <p className="mt-1 text-sm text-ink-soft">Room views appear on the public studio rooms page and on each class card.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {roomRows.map((room) => (
            <details key={room.id} className="card p-4">
              <summary className="flex cursor-pointer items-center gap-3">
                <img src={room.imageUrl} alt="" className="h-12 w-16 rounded-xl object-cover" />
                <div>
                  <p className="text-sm font-semibold">{room.name}</p>
                  <p className="text-xs text-ink-soft">{room.viewName} · cap {room.capacity}</p>
                </div>
                <span className="ml-auto">
                  {room.isActive ? <Badge tone="sage">Active</Badge> : <Badge tone="muted">Hidden</Badge>}
                </span>
              </summary>
              <ActionForm action={saveRoomAction} submitLabel="Save room" submitClassName="btn btn-primary btn-sm mt-2" className="mt-4 space-y-3 border-t border-ink/8 pt-4">
                <input type="hidden" name="roomId" value={room.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="label">Name</label><input name="name" className="field" defaultValue={room.name} /></div>
                  <div><label className="label">View name</label><input name="viewName" className="field" defaultValue={room.viewName} /></div>
                  <div className="sm:col-span-2"><label className="label">Image URL</label><input name="imageUrl" className="field" defaultValue={room.imageUrl} /></div>
                  <div className="sm:col-span-2"><label className="label">Description</label><textarea name="description" rows={3} className="field" defaultValue={room.description} /></div>
                  <div><label className="label">Capacity</label><input name="capacity" type="number" min={1} max={60} className="field" defaultValue={room.capacity} /></div>
                  <div><label className="label">Floor</label><input name="floor" className="field" defaultValue={room.floor} /></div>
                  <div className="sm:col-span-2"><label className="label">Amenities (comma separated)</label><input name="amenities" className="field" defaultValue={room.amenities} /></div>
                  <div><label className="label">Slug</label><input name="slug" className="field" defaultValue={room.slug} /></div>
                  <label className="flex items-end gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={room.isActive} /> Bookable</label>
                </div>
              </ActionForm>
            </details>
          ))}
        </div>

        <details className="card mt-4 p-4">
          <summary className="cursor-pointer text-sm font-semibold">+ Add a studio room</summary>
          <ActionForm action={saveRoomAction} submitLabel="Create room" submitClassName="btn btn-primary btn-sm mt-3" className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Name</label><input name="name" className="field" required /></div>
              <div><label className="label">View name</label><input name="viewName" className="field" placeholder="Sunrise city view" /></div>
              <div className="sm:col-span-2"><label className="label">Image URL</label><input name="imageUrl" className="field" placeholder="https://…" /></div>
              <div className="sm:col-span-2"><label className="label">Description</label><textarea name="description" rows={3} className="field" /></div>
              <div><label className="label">Capacity</label><input name="capacity" type="number" min={1} className="field" defaultValue={14} /></div>
              <div><label className="label">Floor</label><input name="floor" className="field" defaultValue="Level 3" /></div>
              <div className="sm:col-span-2"><label className="label">Amenities</label><input name="amenities" className="field" placeholder="Sprung floor, Mirrors, Sound system" /></div>
              <label className="flex items-end gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked /> Bookable</label>
            </div>
          </ActionForm>
        </details>
      </section>

      {/* Voucher products */}
      <section>
        <h2 className="display text-2xl">Class voucher packs</h2>
        <p className="mt-1 text-sm text-ink-soft">Packs shown on the vouchers page. Price is entered in ringgit.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {productRows.map((product) => (
            <details key={product.id} className="card p-4">
              <summary className="flex cursor-pointer items-center gap-3">
                <div>
                  <p className="text-sm font-semibold">{product.name}</p>
                  <p className="text-xs text-ink-soft">
                    {product.classCount} credits · {formatMoney(product.priceCents)} · {product.validityDays} days
                  </p>
                </div>
                <span className="ml-auto flex gap-1.5">
                  {product.isFeatured ? <Badge tone="clay">Featured</Badge> : null}
                  {product.isActive ? <Badge tone="sage">Live</Badge> : <Badge tone="muted">Hidden</Badge>}
                </span>
              </summary>
              <ActionForm action={saveProductAction} submitLabel="Save pack" submitClassName="btn btn-primary btn-sm mt-2" className="mt-4 space-y-3 border-t border-ink/8 pt-4">
                <input type="hidden" name="productId" value={product.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="label">Name</label><input name="name" className="field" defaultValue={product.name} /></div>
                  <div><label className="label">Price (RM)</label><input name="price" type="number" step="0.01" min={0} className="field" defaultValue={(product.priceCents / 100).toFixed(2)} /></div>
                  <div><label className="label">Credits</label><input name="classCount" type="number" min={1} className="field" defaultValue={product.classCount} /></div>
                  <div><label className="label">Validity (days)</label><input name="validityDays" type="number" min={7} className="field" defaultValue={product.validityDays} /></div>
                  <div className="sm:col-span-2"><label className="label">Description</label><input name="description" className="field" defaultValue={product.description} /></div>
                  <div className="sm:col-span-2"><label className="label">Perks (comma separated)</label><input name="perks" className="field" defaultValue={product.perks} /></div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={product.isFeatured} /> Featured</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={product.isActive} /> On sale</label>
                </div>
              </ActionForm>
            </details>
          ))}
        </div>

        <details className="card mt-4 p-4">
          <summary className="cursor-pointer text-sm font-semibold">+ Add a voucher pack</summary>
          <ActionForm action={saveProductAction} submitLabel="Create pack" submitClassName="btn btn-primary btn-sm mt-3" className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Name</label><input name="name" className="field" required /></div>
              <div><label className="label">Price (RM)</label><input name="price" type="number" step="0.01" min={0} className="field" required /></div>
              <div><label className="label">Credits</label><input name="classCount" type="number" min={1} className="field" defaultValue={10} /></div>
              <div><label className="label">Validity (days)</label><input name="validityDays" type="number" min={7} className="field" defaultValue={180} /></div>
              <div className="sm:col-span-2"><label className="label">Description</label><input name="description" className="field" /></div>
              <div className="sm:col-span-2"><label className="label">Perks</label><input name="perks" className="field" placeholder="Any class, Guest pass, Mat storage" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" /> Featured</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked /> On sale</label>
            </div>
          </ActionForm>
        </details>
      </section>

      {/* Class types */}
      <section>
        <h2 className="display text-2xl">Class styles</h2>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-sand-deep/50 text-left text-[0.68rem] uppercase tracking-[0.12em] text-ink-soft">
              <tr>
                <th className="px-4 py-3">Style</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Intensity</th>
                <th className="px-4 py-3">Minutes</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {typeRows.map((type) => (
                <tr key={type.id}>
                  <td className="px-4 py-3 font-medium">{type.name}</td>
                  <td className="px-4 py-3 capitalize">{type.category}</td>
                  <td className="px-4 py-3">{type.intensity}</td>
                  <td className="px-4 py-3">{type.durationMinutes}</td>
                  <td className="px-4 py-3">
                    {type.isActive ? <Badge tone="sage">Active</Badge> : <Badge tone="muted">Hidden</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          {usage.reduce((sum, row) => sum + row.count, 0)} sessions are scheduled from these styles.
          Class styles are curated by the studio; ask development to add new ones.
        </p>
      </section>
    </div>
  );
}

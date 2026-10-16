import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const bool = (name: string) => integer(name, { mode: "boolean" });
const timestamp = (name: string) => integer(name, { mode: "timestamp" });
const createdAt = () => timestamp("created_at").notNull().default(sql`(unixepoch())`);

/* ------------------------------------------------------------------ */
/* Members + staff accounts                                            */
/* ------------------------------------------------------------------ */
export const users = sqliteTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("member"), // member | admin
    isActive: bool("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

/* ------------------------------------------------------------------ */
/* Studio resources                                                    */
/* ------------------------------------------------------------------ */
export const teachers = sqliteTable(
  "teachers",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    title: text("title").notNull(),
    bio: text("bio").notNull(),
    photoUrl: text("photo_url").notNull(),
    specialties: text("specialties").notNull().default(""), // comma separated
    certifications: text("certifications").notNull().default(""),
    yearsExperience: integer("years_experience").notNull().default(1),
    instagram: text("instagram"),
    isActive: bool("is_active").notNull().default(true),
  },
  (table) => [uniqueIndex("teachers_slug_unique").on(table.slug)],
);

export const rooms = sqliteTable(
  "rooms",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    viewName: text("view_name").notNull(),
    description: text("description").notNull(),
    imageUrl: text("image_url").notNull(),
    capacity: integer("capacity").notNull().default(14),
    floor: text("floor").notNull().default("Ground floor"),
    amenities: text("amenities").notNull().default(""),
    isActive: bool("is_active").notNull().default(true),
  },
  (table) => [uniqueIndex("rooms_slug_unique").on(table.slug)],
);

export const classTypes = sqliteTable(
  "class_types",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("yoga"), // yoga | pilates | meditation
    intensity: text("intensity").notNull().default("All levels"),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    tagline: text("tagline").notNull(),
    description: text("description").notNull(),
    accent: text("accent").notNull().default("emerald"),
    isActive: bool("is_active").notNull().default(true),
  },
  (table) => [uniqueIndex("class_types_slug_unique").on(table.slug)],
);

/* ------------------------------------------------------------------ */
/* Weekly timetable                                                    */
/* ------------------------------------------------------------------ */
export const classTemplates = sqliteTable("class_templates", {
  id: id(),
  classTypeId: integer("class_type_id")
    .notNull()
    .references(() => classTypes.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => teachers.id, { onDelete: "cascade" }),
  roomId: integer("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 1 = Monday ... 7 = Sunday
  startTime: text("start_time").notNull(), // "07:00"
  durationMinutes: integer("duration_minutes").notNull().default(60),
  capacity: integer("capacity").notNull().default(12),
  isPublished: bool("is_published").notNull().default(true),
  createdAt: createdAt(),
});

/* Materialised occurrences: recurring slots + admin-added one-off classes */
export const classSessions = sqliteTable(
  "class_sessions",
  {
    id: id(),
    templateId: integer("template_id").references(() => classTemplates.id, {
      onDelete: "set null",
    }),
    classTypeId: integer("class_type_id")
      .notNull()
      .references(() => classTypes.id, { onDelete: "cascade" }),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    sessionDate: text("session_date").notNull(),
    startTime: text("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    capacity: integer("capacity").notNull().default(12),
    isExtra: bool("is_extra").notNull().default(false),
    status: text("status").notNull().default("scheduled"), // scheduled | cancelled
    note: text("note"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("class_sessions_template_date_unique").on(table.templateId, table.sessionDate),
    index("class_sessions_date_idx").on(table.sessionDate),
  ],
);

/** Audit trail for every change made to a scheduled class. */
export const sessionChanges = sqliteTable("session_changes", {
  id: id(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => classSessions.id, { onDelete: "cascade" }),
  changeType: text("change_type").notNull(), // time | teacher | room | cancellation | reinstated | extra
  label: text("label").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  note: text("note"),
  actorName: text("actor_name").notNull().default("Studio admin"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Vouchers (class credit packs)                                       */
/* ------------------------------------------------------------------ */
export const voucherProducts = sqliteTable("voucher_products", {
  id: id(),
  name: text("name").notNull(),
  classCount: integer("class_count").notNull(),
  priceCents: integer("price_cents").notNull(),
  validityDays: integer("validity_days").notNull().default(180),
  description: text("description").notNull().default(""),
  perks: text("perks").notNull().default(""),
  isFeatured: bool("is_featured").notNull().default(false),
  isActive: bool("is_active").notNull().default(true),
});

export const vouchers = sqliteTable(
  "vouchers",
  {
    id: id(),
    code: text("code").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => voucherProducts.id, {
      onDelete: "set null",
    }),
    productName: text("product_name").notNull(),
    creditsTotal: integer("credits_total").notNull(),
    creditsRemaining: integer("credits_remaining").notNull(),
    priceCents: integer("price_cents").notNull(),
    purchasedAt: timestamp("purchased_at").notNull().default(sql`(unixepoch())`),
    expiresAt: text("expires_at").notNull(),
    status: text("status").notNull().default("active"), // active | depleted | expired
  },
  (table) => [uniqueIndex("vouchers_code_unique").on(table.code)],
);

export const payments = sqliteTable("payments", {
  id: id(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  voucherId: integer("voucher_id").references(() => vouchers.id, { onDelete: "set null" }),
  reference: text("reference").notNull(),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull().default("card"),
  status: text("status").notNull().default("paid"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */
export const bookings = sqliteTable(
  "bookings",
  {
    id: id(),
    reference: text("reference").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    voucherId: integer("voucher_id").references(() => vouchers.id, { onDelete: "set null" }),
    status: text("status").notNull().default("confirmed"), // confirmed | cancelled | attended | no_show
    creditsUsed: integer("credits_used").notNull().default(1),
    checkedInAt: timestamp("checked_in_at"),
    createdAt: createdAt(),
    cancelledAt: timestamp("cancelled_at"),
  },
  (table) => [
    uniqueIndex("bookings_reference_unique").on(table.reference),
    // One active booking per member per class: blocks double-booking at the DB level.
    uniqueIndex("bookings_user_session_active_unique")
      .on(table.userId, table.sessionId)
      .where(sql`status <> 'cancelled'`),
    index("bookings_session_idx").on(table.sessionId),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("info"), // info | booking | change | voucher
    title: text("title").notNull(),
    body: text("body").notNull(),
    sessionId: integer("session_id").references(() => classSessions.id, { onDelete: "cascade" }),
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    actionHref: text("action_href"),
    isRead: bool("is_read").notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [index("notifications_user_read_idx").on(table.userId, table.isRead)],
);

export type User = typeof users.$inferSelect;
export type Teacher = typeof teachers.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type ClassType = typeof classTypes.$inferSelect;
export type ClassTemplate = typeof classTemplates.$inferSelect;
export type ClassSession = typeof classSessions.$inferSelect;
export type Voucher = typeof vouchers.$inferSelect;
export type VoucherProduct = typeof voucherProducts.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type SessionChange = typeof sessionChanges.$inferSelect;

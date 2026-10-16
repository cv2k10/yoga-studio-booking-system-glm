import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Members + staff accounts                                            */
/* ------------------------------------------------------------------ */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("member"), // member | admin
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

/* ------------------------------------------------------------------ */
/* Studio resources                                                    */
/* ------------------------------------------------------------------ */
export const teachers = pgTable(
  "teachers",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    title: text("title").notNull(),
    bio: text("bio").notNull(),
    photoUrl: text("photo_url").notNull(),
    specialties: text("specialties").notNull().default(""), // comma separated
    certifications: text("certifications").notNull().default(""),
    yearsExperience: integer("years_experience").notNull().default(1),
    instagram: text("instagram"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [uniqueIndex("teachers_slug_unique").on(table.slug)],
);

export const rooms = pgTable(
  "rooms",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    viewName: text("view_name").notNull(),
    description: text("description").notNull(),
    imageUrl: text("image_url").notNull(),
    capacity: integer("capacity").notNull().default(14),
    floor: text("floor").notNull().default("Ground floor"),
    amenities: text("amenities").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [uniqueIndex("rooms_slug_unique").on(table.slug)],
);

export const classTypes = pgTable(
  "class_types",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("yoga"), // yoga | pilates | meditation
    intensity: text("intensity").notNull().default("All levels"),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    tagline: text("tagline").notNull(),
    description: text("description").notNull(),
    accent: text("accent").notNull().default("emerald"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [uniqueIndex("class_types_slug_unique").on(table.slug)],
);

/* ------------------------------------------------------------------ */
/* Weekly timetable                                                    */
/* ------------------------------------------------------------------ */
export const classTemplates = pgTable("class_templates", {
  id: serial("id").primaryKey(),
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
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* Materialised occurrences: recurring slots + admin-added one-off classes */
export const classSessions = pgTable(
  "class_sessions",
  {
    id: serial("id").primaryKey(),
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
    sessionDate: date("session_date", { mode: "string" }).notNull(),
    startTime: text("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    capacity: integer("capacity").notNull().default(12),
    isExtra: boolean("is_extra").notNull().default(false),
    status: text("status").notNull().default("scheduled"), // scheduled | cancelled
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("class_sessions_template_date_unique").on(table.templateId, table.sessionDate),
  ],
);

/** Audit trail for every change made to a scheduled class. */
export const sessionChanges = pgTable("session_changes", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => classSessions.id, { onDelete: "cascade" }),
  changeType: text("change_type").notNull(), // time | teacher | room | cancellation | reinstated | extra
  label: text("label").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  note: text("note"),
  actorName: text("actor_name").notNull().default("Studio admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Vouchers (class credit packs)                                       */
/* ------------------------------------------------------------------ */
export const voucherProducts = pgTable("voucher_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  classCount: integer("class_count").notNull(),
  priceCents: integer("price_cents").notNull(),
  validityDays: integer("validity_days").notNull().default(180),
  description: text("description").notNull().default(""),
  perks: text("perks").notNull().default(""),
  isFeatured: boolean("is_featured").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
});

export const vouchers = pgTable(
  "vouchers",
  {
    id: serial("id").primaryKey(),
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
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: date("expires_at", { mode: "string" }).notNull(),
    status: text("status").notNull().default("active"), // active | depleted | expired
  },
  (table) => [uniqueIndex("vouchers_code_unique").on(table.code)],
);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  voucherId: integer("voucher_id").references(() => vouchers.id, { onDelete: "set null" }),
  reference: text("reference").notNull(),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull().default("card"),
  status: text("status").notNull().default("paid"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */
export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
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
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("bookings_reference_unique").on(table.reference)],
);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("info"), // info | booking | change | voucher
  title: text("title").notNull(),
  body: text("body").notNull(),
  sessionId: integer("session_id").references(() => classSessions.id, { onDelete: "cascade" }),
  bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
  actionHref: text("action_href"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

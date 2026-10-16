/**
 * Seeds Sattva Studio with teachers, rooms, class styles, the weekly
 * timetable, materialised sessions, members, vouchers, bookings and demo
 * schedule changes + notifications.
 *
 * The seed runs against an in-memory SQLite copy of the D1 schema (built from
 * the drizzle migrations), then writes every row out as scripts/seed.sql for
 * `wrangler d1 execute`. Run with: npm run db:seed
 */
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const root = new URL("../", import.meta.url);
const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync(new URL("drizzle/", root)).filter((f) => f.endsWith(".sql")).sort()) {
  sqlite.exec(readFileSync(new URL(`drizzle/${file}`, root), "utf8").replaceAll("--> statement-breakpoint", ""));
}

/** pg-style client over node:sqlite, so the seed below reads like before. */
const toSqliteValue = (value) => {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "boolean") return value ? 1 : 0;
  return value ?? null;
};
const client = {
  async query(text, params = []) {
    const statement = text
      .replace(/\$(\d+)/g, "?$1")
      .replace(/now\(\) - interval '(\d+) days'/g, "(unixepoch() - $1 * 86400)")
      .replace(/now\(\)/g, "unixepoch()");
    const prepared = sqlite.prepare(statement);
    const args = params.map(toSqliteValue);
    if (/^\s*select|returning/i.test(statement)) return { rows: prepared.all(...args) };
    prepared.run(...args);
    return { rows: [] };
  },
};

// Matches src/lib/auth.ts: pbkdf2$<iterations>$<salt hex>$<hash hex>
const hash = (password) => {
  const salt = randomBytes(16);
  const derived = pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  return `pbkdf2$100000$${salt.toString("hex")}$${derived.toString("hex")}`;
};

const iso = (date) => {
  const pad = (n) => `${n}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};
const mondayOf = (date) => {
  const dow = date.getDay() === 0 ? 7 : date.getDay();
  return addDays(date, -(dow - 1));
};
const dowOf = (date) => (date.getDay() === 0 ? 7 : date.getDay());
const ref = (prefix, n) =>
  `${prefix}-${randomBytes(3).toString("hex").toUpperCase()}${`${n}`.padStart(2, "0")}`;

/* ---------------------------------- users --------------------------------- */
const users = [
  ["Studio Admin", "admin@sattva.fit", "+60 12 200 8891", "admin"],
  ["Maya Rahman", "maya@sattva.fit", "+60 12 345 6789", "member"],
  ["Aisyah Lim", "aisyah@sattva.fit", "+60 13 221 4477", "member"],
  ["Wei Ling Tan", "weiling@sattva.fit", "+60 19 882 3311", "member"],
  ["Jonathan Pereira", "jonathan@sattva.fit", "+60 11 556 2098", "member"],
  ["Nurul Huda", "nurul@sattva.fit", "+60 17 443 1188", "member"],
  ["Kenji Sato", "kenji@sattva.fit", "+60 12 990 5566", "member"],
  ["Sophie Meyer", "sophie@sattva.fit", "+60 14 667 2299", "member"],
  ["Daniel Osei", "daniel@sattva.fit", "+60 12 771 4402", "member"],
  ["Farah Idris", "farah@sattva.fit", "+60 16 220 7781", "member"],
  ["Liam Wong", "liam@sattva.fit", "+60 12 118 9903", "member"],
  ["Camila Rosa", "camila@sattva.fit", "+60 18 552 3307", "member"],
];

const demoPasswordHash = hash("studio123");
const userIds = {};
for (const [name, email, phone, role] of users) {
  const { rows } = await client.query(
    `insert into users (name, email, phone, password_hash, role) values ($1,$2,$3,$4,$5) returning id`,
    [name, email, phone, demoPasswordHash, role],
  );
  userIds[email] = rows[0].id;
}

const memberEmails = users.filter(([, , , role]) => role === "member").map(([, email]) => email);
const memberIds = memberEmails.map((email) => userIds[email]);
const mayaId = userIds["maya@sattva.fit"];

/* -------------------------------- teachers -------------------------------- */
const teachers = [
  {
    slug: "maya-chen",
    name: "Maya Chen",
    title: "Senior Yoga Teacher · E-RYT 500",
    bio: "Maya has taught vinyasa and hatha for twelve years across Kuala Lumpur and Ubud. Her classes are precise, warm and quietly challenging — expect clear alignment cues and a long, well-earned savasana.",
    photo:
      "https://images.pexels.com/photos/4534878/pexels-photo-4534878.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    specialties: "Vinyasa, Hatha, Prenatal, Alignment",
    certifications: "E-RYT 500, YACEP, Prenatal Yoga (85h)",
    years: 12,
    instagram: "@mayachen.yoga",
  },
  {
    slug: "priya-raman",
    name: "Priya Raman",
    title: "Pilates Lead Instructor",
    bio: "A former physiotherapy assistant, Priya builds every pilates class from the breath up. She is the teacher to see if you are returning from injury or want to understand your core properly.",
    photo:
      "https://images.pexels.com/photos/4498516/pexels-photo-4498516.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    specialties: "Reformer, Mat Pilates, Posture, Pre/Postnatal",
    certifications: "Pilates Mat I & II, Reformer Comprehensive, STOTT",
    years: 8,
    instagram: "@priya.pilates",
  },
  {
    slug: "elena-duarte",
    name: "Elena Duarte",
    title: "Vinyasa & Aerial Teacher",
    bio: "Elena came to yoga from contemporary dance and it shows: fluid sequencing, great playlists and a playful approach to arm balances and inversions.",
    photo:
      "https://images.pexels.com/photos/40037638/pexels-photo-40037638.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    specialties: "Power Yoga, Aerial, Arm balances",
    certifications: "RYT 200, Aerial Yoga Level 2",
    years: 6,
    instagram: "@elena.moves",
  },
  {
    slug: "sara-lindqvist",
    name: "Sara Lindqvist",
    title: "Yin & Meditation Guide",
    bio: "Sara teaches the slowest classes on the timetable. Long holds, breathwork and a candlelit room — the antidote to a screen-heavy week.",
    photo:
      "https://images.pexels.com/photos/6582577/pexels-photo-6582577.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    specialties: "Yin, Yoga Nidra, Breathwork, Restorative",
    certifications: "RYT 350, Yin Yoga 60h, iRest Level 1",
    years: 9,
    instagram: "@sara.stillness",
  },
  {
    slug: "tomas-rivera",
    name: "Tomás Rivera",
    title: "Reformer Pilates Coach",
    bio: "Tomás keeps reformer classes small and technical. Spring settings, tempo and control — you will feel your core the next morning.",
    photo:
      "https://images.pexels.com/photos/39963095/pexels-photo-39963095.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    specialties: "Reformer, Athletic conditioning, Mobility",
    certifications: "Reformer Comprehensive, NASM-CES",
    years: 7,
    instagram: "@tomas.reformer",
  },
];

const teacherIds = {};
for (const t of teachers) {
  const { rows } = await client.query(
    `insert into teachers (slug, name, title, bio, photo_url, specialties, certifications, years_experience, instagram)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [t.slug, t.name, t.title, t.bio, t.photo, t.specialties, t.certifications, t.years, t.instagram],
  );
  teacherIds[t.slug] = rows[0].id;
}

/* ---------------------------------- rooms --------------------------------- */
const rooms = [
  {
    slug: "skyline-studio",
    name: "Skyline Studio",
    view: "Sunrise city skyline",
    description:
      "Our largest studio, wrapped floor-to-ceiling glass on the east side. Morning classes watch the city wake up; the sprung maple floor and climate control keep it comfortable all day.",
    image:
      "https://images.pexels.com/photos/8143699/pexels-photo-8143699.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    capacity: 18,
    floor: "Level 3",
    amenities: "Sprung maple floor, Full mirrors, Climate control, Sound system, Prop wall",
  },
  {
    slug: "reformer-loft",
    name: "Reformer Loft",
    view: "Garden courtyard view",
    description:
      "Ten wooden reformers arranged in a loft overlooking the courtyard. Small classes, plenty of personal correction, and a dedicated spring-tuning station.",
    image:
      "https://images.pexels.com/photos/18499504/pexels-photo-18499504.png?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    capacity: 10,
    floor: "Level 2",
    amenities: "10 reformers, Grip socks required, Towel service, Water station",
  },
  {
    slug: "bamboo-pavilion",
    name: "Bamboo Pavilion",
    view: "Tropical greenery view",
    description:
      "A soft, quiet studio facing mature bamboo and ferns. Warm wood, diffused light and the softest mats in the studio — ideal for foundations, restore and slow flow.",
    image:
      "https://images.pexels.com/photos/25596895/pexels-photo-25596895.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    capacity: 16,
    floor: "Ground floor",
    amenities: "Natural light, Bamboo garden view, Bolsters & blankets, Aromatherapy",
  },
  {
    slug: "moon-room",
    name: "Moon Room",
    view: "Candlelit garden terrace",
    description:
      "Our meditation and yin room. Dimmable lighting, blackout blinds and a terrace of frangipani — evening classes run entirely by candlelight.",
    image:
      "https://images.pexels.com/photos/18797771/pexels-photo-18797771.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    capacity: 12,
    floor: "Level 3",
    amenities: "Candlelight, Blackout blinds, Bolsters, Eye pillows, Meditation cushions",
  },
];

const roomIds = {};
for (const r of rooms) {
  const { rows } = await client.query(
    `insert into rooms (slug, name, view_name, description, image_url, capacity, floor, amenities)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [r.slug, r.name, r.view, r.description, r.image, r.capacity, r.floor, r.amenities],
  );
  roomIds[r.slug] = rows[0].id;
}

/* ------------------------------- class types ------------------------------ */
const classTypes = [
  ["sunrise-vinyasa", "Sunrise Vinyasa", "yoga", "Intermediate", 60, "Breath-led flow to start the day", "A steady, breath-paced sequence building towards one peak pose. Expect sun salutations, standing balance and a short inversion option before you head to work.", "sage"],
  ["slow-flow-restore", "Slow Flow & Restore", "yoga", "All levels", 60, "Move gently, then rest deeply", "Thirty minutes of unhurried movement followed by supported restorative shapes with bolsters and blankets.", "sage"],
  ["hatha-foundations", "Hatha Foundations", "yoga", "Beginner", 60, "Learn the shapes, safely", "The best first class at Sattva. Classical postures broken down with props, options and lots of individual attention.", "sage"],
  ["power-yoga-45", "Power Yoga 45", "yoga", "Advanced", 45, "Forty-five minutes, fully loaded", "A strong, heat-building flow with core work, arm balance options and a short cool down. Come hydrated.", "clay"],
  ["reformer-pilates", "Reformer Pilates", "pilates", "All levels", 50, "Ten reformers, total control", "Full-body reformer work with spring-based resistance. Small class size means real coaching on tempo and alignment.", "clay"],
  ["mat-pilates-core", "Mat Pilates Core", "pilates", "Intermediate", 45, "Core, hips, posture", "Classical mat pilates with a modern core focus. Small props — bands, balls and rings — keep it interesting.", "clay"],
  ["pilates-sculpt", "Pilates Sculpt", "pilates", "Intermediate", 50, "Pilates with light weights", "Reformer and mat combined with light hand weights and higher reps for muscular endurance.", "clay"],
  ["candlelight-yin", "Candlelight Yin", "meditation", "All levels", 60, "Long holds, low light", "Five to six yin shapes held for four minutes each, in a candlelit room. The most restorative hour on the timetable.", "sage"],
  ["meditation-breathwork", "Guided Meditation & Breathwork", "meditation", "All levels", 30, "Thirty minutes to reset", "A guided breathing sequence followed by a short body-scan meditation. Chairs and cushions available.", "sage"],
];

const typeIds = {};
for (const [slug, name, category, intensity, minutes, tagline, description, accent] of classTypes) {
  const { rows } = await client.query(
    `insert into class_types (slug, name, category, intensity, duration_minutes, tagline, description, accent)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [slug, name, category, intensity, minutes, tagline, description, accent],
  );
  typeIds[slug] = rows[0].id;
}

/* ---------------------------- weekly timetable ---------------------------- */
// [classSlug, teacherSlug, roomSlug, day(1=Mon), startTime, minutes, capacity]
const slots = [
  ["sunrise-vinyasa", "maya-chen", "skyline-studio", 1, "07:00", 60, 16],
  ["reformer-pilates", "tomas-rivera", "reformer-loft", 1, "18:30", 50, 10],
  ["candlelight-yin", "sara-lindqvist", "moon-room", 1, "20:00", 60, 12],
  ["mat-pilates-core", "priya-raman", "bamboo-pavilion", 2, "07:00", 45, 14],
  ["meditation-breathwork", "sara-lindqvist", "moon-room", 2, "12:15", 30, 12],
  ["power-yoga-45", "elena-duarte", "skyline-studio", 2, "19:00", 45, 16],
  ["sunrise-vinyasa", "maya-chen", "skyline-studio", 3, "07:00", 60, 16],
  ["reformer-pilates", "tomas-rivera", "reformer-loft", 3, "18:30", 50, 10],
  ["slow-flow-restore", "elena-duarte", "bamboo-pavilion", 3, "20:00", 60, 14],
  ["hatha-foundations", "maya-chen", "bamboo-pavilion", 4, "07:00", 60, 14],
  ["pilates-sculpt", "priya-raman", "reformer-loft", 4, "18:30", 50, 10],
  ["candlelight-yin", "sara-lindqvist", "moon-room", 4, "20:00", 60, 12],
  ["power-yoga-45", "elena-duarte", "skyline-studio", 5, "07:00", 45, 16],
  ["slow-flow-restore", "maya-chen", "skyline-studio", 5, "18:00", 60, 16],
  ["reformer-pilates", "priya-raman", "reformer-loft", 6, "09:00", 50, 10],
  ["hatha-foundations", "maya-chen", "bamboo-pavilion", 6, "10:30", 60, 16],
  ["candlelight-yin", "sara-lindqvist", "moon-room", 6, "16:00", 60, 12],
  ["mat-pilates-core", "priya-raman", "reformer-loft", 7, "09:30", 45, 10],
  ["meditation-breathwork", "sara-lindqvist", "moon-room", 7, "11:00", 30, 12],
  ["slow-flow-restore", "elena-duarte", "bamboo-pavilion", 7, "17:30", 60, 14],
];

const templateIds = [];
for (const [classSlug, teacherSlug, roomSlug, day, start, minutes, capacity] of slots) {
  const { rows } = await client.query(
    `insert into class_templates (class_type_id, teacher_id, room_id, day_of_week, start_time, duration_minutes, capacity)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [typeIds[classSlug], teacherIds[teacherSlug], roomIds[roomSlug], day, start, minutes, capacity],
  );
  templateIds.push(rows[0].id);
}

/* --------------------------- materialise sessions ------------------------- */
const today = new Date();
today.setHours(12, 0, 0, 0);
const from = addDays(mondayOf(today), -7);
const to = addDays(today, 38);

const sessionRows = [];
for (let cursor = new Date(from); cursor <= to; cursor = addDays(cursor, 1)) {
  const day = dowOf(cursor);
  slots.forEach((slot, index) => {
    const [classSlug, teacherSlug, roomSlug, dow, start, minutes, capacity] = slot;
    if (dow !== day) return;
    sessionRows.push({
      templateId: templateIds[index],
      classTypeId: typeIds[classSlug],
      teacherId: teacherIds[teacherSlug],
      roomId: roomIds[roomSlug],
      sessionDate: iso(cursor),
      startTime: start,
      durationMinutes: minutes,
      capacity,
      isPast: cursor < today,
      isToday: iso(cursor) === iso(today),
      index,
    });
  });
}

const sessionIdByDate = {};
for (const s of sessionRows) {
  const { rows } = await client.query(
    `insert into class_sessions (template_id, class_type_id, teacher_id, room_id, session_date, start_time, duration_minutes, capacity, is_extra, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,false,'scheduled') returning id`,
    [s.templateId, s.classTypeId, s.teacherId, s.roomId, s.sessionDate, s.startTime, s.durationMinutes, s.capacity],
  );
  s.id = rows[0].id;
  sessionIdByDate[`${s.sessionDate}|${s.startTime}`] = s.id;
}

/* --------------------------- vouchers + payments -------------------------- */
const productRows = [
  ["Starter Five", 5, 12500, 90, "A gentle way in — five classes to find your rhythm.", "Any class style, Mat & prop hire, Cancel up to 4h before", false],
  ["Ten-Class Pass", 10, 23000, 180, "Our most popular pass. Roughly ten weeks of practice.", "Any class style, Guest pass included, Priority waitlist, Mat storage", true],
  ["Twenty-Class Pass", 20, 42000, 270, "Best value for members practising three times a week.", "Any class style, 2 guest passes, Free workshop entry, Locker rental", false],
];
const productIds = [];
for (const [name, count, price, validity, description, perks, featured] of productRows) {
  const { rows } = await client.query(
    `insert into voucher_products (name, class_count, price_cents, validity_days, description, perks, is_featured)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [name, count, price, validity, description, perks, featured],
  );
  productIds.push(rows[0].id);
}

const voucherIds = {};
for (const email of memberEmails) {
  const { rows } = await client.query(
    `insert into vouchers (code, user_id, product_id, product_name, credits_total, credits_remaining, price_cents, expires_at, status)
     values ($1,$2,$3,$4,$5,$5,$6,$7,'active') returning id`,
    [
      ref("VCH", userIds[email]),
      userIds[email],
      productIds[1],
      "Ten-Class Pass",
      20,
      23000,
      iso(addDays(today, 170)),
    ],
  );
  voucherIds[email] = rows[0].id;
  await client.query(
    `insert into payments (user_id, voucher_id, reference, amount_cents, method, status)
     values ($1,$2,$3,$4,$5,'paid')`,
    [userIds[email], rows[0].id, ref("PAY", userIds[email]), 23000, "card"],
  );
}

/* ------------------------------- bookings --------------------------------- */
const bookingCounts = {};
let counter = 0;
const usedRefs = new Set();
const uniqueRef = (prefix) => {
  let candidate = ref(prefix, ++counter);
  while (usedRefs.has(candidate)) candidate = ref(prefix, ++counter);
  usedRefs.add(candidate);
  return candidate;
};

const addBooking = (userId, session, status, email) => {
  const voucherId = voucherIds[email];
  bookingCounts[email] = (bookingCounts[email] ?? 0) + 1;
  return client.query(
    `insert into bookings (reference, user_id, session_id, voucher_id, status, credits_used, created_at, checked_in_at, cancelled_at)
     values ($1,$2,$3,$4,$5,1, now() - interval '3 days', $6, $7)`,
    [
      uniqueRef("SAT"),
      userId,
      session.id,
      voucherId,
      status,
      status === "attended" ? new Date() : null,
      status === "cancelled" ? new Date() : null,
    ],
  );
};

const past = sessionRows.filter((s) => s.isPast);
const upcoming = sessionRows.filter((s) => !s.isPast);

// History: past classes attended by the demo members.
for (let i = 0; i < past.length; i += 1) {
  const session = past[i];
  const attendees = [memberIds[i % memberIds.length], memberIds[(i + 2) % memberIds.length], memberIds[(i + 4) % memberIds.length]];
  for (const userId of attendees) {
    const email = memberEmails[memberIds.indexOf(userId)];
    const status = (i + memberIds.indexOf(userId)) % 6 === 0 ? "no_show" : "attended";
    await addBooking(userId, session, status, email);
  }
}

// Upcoming occupancy.
for (let i = 0; i < upcoming.length; i += 1) {
  const session = upcoming[i];
  const rotate = i % memberIds.length;
  const seats = 2 + ((i * 3) % 5);
  for (let seat = 0; seat < seats; seat += 1) {
    const userId = memberIds[(rotate + seat) % memberIds.length];
    if (userId === mayaId) continue; // keep the demo member's calendar light
    const email = memberEmails[memberIds.indexOf(userId)];
    await addBooking(userId, session, "confirmed", email);
  }
}

// Guarantee the demo member has several upcoming bookings.
for (const step of [1, 4, 7, 11]) {
  const session = upcoming[step];
  if (session && !sessionIdByDate[`${session.sessionDate}|maya`]) {
    await addBooking(mayaId, session, "confirmed", "maya@sattva.fit");
    sessionIdByDate[`${session.sessionDate}|maya`] = session.id;
  }
}

// Sync credit counters with bookings made (demo members keep a usable balance).
for (const email of memberEmails) {
  const used = bookingCounts[email] ?? 0;
  const remaining = Math.max(4, 20 - used);
  await client.query(`update vouchers set credits_remaining = $2 where id = $1`, [
    voucherIds[email],
    remaining,
  ]);
}

// A second active pass for the demo member so booking flows can be tested.
{
  const { rows } = await client.query(
    `insert into vouchers (code, user_id, product_id, product_name, credits_total, credits_remaining, price_cents, expires_at, status)
     values ($1,$2,$3,'Starter Five',5,5,12500,$4,'active') returning id`,
    [ref("VCH", 900), mayaId, productIds[0], iso(addDays(today, 80))],
  );
  await client.query(
    `insert into payments (user_id, voucher_id, reference, amount_cents, method, status)
     values ($1,$2,$3,12500,'online_banking','paid')`,
    [mayaId, rows[0].id, ref("PAY", 900)],
  );
}

/* --------------------- demo schedule changes + notices -------------------- */
async function notify(sessionId, type, title, body, href) {
  const { rows } = await client.query(
    `select distinct user_id from bookings where session_id = $1 and status in ('confirmed','attended')`,
    [sessionId],
  );
  for (const row of rows) {
    await client.query(
      `insert into notifications (user_id, type, title, body, session_id, action_href)
       values ($1,$2,$3,$4,$5,$6)`,
      [row.user_id, type, title, body, sessionId, href],
    );
  }
}

const changeTargets = upcoming.filter((s) => s.startTime >= "18:00").slice(0, 6);

if (changeTargets[0]) {
  const s = changeTargets[0];
  await client.query(`update class_sessions set teacher_id = $1 where id = $2`, [
    teacherIds["elena-duarte"],
    s.id,
  ]);
  await client.query(
    `insert into session_changes (session_id, change_type, label, old_value, new_value, note, actor_name)
     values ($1,'teacher','Substitute teacher',$2,$3,$4,'Studio Admin')`,
    [s.id, "Priya Raman", "Elena Duarte", "Priya is away this week — Elena is covering."],
  );
  await notify(s.id, "change", "Substitute teacher", "Before: Priya Raman. Now: Elena Duarte. Priya is away this week — Elena is covering.", "/dashboard");
}

if (changeTargets[1]) {
  const s = changeTargets[1];
  const newTime = "19:30";
  await client.query(`update class_sessions set start_time = $1 where id = $2`, [newTime, s.id]);
  await client.query(
    `insert into session_changes (session_id, change_type, label, old_value, new_value, note, actor_name)
     values ($1,'time','Time changed',$2,$3,$4,'Studio Admin')`,
    [s.id, s.startTime, newTime, "Pushed 30 minutes later for one evening only."],
  );
  await notify(s.id, "change", "Time changed", `Before: ${s.startTime}. Now: ${newTime}. Pushed 30 minutes later for one evening only.`, "/dashboard");
}

if (changeTargets[2]) {
  const s = changeTargets[2];
  await client.query(`update class_sessions set room_id = $1 where id = $2`, [roomIds["skyline-studio"], s.id]);
  await client.query(
    `insert into session_changes (session_id, change_type, label, old_value, new_value, note, actor_name)
     values ($1,'room','Room changed',$2,$3,$4,'Studio Admin')`,
    [s.id, "Bamboo Pavilion", "Skyline Studio (Sunrise city skyline)", "Head up to Level 3 — the Bamboo Pavilion floor is being refinished."],
  );
  await notify(s.id, "change", "Room changed", "Before: Bamboo Pavilion. Now: Skyline Studio (Sunrise city skyline). Head up to Level 3.", "/dashboard");
}

if (changeTargets[3]) {
  const s = changeTargets[3];
  await client.query(`update class_sessions set status = 'cancelled' where id = $1`, [s.id]);
  await client.query(
    `insert into session_changes (session_id, change_type, label, old_value, new_value, note, actor_name)
     values ($1,'cancellation','Class cancelled',$2,'Cancelled',$3,'Studio Admin')`,
    [s.id, `${s.startTime} · ${s.durationMinutes} min`, "Teacher unwell. Credits refunded automatically."],
  );
  await client.query(
    `update bookings set status = 'cancelled', cancelled_at = now() where session_id = $1 and status = 'confirmed'`,
    [s.id],
  );
  await notify(s.id, "change", "Class cancelled", "Cancelled by the studio: teacher unwell. Your credit has been returned.", "/dashboard");
}

/* ------------------------------ extra class ------------------------------- */
const extraDate = iso(addDays(today, 9));
const { rows: extraRows } = await client.query(
  `insert into class_sessions (template_id, class_type_id, teacher_id, room_id, session_date, start_time, duration_minutes, capacity, is_extra, status, note)
   values (null,$1,$2,$3,$4,'19:30',90,20,true,'scheduled','Full-moon candlelight yin with a live sound bath') returning id`,
  [typeIds["candlelight-yin"], teacherIds["sara-lindqvist"], roomIds["moon-room"], extraDate],
);
await client.query(
  `insert into session_changes (session_id, change_type, label, new_value, note, actor_name)
   values ($1,'extra','Extra class added',$2,'Full-moon candlelight yin with a live sound bath','Studio Admin')`,
  [extraRows[0].id, `${extraDate} 19:30 · 90 min`],
);
for (const userId of memberIds) {
  await client.query(
    `insert into notifications (user_id, type, title, body, session_id, action_href)
     values ($1,'change','New extra class added',$2,$3,'/timetable')`,
    [userId, `An extra class was added on ${extraDate} at 19:30 — Full-moon candlelight yin with a live sound bath.`, extraRows[0].id],
  );
}

/* --------------------------- welcome notifications ------------------------ */
await client.query(
  `insert into notifications (user_id, type, title, body, action_href)
   values ($1,'voucher','Ten-Class Pass added','Your Ten-Class Pass is active. Every class on the timetable uses one credit, and credits return when you cancel more than 4 hours ahead.','/vouchers')`,
  [mayaId],
);
await client.query(
  `insert into notifications (user_id, type, title, body, action_href)
   values ($1,'info','Studio news: new reformers in the Loft','We replaced two reformers and added grip-sock storage cubbies on Level 2.','/rooms/reformer-loft')`,
  [mayaId],
);

/* ------------------------------ write seed.sql ----------------------------- */
// Parents before children, so the inserts satisfy foreign keys.
const TABLES = [
  "users", "teachers", "rooms", "class_types", "class_templates", "class_sessions",
  "session_changes", "voucher_products", "vouchers", "payments", "bookings", "notifications",
];
const literal = (value) =>
  value === null ? "NULL" : typeof value === "string" ? `'${value.replaceAll("'", "''")}'` : String(value);

const lines = ["PRAGMA defer_foreign_keys = true;"];
for (const table of [...TABLES].reverse()) lines.push(`DELETE FROM ${table};`);
lines.push("DELETE FROM sqlite_sequence;");
const summary = {};
for (const table of TABLES) {
  const rows = sqlite.prepare(`select * from ${table}`).all();
  summary[table] = rows.length;
  for (const row of rows) {
    const columns = Object.keys(row);
    lines.push(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((c) => literal(row[c])).join(", ")});`,
    );
  }
}
writeFileSync(new URL("scripts/seed.sql", root), `${lines.join("\n")}\n`);
console.log("Seed written to scripts/seed.sql:", summary);

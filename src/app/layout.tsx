import type { Metadata } from "@/lib/next";
import type { ReactNode } from "@/lib/next";
import Link from "@/components/Link";
import { getContext } from "hono/context-storage";
import { raw } from "hono/html";
import { SiteHeader } from "@/components/SiteHeader";
import type { AppEnv } from "@/env";

export const metadata: Metadata = {
  title: "Sattva Studio · Yoga & Pilates booking",
  description:
    "Book yoga and pilates classes at Sattva Studio: weekly timetable, class vouchers, teacher profiles and studio room views.",
};

// Disables the submit button while a form posts (showing its pending label)
// and asks for confirmation on forms that declare data-confirm.
const FORM_SCRIPT = `
document.addEventListener("submit", function (event) {
  var form = event.target;
  var question = form.getAttribute("data-confirm");
  if (question && !window.confirm(question)) { event.preventDefault(); return; }
  var button = event.submitter || form.querySelector("button[type=submit]");
  if (!button) return;
  var pending = button.getAttribute("data-pending");
  setTimeout(function () {
    button.disabled = true;
    if (pending) button.textContent = pending;
  }, 0);
});
`;

export default function RootLayout({ children, title }: { children: ReactNode; title?: string }) {
  const flash = getContext<AppEnv>().var.flash;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ?? metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body className="min-h-screen bg-sand text-ink antialiased">
        <SiteHeader />
        {flash ? (
          <div className="no-print mx-auto max-w-7xl px-4 pt-4 sm:px-6">
            <p
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                flash.ok ? "bg-sage/12 text-sage" : "bg-clay/12 text-clay"
              }`}
              role="status"
            >
              {flash.message}
            </p>
          </div>
        ) : null}
        <main className="min-h-[70vh]">{children}</main>
        <footer className="no-print mt-20 border-t border-ink/10 bg-white/60">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
            <div>
              <p className="display text-xl">Sattva Studio</p>
              <p className="mt-2 text-sm text-ink-soft">
                A light-filled yoga and pilates studio in the city. Move, breathe, reset.
              </p>
            </div>
            <div className="text-sm">
              <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-soft">
                Studio
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/timetable" className="hover:text-clay">Weekly timetable</Link></li>
                <li><Link href="/classes" className="hover:text-clay">Class styles</Link></li>
                <li><Link href="/teachers" className="hover:text-clay">Our teachers</Link></li>
                <li><Link href="/rooms" className="hover:text-clay">Studio rooms &amp; views</Link></li>
              </ul>
            </div>
            <div className="text-sm">
              <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-soft">
                Members
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/vouchers" className="hover:text-clay">Class vouchers</Link></li>
                <li><Link href="/dashboard" className="hover:text-clay">My bookings</Link></li>
                <li><Link href="/notifications" className="hover:text-clay">Notifications</Link></li>
                <li><Link href="/admin" className="hover:text-clay">Studio admin</Link></li>
              </ul>
            </div>
            <div className="text-sm">
              <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-soft">
                Visit
              </p>
              <p className="text-ink-soft">
                18 Jalan Tanjung, Level 3<br />
                Open daily 6:30 – 21:30<br />
                hello@sattvastudio.fit
              </p>
            </div>
          </div>
          <div className="border-t border-ink/8 px-4 py-4 text-center text-xs text-ink-soft">
            © {new Date().getFullYear()} Sattva Studio. Class schedule subject to change; members are
            notified in-app.
          </div>
        </footer>
        <script>{raw(FORM_SCRIPT)}</script>
      </body>
    </html>
  );
}

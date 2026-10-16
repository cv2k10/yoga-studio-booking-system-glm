import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Sattva Studio · Yoga & Pilates booking",
  description:
    "Book yoga and pilates classes at Sattva Studio: weekly timetable, class vouchers, teacher profiles and studio room views.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-sand text-ink antialiased">
        <SiteHeader />
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
      </body>
    </html>
  );
}

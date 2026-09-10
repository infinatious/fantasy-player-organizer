"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SeasonWeekPicker } from "./SeasonWeekPicker";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/entry", label: "Enter Rosters" },
  { href: "/leagues", label: "Leagues" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <span className="font-semibold">🏈 Fantasy Organizer</span>
          <div className="flex gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded px-3 py-1.5 text-sm ${
                  pathname === link.href
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <SeasonWeekPicker />
      </div>
    </nav>
  );
}

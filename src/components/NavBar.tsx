"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { TenantName } from "./TenantName";
import packageJson from "../../package.json";
import { withBasePath } from "@/lib/basePath";

const LINKS = [
  { href: "/leagues", label: "Leagues" },
  { href: "/stats", label: "Stats" },
  { href: "/rooting-guide", label: "Rooting Guide" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/leagues" className="flex items-center gap-3 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withBasePath("/infinatious-sports.svg")}
              alt="Infinatious Sports"
              className="h-7 w-auto invert dark:invert-0"
            />
            <span className="h-6 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden="true" />
            <span className="font-semibold">Fantasy Organizer</span>
          </Link>
          <div className="flex gap-1">
            {LINKS.map((link) => {
              // "/" redirects straight to Leagues, so treat it as the same tab.
              const active =
                link.href === "/leagues" ? pathname === "/" || pathname.startsWith(link.href) : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded px-3 py-1.5 text-sm ${
                    active
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <TenantName />
          <span className="text-xs text-neutral-400 dark:text-neutral-500">v{packageJson.version}</span>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

import type { Metadata } from "next";
import { Special_Gothic, Special_Gothic_Condensed_One, Special_Gothic_Expanded_One, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SeasonWeekProvider } from "@/context/SeasonWeekContext";
import { NavBar } from "@/components/NavBar";
import { WeeklyReminderBanner } from "@/components/WeeklyReminderBanner";

// Galano Grotesque isn't available (it's a commercial font, not distributed
// through Google Fonts or any other free source we can pull from), so this
// family is the requested fallback: the regular cut for body text, condensed
// for player names, expanded for headings.
const specialGothic = Special_Gothic({
  variable: "--font-app-sans",
  weight: "variable",
  subsets: ["latin"],
});

const specialGothicCondensed = Special_Gothic_Condensed_One({
  variable: "--font-condensed",
  weight: "400",
  subsets: ["latin"],
});

const specialGothicExpanded = Special_Gothic_Expanded_One({
  variable: "--font-expanded",
  weight: "400",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fantasy Player Organizer",
  description: "Track your fantasy football rosters across platforms and know who to root for.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${specialGothic.variable} ${specialGothicCondensed.variable} ${specialGothicExpanded.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <SeasonWeekProvider>
          <NavBar />
          <WeeklyReminderBanner />
          <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </SeasonWeekProvider>
      </body>
    </html>
  );
}

import { redirect } from "next/navigation";

// Leagues is the home screen; the Rooting Guide moved to its own route.
export default function Home() {
  redirect("/leagues");
}

import { HomePage } from "@/components/public/home-page";

// Regenerated daily so the footer year never goes stale.
export const revalidate = 86400;

export default function Page() {
  return <HomePage currentYear={new Date().getFullYear()} />;
}

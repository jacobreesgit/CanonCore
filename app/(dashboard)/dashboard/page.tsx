/**
 * Main dashboard page displaying key metrics.
 * Protected route requiring authentication.
 */

import { SectionCards } from "@/components/section-cards";

/**
 * Renders the dashboard with metric cards section.
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards />
    </div>
  );
}

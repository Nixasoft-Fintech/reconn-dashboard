
import { CalendarDays } from "lucide-react";

export default function Header() {
  return (
    <header className="dashboard-header">
      <div>
        <h1>Dashboard</h1>
        <p>Transaction reconciliation overview</p>
      </div>

      <div className="header-date">
        <CalendarDays size={17} />
        <span>14 November 2026</span>
      </div>
    </header>
  );
}

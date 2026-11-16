
import { CalendarDays, Upload } from "lucide-react";

export default function Header({ onReconcileClick }) {
  return (
    <header className="dashboard-header">
      <div>
        <h1>Dashboard</h1>
        <p>Transaction reconciliation overview</p>
      </div>

      <div className="dashboard-header-actions">
        <button
          className="reconcile-button"
          type="button"
          onClick={onReconcileClick}
        >
          <Upload size={16} />
          Reconcile
        </button>
        <div className="header-date">
          <CalendarDays size={17} />
          <span>
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </span>
        </div>
      </div>
    </header>
  );
}

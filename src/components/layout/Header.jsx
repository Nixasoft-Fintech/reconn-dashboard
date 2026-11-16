
import { CalendarDays, Upload } from "lucide-react";

export default function Header({ onReconcileClick }) {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header-copy">
        <span className="page-kicker">FINANCE OPERATIONS</span>
        <h1>Reconciliation</h1>
        <p>Monitor transaction matching and settlement readiness.</p>
      </div>

      <div className="dashboard-header-actions">
        <button
          className="reconcile-button"
          type="button"
          onClick={onReconcileClick}
        >
          <Upload size={16} aria-hidden="true" />
          New reconciliation
        </button>
        <div className="header-date">
          <CalendarDays size={17} aria-hidden="true" />
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

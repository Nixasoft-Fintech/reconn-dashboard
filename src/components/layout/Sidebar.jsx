
import { LayoutDashboard, Menu, X } from "lucide-react";

export default function Sidebar({ isOpen, onToggle }) {
  return (
    <aside
      className={isOpen ? "sidebar sidebar-expanded" : "sidebar sidebar-collapsed"}
      id="dashboard-sidebar"
    >
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-logo">N</div>
          {isOpen && <span>NexaFin</span>}
        </div>
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={isOpen}
          aria-controls="dashboard-sidebar"
          onClick={onToggle}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <a
          href="#"
          className="nav-item active"
          aria-label={isOpen ? undefined : "Dashboard"}
          title={isOpen ? undefined : "Dashboard"}
        >
          <LayoutDashboard size={19} />
          {isOpen && <span>Dashboard</span>}
        </a>
      </nav>
    </aside>
  );
}

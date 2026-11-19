
import { Building2, History, LayoutDashboard, Menu,HandCoins, X } from "lucide-react";
import { NavLink } from "react-router-dom";

export default function Sidebar({ isOpen, onToggle }) {
  return (
    <aside
      className={isOpen ? "sidebar sidebar-expanded" : "sidebar sidebar-collapsed"}
      id="dashboard-sidebar"
    >
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">N</div>
          {isOpen && (
            <span className="brand-name">
              <strong>NexaFin</strong>
              <small>FINANCE OPERATIONS</small>
            </span>
          )}
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
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "nav-item active" : "nav-item"
          }
          aria-label={isOpen ? undefined : "Dashboard"}
          title={isOpen ? undefined : "Dashboard"}
        >
          <LayoutDashboard size={19} />
          {isOpen && <span>Dashboard</span>}
        </NavLink>
        <NavLink
          to="/companies"
          className={({ isActive }) =>
            isActive ? "nav-item active" : "nav-item"
          }
          aria-label={isOpen ? undefined : "Companies"}
          title={isOpen ? undefined : "Companies"}
        >
          <Building2 size={19} />
          {isOpen && <span>Companies</span>}
        </NavLink>

        <NavLink
          to="/settlements"
          className={({ isActive }) =>
            isActive ? "nav-item active" : "nav-item"
          }
          aria-label={isOpen ? undefined : "Settlements"}
          title={isOpen ? undefined : "Settlements"}
        >
          <HandCoins size={19} />
          {isOpen && <span>Settlements</span>}
        </NavLink>

        <NavLink
          to="/history"
          className={({ isActive }) =>
            isActive ? "nav-item active" : "nav-item"
          }
          aria-label={isOpen ? undefined : "History"}
          title={isOpen ? undefined : "History"}
        >
          <History size={19} />
          {isOpen && <span>History</span>}
        </NavLink>
      </nav>
      {isOpen && (
        <div className="sidebar-footer">
          <span className="sidebar-footer-mark" aria-hidden="true" />
          Reconciliation workspace
        </div>
      )}
    </aside>
  );
}

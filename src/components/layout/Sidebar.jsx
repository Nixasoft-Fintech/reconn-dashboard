
import {
  Building2,
  History,
  LayoutDashboard,
  Menu,
  X,
  LogIn,
  LogOut,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";
import { stopAuthInterceptor } from "../../services/reconciliationApi";
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export default function Sidebar({ isOpen, onToggle }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    // Stop interceptor before making logout request.
    stopAuthInterceptor();

    try {
      await fetch(`${apiBaseUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <aside
      className={
        isOpen
          ? "sidebar sidebar-expanded"
          : "sidebar sidebar-collapsed"
      }
      id="dashboard-sidebar"
    >
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">
            N
          </div>

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
          to="/login"
          className={({ isActive }) =>
            isActive ? "nav-item active" : "nav-item"
          }
          aria-label={isOpen ? undefined : "Login"}
          title={isOpen ? undefined : "Login"}
        >
          <LogIn size={19} />
          {isOpen && <span>Login</span>}
        </NavLink>

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

      <div className="sidebar-nav">
        <button
          type="button"
          className="nav-item"
          onClick={handleLogout}
          title={isOpen ? undefined : "Logout"}
          aria-label="Logout"
          style={{
            width: "100%",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "#dc5555",
            textAlign: "left",
          }}
        >
          <LogOut size={19} />
          {isOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

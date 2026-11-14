
import { useState } from "react";
import Sidebar from "./Sidebar";

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dashboard-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((isOpen) => !isOpen)}
      />

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

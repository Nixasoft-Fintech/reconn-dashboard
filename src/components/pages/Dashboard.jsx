
import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "../layout/DashboardLayout";
import Header from "../layout/Header";

import SummaryCard from "../dashboard/SummaryCard";
import ReconciliationCard from "../dashboard/ReconciliationCard";
import TransactionTabs from "../dashboard/TransactionTabs";
import ReconciliationUploadModal from "../dashboard/ReconciliationUploadModal";
import CompaniesPage from "./CompaniesPage";
import HistoryPage from "./HistoryPage";

import {
  summaryData,
  reconciliationData,
} from "../data/dashboardData";

export default function Dashboard() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [companies, setCompanies] = useState([
    { id: "company-ditive", name: "Ditive" },
    { id: "company-nexafin", name: "Nexafin" },
    { id: "company-axiso", name: "Axiso" },
    { id: "company-unionsoft", name: "Unionsoft" },
  ]);
  const [historyRecords, setHistoryRecords] = useState([]);

  const addCompany = (company) => {
    setCompanies((currentCompanies) => [...currentCompanies, company]);
  };

  const addHistoryRecord = (record) => {
    setHistoryRecords((currentRecords) => [record, ...currentRecords]);
  };

  return (
    <DashboardLayout>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Header onReconcileClick={() => setIsUploadModalOpen(true)} />

              <section className="summary-grid">
                {summaryData.map((item) => (
                  <SummaryCard key={item.title} item={item} />
                ))}
              </section>

              <section className="reconciliation-grid">
                {reconciliationData.map((item) => (
                  <ReconciliationCard key={item.title} item={item} />
                ))}
              </section>

              <TransactionTabs companies={companies} />
              <ReconciliationUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onSubmitted={addHistoryRecord}
              />
            </>
          }
        />
        <Route
          path="/companies"
          element={
            <CompaniesPage
              companies={companies}
              onAddCompany={addCompany}
            />
          }
        />
        <Route
          path="/history"
          element={<HistoryPage records={historyRecords} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

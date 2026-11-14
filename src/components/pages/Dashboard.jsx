
import { useEffect, useState } from "react";
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
import { getDashboardMetrics } from "../../utils/reconciliation";
import { getReconciliationSummary } from "../../services/reconciliationApi";

const ACTIVE_JOB_ID_KEY = "bank-reconciliation-active-job-id";

export default function Dashboard() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeJobId, setActiveJobId] = useState(
    () => window.localStorage.getItem(ACTIVE_JOB_ID_KEY) ?? "",
  );
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
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
    window.localStorage.setItem(ACTIVE_JOB_ID_KEY, record.jobId);
    setActiveJobId(record.jobId);
    setDashboardSummary(record.result.summary ?? record.result);
    setSummaryError("");
  };

  useEffect(() => {
    if (!activeJobId) {
      return undefined;
    }

    const controller = new AbortController();
    let isCurrentRequest = true;

    const loadSummary = async () => {
      setIsLoadingSummary(true);
      setSummaryError("");

      try {
        const response = await getReconciliationSummary(activeJobId, {
          signal: controller.signal,
        });
        if (isCurrentRequest) {
          setDashboardSummary(response.summary ?? response);
        }
      } catch (error) {
        if (
          isCurrentRequest &&
          !(error instanceof Error && error.name === "AbortError")
        ) {
          setSummaryError(
            error instanceof Error
              ? error.message
              : "Unable to load the saved reconciliation summary.",
          );
        }
      } finally {
        if (isCurrentRequest) {
          setIsLoadingSummary(false);
        }
      }
    };

    loadSummary();

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [activeJobId]);

  const metrics = dashboardSummary
    ? getDashboardMetrics(dashboardSummary)
    : activeJobId
      ? {
          summaryData: summaryData.map((item) => ({ ...item, count: 0, value: 0 })),
          reconciliationData: reconciliationData.map((item) => ({
            ...item,
            matchedCount: 0,
            matchedValue: 0,
            unmatchedCount: 0,
            unmatchedValue: 0,
          })),
        }
      : { summaryData, reconciliationData };

  return (
    <DashboardLayout>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Header onReconcileClick={() => setIsUploadModalOpen(true)} />

              {isLoadingSummary && (
                <p className="session-note" role="status">
                  Loading summary for job {activeJobId}...
                </p>
              )}
              {summaryError && (
                <p className="upload-submit-error" role="alert">
                  Could not load summary for job {activeJobId}: {summaryError}
                </p>
              )}

              <section className="summary-grid">
                {metrics.summaryData.map((item) => (
                  <SummaryCard key={item.title} item={item} />
                ))}
              </section>

              <section className="reconciliation-grid">
                {metrics.reconciliationData.map((item) => (
                  <ReconciliationCard key={item.title} item={item} />
                ))}
              </section>

              <TransactionTabs companies={companies} jobId={activeJobId} />
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

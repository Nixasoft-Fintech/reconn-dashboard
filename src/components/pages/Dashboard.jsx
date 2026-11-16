
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "../layout/DashboardLayout";
import Header from "../layout/Header";

import SummaryCard from "../dashboard/SummaryCard";
import ReconciliationCard from "../dashboard/ReconciliationCard";
import TransactionTabs from "../dashboard/TransactionTabs";
import {
  ReconciliationSkeleton,
  SummarySkeleton,
} from "../dashboard/DataSkeletons";
import ReconciliationUploadModal from "../dashboard/ReconciliationUploadModal";
import CompaniesPage from "./CompaniesPage";
import HistoryDetailsPage from "./HistoryDetailsPage";
import HistoryPage from "./HistoryPage";


import { getDashboardMetrics } from "../../utils/reconciliation";
import { getReconciliationSummary } from "../../services/reconciliationApi";

const ACTIVE_JOB_ID_KEY = "bank-reconciliation-active-job-id";
const SUMMARY_POLL_INTERVAL_MS = 10_000;

export default function Dashboard() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeJobId, setActiveJobId] = useState(
    () => window.localStorage.getItem(ACTIVE_JOB_ID_KEY) ?? "",
  );
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [loadedSummaryJobId, setLoadedSummaryJobId] = useState("");
  const [completedSummaryJobId, setCompletedSummaryJobId] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [companies, setCompanies] = useState([]);
  const isDashboardLoading =
    Boolean(activeJobId) && loadedSummaryJobId !== activeJobId;
  const isSummaryCompleted =
    Boolean(activeJobId) && completedSummaryJobId === activeJobId;
  const canLoadTransactions = isSummaryCompleted && !isDashboardLoading;

  const addCompany = (company) => {
    setCompanies((currentCompanies) => [...currentCompanies, company]);
  };

  const addHistoryRecord = (record) => {
    window.localStorage.setItem(ACTIVE_JOB_ID_KEY, record.jobId);
    setActiveJobId(record.jobId);
    const initialSummary = record.result?.summary;
    setDashboardSummary(initialSummary ?? null);
    setLoadedSummaryJobId(initialSummary ? record.jobId : "");
    setCompletedSummaryJobId(
      String(record.result?.status ?? "").trim().toUpperCase() === "COMPLETED"
        ? record.jobId
        : "",
    );
    setSummaryError("");
  };

  useEffect(() => {
    if (!activeJobId) {
      return undefined;
    }

    const controller = new AbortController();
    let isCurrentRequest = true;
    let isRequestInFlight = false;
    let isCompleted = false;
    let intervalId;

    const loadSummary = async () => {
      if (!isCurrentRequest || isRequestInFlight || isCompleted) {
        return;
      }

      isRequestInFlight = true;

      try {
        const response = await getReconciliationSummary(activeJobId, {
          signal: controller.signal,
        });
        if (isCurrentRequest) {
          setDashboardSummary(response.summary ?? response);
          setLoadedSummaryJobId(activeJobId);
          setSummaryError("");

          isCompleted =
            String(response.status ?? "").trim().toUpperCase() === "COMPLETED";
          if (isCompleted && intervalId !== undefined) {
            setCompletedSummaryJobId(activeJobId);
            window.clearInterval(intervalId);
          }
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
        isRequestInFlight = false;
      }
    };

    void loadSummary();
    intervalId = window.setInterval(() => {
      void loadSummary();
    }, SUMMARY_POLL_INTERVAL_MS);

    return () => {
      isCurrentRequest = false;
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [activeJobId]);

  const metrics = dashboardSummary
    ? getDashboardMetrics(dashboardSummary)
    : activeJobId
      ? {
          summaryData: [],
          reconciliationData: [],
        }
      : { summaryData: [], reconciliationData: [] };

  return (
    <DashboardLayout>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Header onReconcileClick={() => setIsUploadModalOpen(true)} />

              {summaryError && (
                <p className="upload-submit-error" role="alert">
                  Could not load summary for job {activeJobId}: {summaryError}
                </p>
              )}

              <section className="summary-grid" aria-busy={isDashboardLoading}>
                {isDashboardLoading ? (
                  <SummarySkeleton />
                ) : (
                  metrics.summaryData.map((item) => (
                    <SummaryCard key={item.title} item={item} />
                  ))
                )}
              </section>

              <section
                className="reconciliation-grid"
                aria-busy={isDashboardLoading}
              >
                {isDashboardLoading ? (
                  <ReconciliationSkeleton />
                ) : (
                  metrics.reconciliationData.map((item) => (
                    <ReconciliationCard key={item.title} item={item} />
                  ))
                )}
              </section>

              <TransactionTabs
                companies={companies}
                jobId={canLoadTransactions ? activeJobId : ""}
                isWaitingForSummary={Boolean(activeJobId) && !canLoadTransactions}
              />
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
          path="/history/:jobId"
          element={<HistoryDetailsPage companies={companies} />}
        />
        <Route
          path="/history"
          element={<HistoryPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

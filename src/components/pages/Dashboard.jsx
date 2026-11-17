
import { useCallback, useEffect, useRef, useState } from "react";
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
const SUMMARY_POLL_INTERVAL_MS = 30_000;

export default function Dashboard() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeJobId, setActiveJobId] = useState(
    () => window.localStorage.getItem(ACTIVE_JOB_ID_KEY) ?? "",
  );
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [loadedSummaryJobId, setLoadedSummaryJobId] = useState("");
  const [completedSummaryJobId, setCompletedSummaryJobId] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [summaryStatus, setSummaryStatus] = useState("");
  const [canRetrySummary, setCanRetrySummary] = useState(false);
  const [retryRequest, setRetryRequest] = useState(0);
  const [toast, setToast] = useState(null);
  const [companies, setCompanies] = useState([]);
  const toastId = useRef(0);
  const notifiedPendingJobId = useRef("");
  const notifiedCompletedJobId = useRef("");
  const isDashboardLoading =
    Boolean(activeJobId) && loadedSummaryJobId !== activeJobId;
  const isSummaryCompleted =
    Boolean(activeJobId) && completedSummaryJobId === activeJobId;
  const canLoadTransactions = isSummaryCompleted && !isDashboardLoading;

  const notify = useCallback((type, message) => {
    toastId.current += 1;
    setToast({ id: toastId.current, type, message });
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const addCompany = (company) => {
    setCompanies((currentCompanies) => [...currentCompanies, company]);
  };

  const addHistoryRecord = (record) => {
    window.localStorage.setItem(ACTIVE_JOB_ID_KEY, record.jobId);
    setActiveJobId(record.jobId);
    const initialSummary = record.result?.summary;
    const initialStatus = String(record.result?.status ?? "")
      .trim()
      .toUpperCase();
    setDashboardSummary(initialSummary ?? null);
    setLoadedSummaryJobId(initialSummary ? record.jobId : "");
    setSummaryStatus(initialStatus);
    setCanRetrySummary(false);
    setCompletedSummaryJobId(initialStatus === "COMPLETED" ? record.jobId : "");
    setSummaryError("");
    if (initialStatus === "COMPLETED") {
      notifiedCompletedJobId.current = record.jobId;
      notify("success", "Reconciliation completed successfully.");
    } else {
      notifiedPendingJobId.current = record.jobId;
      notify("info", "Reconciliation submitted. Status: pending.");
    }
  };

  useEffect(() => {
    if (!activeJobId) {
      return undefined;
    }

    const controller = new AbortController();
    let isCurrentRequest = true;
    let isRequestInFlight = false;
    let isCompleted = false;
    let pendingSince = null;
    let retryTimeoutId;
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

          const status = String(response.status ?? "").trim().toUpperCase();
          setSummaryStatus(status);
          isCompleted = status === "COMPLETED";
          if (isCompleted && intervalId !== undefined) {
            setCompletedSummaryJobId(activeJobId);
            setCanRetrySummary(false);
            window.clearInterval(intervalId);
            window.clearTimeout(retryTimeoutId);
            if (notifiedCompletedJobId.current !== activeJobId) {
              notifiedCompletedJobId.current = activeJobId;
              notify("success", "Reconciliation completed successfully.");
            }
          } else if (status === "PENDING") {
            if (notifiedPendingJobId.current !== activeJobId) {
              notifiedPendingJobId.current = activeJobId;
              notify("info", "Reconciliation is still pending.");
            }
            if (pendingSince === null) {
              pendingSince = Date.now();
              retryTimeoutId = window.setTimeout(() => {
                if (isCurrentRequest && !isCompleted) {
                  setCanRetrySummary(true);
                }
              }, SUMMARY_POLL_INTERVAL_MS);
            }
          } else {
            pendingSince = null;
            window.clearTimeout(retryTimeoutId);
            setCanRetrySummary(false);
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
          notify(
            "error",
            error instanceof Error
              ? `Could not load reconciliation status: ${error.message}`
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
      window.clearTimeout(retryTimeoutId);
      controller.abort();
    };
  }, [activeJobId, notify, retryRequest]);

  const retrySummary = () => {
    if (!canRetrySummary || isSummaryCompleted) {
      return;
    }

    setCanRetrySummary(false);
    notify("info", "Retrying reconciliation status...");
    setRetryRequest((currentRequest) => currentRequest + 1);
  };

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
                summaryStatus={summaryStatus}
                canRetrySummary={canRetrySummary}
                onRetrySummary={retrySummary}
                onNotify={notify}
              />
              <ReconciliationUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onSubmitted={addHistoryRecord}
                onNotify={notify}
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
      {toast && (
        <div
          className={`app-toast app-toast-${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
          aria-live={toast.type === "error" ? "assertive" : "polite"}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </DashboardLayout>
  );
}

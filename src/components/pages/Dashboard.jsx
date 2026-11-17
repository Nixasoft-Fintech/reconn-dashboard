
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

import {
  getReconciliationSummary,
  openReconciliationStatusStream,
  retryReconciliation,
} from "../../services/reconciliationApi";

const ACTIVE_JOB_ID_KEY = "bank-reconciliation-active-job-id";

const normalizeStatus = (value) =>
  String(value ?? "").trim().toUpperCase();

const getDefaultStatusMessage = (status, fallbackMessage = "") => {
  switch (normalizeStatus(status)) {
    case "PENDING":
      return "Waiting for reconciliation processing...";

    case "SAVING":
      return "Saving reconciliation records...";

    case "COMPLETED":
      return "Reconciliation completed successfully.";

    case "FAILED":
      return fallbackMessage || "Reconciliation failed.";

    default:
      return fallbackMessage || "Waiting for reconciliation processing...";
  }
};

const getFailureCode = (payload = {}) =>
  String(payload?.failure_code ?? payload?.failureCode ?? "").trim();

const isServerRestartFailure = (payload = {}) => {
  const failureCode = getFailureCode(payload).toUpperCase();

  const searchableText = `${failureCode} ${
    payload?.message ?? payload?.failure_message ?? ""
  }`.toLowerCase();

  return /(server.*restart|restart.*server|memory.*state|in-memory.*state|state.*lost|processing.*state.*lost|lost.*processing|resume.*not.*possible)/.test(
    searchableText,
  );
};

const isRetryableFailure = (payload = {}) => {
  if (normalizeStatus(payload?.status) !== "FAILED") {
    return false;
  }

  return (
    !isServerRestartFailure(payload) &&
    (payload?.retryable === true || payload?.can_retry === true)
  );
};

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
  const [jobStatusMessage, setJobStatusMessage] = useState("");

  const [statusConnectionState, setStatusConnectionState] = useState(
    () =>
      window.localStorage.getItem(ACTIVE_JOB_ID_KEY)
        ? "connecting"
        : "idle",
  );

  const [canRetrySummary, setCanRetrySummary] = useState(false);
  const [retryBlockedMessage, setRetryBlockedMessage] = useState("");
  const [isRetryingSummary, setIsRetryingSummary] = useState(false);

  const [toast, setToast] = useState(null);
  const [companies, setCompanies] = useState([]);

  // Increment this value to restart monitoring after a retry.
  const [monitoringVersion, setMonitoringVersion] = useState(0);

  const toastId = useRef(0);
  const notifiedCompletedJobId = useRef("");
  const eventSourceRef = useRef(null);

  const isDashboardLoading =
    Boolean(activeJobId) && loadedSummaryJobId !== activeJobId;

  const isSummaryCompleted =
    Boolean(activeJobId) && completedSummaryJobId === activeJobId;

  const canLoadTransactions =
    isSummaryCompleted && !isDashboardLoading;

  const notify = useCallback((type, message) => {
    toastId.current += 1;
    setToast({ id: toastId.current, type, message });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const disconnectStatusStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const addCompany = useCallback((company) => {
    setCompanies((currentCompanies) => [
      ...currentCompanies,
      company,
    ]);
  }, []);

  const addHistoryRecord = useCallback(
    (record) => {
      const jobId = record?.jobId;

      if (!jobId) {
        notify("error", "The upload response did not contain a job ID.");
        return;
      }

      window.localStorage.setItem(ACTIVE_JOB_ID_KEY, jobId);

      const initialSummary = record.result?.summary ?? null;
      const initialStatus = normalizeStatus(record.result?.status);

      const initialMessage = String(
        record.result?.message ??
          record.result?.failure_message ??
          record.result?.failureMessage ??
          "",
      ).trim();

      disconnectStatusStream();

      setActiveJobId(jobId);
      setDashboardSummary(initialSummary);
      setLoadedSummaryJobId(initialSummary ? jobId : "");
      setCompletedSummaryJobId(
        initialStatus === "COMPLETED" ? jobId : "",
      );

      setSummaryStatus(initialStatus);
      setJobStatusMessage(
        initialMessage ||
          getDefaultStatusMessage(initialStatus),
      );

      setSummaryError("");
      setCanRetrySummary(false);
      setRetryBlockedMessage("");

      setStatusConnectionState(
        initialStatus === "COMPLETED" || initialStatus === "FAILED"
          ? "closed"
          : "connecting",
      );

      setMonitoringVersion((value) => value + 1);

      if (initialStatus === "COMPLETED") {
        notifiedCompletedJobId.current = jobId;
        notify(
          "success",
          initialMessage || "Reconciliation completed successfully.",
        );
      } else {
        notify(
          "info",
          initialMessage || "Reconciliation submitted. Waiting for updates.",
        );
      }
    },
    [disconnectStatusStream, notify],
  );

  const refreshSummary = useCallback(
    async (jobId = activeJobId) => {
      if (!jobId) return null;

      const response = await getReconciliationSummary(jobId);

      // Ignore a response belonging to an older job.
      if (window.localStorage.getItem(ACTIVE_JOB_ID_KEY) !== jobId) {
        return null;
      }

      const status = normalizeStatus(response?.status);

      const message = String(
        response?.message ??
          response?.failure_message ??
          response?.failureMessage ??
          "",
      ).trim();

      setDashboardSummary(response?.summary ?? response ?? null);
      setLoadedSummaryJobId(jobId);
      setSummaryError("");
      setSummaryStatus(status);
      setJobStatusMessage(
        message || getDefaultStatusMessage(status),
      );

      if (status === "COMPLETED") {
        setCompletedSummaryJobId(jobId);
        setCanRetrySummary(false);
        setRetryBlockedMessage("");

        if (notifiedCompletedJobId.current !== jobId) {
          notifiedCompletedJobId.current = jobId;
          notify(
            "success",
            message || "Reconciliation completed successfully.",
          );
        }
      } else if (status === "FAILED") {
        setCanRetrySummary(isRetryableFailure(response));

        setRetryBlockedMessage(
          isRetryableFailure(response)
            ? ""
            : "This job cannot be resumed. Please upload the files again and start a new reconciliation.",
        );
      }

      return response;
    },
    [activeJobId, notify],
  );

  /*
   * Main monitoring effect:
   * 1. Fetch initial summary once.
   * 2. If job is still processing, open one SSE connection.
   * 3. Listen for named status events.
   * 4. Let EventSource handle network reconnection automatically.
   */
  useEffect(() => {
    if (!activeJobId) {
      disconnectStatusStream();
      setStatusConnectionState("idle");
      return undefined;
    }

    let isActive = true;
    let source = null;

    const closeStream = () => {
      if (source) {
        source.close();
        source = null;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    const handleStatusEvent = async (payload) => {
      if (!isActive) return;

      const status = normalizeStatus(payload?.status);

      const message = String(
        payload?.message ??
          payload?.failure_message ??
          payload?.failureMessage ??
          "",
      ).trim();

      // This is a status lookup problem, not a reconciliation failure.
      // Keep the last known real job status.
      if (status === "STATUS_CHECK_ERROR") {
        setStatusConnectionState("reconnecting");
        setJobStatusMessage(
          message ||
            "Unable to check status temporarily. Waiting for the next update...",
        );
        return;
      }

      if (!status) return;

      setSummaryStatus(status);
      setJobStatusMessage(
        message || getDefaultStatusMessage(status),
      );

      if (status === "COMPLETED") {
        setCanRetrySummary(false);
        setRetryBlockedMessage("");
        setStatusConnectionState("closed");

        closeStream();

        try {
          const response = await getReconciliationSummary(activeJobId);

          if (!isActive) return;

          setDashboardSummary(
            response?.summary ?? response ?? null,
          );

          setLoadedSummaryJobId(activeJobId);
          setCompletedSummaryJobId(activeJobId);
          setSummaryError("");

          const finalMessage = String(
            response?.message ?? message ?? "",
          ).trim();

          setJobStatusMessage(
            finalMessage ||
              "Reconciliation completed successfully.",
          );

          if (notifiedCompletedJobId.current !== activeJobId) {
            notifiedCompletedJobId.current = activeJobId;
            notify(
              "success",
              finalMessage || "Reconciliation completed successfully.",
            );
          }
        } catch (error) {
          if (!isActive) return;

          setSummaryError(
            error instanceof Error
              ? error.message
              : "Unable to load the final reconciliation summary.",
          );
        }

        return;
      }

      if (status === "FAILED") {
        const retryable = isRetryableFailure(payload);

        setCanRetrySummary(retryable);
        setRetryBlockedMessage(
          retryable
            ? ""
            : "This job cannot be resumed. Please upload the files again and start a new reconciliation.",
        );

        setStatusConnectionState("closed");
        closeStream();

        notify(
          "error",
          message || "Reconciliation failed.",
        );

        return;
      }

      if (status === "PENDING" || status === "SAVING") {
        setCanRetrySummary(false);
        setRetryBlockedMessage("");
        setStatusConnectionState("connected");
      }
    };

    const startMonitoring = async () => {
      setStatusConnectionState("connecting");

      try {
        const response = await getReconciliationSummary(activeJobId);

        if (!isActive) return;

        const initialStatus = normalizeStatus(response?.status);

        setDashboardSummary(
          response?.summary ?? response ?? null,
        );

        setLoadedSummaryJobId(activeJobId);
        setSummaryError("");
        setSummaryStatus(initialStatus);

        const initialMessage = String(
          response?.message ??
            response?.failure_message ??
            response?.failureMessage ??
            "",
        ).trim();

        setJobStatusMessage(
          initialMessage ||
            getDefaultStatusMessage(initialStatus),
        );

        if (initialStatus === "COMPLETED") {
          setCompletedSummaryJobId(activeJobId);
          setCanRetrySummary(false);
          setRetryBlockedMessage("");
          setStatusConnectionState("closed");

          if (notifiedCompletedJobId.current !== activeJobId) {
            notifiedCompletedJobId.current = activeJobId;
            notify(
              "success",
              initialMessage || "Reconciliation completed successfully.",
            );
          }

          return;
        }

        if (initialStatus === "FAILED") {
          const retryable = isRetryableFailure(response);

          setCanRetrySummary(retryable);
          setRetryBlockedMessage(
            retryable
              ? ""
              : "This job cannot be resumed. Please upload the files again and start a new reconciliation.",
          );

          setStatusConnectionState("closed");
          return;
        }

        setCompletedSummaryJobId("");
        setCanRetrySummary(false);
        setRetryBlockedMessage("");

        // Open exactly one EventSource connection for this job.
        source = openReconciliationStatusStream(activeJobId, {
          onOpen: () => {
            if (isActive) {
              setStatusConnectionState("connected");
            }
          },

          onMessage: (payload) => {
            void handleStatusEvent(payload);
          },

          onError: (_event, readyState) => {
            if (!isActive) return;

            // Do not create another EventSource here.
            // Native EventSource automatically retries.
            setStatusConnectionState(
              readyState === EventSource.CLOSED
                ? "disconnected"
                : "reconnecting",
            );
          },

          onProtocolError: (error) => {
            if (!isActive) return;

            console.error("Invalid SSE event:", error);
            setStatusConnectionState("protocol-error");
          },
        });

        eventSourceRef.current = source;
      } catch (error) {
        if (!isActive) return;

        setSummaryError(
          error instanceof Error
            ? error.message
            : "Unable to load the reconciliation summary.",
        );

        setStatusConnectionState("disconnected");

        notify(
          "error",
          error instanceof Error
            ? `Could not load reconciliation status: ${error.message}`
            : "Unable to load the reconciliation summary.",
        );
      }
    };

    void startMonitoring();

    return () => {
      isActive = false;
      closeStream();
    };
  }, [
    activeJobId,
    monitoringVersion,
    disconnectStatusStream,
    notify,
  ]);

  const retrySummary = useCallback(async () => {
    if (
      !activeJobId ||
      !canRetrySummary ||
      isSummaryCompleted ||
      isRetryingSummary
    ) {
      return;
    }

    setIsRetryingSummary(true);
    setCanRetrySummary(false);
    setRetryBlockedMessage("");

    notify("info", "Retrying reconciliation...");

    try {
      const response = await retryReconciliation(activeJobId);

      const nextStatus = normalizeStatus(response?.status);

      const message = String(
        response?.message ??
          response?.failure_message ??
          response?.failureMessage ??
          "",
      ).trim();

      setSummaryStatus(nextStatus || "PENDING");
      setJobStatusMessage(
        message ||
          getDefaultStatusMessage(nextStatus || "PENDING"),
      );

      if (nextStatus === "FAILED") {
        const retryable = isRetryableFailure(response);

        setCanRetrySummary(retryable);
        setRetryBlockedMessage(
          retryable
            ? ""
            : "This job cannot be resumed. Please upload the files again and start a new reconciliation.",
        );

        setStatusConnectionState("closed");

        notify(
          "error",
          message || "The reconciliation retry failed.",
        );

        return;
      }

      if (nextStatus === "COMPLETED") {
        const refreshed = await getReconciliationSummary(activeJobId);

        setDashboardSummary(
          refreshed?.summary ?? refreshed ?? null,
        );

        setLoadedSummaryJobId(activeJobId);
        setCompletedSummaryJobId(activeJobId);
        setSummaryStatus("COMPLETED");
        setCanRetrySummary(false);
        setRetryBlockedMessage("");
        setStatusConnectionState("closed");

        notify(
          "success",
          message || "Reconciliation completed successfully.",
        );

        return;
      }

      // Restart the monitoring effect after successful retry.
      disconnectStatusStream();
      setStatusConnectionState("connecting");
      setMonitoringVersion((value) => value + 1);

      notify(
        "info",
        message || "Retry initiated. Waiting for live status updates.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to retry reconciliation.";

      setCanRetrySummary(true);
      setSummaryError(message);

      notify("error", `Could not retry reconciliation: ${message}`);
    } finally {
      setIsRetryingSummary(false);
    }
  }, [
    activeJobId,
    canRetrySummary,
    isSummaryCompleted,
    isRetryingSummary,
    notify,
    disconnectStatusStream,
  ]);

  const metrics = dashboardSummary
    ? getDashboardMetrics(dashboardSummary)
    : {
        summaryData: [],
        reconciliationData: [],
      };

  return (
    <DashboardLayout>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Header
                onReconcileClick={() => setIsUploadModalOpen(true)}
              />

              {summaryError && (
                <p className="upload-submit-error" role="alert">
                  Could not load summary for job {activeJobId}:{" "}
                  {summaryError}
                </p>
              )}

              <section
                className="summary-grid"
                aria-busy={isDashboardLoading}
              >
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
                    <ReconciliationCard
                      key={item.title}
                      item={item}
                    />
                  ))
                )}
              </section>

              <TransactionTabs
                companies={companies}
                jobId={canLoadTransactions ? activeJobId : ""}
                isWaitingForSummary={
                  Boolean(activeJobId) && !canLoadTransactions
                }
                summaryStatus={summaryStatus}
                jobStatusMessage={jobStatusMessage}
                statusConnectionState={statusConnectionState}
                canRetrySummary={canRetrySummary}
                retryBlockedMessage={retryBlockedMessage}
                isRetryingSummary={isRetryingSummary}
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

        <Route path="/history" element={<HistoryPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {toast && (
        <div
          className={`app-toast app-toast-${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
          aria-live={
            toast.type === "error" ? "assertive" : "polite"
          }
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

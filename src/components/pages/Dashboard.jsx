import { useCallback, useEffect, useRef, useState } from "react";
import Header from "../layout/Header";
import SummaryCard from "../dashboard/SummaryCard";
import ReconciliationCard from "../dashboard/ReconciliationCard";
import TransactionTabs from "../dashboard/TransactionTabs";
import {
  ReconciliationSkeleton,
  SummarySkeleton,
} from "../dashboard/DataSkeletons";
import ReconciliationUploadModal from "../dashboard/ReconciliationUploadModal";
import "./SettlementPage.css";
import { getDashboardMetrics } from "../../utils/reconciliation";
import {
  getCompanies,
  getReconciliationSummary,
  openReconciliationStatusStream,
  retryReconciliation,
} from "../../services/reconciliationApi";

// -----------------------------------------------------------------------------
// Configuration and status helpers
// -----------------------------------------------------------------------------
const ACTIVE_JOB_ID_KEY = "bank-reconciliation-active-job-id";
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED"]);
const MAX_RECONNECT_ATTEMPTS = 8;
const BASE_RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;

const normalizeStatus = (value) =>
  String(value ?? "").trim().toUpperCase();

const getFailureCode = (payload = {}) =>
  String(
    payload?.failure_code ??
    payload?.failureCode ??
    payload?.failure_code_value ??
    "",
  ).trim();

const isServerRestartFailure = (payload = {}) => {
  const failureCode = getFailureCode(payload).toUpperCase();
  const searchableText = `${failureCode} ${payload?.message ??
    payload?.failure_message ??
    payload?.failureMessage ??
    ""
    }`.toLowerCase();
  return /(server.*restart|restart.*server|memory.*state|in-memory.*state|state.*lost|processing.*state.*lost|lost.*processing|resume.*not.*possible)/.test(
    searchableText,
  );
};
const isRetryableFailure = (payload = {}) => {
  if (normalizeStatus(payload?.status) !== "FAILED") return false;
  if (isServerRestartFailure(payload)) return false;
  return payload?.retryable === true || payload?.can_retry === true;
};
const getFailureGuidance = (payload = {}) => {
  if (isServerRestartFailure(payload)) {
    return "The processing state was lost after a server restart. Please upload the files again and start a new reconciliation.";
  }

  return "The backend has not marked this job as retryable. Please check the failure details; you may need to upload the files again and start a new reconciliation.";
};
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

const getResponseMessage = (payload = {}) =>
  String(
    payload?.message ??
    payload?.failure_message ??
    payload?.failureMessage ??
    "",
  ).trim();

// -----------------------------------------------------------------------------
// Dashboard component
// -----------------------------------------------------------------------------

export default function Dashboard() {
  // UI state: modal, summary data, job status, connection state, and notifications.
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
  const [statusConnectionState, setStatusConnectionState] = useState(() =>
    window.localStorage.getItem(ACTIVE_JOB_ID_KEY)
      ? "connecting"
      : "idle",
  );
  const [canRetrySummary, setCanRetrySummary] = useState(false);
  const [retryBlockedMessage, setRetryBlockedMessage] = useState("");
  const [isRetryingSummary, setIsRetryingSummary] = useState(false);
  const [toast, setToast] = useState(null);
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    let isCurrent = true;

    const loadCompanies = async () => {
      try {
        const response = await getCompanies({
          page: 1,
          limit: 100,
        });

        if (!isCurrent) return;

        console.log("COMPANIES API RESPONSE:", response);

        const items = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response)
            ? response
            : [];

        console.log("COMPANIES LIST:", items);

        setCompanies(items);
      } catch (error) {
        console.error("Failed to load companies:", error);
      }
    };

    loadCompanies();

    return () => {
      isCurrent = false;
    };
  }, []);
  // Refs keep values available to async callbacks without re-creating handlers.
  const toastId = useRef(0);
  const notifiedCompletedJobId = useRef(
  window.localStorage.getItem(ACTIVE_JOB_ID_KEY) ?? "",
);
  const eventSourceRef = useRef(null);
  const activeJobIdRef = useRef(activeJobId);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const connectStatusStreamRef = useRef(null);
  const initialSummaryRequestRef = useRef({
    jobId: "",
    promise: null,
  });
  const finalSummaryRequestRef = useRef({
    jobId: "",
    promise: null,
  });
  const retryInProgressRef = useRef(false);
  // Derived UI flags. Transactions are shown only after the job is completed.
  const isDashboardLoading =
    Boolean(activeJobId) && loadedSummaryJobId !== activeJobId;
  const isSummaryCompleted =
    Boolean(activeJobId) && completedSummaryJobId === activeJobId;
  const canLoadTransactions =
    isSummaryCompleted && !isDashboardLoading;

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------
  const notify = useCallback((type, message) => {
    toastId.current += 1;
    setToast({
      id: toastId.current,
      type,
      message,
    });
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(
      () => setToast(null),
      5000,
    );
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  // ---------------------------------------------------------------------------
  // SSE connection lifecycle
  // ---------------------------------------------------------------------------
  // Stop scheduled reconnects and close the active EventSource.

  // Called when a job changes, reaches a terminal status, or the component unmounts.
  const disconnectStatusStream = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.source.close();
      eventSourceRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
  }, []);

  // ---------------------------------------------------------------------------
  // New reconciliation job setup
  // ---------------------------------------------------------------------------
  const addCompany = useCallback((company) => {
    setCompanies((currentCompanies) => [
      ...currentCompanies,
      company,
    ]);
  }, []);
  const addHistoryRecord = useCallback(
    (record) => {
      const jobId = record?.jobId ?? record?.job_id;
      if (!jobId) {
        notify(
          "error",
          "The reconciliation response did not include a job ID.",
        );
        return;
      }
      disconnectStatusStream();
      window.localStorage.setItem(ACTIVE_JOB_ID_KEY, jobId);
      activeJobIdRef.current = jobId;
      setActiveJobId(jobId);
      const initialSummary =
        record?.result?.summary ?? record?.summary ?? null;
      const initialStatus = normalizeStatus(
        record?.result?.status ?? record?.status,
      );
      const initialMessage = getResponseMessage(
        record?.result ?? record,
      );
      setDashboardSummary(initialSummary);
      setLoadedSummaryJobId(initialSummary ? jobId : "");
      setSummaryStatus(initialStatus);
      setJobStatusMessage(
        initialMessage ||
        getDefaultStatusMessage(initialStatus),
      );
      setStatusConnectionState(
        TERMINAL_STATUSES.has(initialStatus)
          ? "closed"
          : "connecting",
      );
      setCanRetrySummary(false);
      setRetryBlockedMessage("");
      setCompletedSummaryJobId(
        initialStatus === "COMPLETED" ? jobId : "",
      );
      setSummaryError("");
      notifiedCompletedJobId.current = "";
      initialSummaryRequestRef.current = {
        jobId: "",
        promise: null,
      };
      finalSummaryRequestRef.current = {
        jobId: "",
        promise: null,
      };
      notify(
        initialStatus === "COMPLETED" ? "success" : "info",
        initialMessage ||
        (initialStatus === "COMPLETED"
          ? "Reconciliation completed successfully."
          : "Reconciliation submitted. Waiting for processing."),
      );
    },
    [disconnectStatusStream, notify],
  );

  // ---------------------------------------------------------------------------
  // Summary API: fetch the initial or final summary for a job.

  // Requests are de-duplicated per job and request type.

  // ---------------------------------------------------------------------------
  const loadSummary = useCallback(
    async (jobId, { requestType = "normal" } = {}) => {
      if (!jobId) return null;
      const requestRef =
        requestType === "final"
          ? finalSummaryRequestRef
          : initialSummaryRequestRef;
      if (
        requestRef.current.jobId === jobId &&
        requestRef.current.promise
      ) {
        return requestRef.current.promise;
      }
      const requestPromise = getReconciliationSummary();
      requestRef.current = {
        promise: requestPromise,
      };
      try {
        const response = await requestPromise;
        if (activeJobIdRef.current !== jobId) {
          return response;
        }
        const status = normalizeStatus(response?.status);
        const message =
          getResponseMessage(response) ||
          getDefaultStatusMessage(status);
        const summary = response?.summary ?? response ?? null;
        setDashboardSummary(summary);
        setLoadedSummaryJobId(jobId);
        setSummaryError("");
        setSummaryStatus(status);
        setJobStatusMessage(message);
        if (status === "COMPLETED") {
          disconnectStatusStream();
          setCompletedSummaryJobId(jobId);
          setCanRetrySummary(false);
          setRetryBlockedMessage("");
          setStatusConnectionState("closed");
          if (notifiedCompletedJobId.current !== jobId) {
            notifiedCompletedJobId.current = jobId;
            notify("success", message);
          }
        } else if (status === "FAILED") {
          disconnectStatusStream();
          setCompletedSummaryJobId("");
          const retryable = isRetryableFailure(response);
          setCanRetrySummary(retryable);
          setRetryBlockedMessage(
            retryable ? "" : getFailureGuidance(response),
          );
          setStatusConnectionState("closed");
          notify("error", message || "Reconciliation failed.");
        } else {
          setCompletedSummaryJobId("");
          setCanRetrySummary(false);
          setRetryBlockedMessage("");
        }
        return response;
      } catch (error) {
        if (activeJobIdRef.current === jobId) {
          setSummaryError(
            error instanceof Error
              ? error.message
              : "Unable to load the reconciliation summary.",
          );
          setStatusConnectionState("disconnected");
        }
        throw error;
      } finally {
        if (requestRef.current.jobId === jobId) {
          requestRef.current = {
            jobId: "",
            promise: null,
          };
        }
      }
    },
    [disconnectStatusStream, notify],
  );

  const refreshSummary = useCallback(async () => {
    const jobId = activeJobIdRef.current;

    if (!jobId) return;

    try {
      initialSummaryRequestRef.current = { jobId: "", promise: null };
      finalSummaryRequestRef.current = { jobId: "", promise: null };
      await loadSummary(jobId);
    } catch (error) {
      console.error("Failed to refresh summary:", error);

      notify(
        "error",
        "Settlement successful, but summary refresh failed."
      );
    }
  }, [loadSummary, notify]);

  // ---------------------------------------------------------------------------
  // SSE event handler: update status and react to COMPLETED / FAILED.
  // ---------------------------------------------------------------------------
  const handleStatusEvent = useCallback(
    async (jobId, payload) => {
      if (activeJobIdRef.current !== jobId) return;
      const status = normalizeStatus(payload?.status);
      if (!status) return;
      const message =
        getResponseMessage(payload) ||
        getDefaultStatusMessage(status);
      setSummaryStatus(status);
      setJobStatusMessage(message);
      if (status === "COMPLETED") {
        disconnectStatusStream();
        setCanRetrySummary(false);
        setRetryBlockedMessage("");
        setStatusConnectionState("closed");
        setCompletedSummaryJobId("");
        try {
          await loadSummary(jobId, {
            requestType: "final",
          });
        } catch (error) {
          notify(
            "error",
            error instanceof Error
              ? `Reconciliation completed, but the final summary could not be loaded: ${error.message}`
              : "Reconciliation completed, but the final summary could not be loaded.",
          );
        }
        return;
      }
      if (status === "FAILED") {
        disconnectStatusStream();
        const retryable = isRetryableFailure(payload);
        setCanRetrySummary(retryable);
        setRetryBlockedMessage(
          retryable ? "" : getFailureGuidance(payload),
        );
        setStatusConnectionState("closed");
        setCompletedSummaryJobId("");
        notify("error", message || "Reconciliation failed.");
        return;
      }
      setCanRetrySummary(false);
      setRetryBlockedMessage("");
    },
    [disconnectStatusStream, loadSummary, notify],
  );
  // Schedule a new EventSource only after the browser has permanently closed
  // the previous stream. CONNECTING is handled by native EventSource retry.
  const scheduleReconnect = useCallback((jobId) => {
    if (!jobId || activeJobIdRef.current !== jobId) return;
    if (reconnectTimerRef.current !== null) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setStatusConnectionState("disconnected");
      console.error(
        "SSE reconnect limit reached. Check the backend endpoint and response status.",
      );
      return;
    }
    const attempt = reconnectAttemptsRef.current + 1;
    reconnectAttemptsRef.current = attempt;
    const delay = Math.min(
      BASE_RECONNECT_DELAY * 2 ** (attempt - 1),
      MAX_RECONNECT_DELAY,
    );
    console.warn(
      `SSE reconnect attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`,
    );
    setStatusConnectionState("reconnecting");
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      if (activeJobIdRef.current !== jobId) return;
      connectStatusStreamRef.current?.(jobId);
    }, delay);
  }, []);
  // Create one EventSource for the active job. Native EventSource handles
  // transient reconnects; the manual scheduler is only a CLOSED-state fallback.
  const connectStatusStream = useCallback(
    (jobId) => {
      if (!jobId || activeJobIdRef.current !== jobId) {
        return;
      }
      const existing = eventSourceRef.current;
      if (
        existing?.jobId === jobId &&
        existing.source.readyState !== EventSource.CLOSED
      ) {
        return;
      }
      // Remove a previous CLOSED source before creating a new one.
      if (eventSourceRef.current) {
        eventSourceRef.current.source.close();
        eventSourceRef.current = null;
      }
      setStatusConnectionState("connecting");
      let source;
      try {
        source = openReconciliationStatusStream(jobId, {
          onOpen: () => {
            if (activeJobIdRef.current !== jobId) return;
            // Reset attempts after a successful connection.
            reconnectAttemptsRef.current = 0;
            setStatusConnectionState("connected");
          },
          onMessage: (payload) => {
            void handleStatusEvent(jobId, payload);
          },
          onError: (event, readyState) => {
            if (activeJobIdRef.current !== jobId) return;
            console.warn(
              "Reconciliation SSE connection error",
              {
                jobId,
                readyState,
                event,
              },
            );
            if (readyState === EventSource.CONNECTING) {
              // Native EventSource will retry automatically.
              setStatusConnectionState("reconnecting");
              return;
            }
            if (readyState === EventSource.CLOSED) {
              // Native retry has stopped. Create a new EventSource.
              if (eventSourceRef.current?.source === source) {
                eventSourceRef.current = null;
              }
              setStatusConnectionState("disconnected");
              scheduleReconnect(jobId);
            }
          },
          onProtocolError: (error) => {
            if (activeJobIdRef.current === jobId) {
              setStatusConnectionState("protocol-error");
            }
            console.error("Invalid SSE event:", error);
          },
        });
        eventSourceRef.current = {
          jobId,
          source,
        };
      } catch (error) {
        console.error("Could not create SSE connection:", error);
        setStatusConnectionState("disconnected");
        scheduleReconnect(jobId);
      }
    },
    [handleStatusEvent, scheduleReconnect],
  );

  // ---------------------------------------------------------------------------
  // Keep refs synchronized with the latest active job and connection function.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    connectStatusStreamRef.current = connectStatusStream;
    return () => {
      connectStatusStreamRef.current = null;
    };
  }, [connectStatusStream]);
  // Keep the active-job ref synchronized for async callbacks.
  useEffect(() => {
    activeJobIdRef.current = activeJobId;
  }, [activeJobId]);

  // ---------------------------------------------------------------------------
  // Monitoring flow:

  // 1. Fetch summary.
  // 2. If the job is non-terminal, connect to SSE.
  // 3. If summary fetch fails, still try SSE to receive status updates.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!activeJobId) {
      disconnectStatusStream();
      return undefined;
    }
    let cancelled = false;
    const startMonitoring = async () => {
      try {
        const response = await loadSummary(activeJobId);
        if (
          cancelled ||
          activeJobIdRef.current !== activeJobId
        ) {
          return;
        }
        const status = normalizeStatus(response?.status);
        if (!TERMINAL_STATUSES.has(status)) {
          connectStatusStream(activeJobId);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Initial summary request failed:", error);
        notify(
          "error",
          error instanceof Error
            ? `Could not load summary: ${error.message}`
            : "Could not load reconciliation summary.",
        );
        // Summary API failed, but try connecting to SSE anyway.
        if (
          activeJobIdRef.current === activeJobId
        ) {
          connectStatusStream(activeJobId);
        }
      }
    };
    void startMonitoring();
    return () => {
      cancelled = true;
      if (eventSourceRef.current?.jobId === activeJobId) {
        disconnectStatusStream();
      }
    };
  }, [
    activeJobId,
    connectStatusStream,
    disconnectStatusStream,
    loadSummary,
    notify,
  ]);

  // ---------------------------------------------------------------------------
  // Retry flow: only backend-confirmed retryable FAILED jobs can be retried.
  // ---------------------------------------------------------------------------
  const retrySummary = useCallback(async () => {
    const jobId = activeJobIdRef.current;
    if (
      !canRetrySummary ||
      !jobId ||
      isSummaryCompleted ||
      retryInProgressRef.current
    ) {
      return;
    }
    retryInProgressRef.current = true;
    setIsRetryingSummary(true);
    setCanRetrySummary(false);
    setRetryBlockedMessage("");
    notify("info", "Retrying reconciliation...");
    try {
      disconnectStatusStream();
      const response = await retryReconciliation(jobId);
      if (activeJobIdRef.current !== jobId) return;
      const status = normalizeStatus(response?.status);
      const message =
        getResponseMessage(response) ||
        getDefaultStatusMessage(status);
      setSummaryStatus(status || "PENDING");
      setJobStatusMessage(message);
      if (status === "COMPLETED") {
        disconnectStatusStream();
        await loadSummary(jobId, {
          requestType: "final",
        });
        return;
      }
      if (status === "FAILED") {
        const retryable = isRetryableFailure(response);
        setCanRetrySummary(retryable);
        setRetryBlockedMessage(
          retryable ? "" : getFailureGuidance(response),
        );
        setStatusConnectionState("closed");
        notify(
          "error",
          message || "The reconciliation retry failed.",
        );
        return;
      }
      setCanRetrySummary(false);
      setRetryBlockedMessage("");
      setStatusConnectionState("connecting");
      connectStatusStream(jobId);
      notify(
        "info",
        message || "Reconciliation retry initiated.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to retry reconciliation.";
      setSummaryError(message);
      notify(
        "error",
        `Could not retry reconciliation: ${message}`,
      );
    } finally {
      retryInProgressRef.current = false;
      setIsRetryingSummary(false);
    }
  }, [
    canRetrySummary,
    connectStatusStream,
    disconnectStatusStream,
    isSummaryCompleted,
    loadSummary,
    notify,
  ]);

  // ---------------------------------------------------------------------------
  // Dashboard rendering
  // ---------------------------------------------------------------------------
const metrics = dashboardSummary
    ? getDashboardMetrics(dashboardSummary)
    : {
        summaryData: [],
        reconciliationData: [],
      };
  return (
    <>
      <Header onReconcileClick={() => setIsUploadModalOpen(true)} />
      {summaryError && (
        <p className="upload-submit-error" role="alert">
          Could not load summary for job {activeJobId}:{" "}
          {summaryError}
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
      <section className="reconciliation-grid" aria-busy={isDashboardLoading}>
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
        isWaitingForSummary={
          Boolean(activeJobId) && !canLoadTransactions
        }
        onSummaryRefresh={refreshSummary}
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
    </>
  );
}

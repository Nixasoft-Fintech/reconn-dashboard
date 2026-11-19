import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import TransactionTabs from "../dashboard/TransactionTabs";
import { getReconciliationHistoryDetails } from "../../services/reconciliationApi";
import HistoryFiles from "./HistoryFiles";

function formatValue(value) {
  const number = Number(value);
  return value == null || !Number.isFinite(number)
    ? "—"
    : number.toLocaleString("en-IN");
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatDuration(value) {
  const duration = Number(value);
  return value == null || !Number.isFinite(duration)
    ? "—"
    : `${formatValue(duration)} sec`;
}

function getStatusClass(status) {
  return String(status ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
}

function SourceSummary({ title, summary = {} }) {
  const metrics = [
    ["Total records", summary.total_records],
    ["Matched", summary.matched_records],
    ["Unmatched", summary.not_found_records],
    ["Other", summary.other_records],
  ];

  return (
    <article className="history-detail-card">
      <h2>{title}</h2>
      <dl className="history-detail-metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{formatValue(value)}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export default function HistoryDetailsPage({ companies = [] }) {
  const { jobId } = useParams();
  const [record, setRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId) {
      return undefined;
    }

    const controller = new AbortController();
    let isCurrentRequest = true;

    const loadDetails = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await getReconciliationHistoryDetails(jobId, {
          signal: controller.signal,
        });
        if (response.job_id !== jobId) {
          throw new Error(
            "The history API returned details for a different or invalid job.",
          );
        }
        if (isCurrentRequest) {
          setRecord(response);
        }
      } catch (requestError) {
        if (
          isCurrentRequest &&
          !(requestError instanceof Error && requestError.name === "AbortError")
        ) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load reconciliation job details.",
          );
        }
      } finally {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      }
    };

    loadDetails();

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [jobId]);

  const currentRecord = record?.job_id === jobId ? record : null;

  return (
    <section
      className="utility-page history-detail-page"
      aria-labelledby="history-detail-title"
    >
      <header className="utility-page-header history-detail-header">
        <div>
          <Link className="history-back-link" to="/history">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to history
          </Link>
          <span className="page-kicker">RECONCILIATION HISTORY</span>
          <h1 id="history-detail-title">Job details</h1>
          <p className="history-detail-job-id">Job {jobId}</p>
        </div>
        {currentRecord?.status && (
          <span
            className={`history-status history-status-${getStatusClass(currentRecord.status)}`}
          >
            {currentRecord.status}
          </span>
        )}
      </header>

      <div className="history-detail-data" aria-busy={isLoading}>
        {isLoading && (
          <p className="session-note" role="status">
            Loading reconciliation details...
          </p>
        )}
        {error && (
          <p className="upload-submit-error" role="alert">
            Could not load job details: {error}
          </p>
        )}

        {currentRecord && (
          <>
            <section className="history-detail-card history-job-overview">
              <h2>Job information</h2>
              <dl className="history-detail-fields">
                <div>
                  <dt>Job ID</dt>
                  <dd>{currentRecord.job_id}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(currentRecord.created_at)}</dd>
                </div>
                <div>
                  <dt>Completed</dt>
                  <dd>{formatDateTime(currentRecord.completed_at)}</dd>
                </div>
                <div>
                  <dt>Processing duration</dt>
                  <dd>{formatDuration(currentRecord.processing_duration_seconds)}</dd>
                </div>
              </dl>
            </section>

            <section
              className="history-detail-card history-detail-files"
              aria-labelledby="history-files-title"
            >
              <h2 id="history-files-title">Uploaded files</h2>
              <HistoryFiles record={currentRecord} />
            </section>

            <section
              className="history-detail-section"
              aria-labelledby="history-summary-title"
            >
              <h2 id="history-summary-title">Transaction summary</h2>
              <div className="history-detail-summary-grid">
                <SourceSummary
                  title="Fund request"
                  summary={currentRecord.fund_request}
                />
                <SourceSummary
                  title="VA transaction"
                  summary={currentRecord.va_transaction}
                />
                <SourceSummary
                  title="Bank transaction"
                  summary={currentRecord.bank_transaction}
                />
              </div>
            </section>
          </>
        )}
      </div>

      <section
        className="history-detail-transactions"
        aria-label={`Transaction records for job ${jobId}`}
      >
        <TransactionTabs
          key={jobId}
          companies={companies}
          jobId={jobId}
        />
      </section>
    </section>
  );
}

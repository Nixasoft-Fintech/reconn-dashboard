import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { getReconciliationHistory } from "../../services/reconciliationApi";
import { getUploadedFiles } from "./uploadedFiles";

const PAGE_SIZE = 100;

function formatNumber(value) {
  const number = Number(value);
  return value == null || !Number.isFinite(number)
    ? "—"
    : number.toLocaleString("en-IN");
}

function formatDuration(value) {
  const duration = Number(value);
  return value == null || !Number.isFinite(duration)
    ? "—"
    : `${formatNumber(duration)} sec`;
}

function getStatusClass(status) {
  return String(status ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
}

function DateTimeValue({ value }) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return <time dateTime={date.toISOString()}>{date.toLocaleString()}</time>;
}

function FileTableCell({ files, jobId }) {
  if (files.length === 0) {
    return <span className="history-table-empty-value">No file</span>;
  }

  return (
    <ul
      className="history-table-files"
      tabIndex={0}
      aria-label={`Uploaded files for job ${jobId}`}
    >
      {files.map((file, index) => (
        <li
          className="history-table-file"
          key={`${file.bankName ?? ""}-${file.name}-${index}`}
        >
          <span className="history-table-file-name">{file.name}</span>
          {file.format && (
            <p className="history-table-file-meta">
              <strong>Format:</strong> {file.format}
            </p>
          )}
          {file.accountHolder && (
            <p className="history-table-file-meta">
              <strong>Account name:</strong> {file.accountHolder}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function HistoryTableRow({ record, rowNumber }) {
  const files = getUploadedFiles(record);

  return (
    <tr>
      <td className="history-table-row-number">{rowNumber}</td>
      <th className="history-table-job-id" scope="row">
        {record.job_id}
      </th>
      <td>
        <span
          className={`history-status history-status-${getStatusClass(record.status)}`}
        >
          {record.status ?? "Unknown"}
        </span>
      </td>
      <td>
        <DateTimeValue value={record.created_at} />
      </td>
      <td>{formatDuration(record.processing_duration_seconds)}</td>
      <td>
        <FileTableCell files={files} jobId={record.job_id} />
      </td>
      <td>
        <Link
          className="history-view-button"
          to={`/history/${encodeURIComponent(record.job_id)}`}
          aria-label={`View details for reconciliation job ${record.job_id}`}
        >
          <Eye size={16} aria-hidden="true" />
          Details
        </Link>
      </td>
    </tr>
  );
}

function HistoryTable({ items, loading = false, startIndex = 0 }) {
  return (
    <div
      className="history-table-scroll"
      role="region"
      aria-label="Reconciliation history table"
      tabIndex={0}
    >
      <table className="history-table" aria-busy={loading}>
        <caption className="visually-hidden">
          Reconciliation jobs and their uploaded files
        </caption>
        <thead>
          <tr>
            <th scope="col">No.</th>
            <th scope="col">Job ID</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
            <th scope="col">Duration</th>
            <th scope="col">Uploaded files</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }, (_, index) => (
                <tr className="history-table-skeleton-row" key={index}>
                {Array.from({ length: 7 }, (_, cellIndex) => (
                    <td key={cellIndex}>
                      <span className="history-skeleton-line" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((record, index) => (
                <HistoryTableRow
                  key={record.job_id}
                  record={record}
                  rowNumber={startIndex + index + 1}
                />
              ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HistoryPage() {
  const [history, setHistory] = useState({
    items: [],
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    const loadHistory = async () => {
      setIsLoading(true);
      setError("");
      setHistory({
        items: [],
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      });

      try {
        const response = await getReconciliationHistory({
          page: currentPage,
          limit: PAGE_SIZE,
          signal: controller.signal,
        });
        if (!Array.isArray(response.items)) {
          throw new Error("The history API returned an invalid item list.");
        }
        if (
          response.items.some(
            (item) => !item || typeof item.job_id !== "string" || !item.job_id,
          )
        ) {
          throw new Error("The history API returned an item without a job ID.");
        }

        const total = Number(response.total ?? response.items.length);
        const totalPages = Number(
          response.total_pages ?? Math.ceil(total / PAGE_SIZE),
        );
        if (
          !Number.isFinite(total) ||
          total < 0 ||
          !Number.isFinite(totalPages) ||
          totalPages < 0
        ) {
          throw new Error("The history API returned invalid pagination details.");
        }

        if (isCurrentRequest) {
          setHistory({
            items: response.items,
            total,
            totalPages,
            hasNext: response.has_next === true || currentPage < totalPages,
            hasPrevious:
              response.has_previous === true || currentPage > 1,
          });
        }
      } catch (requestError) {
        if (
          isCurrentRequest &&
          !(requestError instanceof Error && requestError.name === "AbortError")
        ) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load reconciliation history.",
          );
        }
      } finally {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [currentPage]);

  const firstItem = history.total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(currentPage * PAGE_SIZE, history.total);

  return (
    <section className="utility-page" aria-labelledby="history-page-title">
      <header className="utility-page-header history-page-header">
        <div>
          <span className="page-kicker">RECONCILIATION RECORDS</span>
          <h1 id="history-page-title">History</h1>
          <p>One row per job with its uploaded files.</p>
        </div>
      </header>

      <div
        className="utility-page-card history-page-card"
        aria-busy={isLoading}
      >
        {isLoading && (
          <>
            <p className="visually-hidden" role="status">
              Loading reconciliation history.
            </p>
            <HistoryTable items={[]} loading />
          </>
        )}
        {error && (
          <p className="upload-submit-error" role="alert">
            Could not load reconciliation history: {error}
          </p>
        )}
        {!isLoading && !error && history.items.length === 0 && (
          <p className="history-page-message" role="status">
            No reconciliation jobs found.
          </p>
        )}
        {!isLoading && !error && history.items.length > 0 && (
          <HistoryTable
            items={history.items}
            startIndex={(currentPage - 1) * PAGE_SIZE}
          />
        )}

        {!isLoading && !error && history.total > 0 && (
          <nav className="history-pagination" aria-label="History pagination">
            <p aria-live="polite" aria-atomic="true">
              Showing {firstItem}–{lastItem} of {formatNumber(history.total)} jobs
            </p>
            <div className="history-pagination-controls">
              <button
                type="button"
                aria-label="Go to previous history page"
                disabled={!history.hasPrevious}
                onClick={() =>
                  setCurrentPage((page) => Math.max(1, page - 1))
                }
              >
                Previous
              </button>
              <span>
                Page <span aria-current="page">{currentPage}</span> of{" "}
                {Math.max(history.totalPages, 1)}
              </span>
              <button
                type="button"
                aria-label="Go to next history page"
                disabled={!history.hasNext}
                onClick={() =>
                  setCurrentPage((page) => Math.min(history.totalPages, page + 1))
                }
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </div>
    </section>
  );
}

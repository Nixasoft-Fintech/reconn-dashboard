import { useState } from "react";
import { Download, Eye, X } from "lucide-react";
import { getReconciliationCounts } from "../../utils/reconciliation";

const PAGE_SIZE = 5;

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getReportSummary(record) {
  const { sourceCount, matchedCount } = getReconciliationCounts(
    record.result.summary,
  );

  return `${sourceCount} source rows · ${matchedCount} matched · ${Math.max(
    0,
    sourceCount - matchedCount,
  )} not matched`;
}

function HistoryPreview({ record, onClose }) {
  const results = record.result.results ?? [];
  const visibleResults = results.slice(0, 20);

  return (
    <div className="upload-modal-backdrop">
      <section
        className="upload-modal history-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-preview-title"
      >
        <header className="upload-modal-header">
          <div>
            <span className="upload-modal-eyebrow">RECONCILIATION REPORT</span>
            <h2 id="history-preview-title">Job {record.jobId}</h2>
            <p>{getReportSummary(record)}</p>
          </div>
          <button
            className="upload-modal-close"
            type="button"
            aria-label="Close report preview"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <div className="upload-modal-content">
          <h3 className="history-preview-heading">Transaction results</h3>
          <div className="table-wrapper">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Transaction ID</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Final Status</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.length === 0 ? (
                  <tr>
                    <td className="empty-state" colSpan={6}>
                      No transaction results are available.
                    </td>
                  </tr>
                ) : (
                  visibleResults.map((item, index) => (
                    <tr
                      key={`${item.source_type}-${item.source_transaction_id}-${index}`}
                    >
                      <td>{item.source_type ?? "—"}</td>
                      <td>{item.source_transaction_id ?? "—"}</td>
                      <td>{item.source_reference ?? "—"}</td>
                      <td>{item.source_amount ?? "—"}</td>
                      <td>{item.final_status ?? "—"}</td>
                      <td>{item.exception_reason ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {results.length > visibleResults.length && (
            <p className="history-preview-note">
              Showing the first {visibleResults.length} of {results.length}{" "}
              transactions.
            </p>
          )}
        </div>

        <footer className="upload-modal-footer history-preview-footer">
          <p>
            Submitted{" "}
            {new Date(record.submittedAt).toLocaleString()}
          </p>
          <button
            className="upload-modal-done"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function HistoryPage({ records }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const firstRecordIndex = (currentPage - 1) * PAGE_SIZE;
  const pageRecords = records.slice(
    firstRecordIndex,
    firstRecordIndex + PAGE_SIZE,
  );

  return (
    <section className="utility-page">
      <header className="utility-page-header">
        <h1>History</h1>
        <p>Review reconciliation jobs, uploaded files, and reports.</p>
      </header>

      <div className="utility-page-card">
        {records.length === 0 ? (
          <p className="history-empty-state">
            No reconciliation jobs yet. Submitted jobs will appear here for
            this browser session.
          </p>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="transaction-table history-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Uploaded Files</th>
                    <th>Short Report</th>
                    <th>Report</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRecords.map((record) => (
                    <tr key={record.jobId}>
                      <td>
                        <strong className="history-job-id">
                          {record.jobId}
                        </strong>
                        <span className="history-date">
                          {new Date(record.submittedAt).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <strong>{record.files.length} files</strong>
                        <ul className="history-file-list">
                          {record.files.map(({ type, file }, index) => (
                            <li
                              className="history-file-item"
                              key={`${record.jobId}-${file.name}-${index}`}
                            >
                              <span className="history-file-name">
                                <span>{type}</span>
                                {file.name}
                              </span>
                              <button
                                className="history-download-button"
                                type="button"
                                onClick={() => downloadFile(file)}
                              >
                                <Download size={14} />
                                Download
                              </button>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>{getReportSummary(record)}</td>
                      <td>
                        <button
                          className="history-view-button"
                          type="button"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <Eye size={15} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="history-pagination">
              <span>
                Showing {firstRecordIndex + 1}–
                {Math.min(firstRecordIndex + PAGE_SIZE, records.length)} of{" "}
                {records.length} jobs
              </span>
              <div>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  type="button"
                  disabled={currentPage === pageCount}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(pageCount, page + 1))
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
        <p className="session-note">
          Job history and uploaded files are kept only for this browser
          session; the backend does not persist them yet.
        </p>
      </div>

      {selectedRecord && (
        <HistoryPreview
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </section>
  );
}

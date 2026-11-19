
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  settlements,
  reverseSettlement,
} from "../../services/settlementsApi";
import "./SettlementPage.css";

const TABS = [
  { id: "ALL", label: "All Settlements" },
  { id: "SETTLED", label: "Settled" },
  { id: "REVERSED", label: "Reversed" },
  { id: "AUTOMATIC", label: "Automatic" },
  { id: "MANUAL", label: "Manual" },
];

const getStatus = (item) => (item.status || "").toUpperCase();

const getMatchType = (item) =>
  (item.match_type || "").toUpperCase();

const formatDate = (date) => {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getTransactionName = (transaction) => {
  if (!transaction) return "—";

  return `${transaction.transaction_type || "Unknown"} / ${transaction.record_key || "—"
    }`;
};

export default function SettlementsPage() {
  const [settlementData, setSettlementData] = useState([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [reverseTarget, setReverseTarget] = useState(null);
  const [reversing, setReversing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const PAGE_LIMIT = 100;

  const fetchSettlements = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await settlements({
          page: currentPage,
          limit: PAGE_LIMIT,
        });

        const items = Array.isArray(response.items)
          ? response.items
          : [];

        setSettlementData(items);
        setTotalRecords(response.total || 0);
        setTotalPages(response.total_pages || 1);
      } catch (err) {
        setError(err.message || "Failed to load settlements.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentPage]
  );

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  // Tab-wise settlement filtering
  const tabFilteredData = useMemo(() => {
    switch (activeTab) {
      case "SETTLED":
        return settlementData.filter(
          (item) => getStatus(item) === "ACTIVE"
        );

      case "REVERSED":
        return settlementData.filter(
          (item) => getStatus(item) === "REVERSED"
        );

      case "AUTOMATIC":
        return settlementData.filter(
          (item) => getMatchType(item) === "AUTOMATIC"
        );

      case "MANUAL":
        return settlementData.filter(
          (item) => getMatchType(item) === "MANUAL"
        );

      default:
        return settlementData;
    }
  }, [settlementData, activeTab]);

  // Search within the selected tab
  const filteredData = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return tabFilteredData;

    return tabFilteredData.filter((item) => {
      const searchableValues = [
        item.settlement_id,
        item.job_id,
        item.status,
        item.match_type,
        item.company?.name,
        item.company?.company_id,
        item.primary?.transaction_type,
        item.primary?.record_key,
        item.counterpart?.transaction_type,
        item.counterpart?.record_key,
        item.settlement_remarks,
        item.remarks,
        item.settled_by,
        item.reversal_reason,
      ];

      return searchableValues.some((value) =>
        String(value || "").toLowerCase().includes(search)
      );
    });
  }, [tabFilteredData, searchTerm]);

  const tabCounts = useMemo(() => {
    return {
      ALL: settlementData.length,
      SETTLED: settlementData.filter(
        (item) => getStatus(item) === "ACTIVE"
      ).length,
      REVERSED: settlementData.filter(
        (item) => getStatus(item) === "REVERSED"
      ).length,
      AUTOMATIC: settlementData.filter(
        (item) => getMatchType(item) === "AUTOMATIC"
      ).length,
      MANUAL: settlementData.filter(
        (item) => getMatchType(item) === "MANUAL"
      ).length,
    };
  }, [settlementData]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchTerm("");
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;

    setCurrentPage(page);
  };

  const handleReverseSettlement = async () => {
    if (!reverseTarget?.settlement_id) return;

    try {
      setReversing(true);

      await reverseSettlement(reverseTarget.settlement_id);

      setReverseTarget(null);
      setSelectedSettlement(null);
      setSuccessMessage("Settlement reversed successfully.");

      await fetchSettlements(true);
    } catch (err) {
      setError(err.message || "Failed to reverse settlement.");
    } finally {
      setReversing(false);
    }
  };

  const getStatusLabel = (status) => {
    if (status === "ACTIVE") return "Settled";
    if (status === "REVERSED") return "Reversed";

    return status || "Unknown";
  };

  const getStatusClass = (status) => {
    if (status === "ACTIVE") return "success";
    if (status === "REVERSED") return "danger";

    return "default";
  };

  return (
    <div className="settlements-page">
      {/* Header */}
      <div className="settlements-header">
        <div>
          <div className="settlements-breadcrumb">
            Reconciliation / Settlements
          </div>

          <h1>Settlements</h1>

          <p>
            View and manage all manual and automatic settlements.
          </p>
        </div>

        <button
          className="settlements-refresh-btn"
          onClick={() => fetchSettlements(true)}
          disabled={refreshing || loading}
        >
          <span>{refreshing ? "↻" : "⟳"}</span>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="settlements-stats">
        <div className="settlement-stat-card">
          <div className="settlement-stat-label">
            Total Settlements
          </div>
          <div className="settlement-stat-value">
            {totalRecords}
          </div>
          <div className="settlement-stat-description">
            All settlement records
          </div>
        </div>

        <div className="settlement-stat-card">
          <div className="settlement-stat-label">
            Settled
          </div>
          <div className="settlement-stat-value">
            {tabCounts.SETTLED}
          </div>
          <div className="settlement-stat-description">
            Active settlements on this page
          </div>
        </div>

        <div className="settlement-stat-card">
          <div className="settlement-stat-label">
            Reversed
          </div>
          <div className="settlement-stat-value">
            {tabCounts.REVERSED}
          </div>
          <div className="settlement-stat-description">
            Reversed settlements on this page
          </div>
        </div>

        <div className="settlement-stat-card">
          <div className="settlement-stat-label">
            Manual
          </div>
          <div className="settlement-stat-value">
            {tabCounts.MANUAL}
          </div>
          <div className="settlement-stat-description">
            Manual settlements on this page
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="settlements-content-card">
        {/* Tabs */}
        <div className="settlements-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`settlements-tab ${activeTab === tab.id ? "active" : ""
                }`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}

              <span className="settlements-tab-count">
                {tabCounts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="settlements-toolbar">
          <div className="settlements-search">
            <span className="settlements-search-icon">⌕</span>

            <input
              type="text"
              placeholder="Search settlement ID, company, transaction..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {searchTerm && (
              <button
                className="settlements-search-clear"
                onClick={() => setSearchTerm("")}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="settlements-result-count">
            Showing {filteredData.length} records
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="settlements-error">
            <span>{error}</span>

            <button onClick={() => fetchSettlements(true)}>
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="settlements-loading">
            <div className="settlements-loader"></div>
            <p>Loading settlements...</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="settlements-table-wrapper">
              <table className="settlements-table">
                <thead>
                  <tr>
                    <th>Row No.</th>
                    <th>Settlement ID</th>
                    <th>Company</th>
                    <th>Primary Transaction</th>
                    <th>Counterpart</th>
                    <th>Match Type</th>
                    <th>Status</th>
                    <th>Settled At</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredData.length > 0 ? (
                    filteredData.map((item, index) => (
                      <tr key={item.settlement_id}>
                        {/* Row Number */}
                        <td>
                          <span className="settlement-row-number">
                            {(currentPage - 1) * PAGE_LIMIT + index + 1}
                          </span>
                        </td>

                        {/* Settlement ID */}
                        <td>
                          <span className="settlement-id">
                            {item.settlement_id || "—"}
                          </span>
                        </td>

                        {/* Company */}
                        <td>
                          <div className="settlement-company">
                            {item.company?.name || "—"}
                          </div>
                        </td>

                        {/* Primary Transaction */}
                        <td>
                          <div className="settlement-transaction">
                            <strong>
                              {item.primary?.transaction_type || "—"}
                            </strong>
                            <span>
                              {item.primary?.record_key || "—"}
                            </span>
                          </div>
                        </td>

                        {/* Counterpart */}
                        <td>
                          <div className="settlement-transaction">
                            <strong>
                              {item.counterpart?.transaction_type || "—"}
                            </strong>
                            <span>
                              {item.counterpart?.record_key || "—"}
                            </span>
                          </div>
                        </td>

                        {/* Match Type */}
                        <td>
                          <span
                            className={`settlement-type-badge ${getMatchType(item) === "MANUAL"
                                ? "manual"
                                : "automatic"
                              }`}
                          >
                            {item.match_type || "—"}
                          </span>
                        </td>

                        {/* Status */}
                        <td>
                          <span
                            className={`settlement-status-badge ${getStatusClass(
                              getStatus(item)
                            )}`}
                          >
                            {getStatusLabel(getStatus(item))}
                          </span>
                        </td>

                        {/* Settled At */}
                        <td>
                          <span className="settlement-date">
                            {formatDate(item.settled_at)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="settlement-actions">
                            <button
                              className="settlement-view-btn"
                              onClick={() => setSelectedSettlement(item)}
                            >
                              View
                            </button>

                            {getStatus(item) === "ACTIVE" && (
                              <button
                                className="settlement-reverse-btn"
                                onClick={() => setReverseTarget(item)}
                              >
                                Reverse
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9">
                        <div className="settlements-empty">
                          <div className="settlements-empty-icon">
                            ◇
                          </div>

                          <h3>No settlements found</h3>

                          <p>
                            {searchTerm
                              ? "Try another search term."
                              : `No records available in ${TABS.find((tab) => tab.id === activeTab)?.label
                              }.`}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="settlements-pagination">
              <div className="settlements-pagination-info">
                Page {currentPage} of {totalPages}
              </div>

              <div className="settlements-pagination-actions">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  Previous
                </button>
                  
                <span>{currentPage}</span>

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Details Modal */}
      {selectedSettlement && (
        <div
          className="settlement-modal-overlay"
          onClick={() => setSelectedSettlement(null)}
        >
          <div
            className="settlement-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settlement-modal-header">
              <div>
                <h2>Settlement Details</h2>
                <p>Complete settlement information</p>
              </div>

              <button
                onClick={() => setSelectedSettlement(null)}
                className="settlement-modal-close"
              >
                ×
              </button>
            </div>

            <div className="settlement-modal-body">
              <div className="settlement-detail-grid">
                <div className="settlement-detail-item">
                  <label>Settlement ID</label>
                  <strong>
                    {selectedSettlement.settlement_id}
                  </strong>
                </div>

                <div className="settlement-detail-item">
                  <label>Company</label>
                  <strong>
                    {selectedSettlement.company?.name || "—"}
                  </strong>
                </div>

                <div className="settlement-detail-item">
                  <label>Status</label>
                  <strong>
                    {getStatusLabel(
                      getStatus(selectedSettlement)
                    )}
                  </strong>
                </div>

                <div className="settlement-detail-item">
                  <label>Match Type</label>
                  <strong>
                    {selectedSettlement.match_type || "—"}
                  </strong>
                </div>

                <div className="settlement-detail-item">
                  <label>Settled At</label>
                  <strong>
                    {formatDate(selectedSettlement.settled_at)}
                  </strong>
                </div>

                <div className="settlement-detail-item">
                  <label>Settled By</label>
                  <strong>
                    {selectedSettlement.settled_by || "—"}
                  </strong>
                </div>
              </div>

              <div className="settlement-detail-section">
                <h3>Primary Transaction</h3>

                <div className="settlement-mapping-card">
                  <p>
                    <strong>Type:</strong>{" "}
                    {selectedSettlement.primary?.transaction_type || "—"}
                  </p>
                  <p>
                    <strong>Record Key:</strong>{" "}
                    {selectedSettlement.primary?.record_key || "—"}
                  </p>
                </div>
              </div>

              <div className="settlement-detail-section">
                <h3>Counterpart Transaction</h3>

                <div className="settlement-mapping-card">
                  <p>
                    <strong>Type:</strong>{" "}
                    {selectedSettlement.counterpart?.transaction_type || "—"}
                  </p>
                  <p>
                    <strong>Record Key:</strong>{" "}
                    {selectedSettlement.counterpart?.record_key || "—"}
                  </p>
                </div>
              </div>

              <div className="settlement-detail-section">
                <h3>Target Records</h3>

                {selectedSettlement.targets?.length > 0 ? (
                  selectedSettlement.targets.map((target, index) => (
                    <div
                      className="settlement-mapping-card"
                      key={`${target.record_id}-${index}`}
                    >
                      <p>
                        <strong>Role:</strong> {target.role || "—"}
                      </p>
                      <p>
                        <strong>Transaction Type:</strong>{" "}
                        {target.transaction_type || "—"}
                      </p>
                      <p>
                        <strong>Record ID:</strong>{" "}
                        {target.record_id || "—"}
                      </p>
                      <p>
                        <strong>Record Key:</strong>{" "}
                        {target.record_key || "—"}
                      </p>
                      <p>
                        <strong>Original Status:</strong>{" "}
                        {target.original_status || "—"}
                      </p>
                      <p>
                        <strong>Current Status:</strong>{" "}
                        {target.current_status || "—"}
                      </p>
                      <p>
                        <strong>Active:</strong>{" "}
                        {target.active ? "Yes" : "No"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>No target records available.</p>
                )}
              </div>

              <div className="settlement-detail-section">
                <h3>Additional Information</h3>

                <div className="settlement-mapping-card">
                  <p>
                    <strong>Settlement Remarks:</strong>{" "}
                    {selectedSettlement.settlement_remarks || "—"}
                  </p>
                  <p>
                    <strong>Remarks:</strong>{" "}
                    {selectedSettlement.remarks || "—"}
                  </p>
                  <p>
                    <strong>Reversal Reason:</strong>{" "}
                    {selectedSettlement.reversal_reason || "—"}
                  </p>
                  <p>
                    <strong>Reversed At:</strong>{" "}
                    {formatDate(selectedSettlement.reversed_at)}
                  </p>
                  <p>
                    <strong>Reversed By:</strong>{" "}
                    {selectedSettlement.reversed_by || "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="settlement-modal-footer">
              <button
                className="settlement-modal-secondary-btn"
                onClick={() => setSelectedSettlement(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Confirmation Modal */}
      {reverseTarget && (
        <div
          className="settlement-modal-overlay"
          onClick={() => !reversing && setReverseTarget(null)}
        >
          <div
            className="settlement-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settlement-confirm-icon">!</div>

            <h2>Reverse Settlement?</h2>

            <p>
              Are you sure you want to reverse this settlement?
              This action will update the linked transaction records.
            </p>

            <div className="settlement-confirm-id">
              {reverseTarget.settlement_id}
            </div>

            <div className="settlement-confirm-actions">
              <button
                className="settlement-modal-secondary-btn"
                disabled={reversing}
                onClick={() => setReverseTarget(null)}
              >
                Cancel
              </button>

              <button
                className="settlement-confirm-reverse-btn"
                disabled={reversing}
                onClick={handleReverseSettlement}
              >
                {reversing ? "Reversing..." : "Yes, Reverse"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {successMessage && (
        <div
          className="settlement-modal-overlay"
          onClick={() => setSuccessMessage("")}
        >
          <div
            className="settlement-success-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settlement-success-icon">✓</div>

            <h2>Success</h2>
            <p>{successMessage}</p>

            <button
              onClick={() => setSuccessMessage("")}
              className="settlement-success-btn"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import TransactionTable from "../tables/TransactionTable";
import {
  getBankTransactions,
  getFundRequests,
  getVaTransactions,
} from "../../services/reconciliationApi";

function formatCurrency(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(amount)
    : "—";
}

function mapTransaction(item, requestedStatus) {
  const extractedReference = Array.isArray(item.bank_extracted_references)
    ? item.bank_extracted_references[0]
    : "";
  const finalStatus = String(item.final_status ?? requestedStatus).toUpperCase();

  return {
    txnId:
      item.source_transaction_id ??
      (item.bank_row_number != null
        ? `BANK-${item.bank_row_number}`
        : undefined),
    rowNumber: item.source_row_number,
    refNum: item.source_reference_number ?? item.source_reference,
    fundReqAmount: item.source_amount,
    user: item.source_user,
    requestDate:
      item.source_data?.["Date Time"] ?? item.source_date ?? "",
    requestStatus: item.source_status,
    sourceBank: item.source_bank,
    paymentMode: item.source_payment_mode,
    virtualAccountNumber: item.source_virtual_account_number,
    accountRow: item.bank_row_number,
    accountBank: item.bank_name,
    accountUtr: item.bank_utr ?? extractedReference,
    accountRefNumber: item.bank_reference ?? extractedReference,
    accountAmount: item.bank_amount,
    accountUser: item.bank_user ?? item.bank_account_holder,
    accountDate: item.bank_date ?? item.bank_value_date,
    accountNarration:
      item.bank_narration ?? item.bank_data?.Particulars ?? "",
    referenceStatus: item.reference_status,
    amountStatus: item.amount_status,
    userStatus: item.user_status,
    dateStatus: item.date_status,
    finalStatus: item.final_status,
    status: finalStatus === "MATCHED" ? "Matched" : "Unmatched",
    remark:
      item.exception_reason ??
      item.source_data?.Remark ??
      item.source_data?.Description ??
      "",
    settleWith: "",
  };
}

export default function TransactionTabs({ companies, jobId }) {
  const [selectedSource, setSelectedSource] = useState("Fund Request");
  const [selectedStatus, setSelectedStatus] = useState("Matched");
  const [settlementTargets, setSettlementTargets] = useState({});
  const [transactionPage, setTransactionPage] = useState({
    items: [],
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [pageSelection, setPageSelection] = useState({
    jobId: "",
    source: "",
    status: "",
    page: 1,
  });
  const [pageSize, setPageSize] = useState(25);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactionsError, setTransactionsError] = useState("");
  const [settlementPreview, setSettlementPreview] = useState(null);
  const currentPage =
    pageSelection.jobId === jobId &&
    pageSelection.source === selectedSource &&
    pageSelection.status === selectedStatus
      ? pageSelection.page
      : 1;
  const isLiveSource =
    selectedSource === "Fund Request" ||
    selectedSource === "VA Transfer" ||
    selectedSource === "Account Statement";

  useEffect(() => {
    if (!jobId || !isLiveSource) {
      return undefined;
    }

    const controller = new AbortController();
    let isCurrentRequest = true;

    const loadTransactions = async () => {
      setTransactionPage({
        items: [],
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      });
      setIsLoadingTransactions(true);
      setTransactionsError("");

      try {
        const status = selectedStatus === "Matched" ? "MATCHED" : "NOT_FOUND";
        const getTransactions =
          selectedSource === "Fund Request"
            ? getFundRequests
            : selectedSource === "VA Transfer"
              ? getVaTransactions
              : getBankTransactions;
        const response = await getTransactions(jobId, {
          status,
          page: currentPage,
          limit: pageSize,
          signal: controller.signal,
        });
        if (!Array.isArray(response.items)) {
          throw new Error(
            "The transactions API returned an invalid item list.",
          );
        }

        const total = Number(response.total ?? response.items.length);
        const totalPages = Number(
          response.total_pages ?? Math.ceil(total / pageSize),
        );
        if (!Number.isFinite(total) || !Number.isFinite(totalPages)) {
          throw new Error(
            "The transactions API returned invalid pagination details.",
          );
        }

        if (isCurrentRequest) {
          setTransactionPage({
            items: response.items.map((item) => mapTransaction(item, status)),
            total,
            totalPages,
            hasNext:
              response.has_next === true || currentPage < totalPages,
            hasPrevious:
              response.has_previous === true || currentPage > 1,
          });
        }
      } catch (error) {
        if (
          isCurrentRequest &&
          !(error instanceof Error && error.name === "AbortError")
        ) {
          setTransactionsError(
            error instanceof Error
              ? error.message
              : "Unable to load reconciliation transactions.",
          );
        }
      } finally {
        if (isCurrentRequest) {
          setIsLoadingTransactions(false);
        }
      }
    };

    loadTransactions();

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [
    currentPage,
    isLiveSource,
    jobId,
    pageSize,
    selectedSource,
    selectedStatus,
  ]);

  const transactions = isLiveSource && jobId ? transactionPage.items : [];

  const selectTab = (source, status) => {
    setSelectedSource(source);
    setSelectedStatus(status);
    setPageSelection({ jobId, source, status, page: 1 });
  };

  const handleSettlementChange = (transactionId, company) => {
    setSettlementTargets((currentTargets) => ({
      ...currentTargets,
      [transactionId]: company,
    }));
  };

  const handleSettle = (transaction) => {
    const transactionId = transaction.txnId ?? transaction.id;
    const company =
      settlementTargets[transactionId] ?? transaction.settleWith ?? "";
    if (!company) {
      return;
    }

    setSettlementPreview({
      transactionId: transactionId ?? "—",
      reference:
        transaction.refNum ??
        transaction.accountUtr ??
        transaction.accountRefNumber ??
        "—",
      amount:
        transaction.fundReqAmount ??
        transaction.accountAmount ??
        transaction.amount,
      company,
    });
  };

  const exportCSV = () => {
    const header = [
      "Transaction ID",
      "Row Number",
      "Reference Number",
      "Source Amount",
      "Source User",
      "Source Date",
      "Source Status",
      "Source Bank",
      "Payment Mode",
      "Virtual Account Number",
      "ACSMT Row",
      "ACSMT Bank",
      "ACSMT UTR",
      "ACSMT Reference Number",
      "ACSMT Amount",
      "ACSMT User",
      "ACSMT Date",
      "ACSMT Narration",
      "Reference Status",
      "Amount Status",
      "User Status",
      "Date Status",
      "Final Status",
      "Remark",
      "Settle With",
    ];

    const rows = transactions.map((item) => [
      item.txnId ?? item.id ?? "",
      item.rowNumber ?? "",
      item.refNum ?? "",
      item.fundReqAmount ?? item.amount ?? "",
      item.user ?? "",
      item.requestDate ?? item.date ?? "",
      item.requestStatus ?? "",
      item.sourceBank ?? "",
      item.paymentMode ?? "",
      item.virtualAccountNumber ?? "",
      item.accountRow ?? "",
      item.accountBank ?? "",
      item.accountUtr ?? "",
      item.accountRefNumber ?? "",
      item.accountAmount ?? "",
      item.accountUser ?? "",
      item.accountDate ?? "",
      item.accountNarration ?? "",
      item.referenceStatus ?? "",
      item.amountStatus ?? "",
      item.userStatus ?? "",
      item.dateStatus ?? "",
      item.finalStatus ?? item.status ?? "",
      item.remark ?? "",
      settlementTargets[item.txnId ?? item.id] ?? item.settleWith ?? "",
    ]);

    const escapeCSVCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCSVCell).join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    const fileName = [selectedSource, selectedStatus]
      .join("-")
      .toLowerCase()
      .replaceAll(" ", "-");
    link.download = `${fileName}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <section className="transactions-card">
      <div className="section-heading table-title">
        <div>
          <h3>Transaction Records</h3>
          <p>View source-wise transaction details</p>
        </div>

        <button className="export-btn" onClick={exportCSV}>
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="transaction-tabs">
        <button
          className={selectedSource === "Fund Request" && selectedStatus === "Matched" ? "tab active" : "tab"}
          onClick={() => selectTab("Fund Request", "Matched")}
        >
          Fund Request Matched
        </button>
        <button
          className={selectedSource === "Fund Request" && selectedStatus === "Unmatched" ? "tab active" : "tab"}
          onClick={() => selectTab("Fund Request", "Unmatched")}
        >
          Fund Request Unmatched
        </button>
      
        <button
          className={selectedSource === "VA Transfer" && selectedStatus === "Matched" ? "tab active" : "tab"}
          onClick={() => selectTab("VA Transfer", "Matched")}
        >
          VA Transfer Matched
        </button>
        <button
          className={selectedSource === "VA Transfer" && selectedStatus === "Unmatched" ? "tab active" : "tab"}
          onClick={() => selectTab("VA Transfer", "Unmatched")}
        >
          VA Transfer Unmatched
        </button>
      
        <button
          className={selectedSource === "Account Statement" && selectedStatus === "Matched" ? "tab active" : "tab"}
          onClick={() => selectTab("Account Statement", "Matched")}
        >
          Account Statement Matched
        </button>
        <button
          className={selectedSource === "Account Statement" && selectedStatus === "Unmatched" ? "tab active" : "tab"}
          onClick={() => selectTab("Account Statement", "Unmatched")}
        >
          Account Statement Unmatched
        </button>
      </div>

      <div className="transaction-table-meta">
        <span>
          {isLiveSource && isLoadingTransactions
            ? "Loading transactions..."
            : isLiveSource
            ? transactionPage.total === 0
              ? "0 transactions"
              : `${(currentPage - 1) * pageSize + 1}–${Math.min(
                  currentPage * pageSize,
                  transactionPage.total,
                )} of ${transactionPage.total} transactions`
            : `${transactions.length} ${
                transactions.length === 1 ? "transaction" : "transactions"
              }`}
        </span>
        <span>Scroll horizontally to view all fields</span>
      </div>

      {isLiveSource && isLoadingTransactions && (
        <p className="session-note" role="status">
          Loading transactions...
        </p>
      )}
      {isLiveSource && !jobId && (
        <p className="session-note">
          Run a reconciliation to view transactions.
        </p>
      )}
      {isLiveSource && transactionsError && (
        <p className="upload-submit-error" role="alert">
          Could not load transactions: {transactionsError}
        </p>
      )}

      <TransactionTable
        transactions={transactions}
        companies={companies}
        settlementTargets={settlementTargets}
        onSettlementChange={handleSettlementChange}
        onSettle={handleSettle}
      />
      {isLiveSource && jobId && (
        <div className="transaction-pagination">
          <label>
            Rows per page
            <select
              value={pageSize}
              disabled={isLoadingTransactions}
              onChange={(event) => {
                const nextPageSize = Number(event.target.value);
                setPageSize(nextPageSize);
                setPageSelection({
                  jobId,
                  source: selectedSource,
                  status: selectedStatus,
                  page: 1,
                });
              }}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="transaction-pagination-controls">
            <span>
              Page {currentPage} of {Math.max(transactionPage.totalPages, 1)}
            </span>
            <button
              type="button"
              disabled={!transactionPage.hasPrevious || isLoadingTransactions}
              onClick={() =>
                setPageSelection({
                  jobId,
                  source: selectedSource,
                  status: selectedStatus,
                  page: currentPage - 1,
                })
              }
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!transactionPage.hasNext || isLoadingTransactions}
              onClick={() =>
                setPageSelection({
                  jobId,
                  source: selectedSource,
                  status: selectedStatus,
                  page: currentPage + 1,
                })
              }
            >
              Next
            </button>
          </div>
        </div>
      )}
      {settlementPreview && (
        <div className="upload-modal-backdrop settlement-preview-backdrop">
          <section
            className="upload-modal settlement-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settlement-preview-title"
          >
            <header className="upload-modal-header">
              <div>
                <span className="upload-modal-eyebrow">SETTLEMENT PREVIEW</span>
                <h2 id="settlement-preview-title">Amount to settle</h2>
              </div>
            </header>
            <div className="upload-modal-content">
              <dl className="settlement-preview-details">
                <div>
                  <dt>Company</dt>
                  <dd>{settlementPreview.company}</dd>
                </div>
                <div>
                  <dt>Transaction</dt>
                  <dd>{settlementPreview.transactionId}</dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd>{settlementPreview.reference}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{formatCurrency(settlementPreview.amount)}</dd>
                </div>
              </dl>
              <p className="settlement-preview-note">
                Settlement processing is not connected yet. No funds have been
                transferred.
              </p>
            </div>
            <footer className="upload-modal-footer">
              <button
                className="upload-modal-done"
                type="button"
                onClick={() => setSettlementPreview(null)}
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

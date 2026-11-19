import { useEffect, useState } from "react";

import { Download, Search, X } from "lucide-react";

import TransactionTable from "../tables/TransactionTable";

import {

  createManualSettlement,

  exportTransactionsCsv,

  getBankTransactions,

  getCompanies,

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



function formatTransactionDate(dateValue) {

  if (!dateValue) return "—";

  try {

    const d = new Date(dateValue);

    if (Number.isNaN(d.getTime())) return String(dateValue);

    return new Intl.DateTimeFormat("en-IN", {

      day: "numeric",

      month: "short",

      year: "numeric",

      hour: "2-digit",

      minute: "2-digit",

      hour12: true,

    }).format(d);

  } catch {

    return String(dateValue);

  }

}



function mapTransaction(item, requestedStatus) {

  const extractedReference = Array.isArray(

    item.bank_extracted_references,

  )

    ? item.bank_extracted_references[0]

    : "";



  const finalStatus = String(

    item.final_status ?? requestedStatus,

  ).toUpperCase();



  const bankTxnId =

    item.bank_transaction_id != null

      ? String(item.bank_transaction_id)

      : undefined;



  return {

    rawItem: item,

    sourceType: item.source_type,

    sourceTransactionId: item.source_transaction_id,

    bankSourceFilename: item.bank_source_filename,

    bankRowNumber: item.bank_row_number,

    bankTransactionId: item.bank_transaction_id,



    txnId:

      item.source_transaction_id ??

      bankTxnId ??

      (item.bank_row_number != null

        ? `BANK-${item.bank_row_number}`

        : undefined),



    rowNumber: item.source_row_number,

    refNum:

      item.source_reference_number ?? item.source_reference,



    fundReqAmount: item.source_amount,

    user: item.source_user,



    requestDate:

      item.source_data?.["Date Time"] ??

      item.source_date ??

      "",



    requestStatus: item.source_status,

    sourceBank: item.source_bank,

    paymentMode: item.source_payment_mode,

    virtualAccountNumber: item.source_virtual_account_number,



    accountRow: item.bank_row_number,

    accountBank: item.bank_name,

    accountUtr: item.bank_utr ?? extractedReference,

    accountRefNumber: item.bank_reference ?? extractedReference,

    accountAmount: item.bank_amount,

    accountUser:

      item.bank_user ?? item.bank_account_holder,

    accountDate:

      item.bank_date ?? item.bank_value_date,



    accountNarration:

      item.bank_narration ??

      item.bank_data?.Particulars ??

      "",



    referenceStatus: item.reference_status,

    amountStatus: item.amount_status,

    userStatus: item.user_status,

    dateStatus: item.date_status,

    finalStatus: item.final_status,



    status:

      finalStatus === "MATCHED"

        ? "Matched"

        : "Unmatched",



    remark:

      item.exception_reason ??

      item.source_data?.Remark ??

      item.source_data?.Description ??

      "",



    settleWith: "",

  };

}



function matchesTransactionSearch(transaction, query) {

  return Object.values(transaction).some(

    (value) =>

      (typeof value === "string" || typeof value === "number") &&

      String(value).toLowerCase().includes(query),

  );

}


// ============================================================
// SETTLEMENT HISTORY API PLACEHOLDERS
// ============================================================
// Connect these two functions to their separate backend endpoints later.

async function fetchAllSettlementsApi(jobId, { signal } = {}) {
  // TODO: Connect the All Settlements GET API here.
  // Example: return getAllSettlements(jobId, { signal });
  void jobId;
  void signal;
  return { items: [] };
}

async function fetchReversedSettlementsApi(jobId, { signal } = {}) {
  // TODO: Connect the Reversed Settlements GET API here.
  // Example: return getReversedSettlements(jobId, { signal });
  void jobId;
  void signal;
  return { items: [] };
}



export default function TransactionTabs({

  companies,

  jobId,

  isWaitingForSummary = false,

  summaryStatus = "",

  jobStatusMessage = "",

  statusConnectionState = "idle",

  canRetrySummary = false,

  retryBlockedMessage = "",

  isRetryingSummary = false,

  onRetrySummary,

  onSummaryRefresh,

  onNotify,

}) {

  const [selectedSource, setSelectedSource] =

    useState("Fund Request");



  const [selectedStatus, setSelectedStatus] =

    useState("Matched");

  // "transactions", "all-settlements", or "reversed-settlements"
  const [activeTab, setActiveTab] = useState("transactions");
  const [settlementHistory, setSettlementHistory] = useState([]);
  const [isLoadingSettlementHistory, setIsLoadingSettlementHistory] =
    useState(false);
  const [settlementHistoryError, setSettlementHistoryError] = useState("");




  const [transactionPage, setTransactionPage] = useState({

    items: [],

    total: 0,

    totalPages: 0,

    hasNext: false,

    hasPrevious: false,

  });



  const [loadedSelection, setLoadedSelection] =

    useState(null);



  const [pageSelection, setPageSelection] = useState({

    jobId: "",

    source: "",

    status: "",

    page: 1,

  });



  const [pageSize, setPageSize] = useState(25);

  const [isLoadingTransactions, setIsLoadingTransactions] =

    useState(false);



  const [transactionsError, setTransactionsError] =

    useState("");



  const [isExporting, setIsExporting] = useState(false);

  const [exportError, setExportError] = useState("");



  // Manual Settlement Modal state

  const [settlementModal, setSettlementModal] = useState(null);

  const [modalCompanyId, setModalCompanyId] = useState("");

  const [modalBankTxnId, setModalBankTxnId] = useState("");

  const [modalRemarks, setModalRemarks] = useState("");

  const [modalError, setModalError] = useState("");

  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  const [fetchedCompanies, setFetchedCompanies] = useState([]);

  const [unmatchedBankTxns, setUnmatchedBankTxns] = useState([]);

  const [isLoadingBankTxns, setIsLoadingBankTxns] = useState(false);

  const [isBankSuggestionsOpen, setIsBankSuggestionsOpen] = useState(false);



  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [searchText, setSearchText] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");



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



  const isLoadedSelectionCurrent =

    loadedSelection?.jobId === jobId &&

    loadedSelection?.source === selectedSource &&

    loadedSelection?.status === selectedStatus &&

    loadedSelection?.page === currentPage &&

    loadedSelection?.pageSize === pageSize;



  const isLoadingDisplayedData =

    isWaitingForSummary ||

    isLoadingTransactions ||

    Boolean(

      jobId &&

      isLiveSource &&

      !isLoadedSelectionCurrent,

    );



  useEffect(() => {

    const timeoutId = window.setTimeout(() => {

      setDebouncedSearch(

        searchText.trim().toLowerCase(),

      );

    }, 350);



    return () => window.clearTimeout(timeoutId);

  }, [searchText]);



  useEffect(() => {

    if (activeTab !== "transactions" || !jobId || !isLiveSource) {

      return undefined;

    }



    const controller = new AbortController();

    let isCurrentRequest = true;



    const requestSelection = {

      jobId,

      source: selectedSource,

      status: selectedStatus,

      page: currentPage,

      pageSize,

    };



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

        const status =

          selectedStatus === "Matched"

            ? "MATCHED"

            : "NOT_FOUND";



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



        console.log("TRANSACTION DATA UPDATED:", {

  source: selectedSource,

  status,

  page: currentPage,

  totalRecords: response.total,

  records: response.items,

});



        if (!Array.isArray(response.items)) {

          throw new Error(

            "The transactions API returned an invalid item list.",

          );

        }



        const total = Number(

          response.total ?? response.items.length,

        );



        const totalPages = Number(

          response.total_pages ??

            Math.ceil(total / pageSize),

        );



        if (

          !Number.isFinite(total) ||

          !Number.isFinite(totalPages)

        ) {

          throw new Error(

            "The transactions API returned invalid pagination details.",

          );

        }



        if (isCurrentRequest) {

          setTransactionPage({

            items: response.items.map((item) =>

              mapTransaction(item, status),

            ),

            total,

            totalPages,

            hasNext:

              response.has_next === true ||

              currentPage < totalPages,

            hasPrevious:

              response.has_previous === true ||

              currentPage > 1,

          });



          setLoadedSelection(requestSelection);

        }

      } catch (error) {

        if (

          isCurrentRequest &&

          !(

            error instanceof Error &&

            error.name === "AbortError"

          )

        ) {

          setTransactionsError(

            error instanceof Error

              ? error.message

              : "Unable to load reconciliation transactions.",

          );



          onNotify?.(

            "error",

            error instanceof Error

              ? `Could not load transactions: ${error.message}`

              : "Unable to load reconciliation transactions.",

          );



          setLoadedSelection(requestSelection);

        }

      } finally {

        if (isCurrentRequest) {

          setIsLoadingTransactions(false);

        }

      }

    };



    void loadTransactions();



    return () => {

      isCurrentRequest = false;

      controller.abort();

    };

  }, [
    activeTab,

    currentPage,

    isLiveSource,

    jobId,

    pageSize,

    selectedSource,

    selectedStatus,

    onNotify,

    reloadTrigger,

  ]);



  const transactions =

    isLiveSource && jobId

      ? transactionPage.items

      : [];

  // Each settlement-history tab calls its own API function.
  useEffect(() => {
    if (
      activeTab !== "all-settlements" &&
      activeTab !== "reversed-settlements"
    ) {
      return undefined;
    }

    if (!jobId) {
      setSettlementHistory([]);
      setSettlementHistoryError(
        "Run a reconciliation to view settlement records.",
      );
      return undefined;
    }

    const controller = new AbortController();
    let isCurrentRequest = true;

    const loadSettlementHistory = async () => {
      setIsLoadingSettlementHistory(true);
      setSettlementHistoryError("");
      setSettlementHistory([]);

      try {
        const response =
          activeTab === "all-settlements"
            ? await fetchAllSettlementsApi(jobId, {
                signal: controller.signal,
              })
            : await fetchReversedSettlementsApi(jobId, {
                signal: controller.signal,
              });

        if (!Array.isArray(response?.items)) {
          throw new Error("Settlement API must return an items array.");
        }

        if (isCurrentRequest) {
          setSettlementHistory(response.items);
        }
      } catch (error) {
        if (
          isCurrentRequest &&
          !(error instanceof Error && error.name === "AbortError")
        ) {
          setSettlementHistoryError(
            error instanceof Error
              ? error.message
              : "Unable to load settlement records.",
          );
        }
      } finally {
        if (isCurrentRequest) {
          setIsLoadingSettlementHistory(false);
        }
      }
    };

    void loadSettlementHistory();

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [activeTab, jobId, reloadTrigger]);




  const filteredTransactions = debouncedSearch

    ? transactions.filter((transaction) =>

        matchesTransactionSearch(transaction, debouncedSearch),

      )

    : transactions;



  const availableCompanies =

    Array.isArray(companies) && companies.length > 0

      ? companies

      : fetchedCompanies;



  useEffect(() => {

    if (Array.isArray(companies) && companies.length > 0) return;

    let isCurrent = true;

    getCompanies()

      .then((res) => {

        if (!isCurrent) return;

        if (Array.isArray(res?.items)) {

          setFetchedCompanies(res.items);

        }

      })

      .catch(() => {});



    return () => {

      isCurrent = false;

    };

  }, [companies]);



  const isSearchPending =

    Boolean(jobId && isLiveSource) &&

    searchText.trim().toLowerCase() !== debouncedSearch;



  const transactionCount =

    isLiveSource && jobId

      ? transactionPage.total

      : transactions.length;



  const displayedCount = debouncedSearch

    ? filteredTransactions.length

    : transactionCount;



  const isLoadingTransactionsOrSearch =

    isLoadingDisplayedData || isSearchPending;



  const transactionCountTone =

    isLoadingTransactionsOrSearch

      ? "loading"

      : displayedCount > 0

        ? "success"

        : "danger";



  const transactionCountLabel = isWaitingForSummary

    ? "Waiting for reconciliation..."

    : isLoadingTransactionsOrSearch

      ? "Loading transactions..."

      : isSearchPending

        ? "Updating search..."

        : debouncedSearch

          ? `${filteredTransactions.length} matching ${

              filteredTransactions.length === 1

                ? "transaction"

                : "transactions"

            } on this page`

          : transactionCount === 0

            ? "0 transactions"

            : `${(currentPage - 1) * pageSize + 1}–${Math.min(

                currentPage * pageSize,

                transactionCount,

              )} of ${transactionCount} transactions`;



  const selectTab = (source, status) => {
    setActiveTab("transactions");
    setSelectedSource(source);
    setSelectedStatus(status);
    setSearchText("");
    setDebouncedSearch("");

    setPageSelection({
      jobId,
      source,
      status,
      page: 1,
    });
  };

  const selectSettlementTab = (tab) => {
    setActiveTab(tab);
    setSettlementModal(null);
    setSearchText("");
    setDebouncedSearch("");
    setSettlementHistory([]);
    setSettlementHistoryError("");
  };



  const closeSettlementModal = () => {

    if (isSubmittingSettlement) return;

    setSettlementModal(null);

    setModalError("");

    setModalCompanyId("");

    setModalBankTxnId("");

    setModalRemarks("");

    setIsSubmittingSettlement(false);

    setIsBankSuggestionsOpen(false);

  };



  const handleSettle = (transaction) => {

    if (selectedSource === "Account Statement") {

      onNotify?.(

        "info",

        "Manual settlement is only supported for Fund Request and VA Transfer.",

      );

      return;

    }



    const sourceTxnId = String(

      transaction.sourceTransactionId ??

      transaction.rawItem?.source_transaction_id ??

      transaction.txnId ??

      ""

    ).trim();



    if (!sourceTxnId) {

      onNotify?.(

        "error",

        "Primary transaction ID is missing for this record.",

      );

      return;

    }



    const primaryType =

      selectedSource === "VA Transfer"

        ? "va_transaction"

        : "fund_request";



    setSettlementModal({

      transaction,

      primaryId: sourceTxnId,

      primaryType,

      primaryTypeLabel: selectedSource,

      amount:

        transaction.fundReqAmount ??

        transaction.accountAmount ??

        transaction.amount,

      reference:

        transaction.refNum ||

        transaction.accountUtr ||

        transaction.accountRefNumber ||

        "—",

    });



    setModalCompanyId(

      availableCompanies.length === 1

        ? (availableCompanies[0].company_id || availableCompanies[0].id)

        : ""

    );

    setModalBankTxnId("");

    setModalRemarks("");

    setModalError("");

    setIsSubmittingSettlement(false);

    setIsBankSuggestionsOpen(false);



    if (jobId) {

      setIsLoadingBankTxns(true);

      getBankTransactions(jobId, { status: "NOT_FOUND", limit: 100 })

        .then((res) => {

          if (Array.isArray(res?.items)) {

            setUnmatchedBankTxns(res.items);

          }

        })

        .catch(() => {})

        .finally(() => {

          setIsLoadingBankTxns(false);

        });

    }

  };



  const handleConfirmSettlement = async (event) => {

  event?.preventDefault();



  if (isSubmittingSettlement || !settlementModal || !jobId) {

    return;

  }



  setModalError("");



  if (!modalCompanyId) {

    setModalError("Please select a settlement company.");

    return;

  }



  const trimmedBankTxnId = modalBankTxnId.trim();



  if (!trimmedBankTxnId) {

    setModalError("Bank Transaction ID is required.");

    return;

  }



  if (!settlementModal.primaryId) {

    setModalError("Primary transaction ID is missing for this record.");

    return;

  }



  const payload = {

    primary: {

      transaction_type: settlementModal.primaryType,

      transaction_id: settlementModal.primaryId,

    },

    company_id: modalCompanyId,

    counterpart: {

      transaction_type: "bank",

      transaction_id: trimmedBankTxnId,

    },

    remarks: modalRemarks.trim(),

  };



  setIsSubmittingSettlement(true);



  try {

    await createManualSettlement(jobId, payload);



    onNotify?.(

      "success",

      `Transaction ${settlementModal.primaryId} settled successfully.`

    );



    setSettlementModal(null);

    setModalError("");

    setModalCompanyId("");

    setModalBankTxnId("");

    setModalRemarks("");



    setReloadTrigger((v) => v + 1);



    // Refresh AI summary after successful settlement

    await onSummaryRefresh?.();



  } catch (err) {

    const errorMessage =

      err instanceof Error

        ? err.message

        : "Failed to settle transaction.";



    setModalError(errorMessage);

    onNotify?.("error", `Settlement failed: ${errorMessage}`);



  } finally {

    setIsSubmittingSettlement(false);

  }

};



  const exportCSV = async () => {

    if (!jobId || isExporting) return;



    setIsExporting(true);

    setExportError("");



    try {

      const { blob, filename } =

        await exportTransactionsCsv(jobId, {

          source: selectedSource,

          status:

            selectedStatus === "Matched"

              ? "MATCHED"

              : "NOT_FOUND",

        });



      onNotify?.("success", "Transaction CSV downloaded.");



      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");



      link.href = url;

      link.download = filename;



      document.body.append(link);

      link.click();

      link.remove();



      window.setTimeout(

        () => URL.revokeObjectURL(url),

        1000,

      );

    } catch (error) {

      const message =

        error instanceof Error

          ? error.message

          : "Unable to export transactions.";



      setExportError(message);



      onNotify?.(

        "error",

        `Could not export transactions: ${message}`,

      );

    } finally {

      setIsExporting(false);

    }

  };



  const normalizedStatus = String(

    summaryStatus ?? "",

  ).trim().toUpperCase();



  const isPending = normalizedStatus === "PENDING";

  const isSaving = normalizedStatus === "SAVING";

  const isCompleted = normalizedStatus === "COMPLETED";

  const isFailed = normalizedStatus === "FAILED";



  const currentStatusMessage =

    jobStatusMessage ||

    (isPending

      ? "Waiting for reconciliation processing..."

      : isSaving

        ? "Saving reconciliation records..."

        : isCompleted

          ? "Reconciliation completed successfully."

          : isFailed

            ? "Reconciliation failed."

            : "No reconciliation status available.");



  const statusTone = isCompleted

    ? "success"

    : isFailed

      ? "danger"

      : "neutral";



  const showRetryButton =

    isFailed && canRetrySummary;



  const showRetryBlockedMessage =

    isFailed &&

    !canRetrySummary &&

    retryBlockedMessage;



  const connectionMessage = {

    connecting: "Connecting to live status...",

    connected: "Live status connected",

    reconnecting:

      "Connection lost. Reconnecting automatically...",

    disconnected:

      "Live status disconnected. Reconnection stopped.",

    "protocol-error":

      "Received an invalid status update. Waiting for the next event...",

  }[statusConnectionState];



  const filteredBankTxns = unmatchedBankTxns.filter((bt) => {

    const q = modalBankTxnId.trim().toLowerCase();

    if (!q) return true;

    const bId = String(bt.bank_transaction_id ?? "").toLowerCase();

    const amount = String(bt.bank_amount ?? "").toLowerCase();

    const ref = String(bt.bank_reference ?? "").toLowerCase();

    const extRef = Array.isArray(bt.bank_extracted_references)

      ? bt.bank_extracted_references.join(" ").toLowerCase()

      : "";

    const narr = String(bt.bank_narration ?? "").toLowerCase();

    const bankName = String(bt.bank_name ?? "").toLowerCase();

    return (

      bId.includes(q) ||

      amount.includes(q) ||

      ref.includes(q) ||

      extRef.includes(q) ||

      narr.includes(q) ||

      bankName.includes(q)

    );

  });



  const selectedBankTxn = unmatchedBankTxns.find(

    (bt) =>

      bt.bank_transaction_id != null &&

      String(bt.bank_transaction_id).trim() === modalBankTxnId.trim()

  );



  return (

    <section className="transactions-card">

      <div className="section-heading table-title">

        <div>

          <h3>Transaction Records</h3>

          <p>View source-wise transaction details</p>

        </div>



        <div className="records-toolbar-actions">

          <div

            className="reconciliation-status-bar"

            role="status"

            aria-live="polite"

          >

            <span

              className={`reconciliation-status-pill reconciliation-status-${statusTone}`}

            >

              {normalizedStatus || "READY"}

            </span>



            <span className="reconciliation-status-message">

              {currentStatusMessage}

            </span>



            {connectionMessage &&

              !isCompleted &&

              !isFailed && (

                <span

                  className={`reconciliation-connection reconciliation-connection-${statusConnectionState}`}

                >

                  <span className="reconciliation-connection-indicator" />

                  {connectionMessage}

                </span>

              )}



            {showRetryBlockedMessage && (

              <span className="reconciliation-status-note">

                {retryBlockedMessage}

              </span>

            )}



            {showRetryButton && (

              <button

                className="retry-summary-btn"

                type="button"

                onClick={onRetrySummary}

                disabled={isRetryingSummary}

              >

                {isRetryingSummary

                  ? "Retrying..."

                  : "Retry"}

              </button>

            )}

          </div>



{activeTab === "transactions" && (
          <button

            className="export-btn"

            type="button"

            onClick={exportCSV}

            disabled={

              !jobId ||

              isWaitingForSummary ||

              isExporting

            }

            aria-busy={isExporting}

          >

            <Download size={16} />

            {isExporting ? "Exporting..." : "Export CSV"}

          </button>
          )}

        </div>

      </div>



      {exportError && activeTab === "transactions" && (

        <p className="upload-submit-error" role="alert">

          Could not export transactions: {exportError}

        </p>

      )}



      <div className="transaction-tabs">

        <button

          className={

            activeTab === "transactions" &&

            selectedSource === "Fund Request" &&

            selectedStatus === "Matched"

              ? "tab active"

              : "tab"

          }

          onClick={() =>

            selectTab("Fund Request", "Matched")

          }

        >

          Fund Request Matched

        </button>



        <button

          className={

            activeTab === "transactions" &&

            selectedSource === "Fund Request" &&

            selectedStatus === "Unmatched"

              ? "tab active"

              : "tab"

          }

          onClick={() =>

            selectTab("Fund Request", "Unmatched")

          }

        >

          Fund Request Unmatched

        </button>



        <button

          className={

            activeTab === "transactions" &&

            selectedSource === "VA Transfer" &&

            selectedStatus === "Matched"

              ? "tab active"

              : "tab"

          }

          onClick={() =>

            selectTab("VA Transfer", "Matched")

          }

        >

          VA Transfer Matched

        </button>



        <button

          className={

            activeTab === "transactions" &&

            selectedSource === "VA Transfer" &&

            selectedStatus === "Unmatched"

              ? "tab active"

              : "tab"

          }

          onClick={() =>

            selectTab("VA Transfer", "Unmatched")

          }

        >

          VA Transfer Unmatched

        </button>



        <button

          className={

            activeTab === "transactions" &&

            selectedSource === "Account Statement" &&

            selectedStatus === "Matched"

              ? "tab active"

              : "tab"

          }

          onClick={() =>

            selectTab("Account Statement", "Matched")

          }

        >

          Account Statement Matched

        </button>



        <button

          className={

            activeTab === "transactions" &&

            selectedSource === "Account Statement" &&

            selectedStatus === "Unmatched"

              ? "tab active"

              : "tab"

          }

          onClick={() =>

            selectTab("Account Statement", "Unmatched")

          }

        >

          Account Statement Unmatched

        </button>



         <button
          type="button"
          className={
            activeTab === "all-settlements" ? "tab active" : "tab"
          }
          onClick={() => selectSettlementTab("all-settlements")}
        >
          All Settlements
        </button>

        <button
          type="button"
          className={
            activeTab === "reversed-settlements" ? "tab active" : "tab"
          }
          onClick={() => selectSettlementTab("reversed-settlements")}
        >
          Reversed Settlements
        </button>

      </div>



      {activeTab === "transactions" ? (
        <>
      <div className="transaction-search-row">

        <div className="transaction-search-control">

          <Search size={17} aria-hidden="true" />



          <label

            className="visually-hidden"

            htmlFor="transaction-search"

          >

            Search transaction records on this page

          </label>



          <input

            id="transaction-search"

            type="text"

            inputMode="search"

            value={searchText}

            onChange={(event) =>

              setSearchText(event.target.value)

            }

            placeholder="Search ID, reference, amount, user, bank..."

            aria-describedby="transaction-search-hint"

            aria-controls="transaction-records-table"

            autoComplete="off"

          />



          {searchText && (

            <button

              className="transaction-search-clear"

              type="button"

              onClick={() => setSearchText("")}

              aria-label="Clear transaction search"

            >

              <X size={16} aria-hidden="true" />

            </button>

          )}

        </div>



        <p

          className="transaction-search-hint"

          id="transaction-search-hint"

        >

          Search the loaded page by ID, reference, amount, name, bank, or status.

        </p>

      </div>



      <div className="transaction-table-meta">

        <span

          className={`transaction-count transaction-count-${transactionCountTone}`}

          aria-live="polite"

          aria-atomic="true"

        >

          {transactionCountLabel}

        </span>



        <span>Scroll horizontally to view all fields</span>

      </div>



      {isLiveSource &&

        !jobId &&

        !isWaitingForSummary && (

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

        id="transaction-records-table"

        transactions={filteredTransactions}

        isLoading={isLoadingTransactionsOrSearch}

        emptyMessage={

          debouncedSearch

            ? `No transaction found for "${searchText.trim()}".`

            : "No transaction found"

        }

        isSettlementDisabled={selectedSource === "Account Statement"}

        onSettle={handleSettle}

      />



      {isLiveSource && jobId && (

        <div className="transaction-pagination">

          <label>

            Rows per page



            <select

              value={pageSize}

              disabled={isLoadingTransactionsOrSearch}

              onChange={(event) => {

                const nextPageSize = Number(

                  event.target.value,

                );



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

              Page {currentPage} of{" "}

              {Math.max(transactionPage.totalPages, 1)}

            </span>



            <button

              type="button"

              disabled={

                !transactionPage.hasPrevious ||

                isLoadingTransactionsOrSearch

              }

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

              disabled={

                !transactionPage.hasNext ||

                isLoadingTransactionsOrSearch

              }

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



        </>
      ) : (
        <div className="settlement-history-panel">
          <div className="transaction-table-meta">
            <span className="transaction-count transaction-count-neutral">
              {activeTab === "all-settlements"
                ? "All Settlements"
                : "Reversed Settlements"}
            </span>
            <span>
              {isLoadingSettlementHistory
                ? "Loading records..."
                : `${settlementHistory.length} records`}
            </span>
          </div>

          {settlementHistoryError ? (
            <p className="session-note" role="alert">
              {settlementHistoryError}
            </p>
          ) : isLoadingSettlementHistory ? (
            <p className="session-note" role="status">
              Loading settlement records...
            </p>
          ) : settlementHistory.length === 0 ? (
            <p className="session-note">
              No records to display. Settlement API integration will be added here.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Settlement ID</th>
                    <th>Primary Transaction ID</th>
                    <th>Bank Transaction ID</th>
                    <th>Company</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {settlementHistory.map((record, index) => (
                    <tr key={record.settlement_id || record.id || index}>
                      <td>{record.settlement_id || record.id || "—"}</td>
                      <td>
                        {record.primary?.transaction_id ||
                          record.primary_transaction_id ||
                          "—"}
                      </td>
                      <td>
                        {record.counterpart?.transaction_id ||
                          record.bank_transaction_id ||
                          "—"}
                      </td>
                      <td>{record.company_name || record.company?.name || "—"}</td>
                      <td>
                        {formatCurrency(
                          record.amount ?? record.settlement_amount,
                        )}
                      </td>
                      <td>
                        {formatTransactionDate(
                          record.created_at || record.settled_at,
                        )}
                      </td>
                      <td>{record.status || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "transactions" && settlementModal && (

        <div

          className="upload-modal-backdrop settlement-preview-backdrop"

          onClick={(e) => {

            if (e.target === e.currentTarget && !isSubmittingSettlement) {

              closeSettlementModal();

            }

          }}

        >

          <form

            className="upload-modal settlement-preview-modal"

            onSubmit={handleConfirmSettlement}

            noValidate

            role="dialog"

            aria-modal="true"

            aria-labelledby="manual-settlement-modal-title"

          >

            <header className="upload-modal-header">

              <div>

                <span className="upload-modal-eyebrow">

                  MANUAL SETTLEMENT

                </span>



                <h2 id="manual-settlement-modal-title">

                  Settle Unmatched Transaction

                </h2>



                <p>

                  Link this {settlementModal.primaryTypeLabel} record to a bank transaction.

                </p>

              </div>



              <button

                type="button"

                className="upload-modal-close"

                onClick={closeSettlementModal}

                disabled={isSubmittingSettlement}

                aria-label="Close modal"

              >

                <X size={18} />

              </button>

            </header>



            <div className="upload-modal-content settlement-modal-scrollable">

              {modalError && (

                <div

                  className="company-error-banner"

                  role="alert"

                  style={{ marginBottom: "14px" }}

                >

                  <span>{modalError}</span>

                </div>

              )}



              {/* Transaction Information (Read-only) */}

              <dl className="settlement-preview-details">

                <div>

                  <dt>Primary Transaction ID</dt>

                  <dd>{settlementModal.primaryId}</dd>

                </div>



                <div>

                  <dt>Primary Transaction Type</dt>

                  <dd>{settlementModal.primaryTypeLabel}</dd>

                </div>



                <div>

                  <dt>Transaction Amount</dt>

                  <dd className="settlement-amount-highlight">

                    {formatCurrency(settlementModal.amount)}

                  </dd>

                </div>



                <div>

                  <dt>Transaction Reference</dt>

                  <dd>{settlementModal.reference || "—"}</dd>

                </div>

              </dl>



              {/* Company Selection */}

              <div className="settlement-field-group">

                <label htmlFor="settlement-company-select">

                  Company <span style={{ color: "var(--danger)" }}>*</span>

                </label>

                <select

                  id="settlement-company-select"

                  className="settlement-modal-input"

                  value={modalCompanyId}

                  onChange={(e) => {

                    setModalCompanyId(e.target.value);

                    if (modalError) setModalError("");

                  }}

                  disabled={isSubmittingSettlement}

                  required

                >

                  <option value="">Select company</option>

                  {availableCompanies.map((company) => {

                    const cId = company.company_id || company.id;

                    return (

                      <option key={cId} value={cId}>

                        {company.name}

                      </option>

                    );

                  })}

                </select>

              </div>



              {/* Bank Transaction ID */}

              <div className="settlement-field-group">

                <div className="settlement-label-row">

                  <label htmlFor="settlement-bank-id-input">

                    Bank Transaction ID <span style={{ color: "var(--danger)" }}>*</span>

                  </label>

                  {unmatchedBankTxns.length > 0 && (

                    <button

                      type="button"

                      className="settlement-toggle-suggestions-btn"

                      onClick={() => setIsBankSuggestionsOpen((prev) => !prev)}

                    >

                      {isBankSuggestionsOpen

                        ? "Hide Suggestions"

                        : `Browse Suggestions (${unmatchedBankTxns.length})`}

                    </button>

                  )}

                </div>



                <input

                  id="settlement-bank-id-input"

                  type="text"

                  className="settlement-modal-input"

                  value={modalBankTxnId}

                  onChange={(e) => {

                    setModalBankTxnId(e.target.value);

                    if (modalError) setModalError("");

                    if (!isBankSuggestionsOpen) setIsBankSuggestionsOpen(true);

                  }}

                  onFocus={() => {

                    if (unmatchedBankTxns.length > 0) {

                      setIsBankSuggestionsOpen(true);

                    }

                  }}

                  placeholder="Enter or select bank transaction ID (e.g. 556072)"

                  disabled={isSubmittingSettlement}

                  required

                  autoComplete="off"

                />



                {isBankSuggestionsOpen && (

                  <div className="settlement-suggestions-dropdown">

                    <div className="settlement-suggestions-header">

                      <span>

                        {isLoadingBankTxns

                          ? "Loading bank transactions..."

                          : `Unmatched Bank Records (${filteredBankTxns.length} ${filteredBankTxns.length === 1 ? "match" : "matches"})`}

                      </span>

                      <button

                        type="button"

                        className="settlement-suggestions-close"

                        onClick={() => setIsBankSuggestionsOpen(false)}

                      >

                        ✕ Close

                      </button>

                    </div>



                    {isLoadingBankTxns ? (

                      <div className="settlement-suggestions-empty">Loading records...</div>

                    ) : filteredBankTxns.length === 0 ? (

                      <div className="settlement-suggestions-empty">

                        No bank transactions match &ldquo;{modalBankTxnId}&rdquo;. You can still submit this ID manually.

                      </div>

                    ) : (

                      <div className="settlement-suggestions-list">

                        {filteredBankTxns.map((bt) => {

                          const bId = bt.bank_transaction_id != null ? String(bt.bank_transaction_id) : "";

                          const isSelected = String(modalBankTxnId).trim() === bId;

                          const ref =

                            bt.bank_reference ||

                            (Array.isArray(bt.bank_extracted_references)

                              ? bt.bank_extracted_references[0]

                              : "") ||

                            "—";

                          const amountFormatted = bt.bank_amount ? formatCurrency(bt.bank_amount) : "—";

                          const dateFormatted = bt.bank_date

                            ? formatTransactionDate(bt.bank_date)

                            : bt.bank_value_date

                              ? formatTransactionDate(bt.bank_value_date)

                              : "—";

                          const narration = bt.bank_narration || bt.bank_data?.Particulars || "—";

                          const bankName = bt.bank_name || "Bank Statement";

                          const accNumber = bt.bank_account_number ? `Acc: ${bt.bank_account_number}` : "";



                          return (

                            <div

                              key={bId || bt.bank_row_number}

                              className={`settlement-suggestion-item ${isSelected ? "selected" : ""}`}

                              onClick={() => {

                                setModalBankTxnId(bId);

                                setIsBankSuggestionsOpen(false);

                                if (modalError) setModalError("");

                              }}

                              role="button"

                              tabIndex={0}

                              onKeyDown={(e) => {

                                if (e.key === "Enter" || e.key === " ") {

                                  e.preventDefault();

                                  setModalBankTxnId(bId);

                                  setIsBankSuggestionsOpen(false);

                                  if (modalError) setModalError("");

                                }

                              }}

                            >

                              <div className="suggestion-item-top">

                                <span className="suggestion-id-pill">

                                  ID: <strong>{bId}</strong>

                                </span>

                                <span className="suggestion-amount-pill">

                                  {amountFormatted} {bt.bank_direction ? `(${bt.bank_direction})` : ""}

                                </span>

                                <span className="suggestion-date">

                                  {dateFormatted}

                                </span>

                              </div>



                              <div className="suggestion-item-mid">

                                <span className="suggestion-ref">

                                  <strong>Ref / UTR:</strong> {ref}

                                </span>

                                <span className="suggestion-bank">

                                  {bankName} {accNumber ? `(${accNumber})` : ""}

                                </span>

                              </div>



                              <div className="suggestion-item-narration">

                                <strong>Narration:</strong> {narration}

                              </div>

                            </div>

                          );

                        })}

                      </div>

                    )}

                  </div>

                )}



                {selectedBankTxn && !isBankSuggestionsOpen && (

                  <div className="settlement-selected-preview">

                    <div className="selected-preview-header">

                      <span className="selected-badge">

                        ✓ Selected Bank Record #{selectedBankTxn.bank_transaction_id}

                      </span>

                      <button

                        type="button"

                        className="selected-change-btn"

                        onClick={() => setIsBankSuggestionsOpen(true)}

                      >

                        Change

                      </button>

                    </div>

                    <div className="selected-preview-body">

                      <div>

                        <strong>Amount:</strong> {formatCurrency(selectedBankTxn.bank_amount)}{" "}

                        {selectedBankTxn.bank_direction ? `(${selectedBankTxn.bank_direction})` : ""}

                      </div>

                      <div>

                        <strong>Date:</strong>{" "}

                        {selectedBankTxn.bank_date

                          ? formatTransactionDate(selectedBankTxn.bank_date)

                          : "—"}

                      </div>

                      <div>

                        <strong>Ref / UTR:</strong>{" "}

                        {selectedBankTxn.bank_reference ||

                          (Array.isArray(selectedBankTxn.bank_extracted_references)

                            ? selectedBankTxn.bank_extracted_references[0]

                            : "—")}

                      </div>

                      <div>

                        <strong>Bank:</strong> {selectedBankTxn.bank_name || "—"}{" "}

                        {selectedBankTxn.bank_account_number

                          ? `(${selectedBankTxn.bank_account_number})`

                          : ""}

                      </div>

                      <div className="selected-narration-full">

                        <strong>Narration:</strong>{" "}

                        {selectedBankTxn.bank_narration ||

                          selectedBankTxn.bank_data?.Particulars ||

                          "—"}

                      </div>

                    </div>

                  </div>

                )}



                <span className="settlement-field-hint">

                  Select a bank record from the suggestions above or enter a bank transaction ID manually.

                </span>

              </div>



              {/* Remarks */}

              <div className="settlement-field-group">

                <label htmlFor="settlement-remarks-input">

                  Remarks <span style={{ color: "var(--muted)", fontWeight: "normal" }}>(Optional)</span>

                </label>

                <textarea

                  id="settlement-remarks-input"

                  className="settlement-modal-textarea"

                  value={modalRemarks}

                  onChange={(e) => setModalRemarks(e.target.value)}

                  placeholder="Enter settlement notes..."

                  disabled={isSubmittingSettlement}

                  rows={3}

                />

              </div>

            </div>



            <footer className="upload-modal-footer">

              <div className="upload-modal-actions" style={{ marginLeft: "auto" }}>

                <button

                  className="upload-modal-done"

                  type="button"

                  disabled={isSubmittingSettlement}

                  onClick={closeSettlementModal}

                >

                  Cancel

                </button>



                <button

                  className="upload-modal-submit"

                  type="submit"

                  disabled={isSubmittingSettlement}

                >

                  {isSubmittingSettlement ? "Settling..." : "Confirm Settlement"}

                </button>

              </div>

            </footer>

          </form>

        </div>

      )}

    </section>

  );

}

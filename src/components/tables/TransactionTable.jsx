
/**
 * Maps an incoming reconciliation status into the visual tone used by the UI.
 */
function getStatusTone(value) {
  const status = String(value).toLowerCase();

  if (/unmatch|mismatch|not_found|fail|error|invalid|duplicate/.test(status)) {
    return "danger";
  }

  if (/not_used/.test(status)) {
    return "warning";
  }

  if (/match|success|approved|pass/.test(status)) {
    return "success";
  }

  return "warning";
}

/**
 * Renders a status badge with a placeholder when the value is missing.
 */
function StatusCell({ value }) {
  if (!value) {
    return <span className="missing-value">—</span>;
  }

  return (
    <span className={`transaction-status transaction-status-${getStatusTone(value)}`}>
      {value}
    </span>
  );
}



/**
 * Displays the full reconciliation view for a set of transactions.
 */
export default function TransactionTable({
  id,
  transactions,
  isLoading,
  emptyMessage = "No transaction found",
  isSettlementDisabled = false,
  onSettle,
  onDelete,
  jobId,
}) {
  return (
    <div className="table-wrapper">
      <table
        id={id}
        className="transaction-table transaction-data-table"
        aria-busy={isLoading}
      >
        <thead>
          <tr>
            <th className="transaction-group-header" colSpan={10}>
              Source Transaction Details
            </th>
            <th className="transaction-group-header" colSpan={8}>
              ACSMT Statement Details
            </th>
            <th className="transaction-group-header" colSpan={6}>
              Match Checks
            </th>
            <th className="transaction-group-header" colSpan={1}>
              Action
            </th>
          </tr>

          <tr>
            <th>Transaction ID</th>
            <th>Row Number</th>
            <th>Reference Number</th>
            <th>Source Amount</th>
            <th>Source User</th>
            <th>Source Date</th>
            <th>Source Status</th>
            <th>Source Bank</th>
            <th>Payment Mode</th>
            <th>Virtual Account Number</th>
            <th>ACSMT Row</th>
            <th>ACSMT Bank</th>
            <th>ACSMT UTR</th>
            <th>ACSMT Reference Number</th>
            <th>ACSMT Amount</th>
            <th>ACSMT User</th>
            <th>ACSMT Date</th>
            <th>ACSMT Narration</th>
            <th>Reference Status</th>
            <th>Amount Status</th>
            <th>User Status</th>
            <th>Date Status</th>
            <th>Final Status</th>
            <th>Remark</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }, (_, rowIndex) => (
              <tr
                className="transaction-skeleton-row"
                key={`skeleton-${rowIndex}`}
                aria-hidden="true"
              >
                {Array.from({ length: 25 }, (_, cellIndex) => (
                  <td key={cellIndex}>
                    <span className="transaction-skeleton-cell" />
                  </td>
                ))}
              </tr>
            ))
          ) : transactions.length === 0 ? (
            <tr className="transaction-empty-row">
              <td className="table-empty-state" colSpan={25} role="status">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            transactions.map((transaction, index) => {
              const finalStatus =
                transaction.finalStatus ?? transaction.status;

              const isUnmatched =
                String(finalStatus).toLowerCase() === "unmatched" ||
                String(finalStatus).toUpperCase() === "NOT_FOUND";

              return (
                <tr
                  key={transaction.source_transaction_id || index}
                >
                  <td className="transaction-id">
                    {transaction.txnId ?? transaction.id ?? "—"}
                  </td>
                  <td>{transaction.rowNumber ?? "—"}</td>
                  <td>{transaction.refNum ?? "—"}</td>
                  <td className="transaction-amount">
                    {transaction.fundReqAmount ?? transaction.amount ?? "—"}
                  </td>
                  <td>{transaction.user ?? "—"}</td>
                  <td>{transaction.requestDate ?? transaction.date ?? "—"}</td>
                  <td>{transaction.requestStatus ?? "—"}</td>
                  <td>{transaction.sourceBank ?? "—"}</td>
                  <td>{transaction.paymentMode ?? "—"}</td>
                  <td>{transaction.virtualAccountNumber ?? "—"}</td>
                  <td>{transaction.accountRow ?? "—"}</td>
                  <td>{transaction.accountBank ?? "—"}</td>
                  <td>{transaction.accountUtr ?? "—"}</td>
                  <td>{transaction.accountRefNumber ?? "—"}</td>
                  <td>{transaction.accountAmount ?? "—"}</td>
                  <td>{transaction.accountUser ?? "—"}</td>
                  <td>{transaction.accountDate ?? "—"}</td>
                  <td>{transaction.accountNarration ?? "—"}</td>

                  <td>
                    <StatusCell value={transaction.referenceStatus} />
                  </td>
                  <td>
                    <StatusCell value={transaction.amountStatus} />
                  </td>
                  <td>
                    <StatusCell value={transaction.userStatus} />
                  </td>
                  <td>
                    <StatusCell value={transaction.dateStatus} />
                  </td>
                  <td>
                    <StatusCell value={finalStatus} />
                  </td>
                  <td>{transaction.remark ?? "—"}</td>

                  <td>
                    {isUnmatched ? (
                      isSettlementDisabled ? (
                        <button
                          className="delete-button"
                          type="button"
                          onClick={() => onDelete?.(jobId, transaction.bankTransactionId)}
                          disabled={!onDelete}
                          title={
                            !onDelete
                              ? "Delete action is not configured."
                              : "Delete unmatched bank statement record"
                          }
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          className="settle-button"
                          type="button"
                          onClick={() => onSettle?.(transaction)}
                        >
                          Settle
                        </button>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Maps an incoming reconciliation status into the visual tone used by the UI.
 * Negative or failed states are highlighted as danger; successful states use success.
 */
function getStatusTone(value) {
  const status = String(value).toLowerCase();

  // Treat the most common failure signals as an error state.
  if (/unmatch|mismatch|not_found|fail|error|invalid|duplicate/.test(status)) {
    return "danger";
  }

  // Positive match states receive a green success treatment.
  if (/match|success|approved|pass/.test(status)) {
    return "success";
  }

  // Any unknown or neutral state stays visually subdued.
  return "neutral";
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
 * Displays the full reconciliation view for a set of transactions, including
 * fund request data, ACSMT statement data, validation checks, and settlement actions.
 */
export default function TransactionTable({
  id,
  transactions,
  isLoading,
  emptyMessage = "No transaction found",
  companies,
  settlementTargets,
  onSettlementChange,
  onSettle,
}) {
  return (
    <div className="table-wrapper">
      <table
        id={id}
        className="transaction-table transaction-data-table"
        aria-busy={isLoading}
      >
        <thead>
          {/* Top-level grouping labels divide the table into its major sections. */}
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
              Settlement
            </th>
          </tr>

          {/* Column names remain static for the reconciliation comparison. */}
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
            <th>Settle With</th>
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
            // Each transaction row contains both the source record and the matching ACSMT data.
            transactions.map((transaction) => (
              <tr key={transaction.txnId ?? transaction.id}>
                <td className="transaction-id">{transaction.txnId ?? transaction.id ?? "—"}</td>
                <td>{transaction.rowNumber ?? "—"}</td>
                <td>{transaction.refNum ?? "—"}</td>
                <td className="transaction-amount">{transaction.fundReqAmount ?? transaction.amount ?? "—"}</td>
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
                  <StatusCell value={transaction.finalStatus ?? transaction.status} />
                </td>
                <td>{transaction.remark ?? "—"}</td>
                <td>
                  {/* Only unmatched transactions can be assigned to a settlement target. */}
                  {(transaction.finalStatus ?? transaction.status) ===
                    "Unmatched" ||
                  transaction.finalStatus === "NOT_FOUND" ? (
                    <div className="settlement-actions">
                      <select
                        className="settlement-select"
                        value={
                          settlementTargets[transaction.txnId ?? transaction.id] ??
                          transaction.settleWith ??
                          ""
                        }
                        onChange={(event) =>
                          onSettlementChange(
                            transaction.txnId ?? transaction.id,
                            event.target.value,
                          )
                        }
                        aria-label={`Settle transaction ${transaction.txnId ?? transaction.id} with`}
                      >
                        <option value="">Select company</option>
                        {companies.map((company) => {
                          const companyId = company.company_id || company.id;
                          return (
                            <option key={companyId} value={companyId}>
                              {company.name}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        className="settle-button"
                        type="button"
                        disabled={
                          !settlementTargets[transaction.txnId ?? transaction.id] &&
                          !transaction.settleWith
                        }
                        onClick={() => onSettle(transaction)}
                      >
                        Settle
                      </button>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

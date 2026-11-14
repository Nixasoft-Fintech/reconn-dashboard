/**
 * Maps an incoming reconciliation status into the visual tone used by the UI.
 * Negative or failed states are highlighted as danger; successful states use success.
 */
function getStatusTone(value) {
  const status = String(value).toLowerCase();

  // Treat the most common failure signals as an error state.
  if (/unmatch|mismatch|fail|error|invalid|duplicate/.test(status)) {
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
  transactions,
  companies,
  settlementTargets,
  onSettlementChange,
}) {
  return (
    <div className="table-wrapper">
      <table className="transaction-table transaction-data-table">
        <thead>
          {/* Top-level grouping labels divide the table into its major sections. */}
          <tr>
            <th className="transaction-group-header" colSpan={5}>
              Fund Request Details
            </th>
            <th className="transaction-group-header" colSpan={6}>
              ACSMT Statement Details
            </th>
            <th className="transaction-group-header" colSpan={5}>
              Match Checks
            </th>
            <th className="transaction-group-header" colSpan={2}>
              Settlement
            </th>
          </tr>

          {/* Column names remain static for the reconciliation comparison. */}
          <tr>
            <th>Transaction ID</th>
            <th>Row Number</th>
            <th>Reference Number</th>
            <th>Fund Request Amount</th>
            <th>User</th>
            <th>ACSMT Row</th>
            <th>ACSMT UTR</th>
            <th>ACSMT Reference Number</th>
            <th>ACSMT Amount</th>
            <th>ACSMT User</th>
            <th>ACSMT Date</th>
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
          {transactions.length === 0 ? (
            // Empty-state row shown when no items match the selected tab/filter.
            <tr>
              <td className="table-empty-state" colSpan={18}>
                No transactions found for this tab.
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
                <td>{transaction.accountRow ?? "—"}</td>
                <td>{transaction.accountUtr ?? "—"}</td>
                <td>{transaction.accountRefNumber ?? "—"}</td>
                <td>{transaction.accountAmount ?? "—"}</td>
                <td>{transaction.accountUser ?? "—"}</td>
                <td>{transaction.accountDate ?? "—"}</td>
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
                  {(transaction.finalStatus ?? transaction.status) === "Unmatched" ? (
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
                      {companies.map((company) => (
                        <option key={company.id} value={company.name}>
                          {company.name}
                        </option>
                      ))}
                    </select>
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

function getStatusTone(value) {
  const status = String(value).toLowerCase();

  if (/unmatch|mismatch|fail|error|invalid|duplicate/.test(status)) {
    return "danger";
  }

  if (/match|success|approved|pass/.test(status)) {
    return "success";
  }

  return "neutral";
}

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
            <tr>
              <td className="table-empty-state" colSpan={18}>
                No transactions found for this tab.
              </td>
            </tr>
          ) : (
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
              <td><StatusCell value={transaction.referenceStatus} /></td>
              <td><StatusCell value={transaction.amountStatus} /></td>
              <td><StatusCell value={transaction.userStatus} /></td>
              <td><StatusCell value={transaction.dateStatus} /></td>
              <td><StatusCell value={transaction.finalStatus ?? transaction.status} /></td>
              <td>{transaction.remark ?? "—"}</td>
              <td>
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

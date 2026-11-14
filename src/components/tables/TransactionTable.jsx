export default function TransactionTable({
  transactions,
  companies,
  settlementTargets,
  onSettlementChange,
}) {
  return (
    <div className="table-wrapper">
      <table className="transaction-table">
        <thead>
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
          {transactions.map((transaction) => (
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
              <td>{transaction.referenceStatus ?? "—"}</td>
              <td>{transaction.amountStatus ?? "—"}</td>
              <td>{transaction.userStatus ?? "—"}</td>
              <td>{transaction.dateStatus ?? "—"}</td>
              <td>{transaction.finalStatus ?? transaction.status ?? "—"}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

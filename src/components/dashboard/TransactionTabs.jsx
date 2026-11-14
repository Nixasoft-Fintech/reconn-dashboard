
import { useState } from "react";
import { Download } from "lucide-react";
import { transactionData } from "../data/dashboardData";
import TransactionTable from "../tables/TransactionTable";

export default function TransactionTabs({ companies }) {
  const [selectedSource, setSelectedSource] = useState("Fund Request");
  const [selectedStatus, setSelectedStatus] = useState("Matched");
  const [settlementTargets, setSettlementTargets] = useState({});
  const sourceTransactions = transactionData[selectedSource];
  const transactions = sourceTransactions.filter(
    (item) => item.status === selectedStatus,
  );

  const handleSettlementChange = (transactionId, company) => {
    setSettlementTargets((currentTargets) => ({
      ...currentTargets,
      [transactionId]: company,
    }));
  };

  const exportCSV = () => {
    const header = [
      "Transaction ID",
      "Row Number",
      "Reference Number",
      "Fund Request Amount",
      "User",
      "ACSMT Row",
      "ACSMT UTR",
      "ACSMT Reference Number",
      "ACSMT Amount",
      "ACSMT User",
      "ACSMT Date",
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
      item.accountRow ?? "",
      item.accountUtr ?? "",
      item.accountRefNumber ?? "",
      item.accountAmount ?? "",
      item.accountUser ?? "",
      item.accountDate ?? "",
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
          onClick={() => {
            setSelectedSource("Fund Request");
            setSelectedStatus("Matched");
          }}
        >
          Fund Request Matched
        </button>
        <button
          className={selectedSource === "Fund Request" && selectedStatus === "Unmatched" ? "tab active" : "tab"}
          onClick={() => {
            setSelectedSource("Fund Request");
            setSelectedStatus("Unmatched");
          }}
        >
          Fund Request Unmatched
        </button>
      
        <button
          className={selectedSource === "VA Transfer" && selectedStatus === "Matched" ? "tab active" : "tab"}
          onClick={() => {
            setSelectedSource("VA Transfer");
            setSelectedStatus("Matched");
          }}
        >
          VA Transfer Matched
        </button>
        <button
          className={selectedSource === "VA Transfer" && selectedStatus === "Unmatched" ? "tab active" : "tab"}
          onClick={() => {
            setSelectedSource("VA Transfer");
            setSelectedStatus("Unmatched");
          }}
        >
          VA Transfer Unmatched
        </button>
      
        <button
          className={selectedSource === "Account Statement" && selectedStatus === "Matched" ? "tab active" : "tab"}
          onClick={() => {
            setSelectedSource("Account Statement");
            setSelectedStatus("Matched");
          }}
        >
          Account Statement Matched
        </button>
        <button
          className={selectedSource === "Account Statement" && selectedStatus === "Unmatched" ? "tab active" : "tab"}
          onClick={() => {
            setSelectedSource("Account Statement");
            setSelectedStatus("Unmatched");
          }}
        >
          Account Statement Unmatched
        </button>
      </div>

      <div className="transaction-table-meta">
        <span>
          {transactions.length}{" "}
          {transactions.length === 1 ? "transaction" : "transactions"}
        </span>
        <span>Scroll horizontally to view all fields</span>
      </div>

      <TransactionTable
        transactions={transactions}
        companies={companies}
        settlementTargets={settlementTargets}
        onSettlementChange={handleSettlementChange}
      />
    </section>
  );
}

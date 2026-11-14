
import {
  Send,
  ArrowLeftRight,
  FileText,
  IndianRupee,
} from "lucide-react";

const icons = {
  send: Send,
  "arrow-left-right": ArrowLeftRight,
  "file-text": FileText,
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function SummaryCard({ item }) {
  const Icon = icons[item.icon];

  return (
    <div className="summary-card">
      <div className="summary-card-top">
        <span>{item.title}</span>

        <div className={`summary-icon ${item.color}`}>
          <Icon size={19} />
        </div>
      </div>

      <h2>{item.count.toLocaleString("en-IN")}</h2>

      <p className="summary-label">Total Transactions</p>

      <div className="summary-footer">
        <span>Total Value</span>
        <strong>{formatCurrency(item.value)}</strong>
      </div>
    </div>
  );
}


const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function ReconciliationCard({ item }) {
  const metrics = [
    {
      title: "Matched Count",
      value: item.matchedCount.toLocaleString("en-IN"),
      type: "matched",
    },
    {
      title: "Matched Value",
      value: formatCurrency(item.matchedValue),
      type: "matched",
    },
    {
      title: "Unmatched Count",
      value: item.unmatchedCount.toLocaleString("en-IN"),
      type: "unmatched",
    },
    {
      title: "Unmatched Value",
      value: formatCurrency(item.unmatchedValue),
      type: "unmatched",
    },
  ];

  return (
    <section className="source-reconciliation">
      <h3>{item.title}</h3>

      <div className="reconciliation-metrics">
        {metrics.map((metric) => (
          <div
            key={metric.title}
            className={`reconciliation-box ${metric.type}`}
          >
            <span>{metric.title}</span>
            <h2>{metric.value}</h2>
          </div>
        ))}
      </div>
    </section>
  );
}

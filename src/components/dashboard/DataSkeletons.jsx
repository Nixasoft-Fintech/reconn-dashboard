function SkeletonBar({ className = "" }) {
  return <span className={`data-skeleton-bar ${className}`} />;
}

export function SummarySkeleton() {
  return (
    <>
      <span className="visually-hidden" role="status">
        Loading transaction summary.
      </span>
      {Array.from({ length: 3 }, (_, index) => (
        <article className="summary-card data-skeleton-card" aria-hidden="true" key={index}>
          <div className="data-skeleton-top">
            <SkeletonBar className="data-skeleton-label" />
            <SkeletonBar className="data-skeleton-icon" />
          </div>
          <SkeletonBar className="data-skeleton-value" />
          <SkeletonBar className="data-skeleton-caption" />
          <div className="data-skeleton-footer">
            <SkeletonBar className="data-skeleton-label" />
            <SkeletonBar className="data-skeleton-footer-value" />
          </div>
        </article>
      ))}
    </>
  );
}

export function ReconciliationSkeleton() {
  return (
    <>
      <span className="visually-hidden" role="status">
        Loading reconciliation totals.
      </span>
      {Array.from({ length: 3 }, (_, cardIndex) => (
        <article
          className="source-reconciliation data-skeleton-card"
          aria-hidden="true"
          key={cardIndex}
        >
          <SkeletonBar className="data-skeleton-source-title" />
          <div className="data-skeleton-metrics">
            {Array.from({ length: 4 }, (_, metricIndex) => (
              <div className="data-skeleton-metric" key={metricIndex}>
                <SkeletonBar className="data-skeleton-metric-label" />
                <SkeletonBar className="data-skeleton-metric-value" />
              </div>
            ))}
          </div>
        </article>
      ))}
    </>
  );
}

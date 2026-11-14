const toNumber = (value) => Number(value ?? 0);

const sum = (...values) => values.reduce((total, value) => total + toNumber(value), 0);

export function getReconciliationCounts(summary) {
  const overall = summary?.overall ?? summary ?? {};

  return {
    sourceCount: toNumber(
      overall.total_source_records ?? overall.source_record_count,
    ),
    matchedCount: toNumber(
      overall.total_matched_records ?? overall.matched_count,
    ),
  };
}

export function getDashboardMetrics(summary) {
  const overall = summary?.overall ?? summary ?? {};
  const fundRequest =
    summary?.fund_request ?? summary?.by_source?.fund_request ?? {};
  const vaTransaction =
    summary?.va_transaction ?? summary?.by_source?.va_transaction ?? {};
  const fundRequestTotalValue =
    fundRequest.total_amount ??
    (fundRequest.total_records !== undefined
      ? sum(
          fundRequest.matched_amount,
          fundRequest.unmatched_amount,
          fundRequest.excluded_amount,
        )
      : fundRequest.eligible_source_amount ?? fundRequest.matched_amount);
  const vaTransactionTotalValue =
    vaTransaction.total_amount ??
    (vaTransaction.total_records !== undefined
      ? sum(vaTransaction.matched_amount, vaTransaction.unmatched_amount)
      : vaTransaction.eligible_source_amount ?? vaTransaction.matched_amount);
  const matchedCount = toNumber(
    overall.total_matched_records ?? overall.matched_count,
  );
  const matchedAmount = toNumber(
    overall.total_matched_amount ?? overall.matched_amount,
  );
  const unmatchedBankCount = toNumber(
    overall.total_unmatched_bank_records ?? overall.unmatched_bank_count,
  );
  const unmatchedBankAmount = toNumber(
    overall.total_unmatched_bank_amount ?? overall.unmatched_bank_amount,
  );
  const totalBankCount = toNumber(
    overall.total_bank_records ?? overall.bank_record_count,
  );

  return {
    summaryData: [
      {
        title: "Fund Request",
        count: toNumber(fundRequest.total_records ?? fundRequest.record_count),
        value: toNumber(fundRequestTotalValue),
        icon: "send",
        color: "blue",
      },
      {
        title: "VA Transfer",
        count: toNumber(vaTransaction.total_records ?? vaTransaction.record_count),
        value: toNumber(vaTransactionTotalValue),
        icon: "arrow-left-right",
        color: "purple",
      },
      {
        title: "Account Statement",
        count: totalBankCount,
        value: matchedAmount + unmatchedBankAmount,
        icon: "file-text",
        color: "orange",
      },
    ],
    reconciliationData: [
      {
        title: "Fund Request",
        matchedCount: toNumber(
          fundRequest.matched_records ?? fundRequest.matched_count,
        ),
        matchedValue: toNumber(fundRequest.matched_amount),
        unmatchedCount: toNumber(
          fundRequest.unmatched_records ??
            fundRequest.status_counts?.NOT_FOUND,
        ),
        unmatchedValue: toNumber(fundRequest.unmatched_amount),
      },
      {
        title: "VA Transfer",
        matchedCount: toNumber(
          vaTransaction.matched_records ?? vaTransaction.matched_count,
        ),
        matchedValue: toNumber(vaTransaction.matched_amount),
        unmatchedCount: toNumber(
          vaTransaction.unmatched_records ??
            vaTransaction.status_counts?.NOT_FOUND,
        ),
        unmatchedValue: toNumber(vaTransaction.unmatched_amount),
      },
      {
        title: "Account Statement",
        matchedCount,
        matchedValue: matchedAmount,
        unmatchedCount: unmatchedBankCount,
        unmatchedValue: unmatchedBankAmount,
      },
    ],
  };
}

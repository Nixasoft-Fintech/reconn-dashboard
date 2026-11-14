
export const summaryData = [
  {
    title: "Fund Transfer",
    count: 1250,
    value: 4580000,
    icon: "send",
    color: "blue",
  },
  {
    title: "VA Transfer",
    count: 980,
    value: 3240000,
    icon: "arrow-left-right",
    color: "purple",
  },
  {
    title: "Account Statement",
    count: 2450,
    value: 7820000,
    icon: "file-text",
    color: "orange",
  },
];


export const reconciliationData = [
  {
    title: "Fund Transfer",
    matchedCount: 1180,
    matchedValue: 4250000,
    unmatchedCount: 70,
    unmatchedValue: 330000,
  },
  {
    title: "VA Transfer",
    matchedCount: 900,
    matchedValue: 2940000,
    unmatchedCount: 80,
    unmatchedValue: 300000,
  },
  {
    title: "Account Statement",
    matchedCount: 2130,
    matchedValue: 7000000,
    unmatchedCount: 320,
    unmatchedValue: 820000,
  },
];


export const transactionData = {
  "Fund Transfer": [
    {
      id: "FR-10021",
      date: "14 Nov 2026",
      amount: 12500,
      status: "Matched",
    },
    {
      id: "FR-10022",
      date: "14 Nov 2026",
      amount: 8000,
      status: "Unmatched",
    },
  ],

  "VA Transfer": [
    {
      id: "VA-20021",
      date: "14 Nov 2026",
      amount: 5000,
      status: "Matched",
    },
    {
      id: "VA-20022",
      date: "14 Nov 2026",
      amount: 9500,
      status: "Unmatched",
    },
  ],

  "Account Statement": [
    {
      id: "ST-30021",
      date: "14 Nov 2026",
      amount: 12500,
      status: "Matched",
    },
    {
      id: "ST-30022",
      date: "14 Nov 2026",
      amount: 6000,
      status: "Unmatched",
    },
  ],
};

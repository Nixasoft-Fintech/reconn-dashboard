
import DashboardLayout from "../layout/DashboardLayout";
import Header from "../layout/Header";

import SummaryCard from "../dashboard/SummaryCard";
import ReconciliationCard from "../dashboard/ReconciliationCard";
import TransactionTabs from "../dashboard/TransactionTabs";

import {
  summaryData,
  reconciliationData,
} from "../data/dashboardData";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <Header />

      <section className="summary-grid">
        {summaryData.map((item) => (
          <SummaryCard key={item.title} item={item} />
        ))}
      </section>

     
<section className="reconciliation-grid">
  {reconciliationData.map((item) => (
    <ReconciliationCard key={item.title} item={item} />
  ))}
</section>


     

      <TransactionTabs />
    </DashboardLayout>
  );
}


import { useState } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import Header from "../layout/Header";

import SummaryCard from "../dashboard/SummaryCard";
import ReconciliationCard from "../dashboard/ReconciliationCard";
import TransactionTabs from "../dashboard/TransactionTabs";
import ReconciliationUploadModal from "../dashboard/ReconciliationUploadModal";

import {
  summaryData,
  reconciliationData,
} from "../data/dashboardData";

export default function Dashboard() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  return (
    <DashboardLayout>
      <Header onReconcileClick={() => setIsUploadModalOpen(true)} />

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
      <ReconciliationUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </DashboardLayout>
  );
}

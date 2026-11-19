import "../../css/SattlementsPage.css";

function SettlementCards({ count = 0 }) {
  return (
    <div className="settlement-cards">
        <h2>Active Settlements</h2>
            <p className="settlement-count">{count}</p>
    </div>
  )
}
                                                                                
export default SettlementCards
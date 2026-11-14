import { useState } from "react";
import { Plus } from "lucide-react";

export default function CompaniesPage({ companies, onAddCompany }) {
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const name = companyName.trim();

    if (!name) {
      setError("Enter a company name.");
      return;
    }

    if (companies.some((company) => company.name.toLowerCase() === name.toLowerCase())) {
      setError("This company has already been added.");
      return;
    }

    onAddCompany({
      id: `${Date.now()}-${companies.length + 1}`,
      name,
    });
    setCompanyName("");
    setError("");
    setIsAddingCompany(false);
  };

  return (
    <section className="utility-page">
      <header className="utility-page-header utility-page-header-row">
        <div>
          <h1>Settlement Companies</h1>
          <p>Manage the companies available for fund settlement.</p>
        </div>
        <button
          className="reconcile-button"
          type="button"
          onClick={() => {
            setIsAddingCompany((isAdding) => !isAdding);
            setError("");
          }}
        >
          <Plus size={16} />
          {isAddingCompany ? "Cancel" : "Add New Company"}
        </button>
      </header>

      {isAddingCompany && (
        <form className="company-form" onSubmit={handleSubmit}>
          <label>
            Company name
            <input
              autoComplete="organization"
              name="companyName"
              onChange={(event) => {
                setCompanyName(event.target.value);
                setError("");
              }}
              placeholder="Enter company name"
              required
              value={companyName}
            />
          </label>
          <button className="upload-modal-submit" type="submit">
            Add Company
          </button>
          {error && (
            <p className="company-form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}

      <div className="utility-page-card">
        <div className="table-wrapper">
          <table className="transaction-table companies-table">
            <thead>
              <tr>
                <th>Serial No.</th>
                <th>Company Name</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={2}>
                    No settlement companies are available yet.
                  </td>
                </tr>
              ) : (
                companies.map((company, index) => (
                  <tr key={company.id}>
                    <td>{index + 1}</td>
                    <td>{company.name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="session-note">
          Companies added here are available in unmatched transaction
          settlement dropdowns for this browser session.
        </p>
      </div>
    </section>
  );
}

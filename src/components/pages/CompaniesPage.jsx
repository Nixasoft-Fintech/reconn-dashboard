import { useCallback, useEffect, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { createCompany, getCompanies } from "../../services/companyApi";

/**
 * Format created_at date into readable format (e.g., "17 Nov 2026")
 * using the application's existing en-GB date convention.
 */
function formatCreatedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function CompaniesPage({ onNotify, onAddCompany }) {
  // Form state
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // List state
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [fetchVersion, setFetchVersion] = useState(0);

  // Standalone toast fallback in case onNotify is not provided by parent
  const [localToast, setLocalToast] = useState(null);

  const notify = useCallback(
    (type, message) => {
      if (typeof onNotify === "function") {
        onNotify(type, message);
      } else {
        setLocalToast({ type, message });
      }
    },
    [onNotify],
  );

  useEffect(() => {
    if (!localToast) return undefined;
    const timeoutId = window.setTimeout(() => setLocalToast(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [localToast]);

  // Fetch companies listing from GET /api/companies
  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;

    getCompanies({ page: 1, limit: 100, signal: controller.signal })
      .then((response) => {
        if (!isCurrent) return;
        const items = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response)
          ? response
          : [];
        setCompanies(items);
        setFetchError("");
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isCurrent || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Unable to load companies.";
        setFetchError(message);
        setIsLoading(false);
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [fetchVersion]);

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setFetchError("");
    setFetchVersion((v) => v + 1);
  }, []);

  // Handle Add Company form submit
  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedAlias = alias.trim();

    // Validate that both fields are provided
    if (!trimmedName || !trimmedAlias) {
      let errorMsg;
      if (!trimmedName && !trimmedAlias) {
        errorMsg = "Both Company Name and Company Nickname are required.";
      } else if (!trimmedName) {
        errorMsg = "Company Name is required.";
      } else {
        errorMsg = "Company Nickname is required.";
      }
      setFormError(errorMsg);
      notify("error", errorMsg);
      return;
    }

    setFormError("");
    setIsSubmitting(true);

    try {
      const createdCompany = await createCompany({
        name: trimmedName,
        alias: trimmedAlias,
      });

      // Reset form after successful creation
      setName("");
      setAlias("");
      setFormError("");

      // Show success notification
      const successMessage = `Company "${createdCompany?.name || trimmedName}" created successfully.`;
      notify("success", successMessage);

      // Notify parent if callback provided
      if (typeof onAddCompany === "function") {
        onAddCompany(createdCompany);
      }

      // Refresh company listing
      setIsLoading(true);
      setFetchError("");
      setFetchVersion((v) => v + 1);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to create company. Please try again.";
      setFormError(message);
      notify("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="utility-page" aria-labelledby="company-page-title">
      <header className="utility-page-header utility-page-header-row">
        <div>
          <span className="page-kicker">COMPANY MANAGEMENT</span>
          <h1 id="company-page-title">Company Management</h1>
          <p>Register and manage companies for settlement and reconciliation.</p>
        </div>
      </header>

      {/* Add Company Form */}
      <form
        className="company-form"
        onSubmit={handleSubmit}
        noValidate
        aria-label="Add Company Form"
      >
        <label htmlFor="company-name-input">
          Company Name
          <input
            id="company-name-input"
            autoComplete="organization"
            disabled={isSubmitting}
            name="name"
            onChange={(event) => {
              setName(event.target.value);
              if (formError) setFormError("");
            }}
            placeholder="e.g. Acme Corp"
            required
            type="text"
            value={name}
          />
        </label>

        <label htmlFor="company-alias-input">
          Company Nickname
          <input
            id="company-alias-input"
            autoComplete="off"
            disabled={isSubmitting}
            name="alias"
            onChange={(event) => {
              setAlias(event.target.value);
              if (formError) setFormError("");
            }}
            placeholder="e.g. ACME"
            required
            type="text"
            value={alias}
          />
        </label>

        <button
          className="upload-modal-submit"
          disabled={isSubmitting}
          type="submit"
        >
          <Plus size={16} aria-hidden="true" />
          {isSubmitting ? "Adding..." : "Add Company"}
        </button>

        {formError && (
          <p className="company-form-error" role="alert">
            {formError}
          </p>
        )}
      </form>

      {/* Companies Listing Card */}
      <div className="utility-page-card" aria-busy={isLoading}>
        {fetchError && (
          <div className="company-error-banner" role="alert">
            <span>Could not load companies: {fetchError}</span>
            <button
              type="button"
              onClick={handleRetry}
              aria-label="Retry loading companies"
            >
              <RotateCcw size={14} aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        <div className="table-wrapper">
          <table
            className="transaction-table companies-table"
            aria-label="Registered companies list"
          >
            <thead>
              <tr>
                <th scope="col">Company Name</th>
                <th scope="col">Created At</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }, (_, index) => (
                  <tr
                    className="transaction-skeleton-row"
                    key={`skeleton-row-${index}`}
                  >
                    <td>
                      <span
                        className="transaction-skeleton-cell"
                        style={{ width: "55%", minHeight: "16px" }}
                      />
                    </td>
                    <td>
                      <span
                        className="transaction-skeleton-cell"
                        style={{ width: "35%", minHeight: "16px" }}
                      />
                    </td>
                  </tr>
                ))
              ) : fetchError ? (
                <tr>
                  <td
                    className="table-empty-state"
                    colSpan={2}
                    style={{ textAlign: "center", padding: "28px 16px" }}
                  >
                    <p style={{ marginBottom: "12px" }}>
                      Failed to load companies: {fetchError}
                    </p>
                    <button
                      className="reconcile-button"
                      type="button"
                      onClick={handleRetry}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      Retry
                    </button>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td
                    className="table-empty-state"
                    colSpan={2}
                    style={{
                      textAlign: "center",
                      padding: "28px 16px",
                      color: "var(--ink-soft)",
                    }}
                  >
                    No companies found. Use the form above to add your first company.
                  </td>
                </tr>
              ) : (
                companies.map((company) => {
                  const companyKey =
                    company.company_id ||
                    `${company.name}-${company.created_at}`;
                  const createdDate = company.created_at
                    ? new Date(company.created_at)
                    : null;
                  const isValidDate =
                    createdDate && !Number.isNaN(createdDate.getTime());

                  return (
                    <tr key={companyKey}>
                      <td>{company.name}</td>
                      <td>
                        {isValidDate ? (
                          <time
                            dateTime={createdDate.toISOString()}
                            title={createdDate.toLocaleString()}
                          >
                            {formatCreatedAt(company.created_at)}
                          </time>
                        ) : (
                          formatCreatedAt(company.created_at)
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Standalone toast when onNotify is not passed */}
      {localToast && (
        <div
          className={`app-toast app-toast-${localToast.type}`}
          role={localToast.type === "error" ? "alert" : "status"}
          aria-live={localToast.type === "error" ? "assertive" : "polite"}
        >
          <span>{localToast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setLocalToast(null)}
            type="button"
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}

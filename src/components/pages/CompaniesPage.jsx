import { useCallback, useEffect, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import {
  createCompany,
  deletecompany,
  getCompanies,
  updateCompany,
} from "../../services/companyApi";
import "../../index.css";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function CompaniesPage({ onNotify, onAddCompany }) {
  // Add form state
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // List state
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [fetchVersion, setFetchVersion] = useState(0);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [total, setTotal] = useState(null); // backend total na de to null rahega

  // Edit state
  const [editCompany, setEditCompany] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAlias, setEditAlias] = useState("");
  const [editError, setEditError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Delete state
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);

  // Standalone toast fallback
  const [localToast, setLocalToast] = useState(null);

  const notify = useCallback(
    (type, message) => {
      if (typeof onNotify === "function") {
        onNotify(type, message);
      } else {
        setLocalToast({ type, message });
      }
    },
    [onNotify]
  );

  // Auto-dismiss local toast
  useEffect(() => {
    if (!localToast) return undefined;

    const timeoutId = window.setTimeout(() => setLocalToast(null), 5000);

    return () => window.clearTimeout(timeoutId);
  }, [localToast]);

  // Companies fetch (current page + limit ke hisaab se)
  const fetchCompanies = useCallback(
    async (signal) => {
      try {
        const response = await getCompanies({ page, limit, signal });

        const items = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response)
            ? response
            : [];

        // Page khaali aaya (jaise last page ka last item delete hua) -> pichle page par jao
        if (items.length === 0 && page > 1) {
          setPage((p) => Math.max(1, p - 1));
          return;
        }

        const rawTotal =
          response?.total ??
          response?.totalCount ??
          response?.total_count ??
          response?.pagination?.total ??
          null;
        const parsedTotal = Number(rawTotal);

        setCompanies(items);
        setTotal(
          rawTotal !== null && Number.isFinite(parsedTotal) ? parsedTotal : null
        );
        setFetchError("");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        setFetchError(
          err instanceof Error ? err.message : "Unable to load companies."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [page, limit]
  );

  // Initial load + page/limit change + retry/add ke baad reload
  useEffect(() => {
    const controller = new AbortController();

    fetchCompanies(controller.signal);

    return () => controller.abort();
  }, [fetchCompanies, fetchVersion]);

  // Pagination helpers
  const totalPages =
    total !== null ? Math.max(1, Math.ceil(total / limit)) : null;
  const hasPrev = page > 1;
  const hasNext =
    totalPages !== null ? page < totalPages : companies.length === limit;

  const rangeStart = companies.length === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = (page - 1) * limit + companies.length;

  const goToPage = (nextPage) => {
    if (nextPage === page || nextPage < 1) return;
    setIsLoading(true);
    setPage(nextPage);
  };

  const handleLimitChange = (event) => {
    setIsLoading(true);
    setLimit(Number(event.target.value));
    setPage(1);
  };

  // Retry loading companies
  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setFetchError("");
    setFetchVersion((v) => v + 1);
  }, []);

  // Delete
  const handleDeleteCompany = async (company) => {
    if (!company?.company_id) {
      notify("error", "Company ID is missing.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${company.name}"?`
    );
    if (!confirmed) return;

    setIsDeletingCompany(true);

    try {
      await deletecompany({ companyId: company.company_id });

      notify("success", `Company "${company.name}" deleted successfully.`);

      // Current page refresh (khaali ho gaya to fetchCompanies pichle page par le jayega)
      await fetchCompanies();
    } catch (error) {
      console.error("Delete company failed:", error);
      notify("error", error?.message || "Failed to delete company.");
    } finally {
      setIsDeletingCompany(false);
    }
  };

  // Edit: modal kholo
  const handleEditCompany = (company) => {
    setEditCompany(company);
    setEditName(company.name || "");
    setEditAlias(company.alias || "");
    setEditError("");
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (isUpdating) return;
    setShowEditModal(false);
    setEditCompany(null);
    setEditName("");
    setEditAlias("");
    setEditError("");
  };

  // Edit: save
  const handleUpdateCompany = async (event) => {
    event.preventDefault();

    const trimmedName = editName.trim();
    const trimmedAlias = editAlias.trim();

    if (!trimmedName) {
      setEditError("Company Name is required.");
      return;
    }

    if (!editCompany?.company_id) {
      setEditError("Company ID is missing.");
      return;
    }

    // Kuch change nahi hua to API call mat karo
    if (
      trimmedName === (editCompany.name || "") &&
      trimmedAlias === (editCompany.alias || "")
    ) {
      closeEditModal();
      return;
    }

    setIsUpdating(true);
    setEditError("");

    try {
      await updateCompany({
        companyId: editCompany.company_id,
        name: trimmedName,
        alias: trimmedAlias, // backend null maange to: trimmedAlias || null
      });

      notify("success", `Company "${trimmedName}" updated successfully.`);
      setShowEditModal(false);
      setEditCompany(null);

      await fetchCompanies();
    } catch (error) {
      const message = error?.message || "Failed to update company.";
      setEditError(message);
      notify("error", message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Add Company form submit
  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedAlias = alias.trim();

    if (!trimmedName) {
      const errorMsg = "Company Name is required.";
      setFormError(errorMsg);
      notify("error", errorMsg);
      return;
    }

    setFormError("");
    setIsSubmitting(true);

    try {
      const createdCompany = await createCompany({
        name: trimmedName,
        ...(trimmedAlias && { alias: trimmedAlias }),
      });

      setName("");
      setAlias("");
      setFormError("");

      notify(
        "success",
        `Company "${createdCompany?.name || trimmedName}" created successfully.`
      );

      if (typeof onAddCompany === "function") {
        onAddCompany(createdCompany);
      }

      // Refresh listing (page 1 par wapas)
      setIsLoading(true);
      setFetchError("");
      setPage(1);
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
                <th scope="col">Company Nickname</th>
                <th scope="col">Actions</th>
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
                    <td>
                      <span
                        className="transaction-skeleton-cell"
                        style={{ width: "40%", minHeight: "16px" }}
                      />
                    </td>
                  </tr>
                ))
              ) : fetchError ? (
                <tr>
                  <td
                    className="table-empty-state"
                    colSpan={3}
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
                    colSpan={3}
                    style={{
                      textAlign: "center",
                      padding: "28px 16px",
                      color: "var(--ink-soft)",
                    }}
                  >
                    No companies found. Use the form above to add your first
                    company.
                  </td>
                </tr>
              ) : (
                companies.map((company) => {
                  const companyKey =
                    company.company_id ||
                    `${company.name}-${company.alias || "company"}`;

                  return (
                    <tr key={companyKey}>
                      <td>{company.name || "-"}</td>
                      <td>{company.alias?.trim() || "-"}</td>
                      <td className="companies-table-actions">
                        <button
                          className="reconcile-button"
                          type="button"
                          onClick={() => handleEditCompany(company)}
                          disabled={isDeletingCompany}
                        >
                          Edit
                        </button>

                        <button
                          className="reconcile-button"
                          type="button"
                          onClick={() => handleDeleteCompany(company)}
                          disabled={isDeletingCompany}
                        >
                          {isDeletingCompany ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!fetchError && (companies.length > 0 || page > 1) && (
          <nav
            aria-label="Companies pagination"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "14px 4px 4px",
            }}
          >
            <span style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>
              {total !== null
                ? `Showing ${rangeStart}-${rangeEnd} of ${total}`
                : `Page ${page}`}
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label
                htmlFor="companies-page-size"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                Rows
                <select
                  id="companies-page-size"
                  value={limit}
                  onChange={handleLimitChange}
                  disabled={isLoading}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="reconcile-button"
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={!hasPrev || isLoading}
              >
                Previous
              </button>

              <span aria-live="polite">
                {totalPages !== null ? `Page ${page} of ${totalPages}` : `Page ${page}`}
              </span>

              <button
                className="reconcile-button"
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={!hasNext || isLoading}
              >
                Next
              </button>
            </div>
          </nav>
        )}
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

      {/* Edit Company Modal */}
      {/* Edit Company Modal */}
{showEditModal && (
  <div
    className="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-company-title"
    onClick={closeEditModal}
  >
    <form
      className="modal-card"
      onSubmit={handleUpdateCompany}
      onClick={(e) => e.stopPropagation()}
      noValidate
    >
      <h2 className="modal-title" id="edit-company-title">
        Edit Company
      </h2>
      <p className="modal-subtitle">
        Update the company name or nickname.
      </p>

      <label className="modal-field" htmlFor="edit-company-name">
        Company Name
        <input
          id="edit-company-name"
          type="text"
          value={editName}
          disabled={isUpdating}
          autoFocus
          onChange={(e) => {
            setEditName(e.target.value);
            if (editError) setEditError("");
          }}
        />
      </label>

      <label className="modal-field" htmlFor="edit-company-alias">
        Company Nickname
        <input
          id="edit-company-alias"
          type="text"
          value={editAlias}
          disabled={isUpdating}
          onChange={(e) => {
            setEditAlias(e.target.value);
            if (editError) setEditError("");
          }}
        />
      </label>

      {editError && (
        <p className="company-form-error" role="alert">
          {editError}
        </p>
      )}

      <div className="modal-actions">
        <button
          className="reconcile-button"
          type="button"
          onClick={closeEditModal}
          disabled={isUpdating}
        >
          Cancel
        </button>

        <button
          className="upload-modal-submit"
          type="submit"
          disabled={isUpdating}
        >
          {isUpdating ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  </div>
)}
    </section>
  );
}

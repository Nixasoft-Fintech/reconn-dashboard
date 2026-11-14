import { useState } from "react";
import { FileText, Upload, X } from "lucide-react";

function formatFileSize(size) {
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadStep({
  step,
  title,
  description,
  files,
  onAddFiles,
  onRemoveFile,
}) {
  return (
    <section className="upload-step">
      <div className="upload-step-heading">
        <span className="upload-step-number">{step}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <label className="upload-picker">
        <input
          type="file"
          accept=".csv,.xls,.xlsx"
          multiple
          onChange={(event) => {
            onAddFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <Upload size={18} />
        <span>Choose files</span>
        <small>CSV, XLS, XLSX · Multiple files allowed</small>
      </label>

      {files.length > 0 && (
        <ul className="selected-files">
          {files.map((file, index) => (
            <li
              className="selected-file"
              key={`${file.name}-${file.lastModified}-${index}`}
            >
              <FileText size={17} />
              <span className="selected-file-details">
                <span className="selected-file-name">{file.name}</span>
                <span className="selected-file-size">
                  {formatFileSize(file.size)}
                </span>
              </span>
              <button
                className="remove-file-button"
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemoveFile(index)}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ReconciliationUploadModal({ isOpen, onClose }) {
  const [vaFiles, setVaFiles] = useState([]);
  const [fundFiles, setFundFiles] = useState([]);
  const [statementFiles, setStatementFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);

  const canSubmit =
    vaFiles.length > 0 && fundFiles.length > 0 && statementFiles.length > 0;

  const addFiles = (setFiles, newFiles) => {
    setFiles((currentFiles) => [...currentFiles, ...newFiles]);
  };
  const removeFile = (setFiles, indexToRemove) => {
    setFiles((currentFiles) =>
      currentFiles.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setResult(null);

    if (!canSubmit) {
      setSubmitError("Select at least one file in each section.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      fundFiles.forEach((file) => formData.append("fund_request_file", file));
      vaFiles.forEach((file) => formData.append("va_transaction_file", file));
      statementFiles.forEach((file) =>
        formData.append("bank_statement_file", file),
      );

      const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiBaseUrl}/api/reconcile`, {
        method: "POST",
        body: formData,
      });
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.detail || "Reconciliation submission failed.",
        );
      }

      setResult(responseData);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to submit reconciliation files.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="upload-modal-backdrop">
      <form
        className="upload-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        onSubmit={handleSubmit}
      >
        <header className="upload-modal-header">
          <div>
            <span className="upload-modal-eyebrow">TRANSACTION MATCHING</span>
            <h2 id="upload-modal-title">Reconcile transactions</h2>
            <p>Add the files in the order shown to prepare a reconciliation.</p>
          </div>
          <button
            className="upload-modal-close"
            type="button"
            aria-label="Close reconciliation upload"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <div className="upload-modal-content">
          <UploadStep
            step="01"
            title="VA Transaction"
            description="Select one or more VA transaction files."
            files={vaFiles}
            onAddFiles={(files) => addFiles(setVaFiles, files)}
            onRemoveFile={(index) => removeFile(setVaFiles, index)}
          />
          <UploadStep
            step="02"
            title="Fund Request"
            description="Select one or more fund request files."
            files={fundFiles}
            onAddFiles={(files) => addFiles(setFundFiles, files)}
            onRemoveFile={(index) => removeFile(setFundFiles, index)}
          />
          <UploadStep
            step="03"
            title="Account Statement"
            description="Select one or more account statement files."
            files={statementFiles}
            onAddFiles={(files) => addFiles(setStatementFiles, files)}
            onRemoveFile={(index) => removeFile(setStatementFiles, index)}
          />
          {submitError && (
            <p className="upload-submit-error" role="alert">
              {submitError}
            </p>
          )}
          {result && (
            <p className="upload-submit-success" role="status">
              Reconciliation completed: {result.summary.source_record_count}{" "}
              source transactions processed, {result.summary.matched_count}{" "}
              matched.
            </p>
          )}
        </div>

        <footer className="upload-modal-footer">
          <p>
            {canSubmit
              ? "All three file types are ready to submit."
              : "Select at least one file in each section to submit."}
          </p>
          <div className="upload-modal-actions">
            <button
              className="upload-modal-done"
              type="button"
              onClick={onClose}
            >
              Close
            </button>
            <button
              className="upload-modal-submit"
              type="submit"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

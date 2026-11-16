import { useState } from "react";
import { FileText, MousePointerClick, Upload, X } from "lucide-react";
import { getReconciliationCounts } from "../../utils/reconciliation";
import { submitReconciliation } from "../../services/reconciliationApi";

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
  disabled,
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
          disabled={disabled}
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
                disabled={disabled}
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

function UploadProgressOverlay({ progress }) {
  const isAwaitingResult = progress >= 100;

  return (
    <div className="upload-progress-overlay">
      <section className="upload-progress-panel" aria-busy="true">
        <div className="upload-progress-visual" aria-hidden="true">
          <div className="upload-animation-scene">
            <span className="upload-animation-orbit upload-animation-orbit-one" />
            <span className="upload-animation-orbit upload-animation-orbit-two" />
            <div className="upload-animation-sheet upload-animation-sheet-back">
              <FileText size={22} />
            </div>
            <div className="upload-animation-sheet upload-animation-sheet-front">
              <FileText size={22} />
            </div>
            <div className="upload-animation-target">
              <Upload size={24} />
            </div>
            <span className="upload-animation-ripple" />
            <div className="upload-animation-pointer">
              <MousePointerClick size={37} />
            </div>
          </div>
          <span className="upload-progress-visual-label">SECURE DATA TRANSFER</span>
        </div>

        <div className="upload-progress-content">
          <div className="upload-progress-heading">
            <span className="upload-modal-eyebrow">RECONCILIATION IN PROGRESS</span>
            <h2>
              {isAwaitingResult ? "Upload complete" : "Uploading your files"}
            </h2>
            <p>
              {isAwaitingResult
                ? "Your files are in. We’re getting the reconciliation ready."
                : "Your files are on their way. Keep this window open for just a moment."}
            </p>
          </div>

          <ul className="upload-progress-sources" aria-label="Files included">
            {["VA transactions", "Fund requests", "Account statements"].map(
              (label) => (
                <li className="upload-progress-source" key={label}>
                  <FileText size={15} aria-hidden="true" />
                  {label}
                </li>
              ),
            )}
          </ul>

          <div
            className="upload-progress-status"
            role="status"
            aria-live="polite"
          >
            <span className="upload-progress-status-dot" aria-hidden="true" />
            {isAwaitingResult
              ? "Preparing your reconciliation"
              : "Sending your files securely"}
            <span className="upload-progress-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ReconciliationUploadModal({
  isOpen,
  onClose,
  onSubmitted,
}) {
  const [vaFiles, setVaFiles] = useState([]);
  const [fundFiles, setFundFiles] = useState([]);
  const [statementFiles, setStatementFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
    setUploadProgress(0);

    try {
      const responseData = await submitReconciliation({
        fundFiles,
        vaFiles,
        statementFiles,
        onUploadProgress: setUploadProgress,
      });
      if (typeof responseData.job_id !== "string" || !responseData.job_id) {
        throw new Error("The reconciliation API response did not include a job ID.");
      }

      setUploadProgress(100);
      setResult(responseData);
      onSubmitted({
        jobId: responseData.job_id,
        submittedAt: new Date().toISOString(),
        files: [
          ...vaFiles.map((file) => ({ type: "VA Transaction", file })),
          ...fundFiles.map((file) => ({ type: "Fund Request", file })),
          ...statementFiles.map((file) => ({
            type: "Account Statement",
            file,
          })),
        ],
        result: responseData,
      });
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
        aria-busy={isSubmitting}
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
            onAddFiles={(files) => addFiles(setVaFiles, files)}
            onRemoveFile={(index) => removeFile(setVaFiles, index)}
          />
          <UploadStep
            step="02"
            title="Fund Request"
            description="Select one or more fund request files."
            files={fundFiles}
            disabled={isSubmitting}
            onAddFiles={(files) => addFiles(setFundFiles, files)}
            onRemoveFile={(index) => removeFile(setFundFiles, index)}
          />
          <UploadStep
            step="03"
            title="Account Statement"
            description="Select one or more account statement files."
            files={statementFiles}
            disabled={isSubmitting}
            onAddFiles={(files) => addFiles(setStatementFiles, files)}
            onRemoveFile={(index) => removeFile(setStatementFiles, index)}
          />
          {submitError && (
            <p className="upload-submit-error" role="alert">
              {submitError}
            </p>
          )}
          {result && (
            <ReconciliationSuccess result={result} />
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
              disabled={isSubmitting}
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
        {isSubmitting && (
          <UploadProgressOverlay progress={uploadProgress} />
        )}
      </form>
    </div>
  );
}

function ReconciliationSuccess({ result }) {
  const { sourceCount, matchedCount } = getReconciliationCounts(result.summary);

  return (
    <p className="upload-submit-success" role="status">
      Reconciliation completed: {matchedCount} of {sourceCount} source
      transactions matched.
    </p>
  );
}

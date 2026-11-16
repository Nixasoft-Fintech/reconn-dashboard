import { FileText } from "lucide-react";
import { getUploadedFiles } from "./uploadedFiles";

function formatRowCount(value) {
  const count = Number(value);
  return value == null || !Number.isFinite(count)
    ? "—"
    : count.toLocaleString("en-IN");
}

export default function HistoryFiles({ record }) {
  const files = getUploadedFiles(record);

  if (files.length === 0) {
    return <p className="history-no-files">No uploaded files recorded.</p>;
  }

  return (
    <ul className="history-file-list" aria-label="Uploaded files">
      {files.map((file, index) => {
        const metadata = [
          file.format && ["Format", file.format],
          file.accountHolder && ["Account holder", file.accountHolder],
          file.accountNumber && ["Account number", file.accountNumber],
          file.transactionCount != null && [
            "Rows",
            formatRowCount(file.transactionCount),
          ],
        ].filter(Boolean);

        return (
          <li
            className="history-file-card"
            key={`${file.type}-${file.bankName ?? ""}-${file.name}-${index}`}
          >
            <span className="history-file-icon" aria-hidden="true">
              <FileText size={17} />
            </span>
            <div className="history-file-content">
              <p className="history-file-type">
                {file.bankName
                  ? `${file.bankName} · ${file.type}`
                  : file.type}
              </p>
              <p className="history-file-name">{file.name}</p>
              {metadata.length > 0 && (
                <dl className="history-file-meta">
                  {metadata.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

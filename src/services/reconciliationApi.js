// Keep API URL construction centralized so every endpoint uses the same base URL.
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

// Map UI source names to API paths; exportTransactionsCsv uses this for every transaction tab.
const transactionExportPaths = {
  "Fund Request": "fund-requests",
  "VA Transfer": "va-transactions",
  "Account Statement": "bank-transactions",
};

// Parse JSON responses, report API errors consistently, and reject malformed success responses.
async function readResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(", ")
      : detail;

    throw new Error(message || `Request failed (${response.status}).`);
  }

  if (!data || typeof data !== "object") {
    throw new Error("The reconciliation API returned an invalid response.");
  }

  return data;
}

// CSV endpoints may return JSON, plain-text, or HTML errors; avoid exposing raw HTML to the UI.
async function getExportErrorMessage(response) {
  const body = await response.text();
  const fallbackMessage = `Request failed (${response.status}).`;

  if (!body) {
    return fallbackMessage;
  }

  try {
    const data = JSON.parse(body);
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(", ")
      : detail;

    return message || fallbackMessage;
  } catch {
    const message = body.trim();
    return message.startsWith("<") ? fallbackMessage : message;
  }
}

// Prefer the server-provided download name, but fall back to a safe local filename.
function getExportFilename(response, fallbackFilename) {
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const encodedFilename = contentDisposition.match(
    /filename\*=UTF-8''([^;]+)/i,
  )?.[1];
  const plainFilename = contentDisposition.match(
    /filename="?([^";]+)"?/i,
  )?.[1];
  let filename = plainFilename;

  if (encodedFilename) {
    try {
      filename = decodeURIComponent(encodedFilename);
    } catch {
      filename = plainFilename;
    }
  }

  return filename?.split(/[\\/]/).pop() || fallbackFilename;
}

/**
 * Upload reconciliation files and report upload progress when a callback is provided.
 * XMLHttpRequest is used because it exposes upload progress events; the resolved value
 * is the parsed reconciliation response, and network/API failures reject the promise.
 */
export async function submitReconciliation({
  fundFiles,
  vaFiles,
  statementFiles,
  onUploadProgress,
}) {
  const formData = new FormData();
  fundFiles.forEach((file) => formData.append("fund_request_file", file));
  vaFiles.forEach((file) => formData.append("va_transaction_file", file));
  statementFiles.forEach((file) =>
    formData.append("bank_statement_file", file),
  );

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${apiBaseUrl}/api/reconcile`);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onUploadProgress) {
        onUploadProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        );
      }
    });
    request.addEventListener("load", () => {
      let data;
      try {
        data = JSON.parse(request.responseText);
      } catch {
        if (request.status >= 200 && request.status < 300) {
          reject(
            new Error("The reconciliation API returned an invalid response."),
          );
          return;
        }
      }

      if (request.status < 200 || request.status >= 300) {
        const detail = data?.detail;
        const message = Array.isArray(detail)
          ? detail.map((item) => item.msg).join(", ")
          : detail;
        reject(new Error(message || `Request failed (${request.status}).`));
        return;
      }

      if (!data || typeof data !== "object") {
        reject(
          new Error("The reconciliation API returned an invalid response."),
        );
        return;
      }

      resolve(data);
    });
    request.addEventListener("error", () => {
      reject(new Error("Network error while uploading reconciliation files."));
    });
    request.addEventListener("abort", () => {
      reject(new Error("The reconciliation file upload was aborted."));
    });
    request.send(formData);
  });
}

/** Fetch the latest processing summary for a reconciliation job. */
export async function getReconciliationSummary(jobId, { signal } = {}) {
  const response = await fetch(
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/summary`,
    { signal },
  );

  return readResponse(response);
}

/** Fetch a page of reconciliation jobs; the history screen requests up to 100 by default. */
export async function getReconciliationHistory({
  page = 1,
  limit = 100,
  signal,
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const response = await fetch(
    `${apiBaseUrl}/api/reconciliation/history?${params}`,
    { signal },
  );

  return readResponse(response);
}

/** Fetch full details for one history job, identified by its job ID. */
export async function getReconciliationHistoryDetails(jobId, { signal } = {}) {
  const response = await fetch(
    `${apiBaseUrl}/api/reconciliation/history/${encodeURIComponent(jobId)}`,
    { signal },
  );

  return readResponse(response);
}

/**
 * Fetch a paginated fund-request transaction list.
 * NOT_FOUND is the default so callers can omit status when they need unmatched records.
 */
export async function getFundRequests(
  jobId,
  { status = "NOT_FOUND", page = 1, limit = 100, signal } = {},
) {
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
  });
  const response = await fetch(
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/fund-requests?${params}`,
    { signal },
  );

  return readResponse(response);
}

/** Fetch a paginated VA transaction list; status, paging, and cancellation are configurable. */
export async function getVaTransactions(
  jobId,
  { status = "NOT_FOUND", page = 1, limit = 100, signal } = {},
) {
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
  });
  const response = await fetch(
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/va-transactions?${params}`,
    { signal },
  );

  return readResponse(response);
}

/** Fetch a paginated bank-statement transaction list; status, paging, and cancellation are configurable. */
export async function getBankTransactions(
  jobId,
  { status = "NOT_FOUND", page = 1, limit = 100, signal } = {},
) {
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
  });
  const response = await fetch(
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/bank-transactions?${params}`,
    { signal },
  );

  return readResponse(response);
}

/**
 * Download a CSV for the selected job, transaction source, and status.
 * Returns a Blob and the server filename (or a generated fallback) for the UI to download.
 */
export async function exportTransactionsCsv(
  jobId,
  { source, status, signal } = {},
) {
  const exportPath = transactionExportPaths[source];
  if (!exportPath) {
    throw new Error("Choose a valid transaction source to export.");
  }
  if (!jobId) {
    throw new Error("Run a reconciliation before exporting transactions.");
  }
  if (!status) {
    throw new Error("Choose a transaction status before exporting.");
  }

  const params = new URLSearchParams({ status });
  const response = await fetch(
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/${exportPath}/export?${params}`,
    {
      signal,
      headers: { Accept: "text/csv" },
    },
  );

  if (!response.ok) {
    throw new Error(await getExportErrorMessage(response));
  }

  const fallbackFilename = `${exportPath}-${status
    .toLowerCase()
    .replaceAll("_", "-")}.csv`;

  return {
    blob: await response.blob(),
    filename: getExportFilename(response, fallbackFilename),
  };
}

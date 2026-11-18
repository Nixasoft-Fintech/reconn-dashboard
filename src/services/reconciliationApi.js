
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const transactionExportPaths = {
  "Fund Request": "fund-requests",
  "VA Transfer": "va-transactions",
  "Account Statement": "bank-transactions",
};

const MAX_RETRIES = 2;
const BASE_RETRY_DELAY = 500;

let requestCounter = 0;
let streamCounter = 0;

// ============================================================
// COMMON HELPERS
// ============================================================

function getRequestId() {
  requestCounter += 1;
  return `API-${requestCounter}`;
}

function getTimestamp() {
  return new Date().toISOString();
}

function getDuration(startTime) {
  return `${Date.now() - startTime}ms`;
}

function getReadyStateName(readyState) {
  switch (readyState) {
    case EventSource.CONNECTING:
      return "CONNECTING";
    case EventSource.OPEN:
      return "OPEN";
    case EventSource.CLOSED:
      return "CLOSED";
    default:
      return `UNKNOWN (${readyState})`;
  }
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Request aborted.", "AbortError"));
      return;
    }

    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);

    function handleAbort() {
      clearTimeout(timeout);
      reject(new DOMException("Request aborted.", "AbortError"));
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function getRetryDelay(response, attempt) {
  const retryAfter = response?.headers?.get("Retry-After");

  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 10000);
    }

    const retryDate = Date.parse(retryAfter);

    if (!Number.isNaN(retryDate)) {
      return Math.min(Math.max(retryDate - Date.now(), 0), 10000);
    }
  }

  return BASE_RETRY_DELAY * (2 ** attempt);
}

function isRetryableStatus(status) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function isNetworkError(error) {
  return (
    error instanceof TypeError ||
    error?.name === "NetworkError"
  );
}

// ============================================================
// API RESPONSE HANDLING
// ============================================================

async function readResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;

    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(", ")
      : detail;

    throw new Error(
      message || `Request failed (${response.status}).`
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error(
      "The reconciliation API returned an invalid response."
    );
  }

  return data;
}

// ============================================================
// CENTRALIZED REQUEST WITH RETRY
// ============================================================

async function requestJson(label, url, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  // Automatically retry only safe GET requests.
  const canRetry = method === "GET";

  for (let attempt = 0; ; attempt += 1) {
    if (options.signal?.aborted) {
      throw new DOMException("Request aborted.", "AbortError");
    }

    try {
      const response = await fetch(url, options);

      if (
        canRetry &&
        isRetryableStatus(response.status) &&
        attempt < MAX_RETRIES
      ) {
        const delay = getRetryDelay(response, attempt);

        await wait(delay, options.signal);
        continue;
      }

      return await readResponse(response);
    } catch (error) {
      const aborted =
        options.signal?.aborted ||
        error?.name === "AbortError";

      if (
        !canRetry ||
        aborted ||
        !isNetworkError(error) ||
        attempt >= MAX_RETRIES
      ) {
        throw error;
      }

      const delay = BASE_RETRY_DELAY * (2 ** attempt);

      await wait(delay, options.signal);
    }
  }
}

// ============================================================
// CSV ERROR HANDLING
// ============================================================

async function getExportErrorMessage(response) {
  const body = await response.text();

  const fallbackMessage = `Request failed (${response.status}).`;

  if (!body) return fallbackMessage;

  try {
    const data = JSON.parse(body);
    const detail = data?.detail;

    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(", ")
      : detail;

    return message || fallbackMessage;
  } catch {
    const message = body.trim();

    return message.startsWith("<")
      ? fallbackMessage
      : message;
  }
}

function getExportFilename(response, fallbackFilename) {
  const contentDisposition =
    response.headers.get("content-disposition") ?? "";

  const encodedFilename = contentDisposition.match(
    /filename\*=UTF-8''([^;]+)/i
  )?.[1];

  const plainFilename = contentDisposition.match(
    /filename="?([^";]+)"?/i
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

// ============================================================
// RECONCILIATION UPLOAD
// ============================================================

export async function submitReconciliation({
  fundFiles = [],
  vaFiles = [],
  statementFiles = [],
  onUploadProgress,
}) {
  const formData = new FormData();

  fundFiles.forEach((file) => {
    formData.append("fund_request_file", file);
  });

  vaFiles.forEach((file) => {
    formData.append("va_transaction_file", file);
  });

  statementFiles.forEach((file) => {
    formData.append("bank_statement_file", file);
  });

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", `${apiBaseUrl}/api/reconcile`);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;

      const progress = Math.min(
        100,
        Math.round((event.loaded / event.total) * 100)
      );

      onUploadProgress?.(progress);
    });

    request.addEventListener("load", () => {
      let data;

      try {
        data = JSON.parse(request.responseText);
      } catch {
        if (request.status >= 200 && request.status < 300) {
          reject(
            new Error(
              "The reconciliation API returned an invalid response."
            )
          );
          return;
        }
      }

      if (request.status < 200 || request.status >= 300) {
        const detail = data?.detail;

        const message = Array.isArray(detail)
          ? detail.map((item) => item.msg).join(", ")
          : detail;

        reject(
          new Error(
            message || `Request failed (${request.status}).`
          )
        );

        return;
      }

      if (!data || typeof data !== "object") {
        reject(
          new Error(
            "The reconciliation API returned an invalid response."
          )
        );
        return;
      }

      resolve(data);
    });

    request.addEventListener("error", () => {
      reject(
        new Error(
          "Network error while uploading reconciliation files."
        )
      );
    });

    request.addEventListener("abort", () => {
      reject(
        new Error("The reconciliation file upload was aborted.")
      );
    });

    request.addEventListener("timeout", () => {
      reject(new Error("Reconciliation upload timed out."));
    });

    request.send(formData);
  });
}

// ============================================================
// GET RECONCILIATION SUMMARY
// ============================================================

export async function getReconciliationSummary(
  jobId,
  { signal } = {}
) {
  return requestJson(
    "Get reconciliation summary",
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/summary`,
    { signal }
  );
}

// ============================================================
// SERVER SENT EVENTS (SSE)
// ============================================================

export function openReconciliationStatusStream(
  jobId,
  {
    onMessage,
    onError,
    onOpen,
    onProtocolError,
  } = {}
) {
  if (!jobId) {
    throw new Error(
      "A job ID is required to open the status stream."
    );
  }

  const streamId = `SSE-${++streamCounter}`;

  const url =
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/events`;

  const source = new EventSource(url);

  const handleEvent = (event) => {
    let payload;

    try {
      payload = JSON.parse(event.data);

      if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
      ) {
        throw new Error(
          "Status event must contain a JSON object."
        );
      }
    } catch (error) {
      onProtocolError?.(error);
      return;
    }

    try {
      onMessage?.(payload);
    } catch {
      // Keep the SSE connection alive if a UI callback fails.
    }
  };

  source.addEventListener("status", handleEvent);
  source.onmessage = handleEvent;

  source.onopen = (event) => {
    onOpen?.(event);
  };

  source.onerror = (event) => {
    // EventSource automatically reconnects.
    // Do not create another EventSource here.
    onError?.(event, source.readyState);
  };

  return source;
}

// ============================================================
// RETRY RECONCILIATION
// ============================================================

export async function retryReconciliation(
  jobId,
  { signal } = {}
) {
  if (!jobId) {
    throw new Error("A job ID is required to retry reconciliation.");
  }

  return requestJson(
    "Retry reconciliation",
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/retry`,
    {
      method: "POST",
      signal,
    }
  );
}

// ============================================================
// RECONCILIATION HISTORY
// ============================================================

export async function getReconciliationHistory({
  page = 1,
  limit = 100,
  signal,
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const url =
    `${apiBaseUrl}/api/reconciliation/history?${params}`;

  return requestJson(
    "Get reconciliation history",
    url,
    { signal }
  );
}

export async function getReconciliationHistoryDetails(
  jobId,
  { signal } = {}
) {
  const url =
    `${apiBaseUrl}/api/reconciliation/history/${encodeURIComponent(jobId)}`;

  return requestJson(
    "Get reconciliation history details",
    url,
    { signal }
  );
}

// ============================================================
// FUND REQUEST TRANSACTIONS
// ============================================================

export async function getFundRequests(
  jobId,
  {
    status = "NOT_FOUND",
    page = 1,
    limit = 100,
    signal,
  } = {}
) {
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
  });

  const url =
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/fund-requests?${params}`;

  return requestJson(
    "Get fund request transactions",
    url,
    { signal }
  );
}

// ============================================================
// VA TRANSACTIONS
// ============================================================

export async function getVaTransactions(
  jobId,
  {
    status = "NOT_FOUND",
    page = 1,
    limit = 100,
    signal,
  } = {}
) {
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
  });

  const url =
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/va-transactions?${params}`;

  return requestJson(
    "Get VA transactions",
    url,
    { signal }
  );
}

// ============================================================
// BANK STATEMENT TRANSACTIONS
// ============================================================

export async function getBankTransactions(
  jobId,
  {
    status = "NOT_FOUND",
    page = 1,
    limit = 100,
    signal,
  } = {}
) {
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
  });

  const url =
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/bank-transactions?${params}`;

  return requestJson(
    "Get bank statement transactions",
    url,
    { signal }
  );
}

// ============================================================
// CSV EXPORT
// ============================================================

export async function exportTransactionsCsv(
  jobId,
  { source, status, signal } = {}
) {
  const exportPath = transactionExportPaths[source];

  if (!exportPath) {
    throw new Error("Choose a valid transaction source to export.");
  }

  if (!jobId) {
    throw new Error(
      "Run a reconciliation before exporting transactions."
    );
  }

  if (!status) {
    throw new Error(
      "Choose a transaction status before exporting."
    );
  }

  const params = new URLSearchParams({ status });

  const url =
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/${exportPath}/export?${params}`;

  let response;

  for (let attempt = 0; ; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException("Request aborted.", "AbortError");
    }

    try {
      response = await fetch(url, {
        signal,
        headers: { Accept: "text/csv" },
      });

      if (
        isRetryableStatus(response.status) &&
        attempt < MAX_RETRIES
      ) {
        await wait(getRetryDelay(response, attempt), signal);
        continue;
      }

      break;
    } catch (error) {
      const aborted =
        signal?.aborted ||
        error?.name === "AbortError";

      if (
        aborted ||
        !isNetworkError(error) ||
        attempt >= MAX_RETRIES
      ) {
        throw error;
      }

      await wait(
        BASE_RETRY_DELAY * (2 ** attempt),
        signal
      );
    }
  }

  if (!response.ok) {
    throw new Error(await getExportErrorMessage(response));
  }

  const fallbackFilename =
    `${exportPath}-${status.toLowerCase().replaceAll("_", "-")}.csv`;

  const filename = getExportFilename(
    response,
    fallbackFilename
  );

  const blob = await response.blob();

  return {
    blob,
    filename,
  };
}

// ============================================================
// COMPANY MANAGEMENT
// ============================================================

export { getCompanies, createCompany } from "./companyApi";

// ============================================================
// MANUAL SETTLEMENTS
// ============================================================

/**
 * Create a manual settlement between a source record and a bank row.
 * POST /api/reconciliation/{job_id}/manual-settlements
 */

export async function createManualSettlement(
  jobId,
  payload,
  { signal } = {}
) {
  if (!jobId) {
    throw new Error("A job ID is required.");
  }

  const url =
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/manual-settlements`;

  return requestJson(
    "Create manual settlement",
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    }
  );
}

/**
 * List manual settlements for a job.
 * GET /api/reconciliation/{job_id}/manual-settlements
 */

export async function getManualSettlements(
  jobId,
  {
    page = 1,
    limit = 100,
    signal,
  } = {}
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const url =
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/manual-settlements?${params}`;

  return requestJson(
    "Get manual settlements",
    url,
    { signal }
  );
}

/**
 * Reverse an active manual settlement.
 * POST /api/reconciliation/manual-settlements/{settlement_id}/reverse
 */

export async function reverseManualSettlement(
  settlementId,
  {
    reason,
    signal,
  } = {}
) {
  if (!settlementId) {
    throw new Error("A settlement ID is required.");
  }

  const url =
    `${apiBaseUrl}/api/reconciliation/manual-settlements/${encodeURIComponent(settlementId)}/reverse`;

  return requestJson(
    "Reverse manual settlement",
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(reason ? { reason } : {}),
      signal,
    }
  );
}

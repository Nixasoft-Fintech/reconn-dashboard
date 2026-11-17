
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const DEBUG_ENABLED = true;
const DEBUG_PREFIX = "[RECON-DEBUG]";

let requestCounter = 0;
let streamCounter = 0;

const transactionExportPaths = {
  "Fund Request": "fund-requests",
  "VA Transfer": "va-transactions",
  "Account Statement": "bank-transactions",
};

// ============================================================
// DEBUG LOGGER
// ============================================================

function getTimestamp() {
  return new Date().toISOString();
}

function debugLog(stage, message, data = null) {
  if (!DEBUG_ENABLED) return;

  const prefix = `${DEBUG_PREFIX} [${getTimestamp()}] [${stage}]`;

  if (data !== null) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

function debugGroup(stage, title, callback) {
  if (!DEBUG_ENABLED) {
    callback?.();
    return;
  }

  console.groupCollapsed(
    `${DEBUG_PREFIX} [${getTimestamp()}] [${stage}] ${title}`,
  );

  try {
    callback?.();
  } finally {
    console.groupEnd();
  }
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

function getRequestId() {
  requestCounter += 1;
  return `API-${requestCounter}`;
}

// ============================================================
// COMMON API RESPONSE HANDLING
// ============================================================

async function readResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;

    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(", ")
      : detail;

    throw new Error(
      message || `Request failed (${response.status}).`,
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error(
      "The reconciliation API returned an invalid response.",
    );
  }

  return data;
}

/**
 * Centralized fetch wrapper.
 * Logs request, response, duration, and errors.
 */
async function requestJson(label, url, options = {}) {
  const requestId = getRequestId();
  const startTime = Date.now();

  debugGroup("API REQUEST", `${requestId} ${label}`, () => {
    debugLog("REQUEST", "URL:", url);
    debugLog("REQUEST", "Method:", options.method || "GET");
    debugLog("REQUEST", "Options:", options);
  });

  try {
    const response = await fetch(url, options);

    debugLog("API RESPONSE", `${requestId} HTTP response received`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      duration: getDuration(startTime),
      url: response.url,
    });

    const data = await readResponse(response);

    debugGroup("API RESPONSE BODY", `${requestId} ${label}`, () => {
      debugLog("RESPONSE DATA", "Complete response:", data);
    });

    debugLog("API SUCCESS", `${requestId} ${label} completed`, {
      duration: getDuration(startTime),
    });

    return data;
  } catch (error) {
    debugGroup("API ERROR", `${requestId} ${label} failed`, () => {
      debugLog("ERROR MESSAGE", error.message);
      debugLog("ERROR OBJECT", "Full error:", error);
      debugLog("DURATION", getDuration(startTime));
      debugLog("URL", url);
    });

    throw error;
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

// ============================================================
// RECONCILIATION UPLOAD
// ============================================================

export async function submitReconciliation({
  fundFiles,
  vaFiles,
  statementFiles,
  onUploadProgress,
}) {
  const requestId = getRequestId();
  const startTime = Date.now();

  debugGroup(
    "RECONCILIATION START",
    `${requestId} File upload started`,
    () => {
      debugLog("UPLOAD", "Fund request files:", fundFiles.length);
      debugLog("UPLOAD", "VA transaction files:", vaFiles.length);
      debugLog("UPLOAD", "Bank statement files:", statementFiles.length);

      debugLog(
        "UPLOAD",
        "Fund files:",
        fundFiles.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      );

      debugLog(
        "UPLOAD",
        "VA files:",
        vaFiles.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      );

      debugLog(
        "UPLOAD",
        "Statement files:",
        statementFiles.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      );

      debugLog(
        "UPLOAD",
        "Endpoint:",
        `${apiBaseUrl}/api/reconcile`,
      );
    },
  );

  const formData = new FormData();

  fundFiles.forEach((file) =>
    formData.append("fund_request_file", file),
  );

  vaFiles.forEach((file) =>
    formData.append("va_transaction_file", file),
  );

  statementFiles.forEach((file) =>
    formData.append("bank_statement_file", file),
  );

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", `${apiBaseUrl}/api/reconcile`);

    let lastLoggedProgress = -1;

    request.upload.addEventListener("loadstart", () => {
      debugLog("UPLOAD", `${requestId} Upload started`);
    });

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;

      const progress = Math.min(
        100,
        Math.round((event.loaded / event.total) * 100),
      );

      // Log only when progress increases by at least 10%.
      if (
        progress === 100 ||
        progress >= lastLoggedProgress + 10
      ) {
        lastLoggedProgress = progress;

        debugLog("UPLOAD PROGRESS", `${requestId} ${progress}%`, {
          uploadedBytes: event.loaded,
          totalBytes: event.total,
          percentage: progress,
        });
      }

      onUploadProgress?.(progress);
    });

    request.upload.addEventListener("load", () => {
      debugLog("UPLOAD", `${requestId} File transfer completed`, {
        duration: getDuration(startTime),
      });
    });

    request.addEventListener("load", () => {
      debugLog("UPLOAD RESPONSE", `${requestId} Server responded`, {
        status: request.status,
        statusText: request.statusText,
        duration: getDuration(startTime),
      });

      let data;

      try {
        data = JSON.parse(request.responseText);
      } catch (error) {
        debugLog("UPLOAD PARSE ERROR", "Invalid JSON response", {
          responseText: request.responseText,
          error,
        });

        if (request.status >= 200 && request.status < 300) {
          reject(
            new Error(
              "The reconciliation API returned an invalid response.",
            ),
          );
          return;
        }
      }

      if (request.status < 200 || request.status >= 300) {
        const detail = data?.detail;

        const message = Array.isArray(detail)
          ? detail.map((item) => item.msg).join(", ")
          : detail;

        debugLog("UPLOAD FAILED", `${requestId} Upload API failed`, {
          status: request.status,
          response: data,
        });

        reject(
          new Error(
            message || `Request failed (${request.status}).`,
          ),
        );

        return;
      }

      if (!data || typeof data !== "object") {
        reject(
          new Error(
            "The reconciliation API returned an invalid response.",
          ),
        );
        return;
      }

      debugGroup(
        "RECONCILIATION SUBMITTED",
        `${requestId} Backend response`,
        () => {
          debugLog("JOB ID", "Received job ID:", data.job_id ?? data.jobId);
          debugLog("STATUS", "Initial status:", data.status);
          debugLog("COMPLETE RESPONSE", "Response body:", data);
        },
      );

      debugLog("UPLOAD SUCCESS", `${requestId} Completed`, {
        duration: getDuration(startTime),
      });

      resolve(data);
    });

    request.addEventListener("error", () => {
      debugLog("UPLOAD NETWORK ERROR", `${requestId} Network error`, {
        status: request.status,
        duration: getDuration(startTime),
      });

      reject(
        new Error(
          "Network error while uploading reconciliation files.",
        ),
      );
    });

    request.addEventListener("abort", () => {
      debugLog("UPLOAD ABORTED", `${requestId} Upload aborted`);

      reject(
        new Error("The reconciliation file upload was aborted."),
      );
    });

    request.addEventListener("timeout", () => {
      debugLog("UPLOAD TIMEOUT", `${requestId} Upload timed out`);

      reject(new Error("Reconciliation upload timed out."));
    });

    debugLog("UPLOAD", `${requestId} Sending FormData to backend`);

    request.send(formData);
  });
}

// ============================================================
// GET RECONCILIATION SUMMARY
// ============================================================

export async function getReconciliationSummary(
  jobId,
  { signal } = {},
) {
  debugLog("SUMMARY", "Fetching reconciliation summary", {
    jobId,
  });

  return requestJson(
    "Get reconciliation summary",
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/summary`,
    { signal },
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
  } = {},
) {
  if (!jobId) {
    throw new Error(
      "A job ID is required to open the status stream.",
    );
  }

  const streamId = `SSE-${++streamCounter}`;

  const url = `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/events`;

  const connectionStartTime = Date.now();

  debugGroup(
    "SSE CONNECTING",
    `${streamId} Starting status stream`,
    () => {
      debugLog("JOB ID", jobId);
      debugLog("STREAM URL", url);
      debugLog("TIME", "Connection requested at:", getTimestamp());
    },
  );

  let source;

  try {
    source = new EventSource(url);
  } catch (error) {
    debugLog("SSE CREATION ERROR", `${streamId} Could not create EventSource`, {
      error,
      message: error.message,
    });

    throw error;
  }

  debugLog("SSE CREATED", `${streamId} EventSource object created`, {
    readyState: getReadyStateName(source.readyState),
  });

  // ----------------------------------------------------------
  // SSE EVENT HANDLER
  // ----------------------------------------------------------

  const handleEvent = (event) => {
    const eventReceivedAt = Date.now();

    debugGroup(
      "SSE EVENT RECEIVED",
      `${streamId} Event: ${event.type}`,
      () => {
        debugLog("EVENT TYPE", event.type);
        debugLog("JOB ID", jobId);
        debugLog("LAST EVENT ID", event.lastEventId || "Not provided");
        debugLog("EVENT DATA RAW", event.data);
        debugLog("EVENT TIME", getTimestamp());
      },
    );

    let payload;

    try {
      payload = JSON.parse(event.data);

      if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
      ) {
        throw new Error(
          "Status event must contain a JSON object.",
        );
      }
    } catch (error) {
      debugGroup(
        "SSE PARSE ERROR",
        `${streamId} Invalid event JSON`,
        () => {
          debugLog("RAW DATA", event.data);
          debugLog("ERROR", error);
        },
      );

      onProtocolError?.(error);
      return;
    }

    const receivedStatus = String(
      payload?.status ?? "",
    ).trim().toUpperCase();

    debugGroup(
      "SSE STATUS UPDATE",
      `${streamId} Status: ${receivedStatus || "UNKNOWN"}`,
      () => {
        debugLog("JOB ID", payload?.job_id ?? jobId);
        debugLog("STATUS", receivedStatus);
        debugLog("MESSAGE", payload?.message ?? "");
        debugLog("FULL PAYLOAD", payload);
        debugLog(
          "PROCESSING TIME",
          `${Date.now() - eventReceivedAt}ms`,
        );
      },
    );

    try {
      onMessage?.(payload);
    } catch (error) {
      debugLog("SSE CALLBACK ERROR", `${streamId} onMessage failed`, {
        error,
        payload,
      });
    }
  };

  // Named events: event: status
  source.addEventListener("status", handleEvent);

  // Unnamed/default events.
  source.onmessage = handleEvent;

  // ----------------------------------------------------------
  // CONNECTION OPEN
  // ----------------------------------------------------------

  source.onopen = (event) => {
    debugGroup(
      "SSE CONNECTED",
      `${streamId} Connection established`,
      () => {
        debugLog("JOB ID", jobId);
        debugLog("READY STATE", getReadyStateName(source.readyState));
        debugLog("OPEN TIME", getTimestamp());
        debugLog(
          "CONNECTION DURATION",
          getDuration(connectionStartTime),
        );
        debugLog("EVENT", event);
      },
    );

    onOpen?.(event);
  };

  // ----------------------------------------------------------
  // CONNECTION ERROR / RECONNECTION
  // ----------------------------------------------------------

  source.onerror = (event) => {
    const readyState = source.readyState;

    debugGroup(
      "SSE CONNECTION ERROR",
      `${streamId} EventSource error`,
      () => {
        debugLog("JOB ID", jobId);
        debugLog("READY STATE", getReadyStateName(readyState));
        debugLog("ERROR TIME", getTimestamp());
        debugLog("EVENT", event);

        if (readyState === EventSource.CONNECTING) {
          debugLog(
            "SSE RECONNECTING",
            "Browser EventSource is attempting automatic reconnection.",
          );
        } else if (readyState === EventSource.CLOSED) {
          debugLog(
            "SSE CLOSED",
            "EventSource connection is permanently closed.",
          );
        }
      },
    );

    // Do not create another EventSource here.
    // Browser EventSource handles automatic reconnection.
    onError?.(event, readyState);
  };

  // ----------------------------------------------------------
  // LOG WHEN CONNECTION IS CLOSED
  // ----------------------------------------------------------

  const originalClose = source.close.bind(source);

  source.close = () => {
    debugGroup(
      "SSE CLOSE",
      `${streamId} Closing status stream`,
      () => {
        debugLog("JOB ID", jobId);
        debugLog("CLOSE TIME", getTimestamp());
        debugLog(
          "PREVIOUS READY STATE",
          getReadyStateName(source.readyState),
        );
        debugLog(
          "CONNECTION LIFETIME",
          getDuration(connectionStartTime),
        );
      },
    );

    originalClose();

    debugLog("SSE CLOSED", `${streamId} Connection closed`, {
      readyState: getReadyStateName(source.readyState),
    });
  };

  debugLog("SSE WAITING", `${streamId} Waiting for server events`);

  return source;
}

// ============================================================
// RETRY RECONCILIATION
// ============================================================

export async function retryReconciliation(
  jobId,
  { signal } = {},
) {
  debugLog("RETRY", "Retry reconciliation requested", {
    jobId,
  });

  return requestJson(
    "Retry reconciliation",
    `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/retry`,
    {
      method: "POST",
      signal,
    },
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

  const url = `${apiBaseUrl}/api/reconciliation/history?${params}`;

  return requestJson(
    "Get reconciliation history",
    url,
    { signal },
  );
}

export async function getReconciliationHistoryDetails(
  jobId,
  { signal } = {},
) {
  const url = `${apiBaseUrl}/api/reconciliation/history/${encodeURIComponent(jobId)}`;

  return requestJson(
    "Get reconciliation history details",
    url,
    { signal },
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
  } = {},
) {
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
  });

  const url = `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/fund-requests?${params}`;

  return requestJson(
    "Get fund request transactions",
    url,
    { signal },
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
  } = {},
) {
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
  });

  const url = `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/va-transactions?${params}`;

  return requestJson(
    "Get VA transactions",
    url,
    { signal },
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
  } = {},
) {
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
  });

  const url = `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/bank-transactions?${params}`;

  return requestJson(
    "Get bank statement transactions",
    url,
    { signal },
  );
}

// ============================================================
// CSV EXPORT
// ============================================================

export async function exportTransactionsCsv(
  jobId,
  { source, status, signal } = {},
) {
  const requestId = getRequestId();
  const startTime = Date.now();

  const exportPath = transactionExportPaths[source];

  if (!exportPath) {
    throw new Error("Choose a valid transaction source to export.");
  }

  if (!jobId) {
    throw new Error(
      "Run a reconciliation before exporting transactions.",
    );
  }

  if (!status) {
    throw new Error(
      "Choose a transaction status before exporting.",
    );
  }

  const params = new URLSearchParams({ status });

  const url = `${apiBaseUrl}/api/reconciliation/${encodeURIComponent(jobId)}/${exportPath}/export?${params}`;

  debugGroup(
    "CSV EXPORT START",
    `${requestId} Exporting ${source}`,
    () => {
      debugLog("JOB ID", jobId);
      debugLog("SOURCE", source);
      debugLog("STATUS", status);
      debugLog("URL", url);
    },
  );

  try {
    const response = await fetch(url, {
      signal,
      headers: { Accept: "text/csv" },
    });

    debugLog("CSV RESPONSE", `${requestId} Server responded`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      duration: getDuration(startTime),
    });

    if (!response.ok) {
      const errorMessage = await getExportErrorMessage(response);

      debugLog("CSV EXPORT ERROR", `${requestId} Export failed`, {
        errorMessage,
      });

      throw new Error(errorMessage);
    }

    const fallbackFilename = `${exportPath}-${status
      .toLowerCase()
      .replaceAll("_", "-")}.csv`;

    const filename = getExportFilename(
      response,
      fallbackFilename,
    );

    const blob = await response.blob();

    debugLog("CSV EXPORT SUCCESS", `${requestId} CSV downloaded`, {
      filename,
      fileSize: blob.size,
      fileType: blob.type,
      duration: getDuration(startTime),
    });

    return {
      blob,
      filename,
    };
  } catch (error) {
    debugLog("CSV EXPORT FAILED", `${requestId} Error`, {
      message: error.message,
      error,
      duration: getDuration(startTime),
    });

    throw error;
  }
}

// ============================================================
// COMPANY MANAGEMENT
// ============================================================

export { getCompanies, createCompany } from "./companyApi";


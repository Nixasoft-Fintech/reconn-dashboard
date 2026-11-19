
async function readResponse(response) {
  if (response.status === 204) return { success: true };

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;

    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg || JSON.stringify(item)).join(", ")
      : typeof detail === "object" && detail !== null
        ? JSON.stringify(detail)
        : detail;

    throw new Error(message || `Request failed (${response.status}).`);
  }

  if (data === null) return { success: true };

  if (typeof data !== "object") {
    throw new Error("The API returned an invalid response.");
  }

  return data;
}

// GET /api/reconciliation/{job_id}/manual-settlements
export async function settlements({
  jobId,
  page = 1,
  limit = 100,
  signal,
} = {}) {
  if (!jobId) {
    throw new Error("Job ID is required.");
  }

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const url = `/api/reconciliation/${encodeURIComponent(jobId)}/manual-settlements?${params}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  return readResponse(response);
}

// POST /api/reconciliation/manual-settlements/{settlement_id}/reverse
export async function reverseSettlement(settlementId) {
  if (!settlementId) {
    throw new Error("Settlement ID is required.");
  }

  const url = `/api/reconciliation/manual-settlements/${encodeURIComponent(settlementId)}/reverse`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  return readResponse(response);
}

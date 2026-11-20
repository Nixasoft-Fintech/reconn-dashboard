const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function readResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;

    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg || JSON.stringify(item)).join(", ")
      : typeof detail === "object" && detail !== null
      ? JSON.stringify(detail)
      : detail;

    throw new Error(
      message || `Request failed (${response.status}).`,
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error("The API returned an invalid response.");
  }

  return data;
}

/**
 * Fetch all companies using default pagination.
 *
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=100]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   total: number,
 *   page: number,
 *   limit: number,
 *   total_pages: number,
 *   has_next: boolean,
 *   has_previous: boolean,
 *   items: Array<{
 *     company_id: string,
 *     name: string,
 *     alias: string,
 *     created_at: string,
 *     updated_at: string
 *   }>
 * }>}
 */

export async function getCompanies({ page = 1, limit = 100, signal } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const url = `${apiBaseUrl}/api/companies?${params}`;

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  return readResponse(response);
}

/**
 * Create a new company.
 *
 * @param {Object} company
 * @param {string} company.name - Company Name
 * @param {string} company.alias - Company Nickname
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   company_id: string,
 *   name: string,
 *   alias: string,
 *   created_at: string,
 *   updated_at: string
 * }>}
 */
export async function createCompany({ name, alias }, { signal } = {}) {
  const url = `${apiBaseUrl}/api/companies`;

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ name, alias }),
    signal,
  });

  return readResponse(response);
}

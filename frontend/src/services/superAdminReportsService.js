import apiClient, { getApiErrorMessage } from "../shared/api/apiClient";

/* SUPER ADMIN-SA4B — authenticated, read-only portfolio reports */
export async function fetchPortfolioReports(params = {}) {
  try {
    const response = await apiClient.get("/superadmin/reports/overview", {
      params,
    });
    if (response.data?.success !== true || !response.data?.data) {
      throw new Error(response.data?.message || "Portfolio report data is unavailable.");
    }
    return response.data.data;
  } catch (error) {
    if (error?.response) throw new Error(getApiErrorMessage(error));
    throw error;
  }
}

import axios from "axios";

/*
 * Development:
 * REACT_APP_API_URL=http://localhost:5000/api
 *
 * Production:
 * REACT_APP_API_URL=https://your-api-domain.com/api
 *
 * When frontend and backend use the same domain,
 * the safe production fallback is /api.
 */
const configuredApiUrl =
  process.env.REACT_APP_API_URL?.trim() || "/api";

const API_BASE_URL = configuredApiUrl.replace(/\/+$/, "");

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

function getDefaultErrorMessage(status) {
  switch (status) {
    case 400:
      return "The submitted information is missing or invalid.";

    case 401:
      return "Your session is invalid or expired. Please sign in again.";

    case 403:
      return "Your account does not have permission to perform this action.";

    case 404:
      return "The requested service or record could not be found.";

    case 409:
      return "This record already exists or conflicts with existing data.";

    case 422:
      return "Some submitted information could not be processed.";

    case 429:
      return "Too many requests were made. Please wait and try again.";

    case 500:
      return "The server encountered an unexpected error. Please try again.";

    case 502:
    case 503:
    case 504:
      return "The service is temporarily unavailable. Please try again shortly.";

    default:
      return "The request could not be completed. Please try again.";
  }
}

function getDefaultErrorCode(status) {
  switch (status) {
    case 400:
      return "INVALID_REQUEST";

    case 401:
      return "AUTH_REQUIRED";

    case 403:
      return "ACCESS_FORBIDDEN";

    case 404:
      return "RESOURCE_NOT_FOUND";

    case 409:
      return "RESOURCE_CONFLICT";

    case 422:
      return "VALIDATION_FAILED";

    case 429:
      return "TOO_MANY_REQUESTS";

    case 500:
      return "INTERNAL_SERVER_ERROR";

    case 502:
    case 503:
    case 504:
      return "SERVICE_UNAVAILABLE";

    default:
      return "REQUEST_FAILED";
  }
}

/**
 * Converts Axios, network and backend errors into one predictable format.
 *
 * Components can safely use:
 * error.message
 * error.code
 * error.status
 * error.requestId
 */
export function normalizeApiError(error) {
  if (error?.isNormalizedApiError) {
    return error;
  }

  /*
   * Request reached the browser but no response came from backend.
   */
  if (!error?.response) {
    const isTimeout =
      error?.code === "ECONNABORTED" ||
      error?.code === "ETIMEDOUT";

    const normalizedError = new Error(
      isTimeout
        ? "The server took too long to respond. Please try again."
        : "Unable to connect to the server. Check that the backend is running and the API URL is correct."
    );

    normalizedError.name = "ApiError";
    normalizedError.code = isTimeout
      ? "REQUEST_TIMEOUT"
      : "NETWORK_ERROR";
    normalizedError.status = null;
    normalizedError.requestId = null;
    normalizedError.isNormalizedApiError = true;

    return normalizedError;
  }

  const status = error.response.status;
  const responseData = error.response.data;

  const safeResponseData =
    responseData &&
    typeof responseData === "object" &&
    !Array.isArray(responseData)
      ? responseData
      : {};

  const backendMessage =
    typeof safeResponseData.message === "string"
      ? safeResponseData.message.trim()
      : "";

  const backendCode =
    typeof safeResponseData.code === "string"
      ? safeResponseData.code.trim()
      : "";

  const requestId =
    safeResponseData.requestId ||
    error.response.headers?.["x-request-id"] ||
    null;

  const normalizedError = new Error(
    backendMessage || getDefaultErrorMessage(status)
  );

  normalizedError.name = "ApiError";
  normalizedError.code =
    backendCode || getDefaultErrorCode(status);
  normalizedError.status = status;
  normalizedError.requestId = requestId;
  normalizedError.isNormalizedApiError = true;

  return normalizedError;
}

/**
 * Components can use this helper when displaying an error.
 */
export function getApiErrorMessage(error) {
  return normalizeApiError(error).message;
}

let authRequestInterceptorId = null;

/**
 * Connects Clerk's getToken() function with every authenticated API request.
 *
 * This should be configured once inside the React application.
 */
export function setupApiClientAuth(getToken) {
  if (typeof getToken !== "function") {
    throw new Error(
      "setupApiClientAuth requires Clerk's getToken function."
    );
  }

  /*
   * Prevent duplicate interceptors during React development reloads.
   */
  if (authRequestInterceptorId !== null) {
    apiClient.interceptors.request.eject(
      authRequestInterceptorId
    );
  }

  authRequestInterceptorId =
    apiClient.interceptors.request.use(
      async (config) => {
        const token = await getToken();

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => {
        return Promise.reject(normalizeApiError(error));
      }
    );
}

/*
 * All failed API responses pass through the same error normalizer.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(normalizeApiError(error));
  }
);

export default apiClient;
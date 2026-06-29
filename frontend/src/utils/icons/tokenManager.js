//import apiClient from '../../services/apiClient';
let accessToken = localStorage.getItem("token") || null;

export const setAccessToken = (token) => {
  localStorage.setItem("token", token);
};

export const getAccessToken = () => {
  return localStorage.getItem("token");
};

export const clearTokens = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export const refreshAccessToken = async () => {
  const response = await fetch(
    "http://localhost:5000/api/auth/refresh-token",
    {
      method: "POST",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }

  const data = await response.json();
  setAccessToken(data.accessToken);
  return data.accessToken;
};
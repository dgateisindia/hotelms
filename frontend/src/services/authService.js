// frontend/src/services/authService.js
import apiClient from './apiClient';
export const createHotel = (data) => apiClient.post("/auth/create-hotel", data);
export const loginUser = (email, password) =>
  apiClient.post('/auth/login', { email, password });

export const registerUser = (formData) =>
  apiClient.post('/auth/register', formData);

export const registerSuperAdmin = (data) =>
  apiClient.post('/auth/register-super-admin', data);

export const registerAdmin = (data) =>
  apiClient.post('/auth/register-admin', data);
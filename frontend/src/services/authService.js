// frontend/src/services/authService.js
import apiClient from './apiClient';

export const loginUser = (email, password) =>
  apiClient.post('/auth/login', { email, password });

export const registerUser = (formData) =>
  apiClient.post('/auth/register', formData);
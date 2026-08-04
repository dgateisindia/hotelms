import apiClient from './apiClient'; // your existing centralized axios instance

const createStaffUser = async (data) => {
  const response = await apiClient.post('/users/create-admin', data);
  return response.data;
};

const getStaffUsers = async () => {
  const response = await apiClient.get('/users/staff');
  return response.data;
};

export default { createStaffUser, getStaffUsers };
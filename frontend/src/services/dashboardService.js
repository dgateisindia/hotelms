import apiClient from './apiClient';

const getSuperAdminStats = async () => {
  const res = await apiClient.get('/dashboard/super-admin-stats');
  return res.data;
};

const getAdminsStatus = async () => {
  const res = await apiClient.get('/dashboard/admins-status');
  return res.data;
};

export default { getSuperAdminStats, getAdminsStatus };
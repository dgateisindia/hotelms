import apiClient from "../shared/api/apiClient";

const getSuperAdminStats = async () => {
  const res = await apiClient.get('/dashboard/super-admin-stats');
  return res.data;
};

const getAdminsStatus = async () => {
  const res = await apiClient.get('/dashboard/admins-status');
  return res.data;
};

const getAdminDailyStats = async (date) => {
  const res = await apiClient.get('/dashboard/admin-daily-stats', {
    params: { date },
  });
  return res.data;
};

export default { getSuperAdminStats, getAdminsStatus, getAdminDailyStats };
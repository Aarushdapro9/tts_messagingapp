import axios from 'axios';

const serverUrl = process.env.REACT_APP_SERVER_URL || '';

function adminApi() {
  return axios.create({
    baseURL: serverUrl,
    headers: { Authorization: localStorage.getItem('userToken') || '' },
  });
}

export const getAdminOverview = async () => (await adminApi().get('/api/admin')).data;

export const getAdminChatMessages = async (chatId) =>
  (await adminApi().get(`/api/admin/chats/${chatId}/messages`)).data;

export const updateUserRole = async (userId, role) =>
  (await adminApi().patch(`/api/admin/users/${userId}/role`, role)).data;

export const updateUserApproval = async (userId, approved) =>
  (await adminApi().patch(`/api/admin/users/${userId}/approval`, { approved })).data;

export const deleteUserAccount = async (userId) =>
  (await adminApi().delete(`/api/admin/users/${userId}`)).data;

export const updateUserModeration = async (userId, action) =>
  (await adminApi().patch(`/api/admin/users/${userId}/moderation`, action)).data;

export const getReports = async () => (await adminApi().get('/api/admin/reports')).data;
export const getAuditLogs = async () => (await adminApi().get('/api/admin/audit-logs')).data;
export const updateReport = async (reportId, update) =>
  (await adminApi().patch(`/api/admin/reports/${reportId}`, update)).data;
export const createReport = async (report) =>
  (await adminApi().post('/api/admin/reports', report)).data;
export const getSystemSettings = async () => (await adminApi().get('/api/admin/settings')).data;
export const updateSystemSettings = async (settings) =>
  (await adminApi().patch('/api/admin/settings', settings)).data;
export const downloadOwnerExport = async () =>
  adminApi().get('/api/admin/export', { responseType: 'blob' });
export const cancelGameAsAdmin = async (matchId) =>
  (await adminApi().post(`/api/admin/games/${matchId}/cancel`)).data;

export const createAppAlert = async (alert) =>
  (await adminApi().post('/api/admin/alerts', alert)).data;

export const getPendingAlerts = async () =>
  (await adminApi().get('/api/admin/alerts/pending')).data;

export const dismissAppAlert = async (alertId) =>
  adminApi().post(`/api/admin/alerts/${alertId}/dismiss`);

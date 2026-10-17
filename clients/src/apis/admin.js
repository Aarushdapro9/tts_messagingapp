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

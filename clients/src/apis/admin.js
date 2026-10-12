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

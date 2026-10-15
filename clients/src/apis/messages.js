import axios from 'axios';
const serverUrl = process.env.REACT_APP_SERVER_URL || '';
const API = (token) =>
  axios.create({
    baseURL: serverUrl,
    headers: { Authorization: token },
  });
export const sendMessage = async (body) => {
  const token = localStorage.getItem('userToken');
  const { data } = await API(token).post('/api/message/', body);
  return data;
};
export const fetchMessages = async (id) => {
  const token = localStorage.getItem('userToken');
  const { data } = await API(token).get(`/api/message/${id}`);
  return data;
};

export const createPoll = async (body) => {
  const token = localStorage.getItem('userToken');
  const { data } = await API(token).post('/api/message/poll', body);
  return data;
};

export const voteOnPoll = async (messageId, optionId) => {
  const token = localStorage.getItem('userToken');
  const { data } = await API(token).post(`/api/message/${messageId}/poll/vote`, { optionId });
  return data;
};

export const togglePinnedMessage = async (messageId) => {
  const token = localStorage.getItem('userToken');
  const { data } = await API(token).patch(`/api/message/${messageId}/pin`);
  return data;
};

export const deleteMessage = async (messageId) => {
  const token = localStorage.getItem('userToken');
  const { data } = await API(token).delete(`/api/message/${messageId}`);
  return data;
};

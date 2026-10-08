import axios from 'axios';
import { toast } from 'react-toastify';
const serverUrl = process.env.REACT_APP_SERVER_URL || '';
const API = (token) =>
  axios.create({
    baseURL: serverUrl,
    headers: { Authorization: token },
  });
let url = serverUrl;
export const loginUser = async (body) => {
  return axios.post(`${url}/auth/login`, body);
};
export const googleAuth = async (body) => {
  return axios.post(`${url}/api/google`, body);
};
export const registerUser = async (body) => {
  return axios.post(`${url}/auth/register`, body);
};
export const validUser = async () => {
  try {
    const token = localStorage.getItem('userToken');

    const { data } = await API(token).get(`/auth/valid`, {
      headers: { Authorization: token },
    });
    return data;
  } catch (error) {
    console.log('error in valid user api');
  }
};
export const searchUsers = async (id) => {
  try {
    const token = localStorage.getItem('userToken');

    return await API(token).get(`/api/user?search=${id}`);
  } catch (error) {
    console.log('error in search users api');
  }
};
export const updateUser = async (id, body) => {
  try {
    const token = localStorage.getItem('userToken');

    const { data } = await API(token).patch(`/api/users/update/${id}`, body);
    return data;
  } catch (error) {
    console.log('error in update user api');
    toast.error('Something Went Wrong.try Again!');
  }
};
export const checkValid = async () => {
  const data = await validUser();
  if (!data?.user) {
    window.location.href = '/login';
  } else {
    window.location.href = '/chats';
  }
};

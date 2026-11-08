import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { toast } from 'react-toastify';
import { fetchAllChats } from '../apis/chat';
const initialState = {
  chats: [],
  activeChat: '',
  isLoading: false,
  notifications: [],
};
export const fetchChats = createAsyncThunk('redux/chats', async () => {
  try {
    const data = await fetchAllChats();
    return data;
  } catch (error) {
    toast.error('Something Went Wrong!Try Again');
  }
}, {
  // Chat updates can arrive as a burst of socket events. Keep just one
  // full-list request in flight instead of duplicating the same Supabase read.
  condition: (_, { getState }) => !getState().chats.isLoading,
});
const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
    setActiveChat: (state, { payload }) => {
      state.activeChat = payload;
    },
    setNotifications: (state, { payload }) => {
      state.notifications = payload;
    },
  },
  extraReducers: {
    [fetchChats.pending]: (state) => {
      state.isLoading = true;
    },
    [fetchChats.fulfilled]: (state, { payload }) => {
      state.chats = payload;
      state.isLoading = false;
    },
    [fetchChats.rejected]: (state) => {
      state.isLoading = false;
    },
  },
});
export const { setActiveChat, setNotifications } = chatsSlice.actions;
export default chatsSlice.reducer;

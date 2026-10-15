import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  id: '',
  email: '',
  profilePic: '',
  bio: '',
  name: '',
  isAdmin: false,
  isOwner: false,
  title: 'Member',
};

const activeUserSlice = createSlice({
  name: 'activeUser',
  initialState,
  reducers: {
    setActiveUser: (state, { payload }) => {
      state.id = payload.id;
      state.email = payload.email;
      state.profilePic = payload.profilePic;
      state.bio = payload.bio;
      state.name = payload.name;
      state.isAdmin = Boolean(payload.isAdmin);
      state.isOwner = Boolean(payload.isOwner);
      state.title = payload.title || (payload.isAdmin ? 'Administrator' : 'Member');
    },
    setUserNameAndBio: (state, { payload }) => {
      state.name = payload.name;
      state.bio = payload.bio;
    },
  },
});
export const { setActiveUser, setUserNameAndBio } = activeUserSlice.actions;
export default activeUserSlice.reducer;

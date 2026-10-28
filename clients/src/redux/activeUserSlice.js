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
  approved: true,
  onboardingChatId: null,
  theme: null,
  themeSettings: null,
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
      state.approved = payload.approved !== false;
      state.onboardingChatId = payload.onboardingChatId || null;
      state.theme = payload.theme || null;
      state.themeSettings = payload.themeSettings || null;
    },
    setUserNameAndBio: (state, { payload }) => {
      state.name = payload.name;
      state.bio = payload.bio;
      if (payload.theme) state.theme = payload.theme;
      if (payload.themeSettings) state.themeSettings = payload.themeSettings;
    },
    setUserThemeSettings: (state, { payload }) => {
      state.themeSettings = payload;
    },
  },
});
export const { setActiveUser, setUserNameAndBio, setUserThemeSettings } = activeUserSlice.actions;
export default activeUserSlice.reducer;

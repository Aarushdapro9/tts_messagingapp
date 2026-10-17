import { createSlice } from "@reduxjs/toolkit";
const initialState = {
  showProfile: false,
  showNotifications: false,
  selectedUser: null,
};
const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    setShowProfile: (state, { payload }) => {
      state.showProfile = payload;
    },
    setShowNotifications: (state, { payload }) => {
      state.showNotifications = payload;
    },
    setSelectedUser: (state, { payload }) => {
      state.selectedUser = payload;
    },
  },
});
export const { setShowProfile, setShowNotifications, setSelectedUser } = profileSlice.actions;
export default profileSlice.reducer;

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import communitiesReducer from './communitiesSlice';
import userReducer from './userSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    communities: communitiesReducer,
    user: userReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;

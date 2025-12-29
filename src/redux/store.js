import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import communitiesReducer from './communitiesSlice';
import userReducer from './userSlice';
import postsReducer from './postsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    communities: communitiesReducer,
    user: userReducer,
    posts: postsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;

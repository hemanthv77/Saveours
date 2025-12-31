import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import communitiesReducer from './communitiesSlice';
import userReducer from './userSlice';
import postsReducer from './postsSlice';
import cartReducer from './cartSlice';
import notificationsReducer from './notificationsSlice';
import creatorOrdersReducer from './creatorOrdersSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    communities: communitiesReducer,
    user: userReducer,
    posts: postsReducer,
    cart: cartReducer,
    notifications: notificationsReducer,
    creatorOrders: creatorOrdersReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;

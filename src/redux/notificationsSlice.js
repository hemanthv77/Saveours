import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import firestore from '@react-native-firebase/firestore';

// Store unsubscribe function globally
let unsubscribeNotifications = null;

// ============================================================
// ASYNC THUNKS
// ============================================================

// Fetch notifications for a user
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (userId, { rejectWithValue }) => {
    try {
      // Query without orderBy to avoid needing composite index
      const snapshot = await firestore()
        .collection('notifications')
        .where('userId', '==', userId)
        .get();

      const notifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toMillis() || Date.now(),
      }));

      // Sort client-side by createdAt descending (newest first)
      notifications.sort((a, b) => b.createdAt - a.createdAt);

      // Return only the most recent 50
      return notifications.slice(0, 50);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return rejectWithValue(error.message);
    }
  }
);

// Subscribe to real-time notifications
export const subscribeToNotifications = createAsyncThunk(
  'notifications/subscribe',
  async (userId, { dispatch, rejectWithValue }) => {
    try {
      // Unsubscribe from any existing listener
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
        unsubscribeNotifications = null;
      }

      // Set up real-time listener
      unsubscribeNotifications = firestore()
        .collection('notifications')
        .where('userId', '==', userId)
        .onSnapshot(
          (snapshot) => {
            const notifications = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toMillis() || Date.now(),
            }));

            // Sort client-side by createdAt descending
            notifications.sort((a, b) => b.createdAt - a.createdAt);

            // Dispatch action to update state
            dispatch(setNotifications(notifications.slice(0, 50)));
          },
          (error) => {
            console.error('Notifications listener error:', error);
          }
        );

      return true;
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
      return rejectWithValue(error.message);
    }
  }
);

// Unsubscribe from notifications
export const unsubscribeFromNotifications = () => {
  if (unsubscribeNotifications) {
    unsubscribeNotifications();
    unsubscribeNotifications = null;
  }
};

// Mark notification as read
export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      await firestore()
        .collection('notifications')
        .doc(notificationId)
        .update({ read: true });

      return notificationId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Mark all notifications as read
export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (userId, { rejectWithValue }) => {
    try {
      const snapshot = await firestore()
        .collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .get();

      const batch = firestore().batch();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { read: true });
      });
      await batch.commit();

      return true;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// ============================================================
// INITIAL STATE
// ============================================================
const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

// ============================================================
// SLICE
// ============================================================
const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Set notifications from real-time listener
    setNotifications: (state, action) => {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter((n) => !n.read).length;
      state.loading = false;
    },
    // Add new notification (from real-time listener)
    addNotification: (state, action) => {
      const notification = action.payload;
      // Avoid duplicates
      const exists = state.notifications.find((n) => n.id === notification.id);
      if (!exists) {
        state.notifications.unshift(notification);
        if (!notification.read) {
          state.unreadCount += 1;
        }
      }
    },
    // Update notification
    updateNotification: (state, action) => {
      const { id, ...updates } = action.payload;
      const index = state.notifications.findIndex((n) => n.id === id);
      if (index !== -1) {
        state.notifications[index] = { ...state.notifications[index], ...updates };
      }
    },
    // Clear notifications
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    // Set unread count
    setUnreadCount: (state, action) => {
      state.unreadCount = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload;
        state.unreadCount = action.payload.filter((n) => !n.read).length;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Mark as read
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const index = state.notifications.findIndex((n) => n.id === action.payload);
        if (index !== -1 && !state.notifications[index].read) {
          state.notifications[index].read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      // Mark all as read
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.notifications = state.notifications.map((n) => ({ ...n, read: true }));
        state.unreadCount = 0;
      });
  },
});

// ============================================================
// SELECTORS
// ============================================================
export const selectNotifications = (state) => state.notifications.notifications;
export const selectUnreadCount = (state) => state.notifications.unreadCount;
export const selectNotificationsLoading = (state) => state.notifications.loading;
export const selectNotificationsError = (state) => state.notifications.error;
export const selectOrderNotifications = (state) =>
  state.notifications.notifications.filter((n) => n.type === 'new_order');

// ============================================================
// EXPORTS
// ============================================================
export const {
  setNotifications,
  addNotification,
  updateNotification,
  clearNotifications,
  setUnreadCount,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;

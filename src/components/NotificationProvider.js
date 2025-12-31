import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import {
  subscribeToNotifications,
  unsubscribeFromNotifications,
} from '../redux/notificationsSlice';
import { useNotificationService } from '../services/NotificationService';

/**
 * Global notification provider that subscribes to real-time notifications
 * when a user is logged in. Wrap this around your navigation to ensure
 * notifications are received throughout the app.
 */
const NotificationProvider = ({ children }) => {
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.auth?.user);

  // Initialize push notification service
  useNotificationService(currentUser?.uid);

  useEffect(() => {
    if (currentUser?.uid) {
      // Subscribe to real-time in-app notifications
      dispatch(subscribeToNotifications(currentUser.uid));
    } else {
      // Unsubscribe when user logs out
      unsubscribeFromNotifications();
    }

    // Cleanup on unmount
    return () => {
      unsubscribeFromNotifications();
    };
  }, [dispatch, currentUser?.uid]);

  return children;
};

export default NotificationProvider;

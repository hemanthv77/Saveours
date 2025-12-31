import { useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { useNavigation } from '@react-navigation/native';
import {
  requestNotificationPermission,
  getFCMToken,
  saveFCMToken,
} from './firebase';

// ============================================================
// NOTIFICATION NAVIGATION HANDLER
// ============================================================

/**
 * Handle navigation based on notification data
 * @param {Object} data - Notification data payload
 * @param {Object} navigation - React Navigation object
 */
export const handleNotificationNavigation = (data, navigation) => {
  if (!data || !navigation) return;

  const { type, orderId, chatId, communityId, postId } = data;

  switch (type) {
    case 'new_order':
      // Seller received a new order - go to their orders
      if (orderId) {
        navigation.navigate('OrderDetail', { orderId });
      } else {
        navigation.navigate('MyOrders', { postId });
      }
      break;

    case 'order_confirmed':
    case 'order_preparing':
    case 'order_ready':
    case 'order_completed':
    case 'order_cancelled':
      // Buyer received order status update
      if (orderId) {
        navigation.navigate('OrderDetail', { orderId });
      }
      break;

    case 'new_message':
      // New chat message
      if (chatId) {
        navigation.navigate('Chat', { chatId });
      }
      break;

    case 'join_request_approved':
      // User's join request was approved
      if (communityId) {
        navigation.navigate('CommunityFeed', { communityId });
      }
      break;

    case 'join_request_pending':
      // Admin has pending join requests
      if (communityId) {
        navigation.navigate('CommunityDetail', { communityId });
      }
      break;

    default:
      // Default - go to communities/home
      navigation.navigate('Communities');
  }
};

// ============================================================
// IN-APP NOTIFICATION DISPLAY
// ============================================================

/**
 * Show in-app notification when app is in foreground
 * Uses Alert as a simple fallback - can be replaced with toast library
 * @param {Object} remoteMessage - FCM remote message object
 * @param {Object} navigation - React Navigation object (optional)
 */
export const showInAppNotification = (remoteMessage, navigation = null) => {
  const { notification, data } = remoteMessage;

  if (!notification) return;

  const title = notification.title || 'Notification';
  const body = notification.body || '';

  Alert.alert(
    title,
    body,
    [
      {
        text: 'Dismiss',
        style: 'cancel',
      },
      {
        text: 'View',
        onPress: () => {
          if (navigation && data) {
            handleNotificationNavigation(data, navigation);
          }
        },
      },
    ],
    { cancelable: true }
  );
};

// ============================================================
// NOTIFICATION SERVICE HOOK
// ============================================================

/**
 * Custom hook to set up and manage push notifications
 * Should be used in a component that has access to navigation
 * @param {string} userId - Current user's ID
 * @returns {Object} - Notification service status
 */
export const useNotificationService = (userId) => {
  const navigation = useNavigation();

  // Setup notifications
  const setupNotifications = useCallback(async () => {
    if (!userId) return false;

    try {
      const hasPermission = await requestNotificationPermission();

      if (hasPermission) {
        const token = await getFCMToken();
        if (token) {
          await saveFCMToken(userId, token);
          console.log('Push notifications initialized successfully');
          return true;
        }
      } else {
        console.log('Notification permission denied');
      }
      return false;
    } catch (error) {
      console.error('Error setting up notifications:', error);
      return false;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Setup notifications on mount
    setupNotifications();

    // Handle token refresh
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
      console.log('FCM Token refreshed');
      await saveFCMToken(userId, token);
    });

    // Handle foreground notifications (app is open)
    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground notification received:', remoteMessage);

      // Show in-app notification
      showInAppNotification(remoteMessage, navigation);
    });

    // Handle background notification tap (app was in background)
    const unsubscribeBackground = messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app from background:', remoteMessage);

      if (remoteMessage?.data) {
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          handleNotificationNavigation(remoteMessage.data, navigation);
        }, 500);
      }
    });

    // Check if app was opened from a notification (when app was quit)
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('App opened from quit state via notification:', remoteMessage);

          // Delay navigation to ensure app is fully loaded
          setTimeout(() => {
            handleNotificationNavigation(remoteMessage.data, navigation);
          }, 1000);
        }
      })
      .catch((error) => {
        console.error('Error getting initial notification:', error);
      });

    // Cleanup
    return () => {
      unsubscribeTokenRefresh();
      unsubscribeForeground();
      unsubscribeBackground();
    };
  }, [userId, navigation, setupNotifications]);

  return {
    setupNotifications,
  };
};

// ============================================================
// BACKGROUND MESSAGE HANDLER
// ============================================================

/**
 * Set up background message handler
 * This should be called in index.js before AppRegistry.registerComponent
 */
export const setBackgroundMessageHandler = () => {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('Background message handled:', remoteMessage);

    // You can do silent data processing here
    // Note: This runs when the app is in background/quit
    // The notification will be shown automatically by FCM
    // This handler is for data-only messages or additional processing
  });
};

export default {
  useNotificationService,
  handleNotificationNavigation,
  showInAppNotification,
  setBackgroundMessageHandler,
};

import firestore from '@react-native-firebase/firestore';

/**
 * Send notification to a user
 * Creates a notification document that triggers a Cloud Function to send FCM push
 */
export const sendNotificationToUser = async (userId, notification) => {
  try {
    // Get user's FCM token from Firestore
    const userDoc = await firestore()
      .collection('users')
      .doc(userId)
      .get();

    if (!userDoc.exists) return;

    const fcmToken = userDoc.data().fcmToken;
    if (!fcmToken) return;

    // Create notification document (triggers Cloud Function)
    await firestore()
      .collection('notifications')
      .add({
        recipientId: userId,
        fcmToken: fcmToken,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sent: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

/**
 * Get status title for order status updates
 */
const getStatusTitle = (status) => {
  const titles = {
    confirmed: 'Order Confirmed! ✅',
    preparing: 'Order Being Prepared 👨‍🍳',
    ready: 'Order Ready for Pickup! 🎉',
    completed: 'Order Completed',
    cancelled: 'Order Cancelled',
  };
  return titles[status] || 'Order Update';
};

/**
 * Get status body message for order status updates
 */
const getStatusBody = (status, sellerName) => {
  const bodies = {
    confirmed: `${sellerName} confirmed your order`,
    preparing: `${sellerName} is preparing your food`,
    ready: `Your order is ready! Pick it up now`,
    completed: 'Thanks for your order!',
    cancelled: 'Your order was cancelled',
  };
  return bodies[status] || 'Your order status has changed';
};

/**
 * Notification templates for different events
 */
export const NotificationTemplates = {
  newOrder: (sellerName, buyerName, total, orderId) => ({
    title: 'New Order! 🎉',
    body: `${buyerName} ordered ₹${total} from your kitchen`,
    data: {
      type: 'new_order',
      orderId: orderId,
    },
  }),

  orderStatusUpdate: (status, sellerName, orderId) => ({
    title: getStatusTitle(status),
    body: getStatusBody(status, sellerName),
    data: {
      type: 'order_status_update',
      orderId: orderId,
      status: status,
    },
  }),

  newMessage: (senderName, messagePreview, chatId) => ({
    title: `${senderName}`,
    body: messagePreview,
    data: {
      type: 'new_message',
      chatId: chatId,
    },
  }),

  joinRequestApproved: (communityName, communityId) => ({
    title: 'Join Request Approved! ✅',
    body: `You've been accepted to ${communityName}`,
    data: {
      type: 'join_request_approved',
      communityId: communityId,
    },
  }),

  joinRequestPending: (requesterName, communityName, requestId) => ({
    title: 'New Join Request',
    body: `${requesterName} wants to join ${communityName}`,
    data: {
      type: 'join_request_pending',
      requestId: requestId,
    },
  }),
};

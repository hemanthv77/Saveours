import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import firestore from '@react-native-firebase/firestore';

// ============================================================
// ASYNC THUNKS
// ============================================================

// Fetch orders for a seller (creator)
export const fetchSellerOrders = createAsyncThunk(
  'creatorOrders/fetchSellerOrders',
  async (params, { rejectWithValue }) => {
    try {
      // Handle both string (sellerId) and object { sellerId, postId } params
      const sellerId = typeof params === 'string' ? params : params.sellerId;
      const postId = typeof params === 'object' ? params.postId : undefined;

      let query = firestore()
        .collection('orders')
        .where('sellerId', '==', sellerId);

      if (postId) {
        query = query.where('postId', '==', postId);
      }

      // Get without orderBy to avoid needing composite index
      const snapshot = await query.get();

      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toMillis() || Date.now(),
        updatedAt: doc.data().updatedAt?.toMillis() || Date.now(),
        estimatedReadyTime: doc.data().estimatedReadyTime?.toMillis() || null,
      }));

      // Sort client-side by createdAt descending (newest first)
      orders.sort((a, b) => b.createdAt - a.createdAt);

      return orders;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Update order status
export const updateOrderStatus = createAsyncThunk(
  'creatorOrders/updateOrderStatus',
  async ({ orderId, status, buyerId, sellerName, cancelNote }, { rejectWithValue }) => {
    try {
      const orderRef = firestore().collection('orders').doc(orderId);
      
      const updateData = {
        orderStatus: status,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      // Add cancel note if provided
      if (status === 'cancelled' && cancelNote) {
        updateData.cancelNote = cancelNote;
        updateData.cancelledAt = firestore.FieldValue.serverTimestamp();
      }

      await orderRef.update(updateData);

      // If cancelled, release reserved portions back to the post
      if (status === 'cancelled') {
        try {
          // Get the order to find out how many portions to release
          const orderDoc = await orderRef.get();
          const orderData = orderDoc.data();
          
          if (orderData?.postId && orderData?.items) {
            const postRef = firestore().collection('posts').doc(orderData.postId);
            
            // Calculate total portions to release
            let totalPortionsToRelease = 0;
            orderData.items.forEach((item) => {
              totalPortionsToRelease += item.quantity || 1;
            });

            // Release the portions back (increment available, decrement reserved)
            await postRef.update({
              portionsAvailable: firestore.FieldValue.increment(totalPortionsToRelease),
              portionsReserved: firestore.FieldValue.increment(-totalPortionsToRelease),
            });
          }
        } catch (releaseErr) {
          console.error('Error releasing portions on cancel:', releaseErr);
          // Don't fail the cancellation if portion release fails
        }
      }

      // Create notification for buyer based on status
      let notificationMessage = '';
      let notificationType = '';

      switch (status) {
        case 'confirmed':
          notificationMessage = `${sellerName} has confirmed your order!`;
          notificationType = 'order_confirmed';
          break;
        case 'preparing':
          notificationMessage = `${sellerName} is preparing your order`;
          notificationType = 'order_preparing';
          break;
        case 'ready':
          notificationMessage = `Your order is ready for pickup from ${sellerName}!`;
          notificationType = 'order_ready';
          break;
        case 'completed':
          notificationMessage = `Your order from ${sellerName} has been completed. Thank you!`;
          notificationType = 'order_completed';
          break;
        case 'cancelled':
          notificationMessage = cancelNote 
            ? `Your order from ${sellerName} has been cancelled. Reason: ${cancelNote}`
            : `Your order from ${sellerName} has been cancelled`;
          notificationType = 'order_cancelled';
          break;
        default:
          break;
      }

      if (notificationMessage && buyerId) {
        await firestore().collection('notifications').add({
          userId: buyerId,
          type: notificationType,
          title: getNotificationTitle(status),
          body: notificationMessage,
          data: {
            orderId: orderId,
          },
          read: false,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      return { orderId, status };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Helper function for notification titles
const getNotificationTitle = (status) => {
  switch (status) {
    case 'confirmed':
      return 'Order Confirmed';
    case 'preparing':
      return 'Order Being Prepared';
    case 'ready':
      return 'Order Ready for Pickup!';
    case 'completed':
      return 'Order Completed';
    case 'cancelled':
      return 'Order Cancelled';
    default:
      return 'Order Update';
  }
};

// ============================================================
// INITIAL STATE
// ============================================================
const initialState = {
  orders: [],
  activeOrders: [],
  completedOrders: [],
  loading: false,
  error: null,
  orderCounts: {}, // { postId: count }
};

// ============================================================
// SLICE
// ============================================================
const creatorOrdersSlice = createSlice({
  name: 'creatorOrders',
  initialState,
  reducers: {
    // Set order counts for posts
    setOrderCounts: (state, action) => {
      state.orderCounts = action.payload;
    },
    // Update order count for a specific post
    updateOrderCount: (state, action) => {
      const { postId, count } = action.payload;
      state.orderCounts[postId] = count;
    },
    // Add new order (from real-time listener)
    addOrder: (state, action) => {
      const order = action.payload;
      const exists = state.orders.find((o) => o.id === order.id);
      if (!exists) {
        state.orders.unshift(order);
        // Update categorized lists
        if (['pending', 'confirmed', 'preparing', 'ready'].includes(order.orderStatus)) {
          state.activeOrders.unshift(order);
        } else {
          state.completedOrders.unshift(order);
        }
        // Update order count
        if (order.postId) {
          state.orderCounts[order.postId] = (state.orderCounts[order.postId] || 0) + 1;
        }
      }
    },
    // Clear orders
    clearOrders: (state) => {
      state.orders = [];
      state.activeOrders = [];
      state.completedOrders = [];
      state.orderCounts = {};
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch seller orders
      .addCase(fetchSellerOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSellerOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload;
        
        // Categorize orders
        state.activeOrders = action.payload.filter((o) =>
          ['pending', 'confirmed', 'preparing', 'ready'].includes(o.orderStatus)
        );
        state.completedOrders = action.payload.filter((o) =>
          ['completed', 'cancelled'].includes(o.orderStatus)
        );
      })
      .addCase(fetchSellerOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update order status
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        const { orderId, status } = action.payload;
        
        // Update in main orders list
        const orderIndex = state.orders.findIndex((o) => o.id === orderId);
        if (orderIndex !== -1) {
          state.orders[orderIndex].orderStatus = status;
        }

        // Move between active and completed if needed
        if (status === 'completed' || status === 'cancelled') {
          const activeIndex = state.activeOrders.findIndex((o) => o.id === orderId);
          if (activeIndex !== -1) {
            const order = { ...state.activeOrders[activeIndex], orderStatus: status };
            state.activeOrders.splice(activeIndex, 1);
            state.completedOrders.unshift(order);
          }
        } else {
          // Update in activeOrders
          const activeIndex = state.activeOrders.findIndex((o) => o.id === orderId);
          if (activeIndex !== -1) {
            state.activeOrders[activeIndex].orderStatus = status;
          }
        }
      });
  },
});

// ============================================================
// SELECTORS
// ============================================================
export const selectAllOrders = (state) => state.creatorOrders.orders;
export const selectActiveOrders = (state) => state.creatorOrders.activeOrders;
export const selectCompletedOrders = (state) => state.creatorOrders.completedOrders;
export const selectOrdersLoading = (state) => state.creatorOrders.loading;
export const selectOrdersError = (state) => state.creatorOrders.error;
export const selectOrderCounts = (state) => state.creatorOrders.orderCounts;
export const selectOrderCountForPost = (postId) => (state) =>
  state.creatorOrders.orderCounts[postId] || 0;

// ============================================================
// EXPORTS
// ============================================================
export const {
  setOrderCounts,
  updateOrderCount,
  addOrder,
  clearOrders,
} = creatorOrdersSlice.actions;

export default creatorOrdersSlice.reducer;

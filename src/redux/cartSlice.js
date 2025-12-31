import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

// ============================================================
// CONSTANTS
// ============================================================
const CART_STORAGE_KEY = '@saveours_cart';
const CART_EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds
const PLATFORM_FEE_PERCENT = 0.02; // 2%

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Calculate total from items
const calculateTotal = (items) => {
  return items.reduce((total, item) => total + (item.subtotal || 0), 0);
};

// Calculate item count
const calculateItemCount = (items) => {
  return items.reduce((count, item) => count + (item.quantity || 0), 0);
};

// Calculate platform fee (2% of total)
const calculatePlatformFee = (total) => {
  return Math.round(total * PLATFORM_FEE_PERCENT * 100) / 100;
};

// ============================================================
// ASYNC THUNKS
// ============================================================

// Add item to cart with Firestore reservation
export const addToCartAsync = createAsyncThunk(
  'cart/addToCartAsync',
  async ({ postId, sellerId, sellerName, sellerAvatar, communityId, communityName, dish, quantity = 1 }, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState();
      const currentCart = state.cart;

      // Check if cart is from different seller
      if (currentCart.sellerId && currentCart.sellerId !== sellerId && currentCart.items.length > 0) {
        return rejectWithValue('Cart contains items from a different seller');
      }

      // Reserve portion in Firestore
      const postRef = firestore().collection('posts').doc(postId);
      
      await firestore().runTransaction(async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists) {
          throw new Error('Post no longer exists');
        }

        const postData = postDoc.data();
        const dishIndex = postData.dishes.findIndex((d) => d.dishId === dish.dishId);
        
        if (dishIndex === -1) {
          throw new Error('Dish no longer available');
        }

        const currentDish = postData.dishes[dishIndex];
        const available = currentDish.portionsAvailable - (currentDish.portionsReserved || 0) - (currentDish.portionsSold || 0);

        if (available < quantity) {
          throw new Error(`Only ${available} portions available`);
        }

        // Update reserved portions
        const updatedDishes = [...postData.dishes];
        updatedDishes[dishIndex] = {
          ...currentDish,
          portionsReserved: (currentDish.portionsReserved || 0) + quantity,
        };

        transaction.update(postRef, { dishes: updatedDishes });
      });

      // Prepare item data
      const item = {
        dishId: dish.dishId,
        dishName: dish.name || dish.dishName,
        dishPhoto: dish.photoUrl || dish.photos?.[0] || null,
        pricePerPortion: dish.pricePerPortion,
        quantity,
        maxQuantity: dish.portionsAvailable - (dish.portionsReserved || 0) - (dish.portionsSold || 0),
        subtotal: dish.pricePerPortion * quantity,
      };

      // Save to AsyncStorage
      const newCart = {
        items: [...currentCart.items.filter((i) => i.dishId !== dish.dishId), item],
        postId,
        sellerId,
        sellerName,
        sellerAvatar,
        communityId,
        communityName,
        expiryTime: currentCart.expiryTime || Date.now() + CART_EXPIRY_TIME,
        lastUpdated: Date.now(),
      };

      // Merge quantities if item exists
      const existingIndex = currentCart.items.findIndex((i) => i.dishId === dish.dishId);
      if (existingIndex !== -1) {
        const existingItem = currentCart.items[existingIndex];
        newCart.items = currentCart.items.map((i) =>
          i.dishId === dish.dishId
            ? {
                ...i,
                quantity: i.quantity + quantity,
                subtotal: (i.quantity + quantity) * i.pricePerPortion,
              }
            : i
        );
      }

      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));

      return {
        item,
        postId,
        sellerId,
        sellerName,
        sellerAvatar,
        communityId,
        communityName,
        expiryTime: newCart.expiryTime,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Remove item from cart with Firestore release
export const removeFromCartAsync = createAsyncThunk(
  'cart/removeFromCartAsync',
  async ({ dishId, postId, quantity = 1 }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const currentCart = state.cart;
      const item = currentCart.items.find((i) => i.dishId === dishId);

      if (!item) {
        return rejectWithValue('Item not found in cart');
      }

      // Release portion in Firestore
      const postRef = firestore().collection('posts').doc(postId || currentCart.postId);
      
      await firestore().runTransaction(async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists) return;

        const postData = postDoc.data();
        const dishIndex = postData.dishes.findIndex((d) => d.dishId === dishId);
        
        if (dishIndex === -1) return;

        const currentDish = postData.dishes[dishIndex];
        const updatedDishes = [...postData.dishes];
        updatedDishes[dishIndex] = {
          ...currentDish,
          portionsReserved: Math.max(0, (currentDish.portionsReserved || 0) - quantity),
        };

        transaction.update(postRef, { dishes: updatedDishes });
      });

      // Update AsyncStorage
      const newItems = currentCart.items.filter((i) => i.dishId !== dishId);
      
      if (newItems.length === 0) {
        await AsyncStorage.removeItem(CART_STORAGE_KEY);
      } else {
        const newCart = {
          ...currentCart,
          items: newItems,
          lastUpdated: Date.now(),
        };
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
      }

      return { dishId, quantity };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Clear entire cart with Firestore release
export const clearCartAsync = createAsyncThunk(
  'cart/clearCartAsync',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const currentCart = state.cart;

      if (currentCart.items.length === 0) {
        await AsyncStorage.removeItem(CART_STORAGE_KEY);
        return { success: true };
      }

      // Release all reserved portions in Firestore
      const postRef = firestore().collection('posts').doc(currentCart.postId);
      
      await firestore().runTransaction(async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists) return;

        const postData = postDoc.data();
        const updatedDishes = postData.dishes.map((dish) => {
          const cartItem = currentCart.items.find((i) => i.dishId === dish.dishId);
          if (cartItem) {
            return {
              ...dish,
              portionsReserved: Math.max(0, (dish.portionsReserved || 0) - cartItem.quantity),
            };
          }
          return dish;
        });

        transaction.update(postRef, { dishes: updatedDishes });
      });

      await AsyncStorage.removeItem(CART_STORAGE_KEY);

      return { success: true };
    } catch (error) {
      console.error('Error clearing cart:', error);
      // Still clear local cart even if Firestore fails
      await AsyncStorage.removeItem(CART_STORAGE_KEY);
      return { success: true };
    }
  }
);

// Load cart from AsyncStorage on app start
export const loadCartAsync = createAsyncThunk(
  'cart/loadCartAsync',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const savedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
      
      if (!savedCart) {
        return null;
      }

      const cart = JSON.parse(savedCart);

      // Check if cart has expired
      if (cart.expiryTime && Date.now() > cart.expiryTime) {
        // Cart expired - clear it
        await dispatch(clearCartAsync());
        return null;
      }

      // Validate portions still available
      if (cart.postId && cart.items.length > 0) {
        const postDoc = await firestore()
          .collection('posts')
          .doc(cart.postId)
          .get();

        if (!postDoc.exists) {
          await AsyncStorage.removeItem(CART_STORAGE_KEY);
          return null;
        }

        const postData = postDoc.data();
        
        // Check if post is still active
        if (postData.status !== 'active') {
          await AsyncStorage.removeItem(CART_STORAGE_KEY);
          return null;
        }

        // Update max quantities based on current availability
        const updatedItems = cart.items.map((item) => {
          const dish = postData.dishes.find((d) => d.dishId === item.dishId);
          if (dish) {
            const available = dish.portionsAvailable - (dish.portionsReserved || 0) - (dish.portionsSold || 0);
            return {
              ...item,
              maxQuantity: available + item.quantity, // Include already reserved by this cart
              quantity: Math.min(item.quantity, available + item.quantity),
              subtotal: Math.min(item.quantity, available + item.quantity) * item.pricePerPortion,
            };
          }
          return null;
        }).filter(Boolean);

        if (updatedItems.length === 0) {
          await AsyncStorage.removeItem(CART_STORAGE_KEY);
          return null;
        }

        return {
          ...cart,
          items: updatedItems,
        };
      }

      return cart;
    } catch (error) {
      console.error('Error loading cart:', error);
      return rejectWithValue(error.message);
    }
  }
);

// ============================================================
// INITIAL STATE
// ============================================================
const initialState = {
  items: [], // Array of cart items
  postId: null,
  sellerId: null,
  sellerName: null,
  sellerAvatar: null,
  communityId: null,
  communityName: null,
  total: 0,
  itemCount: 0,
  expiryTime: null, // Timestamp when cart expires
  isActive: false,
  lastUpdated: null,
  loading: false,
  error: null,
};

// ============================================================
// SLICE
// ============================================================
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    // Add item to cart (sync version for simple cases)
    addToCart: (state, action) => {
      const { 
        dishId, 
        dishName, 
        dishPhoto, 
        pricePerPortion, 
        quantity = 1, 
        maxQuantity,
        postId, 
        sellerId, 
        sellerName, 
        sellerAvatar,
        communityId, 
        communityName 
      } = action.payload;

      // If cart is from different seller, clear it first
      if (state.sellerId && state.sellerId !== sellerId && state.items.length > 0) {
        state.items = [];
      }

      // Set cart metadata
      state.sellerId = sellerId;
      state.sellerName = sellerName;
      state.sellerAvatar = sellerAvatar || null;
      state.postId = postId;
      state.communityId = communityId;
      state.communityName = communityName;
      state.isActive = true;
      state.lastUpdated = Date.now();

      // Set expiry time if cart is new
      if (!state.expiryTime) {
        state.expiryTime = Date.now() + CART_EXPIRY_TIME;
      }

      // Check if item already exists
      const existingIndex = state.items.findIndex((item) => item.dishId === dishId);
      
      if (existingIndex !== -1) {
        // Update quantity
        const newQuantity = state.items[existingIndex].quantity + quantity;
        state.items[existingIndex].quantity = newQuantity;
        state.items[existingIndex].subtotal = newQuantity * pricePerPortion;
      } else {
        // Add new item
        state.items.push({
          dishId,
          dishName,
          dishPhoto,
          pricePerPortion,
          quantity,
          maxQuantity: maxQuantity || 10,
          subtotal: pricePerPortion * quantity,
        });
      }

      // Update totals
      state.total = calculateTotal(state.items);
      state.itemCount = calculateItemCount(state.items);
    },

    // Update item quantity
    updateQuantity: (state, action) => {
      const { dishId, quantity } = action.payload;
      const itemIndex = state.items.findIndex((item) => item.dishId === dishId);
      
      if (itemIndex !== -1) {
        if (quantity <= 0) {
          // Remove item if quantity is 0 or less
          state.items.splice(itemIndex, 1);
          
          // Clear cart metadata if no items left
          if (state.items.length === 0) {
            return initialState;
          }
        } else {
          state.items[itemIndex].quantity = quantity;
          state.items[itemIndex].subtotal = quantity * state.items[itemIndex].pricePerPortion;
        }
      }

      // Update totals
      state.total = calculateTotal(state.items);
      state.itemCount = calculateItemCount(state.items);
      state.lastUpdated = Date.now();
    },

    // Update max quantity for an item
    updateMaxQuantity: (state, action) => {
      const { dishId, maxQuantity } = action.payload;
      const itemIndex = state.items.findIndex((item) => item.dishId === dishId);
      
      if (itemIndex !== -1) {
        state.items[itemIndex].maxQuantity = maxQuantity;
        // Adjust quantity if it exceeds max
        if (state.items[itemIndex].quantity > maxQuantity) {
          state.items[itemIndex].quantity = maxQuantity;
          state.items[itemIndex].subtotal = maxQuantity * state.items[itemIndex].pricePerPortion;
        }
      }

      // Update totals
      state.total = calculateTotal(state.items);
      state.itemCount = calculateItemCount(state.items);
    },

    // Remove item from cart
    removeFromCart: (state, action) => {
      const { dishId } = action.payload;
      state.items = state.items.filter((item) => item.dishId !== dishId);

      // Clear cart metadata if no items left
      if (state.items.length === 0) {
        return initialState;
      }

      // Update totals
      state.total = calculateTotal(state.items);
      state.itemCount = calculateItemCount(state.items);
      state.lastUpdated = Date.now();
    },

    // Clear entire cart
    clearCart: () => {
      return initialState;
    },

    // Set cart expiry time
    setCartExpiry: (state, action) => {
      state.expiryTime = action.payload;
    },

    // Load cart from storage
    loadCartFromStorage: (state, action) => {
      const loadedCart = action.payload;
      if (loadedCart) {
        state.items = loadedCart.items || [];
        state.postId = loadedCart.postId;
        state.sellerId = loadedCart.sellerId;
        state.sellerName = loadedCart.sellerName;
        state.sellerAvatar = loadedCart.sellerAvatar;
        state.communityId = loadedCart.communityId;
        state.communityName = loadedCart.communityName;
        state.expiryTime = loadedCart.expiryTime;
        state.lastUpdated = loadedCart.lastUpdated;
        state.isActive = state.items.length > 0;
        state.total = calculateTotal(state.items);
        state.itemCount = calculateItemCount(state.items);
      }
    },

    // Refresh cart expiry (called when user interacts with cart)
    refreshCartExpiry: (state) => {
      if (state.items.length > 0) {
        state.expiryTime = Date.now() + CART_EXPIRY_TIME;
        state.lastUpdated = Date.now();
      }
    },

    // Check and clear expired cart
    checkCartExpiry: (state) => {
      if (state.expiryTime && Date.now() > state.expiryTime) {
        return initialState;
      }
    },

    // Set error
    setError: (state, action) => {
      state.error = action.payload;
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // addToCartAsync
    builder
      .addCase(addToCartAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addToCartAsync.fulfilled, (state, action) => {
        const { item, postId, sellerId, sellerName, sellerAvatar, communityId, communityName, expiryTime } = action.payload;
        
        state.loading = false;
        state.postId = postId;
        state.sellerId = sellerId;
        state.sellerName = sellerName;
        state.sellerAvatar = sellerAvatar;
        state.communityId = communityId;
        state.communityName = communityName;
        state.expiryTime = expiryTime;
        state.isActive = true;
        state.lastUpdated = Date.now();

        // Check if item already exists
        const existingIndex = state.items.findIndex((i) => i.dishId === item.dishId);
        if (existingIndex !== -1) {
          state.items[existingIndex] = item;
        } else {
          state.items.push(item);
        }

        // Update totals
        state.total = calculateTotal(state.items);
        state.itemCount = calculateItemCount(state.items);
      })
      .addCase(addToCartAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // removeFromCartAsync
      .addCase(removeFromCartAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeFromCartAsync.fulfilled, (state, action) => {
        const { dishId } = action.payload;
        state.loading = false;
        state.items = state.items.filter((item) => item.dishId !== dishId);

        // Clear cart metadata if no items left
        if (state.items.length === 0) {
          return initialState;
        }

        // Update totals
        state.lastUpdated = Date.now();
        state.total = calculateTotal(state.items);
        state.itemCount = calculateItemCount(state.items);
      })
      .addCase(removeFromCartAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // clearCartAsync
      .addCase(clearCartAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(clearCartAsync.fulfilled, () => {
        return initialState;
      })
      .addCase(clearCartAsync.rejected, () => {
        // Still reset to initial state as we cleared local storage
        return initialState;
      })
      // loadCartAsync
      .addCase(loadCartAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadCartAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          const loadedCart = action.payload;
          state.items = loadedCart.items || [];
          state.postId = loadedCart.postId;
          state.sellerId = loadedCart.sellerId;
          state.sellerName = loadedCart.sellerName;
          state.sellerAvatar = loadedCart.sellerAvatar;
          state.communityId = loadedCart.communityId;
          state.communityName = loadedCart.communityName;
          state.expiryTime = loadedCart.expiryTime;
          state.lastUpdated = loadedCart.lastUpdated;
          state.isActive = state.items.length > 0;
          state.total = calculateTotal(state.items);
          state.itemCount = calculateItemCount(state.items);
        }
      })
      .addCase(loadCartAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

// ============================================================
// SELECTORS
// ============================================================

// Basic selectors
export const selectCartItems = (state) => state.cart.items;
export const selectCartItemCount = (state) => state.cart.itemCount;
export const selectCartTotal = (state) => state.cart.total;
export const selectCartSellerId = (state) => state.cart.sellerId;
export const selectCartSellerName = (state) => state.cart.sellerName;
export const selectCartSellerAvatar = (state) => state.cart.sellerAvatar;
export const selectCartPostId = (state) => state.cart.postId;
export const selectCartCommunityId = (state) => state.cart.communityId;
export const selectCartCommunityName = (state) => state.cart.communityName;
export const selectCartExpiryTime = (state) => state.cart.expiryTime;
export const selectCartLoading = (state) => state.cart.loading;
export const selectCartError = (state) => state.cart.error;
export const selectCartLastUpdated = (state) => state.cart.lastUpdated;

// Derived selectors
export const selectIsCartEmpty = (state) => state.cart.items.length === 0;
export const selectIsCartActive = (state) => state.cart.isActive && state.cart.items.length > 0;

export const selectCartSeller = (state) => ({
  sellerId: state.cart.sellerId,
  sellerName: state.cart.sellerName,
  sellerAvatar: state.cart.sellerAvatar,
});

export const selectCartTimeRemaining = (state) => {
  if (!state.cart.expiryTime) return null;
  const remaining = state.cart.expiryTime - Date.now();
  return remaining > 0 ? remaining : 0;
};

export const selectCartPlatformFee = (state) => {
  return calculatePlatformFee(state.cart.total);
};

export const selectCartTotalWithFee = (state) => {
  const fee = calculatePlatformFee(state.cart.total);
  return Math.round((state.cart.total + fee) * 100) / 100;
};

// Item-specific selectors (use with selector creator pattern)
export const selectCartItemQuantity = (dishId) => (state) => {
  const item = state.cart.items.find((i) => i.dishId === dishId);
  return item ? item.quantity : 0;
};

export const selectHasItemInCart = (dishId) => (state) => {
  return state.cart.items.some((item) => item.dishId === dishId);
};

export const selectCartItem = (dishId) => (state) => {
  return state.cart.items.find((item) => item.dishId === dishId) || null;
};

// Legacy selector (for backwards compatibility)
export const selectCartExpiresAt = (state) => state.cart.expiryTime;

// ============================================================
// EXPORTS
// ============================================================

export const {
  addToCart,
  updateQuantity,
  updateMaxQuantity,
  removeFromCart,
  clearCart,
  setCartExpiry,
  loadCartFromStorage,
  refreshCartExpiry,
  checkCartExpiry,
  setError,
  clearError,
} = cartSlice.actions;

// Export helper functions for use in components
export { calculateTotal, calculateItemCount, calculatePlatformFee, CART_EXPIRY_TIME, PLATFORM_FEE_PERCENT };

export default cartSlice.reducer;

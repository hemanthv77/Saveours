import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

// ============================================================
// CONSTANTS
// ============================================================
const CART_STORAGE_KEY = '@saveours_cart';
const CART_EXPIRY_MINUTES = 10;
const PLATFORM_FEE_PERCENT = 0.02; // 2%

// ============================================================
// ASYNC STORAGE OPERATIONS
// ============================================================

/**
 * Save cart to AsyncStorage
 * @param {Object} cart - Cart object to save
 */
export const saveCartToStorage = async (cart) => {
  try {
    const cartString = JSON.stringify(cart);
    await AsyncStorage.setItem(CART_STORAGE_KEY, cartString);
  } catch (error) {
    console.error('Error saving cart:', error);
  }
};

/**
 * Load cart from AsyncStorage
 * @returns {Object|null} - Cart object or null if not found/expired
 */
export const loadCartFromStorage = async () => {
  try {
    const cartString = await AsyncStorage.getItem(CART_STORAGE_KEY);
    if (cartString) {
      const cart = JSON.parse(cartString);
      
      // Check if expired
      if (cart.expiryTime && Date.now() > cart.expiryTime) {
        await clearCartFromStorage();
        return null;
      }
      
      return cart;
    }
    return null;
  } catch (error) {
    console.error('Error loading cart:', error);
    return null;
  }
};

/**
 * Clear cart from AsyncStorage
 */
export const clearCartFromStorage = async () => {
  try {
    await AsyncStorage.removeItem(CART_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing cart:', error);
  }
};

// ============================================================
// FIRESTORE PORTION OPERATIONS
// ============================================================

/**
 * Reserve portion in Firestore
 * @param {string} postId - Post document ID
 * @param {string} dishId - Dish ID within the post
 * @param {number} quantity - Number of portions to reserve
 * @returns {boolean} - Success status
 */
export const reservePortion = async (postId, dishId, quantity = 1) => {
  try {
    const postRef = firestore().collection('posts').doc(postId);
    
    await firestore().runTransaction(async (transaction) => {
      const postDoc = await transaction.get(postRef);
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      const dishes = [...postDoc.data().dishes];
      const dishIndex = dishes.findIndex((d) => d.dishId === dishId);
      
      if (dishIndex === -1) {
        throw new Error('Dish not found');
      }
      
      const dish = dishes[dishIndex];
      const reserved = dish.portionsReserved || 0;
      const sold = dish.portionsSold || 0;
      const available = dish.portionsAvailable - reserved - sold;
      
      if (available < quantity) {
        throw new Error('Insufficient portions available');
      }
      
      // Increment portionsReserved
      dishes[dishIndex] = {
        ...dish,
        portionsReserved: reserved + quantity,
      };
      transaction.update(postRef, { dishes });
    });
    
    return true;
  } catch (error) {
    console.error('Error reserving portion:', error);
    throw error;
  }
};

/**
 * Release portion in Firestore
 * @param {string} postId - Post document ID
 * @param {string} dishId - Dish ID within the post
 * @param {number} quantity - Number of portions to release
 * @returns {boolean} - Success status
 */
export const releasePortion = async (postId, dishId, quantity = 1) => {
  try {
    const postRef = firestore().collection('posts').doc(postId);
    
    await firestore().runTransaction(async (transaction) => {
      const postDoc = await transaction.get(postRef);
      
      if (!postDoc.exists) return;
      
      const dishes = [...postDoc.data().dishes];
      const dishIndex = dishes.findIndex((d) => d.dishId === dishId);
      
      if (dishIndex === -1) return;
      
      // Decrement portionsReserved
      dishes[dishIndex] = {
        ...dishes[dishIndex],
        portionsReserved: Math.max(0, (dishes[dishIndex].portionsReserved || 0) - quantity),
      };
      transaction.update(postRef, { dishes });
    });
    
    return true;
  } catch (error) {
    console.error('Error releasing portion:', error);
    throw error;
  }
};

/**
 * Convert reserved portions to sold (on successful checkout)
 * @param {string} postId - Post document ID
 * @param {string} dishId - Dish ID within the post
 * @param {number} quantity - Number of portions to convert
 * @returns {boolean} - Success status
 */
export const convertReservedToSold = async (postId, dishId, quantity) => {
  try {
    const postRef = firestore().collection('posts').doc(postId);
    
    await firestore().runTransaction(async (transaction) => {
      const postDoc = await transaction.get(postRef);
      
      if (!postDoc.exists) throw new Error('Post not found');
      
      const dishes = [...postDoc.data().dishes];
      const dishIndex = dishes.findIndex((d) => d.dishId === dishId);
      
      if (dishIndex === -1) throw new Error('Dish not found');
      
      const dish = dishes[dishIndex];
      
      // Decrement reserved, increment sold
      dishes[dishIndex] = {
        ...dish,
        portionsReserved: Math.max(0, (dish.portionsReserved || 0) - quantity),
        portionsSold: (dish.portionsSold || 0) + quantity,
      };
      
      transaction.update(postRef, { dishes });
    });
    
    return true;
  } catch (error) {
    console.error('Error converting portion:', error);
    throw error;
  }
};

/**
 * Batch convert all cart items from reserved to sold
 * @param {string} postId - Post document ID
 * @param {Array} items - Array of cart items with dishId and quantity
 * @returns {boolean} - Success status
 */
export const convertAllReservedToSold = async (postId, items) => {
  try {
    const postRef = firestore().collection('posts').doc(postId);
    
    await firestore().runTransaction(async (transaction) => {
      const postDoc = await transaction.get(postRef);
      
      if (!postDoc.exists) throw new Error('Post not found');
      
      const dishes = [...postDoc.data().dishes];
      
      items.forEach((item) => {
        const dishIndex = dishes.findIndex((d) => d.dishId === item.dishId);
        if (dishIndex !== -1) {
          const dish = dishes[dishIndex];
          dishes[dishIndex] = {
            ...dish,
            portionsReserved: Math.max(0, (dish.portionsReserved || 0) - item.quantity),
            portionsSold: (dish.portionsSold || 0) + item.quantity,
          };
        }
      });
      
      transaction.update(postRef, { dishes });
    });
    
    return true;
  } catch (error) {
    console.error('Error converting portions:', error);
    throw error;
  }
};

/**
 * Release all cart items' portions
 * @param {string} postId - Post document ID
 * @param {Array} items - Array of cart items with dishId and quantity
 * @returns {boolean} - Success status
 */
export const releaseAllPortions = async (postId, items) => {
  try {
    const postRef = firestore().collection('posts').doc(postId);
    
    await firestore().runTransaction(async (transaction) => {
      const postDoc = await transaction.get(postRef);
      
      if (!postDoc.exists) return;
      
      const dishes = [...postDoc.data().dishes];
      
      items.forEach((item) => {
        const dishIndex = dishes.findIndex((d) => d.dishId === item.dishId);
        if (dishIndex !== -1) {
          dishes[dishIndex] = {
            ...dishes[dishIndex],
            portionsReserved: Math.max(0, (dishes[dishIndex].portionsReserved || 0) - item.quantity),
          };
        }
      });
      
      transaction.update(postRef, { dishes });
    });
    
    return true;
  } catch (error) {
    console.error('Error releasing portions:', error);
    throw error;
  }
};

// ============================================================
// CALCULATION HELPERS
// ============================================================

/**
 * Calculate platform fee (2% of amount)
 * @param {number} amount - Base amount
 * @returns {number} - Platform fee
 */
export const calculatePlatformFee = (amount) => {
  return Math.round(amount * PLATFORM_FEE_PERCENT * 100) / 100;
};

/**
 * Calculate grand total (amount + platform fee)
 * @param {number} itemTotal - Subtotal of items
 * @returns {number} - Grand total
 */
export const calculateGrandTotal = (itemTotal) => {
  const platformFee = calculatePlatformFee(itemTotal);
  return Math.round((itemTotal + platformFee) * 100) / 100;
};

/**
 * Calculate cart subtotal from items
 * @param {Array} items - Cart items
 * @returns {number} - Subtotal
 */
export const calculateCartSubtotal = (items) => {
  return items.reduce((total, item) => {
    return total + (item.pricePerPortion * item.quantity);
  }, 0);
};

/**
 * Calculate total item count
 * @param {Array} items - Cart items
 * @returns {number} - Total quantity
 */
export const calculateItemCount = (items) => {
  return items.reduce((count, item) => count + item.quantity, 0);
};

// ============================================================
// FORMATTING HELPERS
// ============================================================

/**
 * Format currency (Indian Rupees)
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount) => {
  return `₹${amount.toFixed(2)}`;
};

/**
 * Format currency without decimals
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
export const formatCurrencyWhole = (amount) => {
  return `₹${Math.round(amount)}`;
};

// ============================================================
// TIME HELPERS
// ============================================================

/**
 * Get cart expiry time (10 minutes from now)
 * @returns {number} - Expiry timestamp in milliseconds
 */
export const getCartExpiryTime = () => {
  return Date.now() + (CART_EXPIRY_MINUTES * 60 * 1000);
};

/**
 * Format time remaining until expiry
 * @param {number} expiryTime - Expiry timestamp in milliseconds
 * @returns {string} - Formatted time string (MM:SS)
 */
export const formatTimeRemaining = (expiryTime) => {
  const now = Date.now();
  const diff = expiryTime - now;
  
  if (diff <= 0) return 'Expired';
  
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Check if cart has expired
 * @param {number} expiryTime - Expiry timestamp in milliseconds
 * @returns {boolean} - True if expired
 */
export const isCartExpired = (expiryTime) => {
  if (!expiryTime) return false;
  return Date.now() > expiryTime;
};

/**
 * Get remaining milliseconds until expiry
 * @param {number} expiryTime - Expiry timestamp in milliseconds
 * @returns {number} - Remaining milliseconds (0 if expired)
 */
export const getTimeRemainingMs = (expiryTime) => {
  if (!expiryTime) return 0;
  const remaining = expiryTime - Date.now();
  return remaining > 0 ? remaining : 0;
};

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Validate if portions are still available
 * @param {string} postId - Post document ID
 * @param {string} dishId - Dish ID
 * @param {number} requestedQuantity - Quantity to validate
 * @returns {Object} - { available: boolean, maxAvailable: number }
 */
export const validatePortionAvailability = async (postId, dishId, requestedQuantity) => {
  try {
    const postDoc = await firestore()
      .collection('posts')
      .doc(postId)
      .get();
    
    if (!postDoc.exists) {
      return { available: false, maxAvailable: 0, error: 'Post not found' };
    }
    
    const dishes = postDoc.data().dishes;
    const dish = dishes.find((d) => d.dishId === dishId);
    
    if (!dish) {
      return { available: false, maxAvailable: 0, error: 'Dish not found' };
    }
    
    const reserved = dish.portionsReserved || 0;
    const sold = dish.portionsSold || 0;
    const maxAvailable = dish.portionsAvailable - reserved - sold;
    
    return {
      available: maxAvailable >= requestedQuantity,
      maxAvailable,
      error: null,
    };
  } catch (error) {
    console.error('Error validating portions:', error);
    return { available: false, maxAvailable: 0, error: error.message };
  }
};

/**
 * Check if post is still active
 * @param {string} postId - Post document ID
 * @returns {boolean} - True if active
 */
export const isPostActive = async (postId) => {
  try {
    const postDoc = await firestore()
      .collection('posts')
      .doc(postId)
      .get();
    
    if (!postDoc.exists) return false;
    
    const postData = postDoc.data();
    return postData.status === 'active';
  } catch (error) {
    console.error('Error checking post status:', error);
    return false;
  }
};

// ============================================================
// EXPORTS
// ============================================================
export {
  CART_STORAGE_KEY,
  CART_EXPIRY_MINUTES,
  PLATFORM_FEE_PERCENT,
};

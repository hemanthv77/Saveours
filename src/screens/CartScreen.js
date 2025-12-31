import React, { useState, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Redux
import {
  addToCart,
  updateQuantity,
  removeFromCart,
  clearCart,
  refreshCartExpiry,
  checkCartExpiry,
  selectCartItems,
  selectCartItemCount,
  selectCartTotal,
  selectIsCartEmpty,
  selectCartExpiresAt,
  selectCartSellerId,
  selectCartSellerName,
  selectCartPostId,
  selectCartCommunityId,
} from '../redux/cartSlice';

// Utils
import { formatPostTime } from '../utils/timeHelpers';

// ============================================================
// CONSTANTS
// ============================================================
const COLORS = {
  primary: '#FF6B4A',
  background: '#F5F5F5',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  error: '#FF3B30',
  border: '#E0E0E0',
  overlay: 'rgba(0, 0, 0, 0.5)',
  success: '#34C759',
  warning: '#FF9500',
  timerBg: '#FFF3E0',
  cardBg: '#F8F8F8',
};

const PLATFORM_FEE_PERCENT = 0.02; // 2%
const CART_STORAGE_KEY = '@saveours_cart';

// ============================================================
// CART SCREEN COMPONENT
// ============================================================
const CartScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();

  // Route params
  const {
    postId: routePostId,
    sellerId: routeSellerId,
    sellerName: routeSellerName,
    dishes: routeDishes,
  } = route.params || {};

  // Redux cart state
  const cartItems = useSelector(selectCartItems);
  const cartItemCount = useSelector(selectCartItemCount);
  const cartTotal = useSelector(selectCartTotal);
  const isCartEmpty = useSelector(selectIsCartEmpty);
  const cartExpiresAt = useSelector(selectCartExpiresAt);
  const cartSellerId = useSelector(selectCartSellerId);
  const cartSellerName = useSelector(selectCartSellerName);
  const cartPostId = useSelector(selectCartPostId);
  const cartCommunityId = useSelector(selectCartCommunityId);

  // Local state
  const [loading, setLoading] = useState(true);
  const [postData, setPostData] = useState(null);
  const [sellerData, setSellerData] = useState(null);
  const [cartTimeRemaining, setCartTimeRemaining] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [updatingQuantity, setUpdatingQuantity] = useState({}); // { dishId: boolean }

  // Current user
  const currentUserId = auth().currentUser?.uid;

  // Determine which post to use (from route or existing cart)
  const activePostId = routePostId || cartPostId;
  const activeSellerId = routeSellerId || cartSellerId;
  const activeSellerName = routeSellerName || cartSellerName;

  // ============================================================
  // HEADER SETUP
  // ============================================================
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: "Today's Cart",
      headerTitleAlign: 'center',
      headerShadowVisible: true,
      headerStyle: {
        backgroundColor: COLORS.white,
      },
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
      },
    });
  }, [navigation]);

  // ============================================================
  // CART EXPIRY TIMER
  // ============================================================
  useEffect(() => {
    if (!cartExpiresAt) {
      setCartTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const remaining = cartExpiresAt - Date.now();
      if (remaining <= 0) {
        handleCartExpired();
      } else {
        setCartTimeRemaining(remaining);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [cartExpiresAt]);

  // ============================================================
  // CART CONFLICT CHECK
  // ============================================================
  useEffect(() => {
    if (!routePostId || !routeSellerId) return;

    // Check if cart has items from different seller
    if (cartSellerId && cartSellerId !== routeSellerId && cartItems.length > 0) {
      Alert.alert(
        'Start New Order?',
        `You have items from ${cartSellerName}'s kitchen. Starting a new order will clear your current cart.\n\nCurrent cart: ₹${cartTotal.toFixed(2)} (${cartItemCount} items)`,
        [
          {
            text: 'Keep Current Cart',
            style: 'cancel',
            onPress: () => {
              // Stay with current cart, don't load new dishes
            },
          },
          {
            text: 'Start New Order',
            style: 'destructive',
            onPress: () => {
              handleClearCartAndStart();
            },
          },
        ]
      );
    }
  }, [routePostId, routeSellerId]);

  // ============================================================
  // LOAD POST DATA (Real-time listener)
  // ============================================================
  useEffect(() => {
    if (!activePostId) {
      setLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection('posts')
      .doc(activePostId)
      .onSnapshot(
        (doc) => {
          if (!doc.exists) {
            Alert.alert(
              'Menu Unavailable',
              'This menu is no longer available.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
            return;
          }

          const data = { id: doc.id, ...doc.data() };
          setPostData(data);

          // Check for stock changes
          if (cartItems.length > 0) {
            checkStockAvailability(data);
          }

          setLoading(false);
        },
        (error) => {
          console.error('Error loading post:', error);
          setLoading(false);
          Alert.alert('Error', 'Failed to load menu details.');
        }
      );

    return unsubscribe;
  }, [activePostId]);

  // ============================================================
  // LOAD SELLER DATA
  // ============================================================
  useEffect(() => {
    if (!activeSellerId) return;

    const loadSeller = async () => {
      try {
        const sellerDoc = await firestore()
          .collection('users')
          .doc(activeSellerId)
          .get();

        if (sellerDoc.exists) {
          setSellerData({ id: sellerDoc.id, ...sellerDoc.data() });
        }
      } catch (error) {
        console.error('Error loading seller:', error);
      }
    };

    loadSeller();
  }, [activeSellerId]);

  // ============================================================
  // PERSIST CART TO STORAGE
  // ============================================================
  useEffect(() => {
    const saveCart = async () => {
      try {
        const cartState = {
          items: cartItems,
          sellerId: cartSellerId,
          sellerName: cartSellerName,
          postId: cartPostId,
          communityId: cartCommunityId,
          expiresAt: cartExpiresAt,
        };
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState));
      } catch (error) {
        console.error('Error saving cart:', error);
      }
    };

    if (cartItems.length > 0) {
      saveCart();
    } else {
      AsyncStorage.removeItem(CART_STORAGE_KEY);
    }
  }, [cartItems, cartSellerId, cartPostId, cartExpiresAt]);

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  // Format timer display
  const formatTimer = useCallback((ms) => {
    if (!ms || ms <= 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Check stock availability for cart items
  const checkStockAvailability = useCallback((post) => {
    if (!post?.dishes || !cartItems.length) return;

    cartItems.forEach((cartItem) => {
      const dish = post.dishes.find((d) => d.id === cartItem.dishId || d.dishId === cartItem.dishId);
      if (!dish) {
        // Dish no longer exists
        Alert.alert(
          'Item Unavailable',
          `"${cartItem.dishName || 'Item'}" is no longer available.`,
          [{ text: 'OK' }]
        );
        dispatch(removeFromCart({ dishId: cartItem.dishId }));
      } else {
        const available = dish.portionsAvailable - (dish.portionsReserved || 0) - (dish.portionsSold || 0);
        if (available < cartItem.quantity) {
          if (available <= 0) {
            Alert.alert(
              'Item Sold Out',
              `"${cartItem.dishName || 'Item'}" is now sold out.`,
              [{ text: 'OK' }]
            );
            dispatch(removeFromCart({ dishId: cartItem.dishId }));
          } else {
            Alert.alert(
              'Stock Changed',
              `Only ${available} portions of "${cartItem.dishName || 'this item'}" are now available. Your quantity has been adjusted.`,
              [{ text: 'OK' }]
            );
            dispatch(updateQuantity({ dishId: cartItem.dishId, quantity: available }));
          }
        }
      }
    });
  }, [cartItems, dispatch]);

  // Handle cart expired
  const handleCartExpired = useCallback(async () => {
    // Release reserved portions
    await releaseAllReservations();
    dispatch(checkCartExpiry());
    Alert.alert(
      'Cart Expired',
      'Your cart has expired. Please add items again.',
      [{ text: 'OK' }]
    );
  }, [dispatch]);

  // Handle clear cart and start new order
  const handleClearCartAndStart = useCallback(async () => {
    await releaseAllReservations();
    dispatch(clearCart());
  }, [dispatch]);

  // Release all reserved portions
  const releaseAllReservations = useCallback(async () => {
    if (!cartPostId || cartItems.length === 0) return;

    try {
      const postRef = firestore().collection('posts').doc(cartPostId);
      const postDoc = await postRef.get();

      if (!postDoc.exists) return;

      const postData = postDoc.data();
      const updatedDishes = postData.dishes.map((dish) => {
        const cartItem = cartItems.find((item) => item.dishId === dish.id);
        if (cartItem) {
          return {
            ...dish,
            portionsReserved: Math.max(0, (dish.portionsReserved || 0) - cartItem.quantity),
          };
        }
        return dish;
      });

      await postRef.update({ dishes: updatedDishes });
    } catch (error) {
      console.error('Error releasing reservations:', error);
    }
  }, [cartPostId, cartItems]);

  // ============================================================
  // QUANTITY HANDLERS
  // ============================================================

  // Reserve portion in Firestore
  const reservePortion = useCallback(async (dishId, delta) => {
    if (!activePostId) return false;

    try {
      const postRef = firestore().collection('posts').doc(activePostId);
      const postDoc = await postRef.get();

      if (!postDoc.exists) return false;

      const postData = postDoc.data();
      const updatedDishes = postData.dishes.map((dish) => {
        if (dish.id === dishId) {
          const newReserved = Math.max(0, (dish.portionsReserved || 0) + delta);
          return { ...dish, portionsReserved: newReserved };
        }
        return dish;
      });

      await postRef.update({ dishes: updatedDishes });
      return true;
    } catch (error) {
      console.error('Error updating reservation:', error);
      return false;
    }
  }, [activePostId]);

  // Increment quantity
  const handleIncrement = useCallback(async (dish) => {
    const dishId = dish.dishId || dish.id;
    const cartItem = cartItems.find((item) => item.dishId === dishId);
    const currentQty = cartItem?.quantity || 0;
    const available = dish.portionsAvailable - (dish.portionsReserved || 0) - (dish.portionsSold || 0);

    if (currentQty >= available) {
      Alert.alert('Maximum Reached', `Only ${available} portions available.`);
      return;
    }

    setUpdatingQuantity((prev) => ({ ...prev, [dishId]: true }));

    // Reserve portion in Firestore
    const success = await reservePortion(dishId, 1);
    if (!success) {
      setUpdatingQuantity((prev) => ({ ...prev, [dishId]: false }));
      Alert.alert('Error', 'Failed to reserve portion. Please try again.');
      return;
    }

    // Update Redux
    if (cartItem) {
      dispatch(updateQuantity({ dishId, quantity: currentQty + 1 }));
    } else {
      dispatch(addToCart({
        dishId,
        dishName: dish.name,
        dishPhoto: dish.photoUrl || dish.photos?.[0],
        pricePerPortion: dish.pricePerPortion,
        quantity: 1,
        maxQuantity: available,
        postId: activePostId,
        sellerId: activeSellerId,
        sellerName: activeSellerName || postData?.userName,
        sellerAvatar: sellerData?.profilePhoto || null,
        communityId: postData?.communityId,
        communityName: postData?.communityName,
      }));
    }

    dispatch(refreshCartExpiry());
    setUpdatingQuantity((prev) => ({ ...prev, [dishId]: false }));
  }, [cartItems, dispatch, activePostId, activeSellerId, activeSellerName, postData, reservePortion]);

  // Decrement quantity
  const handleDecrement = useCallback(async (dish) => {
    const dishId = dish.dishId || dish.id;
    const cartItem = cartItems.find((item) => item.dishId === dishId);
    
    if (!cartItem || cartItem.quantity <= 0) return;

    const newQty = cartItem.quantity - 1;

    if (newQty === 0) {
      // Show confirmation
      Alert.alert(
        'Remove Item?',
        `Remove "${dish.name}" from your cart?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setUpdatingQuantity((prev) => ({ ...prev, [dishId]: true }));
              await reservePortion(dishId, -cartItem.quantity);
              dispatch(removeFromCart({ dishId }));
              setUpdatingQuantity((prev) => ({ ...prev, [dishId]: false }));
            },
          },
        ]
      );
      return;
    }

    setUpdatingQuantity((prev) => ({ ...prev, [dishId]: true }));

    // Release portion in Firestore
    const success = await reservePortion(dishId, -1);
    if (!success) {
      setUpdatingQuantity((prev) => ({ ...prev, [dishId]: false }));
      Alert.alert('Error', 'Failed to update. Please try again.');
      return;
    }

    dispatch(updateQuantity({ dishId, quantity: newQty }));
    dispatch(refreshCartExpiry());
    setUpdatingQuantity((prev) => ({ ...prev, [dishId]: false }));
  }, [cartItems, dispatch, reservePortion]);

  // ============================================================
  // NAVIGATION HANDLERS
  // ============================================================

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleDismissCart = useCallback(() => {
    if (isCartEmpty) {
      navigation.goBack();
      return;
    }

    Alert.alert(
      'Clear Cart?',
      'All items will be removed from your cart.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cart',
          style: 'destructive',
          onPress: async () => {
            await releaseAllReservations();
            dispatch(clearCart());
          },
        },
      ]
    );
  }, [isCartEmpty, dispatch, navigation, releaseAllReservations]);

  // Discard cart completely and go back to feed
  const handleDiscardCart = useCallback(async () => {
    if (isCartEmpty) {
      navigation.goBack();
      return;
    }

    Alert.alert(
      'Discard Cart?',
      'All items will be removed from your cart.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await releaseAllReservations();
            dispatch(clearCart());
            navigation.goBack();
          },
        },
      ]
    );
  }, [isCartEmpty, dispatch, navigation, releaseAllReservations]);

  const handleBackToFeed = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleCheckout = useCallback(() => {
    if (isCartEmpty) return;

    navigation.navigate('Checkout', {
      cartItems,
      cartTotal,
      sellerId: cartSellerId,
      sellerName: cartSellerName,
      postId: cartPostId,
      specialInstructions,
    });
  }, [isCartEmpty, navigation, cartItems, cartTotal, cartSellerId, cartSellerName, cartPostId, specialInstructions]);

  const handleBrowseFood = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  // Get available dishes (from route or post data)
  const availableDishes = useMemo(() => {
    if (routeDishes) return routeDishes;
    if (postData?.dishes) return postData.dishes;
    return [];
  }, [routeDishes, postData]);

  // Calculate price breakdown
  const priceBreakdown = useMemo(() => {
    const itemTotal = cartTotal;
    const platformFee = Math.round(itemTotal * PLATFORM_FEE_PERCENT * 100) / 100;
    const deliveryFee = 0; // Self pickup
    const grandTotal = itemTotal + platformFee + deliveryFee;

    return {
      itemTotal,
      platformFee,
      deliveryFee,
      grandTotal,
    };
  }, [cartTotal]);

  // Get quantity for a dish
  const getQuantity = useCallback((dishId) => {
    const item = cartItems.find((i) => i.dishId === dishId);
    return item?.quantity || 0;
  }, [cartItems]);

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  // Render seller info section
  const renderSellerInfo = () => {
    const sellerDisplayName = sellerData?.firstName
      ? `${sellerData.firstName} ${sellerData.lastName || ''}`.trim()
      : activeSellerName || 'Seller';
    
    const postedTime = postData?.createdAt
      ? formatPostTime(postData.createdAt?.toDate?.() || postData.createdAt)
      : '';

    return (
      <View style={styles.sellerCard}>
        <View style={styles.sellerRow}>
          {sellerData?.photoUrl ? (
            <Image source={{ uri: sellerData.photoUrl }} style={styles.sellerAvatar} />
          ) : (
            <View style={styles.sellerAvatarPlaceholder}>
              <Text style={styles.sellerAvatarText}>
                {sellerDisplayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerTitle}>
              Ordering from {sellerDisplayName}'s Kitchen
            </Text>
            {postedTime ? (
              <Text style={styles.sellerTime}>Posted {postedTime}</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  // Render dish item
  const renderDishItem = (dish, index) => {
    const dishId = dish.dishId || dish.id;
    const quantity = getQuantity(dishId);
    const available = dish.portionsAvailable - (dish.portionsReserved || 0) - (dish.portionsSold || 0);
    const isLowStock = available > 0 && available < 3;
    const isSoldOut = available <= 0;
    const isUpdating = updatingQuantity[dishId];
    const subtotal = quantity * dish.pricePerPortion;

    return (
      <View key={dishId || `dish-${index}`}>
        {index > 0 && <View style={styles.itemSeparator} />}
        <View style={styles.itemCard}>
          <View style={styles.itemRow}>
            {/* Left side - Photo and info */}
            <View style={styles.itemLeft}>
              {dish.photoUrl ? (
                <Image source={{ uri: dish.photoUrl }} style={styles.itemPhoto} />
              ) : dish.photos?.[0] ? (
                <Image source={{ uri: dish.photos[0] }} style={styles.itemPhoto} />
              ) : (
                <View style={styles.itemPhotoPlaceholder}>
                  <Text style={styles.itemPhotoIcon}>🍽️</Text>
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>{dish.name}</Text>
                <Text style={styles.itemPrice}>₹{dish.pricePerPortion}/portion</Text>
                <Text style={[
                  styles.itemAvailable,
                  isLowStock && styles.itemLowStock,
                  isSoldOut && styles.itemSoldOut,
                ]}>
                  {isSoldOut ? 'Sold out' : `${available} available`}
                </Text>
              </View>
            </View>

            {/* Right side - Quantity controls */}
            <View style={styles.itemRight}>
              {isUpdating ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={[
                      styles.quantityButton,
                      styles.quantityMinus,
                      quantity === 0 && styles.quantityButtonDisabled,
                    ]}
                    onPress={() => handleDecrement(dish)}
                    disabled={quantity === 0}
                    accessibilityLabel="Decrease quantity"
                  >
                    <Text style={[
                      styles.quantityButtonText,
                      quantity === 0 && styles.quantityButtonTextDisabled,
                    ]}>−</Text>
                  </TouchableOpacity>

                  <View style={styles.quantityDisplay}>
                    <Text style={styles.quantityText}>{quantity}</Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.quantityButton,
                      styles.quantityPlus,
                      (isSoldOut || quantity >= available) && styles.quantityButtonDisabled,
                    ]}
                    onPress={() => handleIncrement(dish)}
                    disabled={isSoldOut || quantity >= available}
                    accessibilityLabel="Increase quantity"
                  >
                    <Text style={[
                      styles.quantityButtonText,
                      styles.quantityPlusText,
                      (isSoldOut || quantity >= available) && styles.quantityButtonTextDisabled,
                    ]}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Subtotal */}
          {quantity > 0 && (
            <Text style={styles.itemSubtotal}>Subtotal: ₹{subtotal.toFixed(2)}</Text>
          )}
        </View>
      </View>
    );
  };

  // Render special instructions section
  const renderSpecialInstructions = () => (
    <View style={styles.instructionsSection}>
      <TouchableOpacity
        style={styles.instructionsHeader}
        onPress={() => setShowInstructions(!showInstructions)}
      >
        <Text style={styles.instructionsTitle}>
          {showInstructions ? '▼' : '▶'} Add special instructions
        </Text>
      </TouchableOpacity>
      {showInstructions && (
        <TextInput
          style={styles.instructionsInput}
          placeholder="No onions, extra spicy, etc."
          placeholderTextColor={COLORS.textMuted}
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={3}
          maxLength={200}
        />
      )}
    </View>
  );

  // Render price breakdown section
  const renderPriceBreakdown = () => (
    <View style={styles.priceCard}>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Item Total</Text>
        <Text style={styles.priceValue}>₹{priceBreakdown.itemTotal.toFixed(2)}</Text>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabelMuted}>Platform Fee (2%)</Text>
        <Text style={styles.priceValueMuted}>₹{priceBreakdown.platformFee.toFixed(2)}</Text>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabelMuted}>Delivery/Pickup</Text>
        <Text style={styles.priceValueMuted}>Self Pickup - Free</Text>
      </View>
      <View style={styles.priceSeparator} />
      <View style={styles.priceRow}>
        <Text style={styles.priceTotalLabel}>Total Amount</Text>
        <Text style={styles.priceTotalValue}>₹{priceBreakdown.grandTotal.toFixed(2)}</Text>
      </View>
    </View>
  );

  // Render cart timer section
  const renderCartTimer = () => {
    if (!cartTimeRemaining) return null;

    const isUrgent = cartTimeRemaining < 2 * 60 * 1000; // Less than 2 minutes

    return (
      <View style={[styles.timerCard, isUrgent && styles.timerCardUrgent]}>
        <Text style={styles.timerIcon}>⏱️</Text>
        <View style={styles.timerInfo}>
          <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
            Cart expires in {formatTimer(cartTimeRemaining)}
          </Text>
          <Text style={styles.timerSubtext}>Complete checkout before timer ends</Text>
        </View>
      </View>
    );
  };

  // Render empty cart state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🛒</Text>
      <Text style={styles.emptyTitle}>Your cart is empty</Text>
      <Text style={styles.emptySubtitle}>Add items from the community feed</Text>
      <TouchableOpacity style={styles.browseButton} onPress={handleBrowseFood}>
        <Text style={styles.browseButtonText}>Browse Food</Text>
      </TouchableOpacity>
    </View>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your cart...</Text>
      </View>
    );
  }

  // Empty cart state
  if (isCartEmpty && availableDishes.length === 0) {
    return (
      <View style={styles.container}>
        {renderEmptyState()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Seller Info */}
        {renderSellerInfo()}

        {/* Items Section */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Menu Items</Text>
          <View style={styles.itemsCard}>
            {availableDishes.map((dish, index) => renderDishItem(dish, index))}
          </View>
        </View>

        {/* Special Instructions */}
        {renderSpecialInstructions()}

        {/* Price Breakdown - only show if cart has items */}
        {!isCartEmpty && (
          <>
            {renderPriceBreakdown()}
            {renderCartTimer()}
          </>
        )}

        {/* Empty cart message if no items selected */}
        {isCartEmpty && availableDishes.length > 0 && (
          <View style={styles.noItemsMessage}>
            <Text style={styles.noItemsText}>
              Select items above to add them to your cart
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.discardButton}
          onPress={handleDiscardCart}
          activeOpacity={0.8}
        >
          <Text style={styles.discardButtonText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.checkoutButton, isCartEmpty && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={isCartEmpty}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.checkoutButtonText,
            isCartEmpty && styles.checkoutButtonTextDisabled,
          ]}>
            Checkout
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Custom Header
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: 4,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBackButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  headerBackIcon: {
    fontSize: 28,
    color: COLORS.text,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  headerPlaceholder: {
    width: 48,
    marginRight: 4,
  },

  // Legacy header styles (keeping for compatibility)
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dismissCartText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
  },

  // Seller card
  sellerCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  sellerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sellerAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  sellerTime: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Items section
  itemsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  itemsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  itemSeparator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  itemCard: {
    padding: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemLeft: {
    flex: 0.7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemPhotoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: COLORS.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemPhotoIcon: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2,
  },
  itemAvailable: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  itemLowStock: {
    color: COLORS.warning,
    fontWeight: '500',
  },
  itemSoldOut: {
    color: COLORS.error,
    fontWeight: '500',
  },
  itemRight: {
    flex: 0.3,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  quantityMinus: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  quantityPlus: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  quantityButtonDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  quantityPlusText: {
    color: COLORS.primary,
  },
  quantityButtonTextDisabled: {
    color: COLORS.border,
  },
  quantityDisplay: {
    width: 40,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemSubtotal: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 8,
  },

  // Special instructions
  instructionsSection: {
    marginBottom: 16,
  },
  instructionsHeader: {
    paddingVertical: 12,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  instructionsInput: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    textAlignVertical: 'top',
    minHeight: 80,
  },

  // Price breakdown
  priceCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  priceLabelMuted: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  priceValueMuted: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  priceSeparator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  priceTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  priceTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Timer
  timerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.timerBg,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  timerCardUrgent: {
    backgroundColor: '#FFEBEE',
  },
  timerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  timerInfo: {
    flex: 1,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
  },
  timerTextUrgent: {
    color: COLORS.error,
  },
  timerSubtext: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // No items message
  noItemsMessage: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noItemsText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    gap: 12,
  },
  discardButton: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    backgroundColor: COLORS.white,
  },
  discardButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.error,
  },
  backButton: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  checkoutButton: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  checkoutButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  checkoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  checkoutButtonTextDisabled: {
    color: COLORS.textMuted,
  },
});

export default CartScreen;

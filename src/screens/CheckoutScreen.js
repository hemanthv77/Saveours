import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendNotificationToUser, NotificationTemplates } from '../services/notificationSender';

// Redux
import {
  clearCart,
  selectCartItems,
  selectCartTotal,
  selectCartItemCount,
  selectCartPostId,
  selectCartSellerId,
  selectCartSellerName,
  selectCartCommunityId,
} from '../redux/cartSlice';

// ============================================================
// CONSTANTS
// ============================================================
const COLORS = {
  primary: '#FF6B4A',
  primaryLight: '#FFF0ED',
  background: '#F5F5F5',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  error: '#FF3B30',
  border: '#E0E0E0',
  success: '#34C759',
  warning: '#FF9500',
  infoBg: '#E3F2FD',
  infoText: '#1976D2',
  disabled: '#CCCCCC',
  disabledText: '#999999',
};

const PLATFORM_FEE_PERCENT = 0.02; // 2%
const CART_STORAGE_KEY = '@saveours_cart';

// Delivery methods
const DELIVERY_METHODS = {
  SELF_PICKUP: 'self_pickup',
  DELIVERY: 'delivery',
};

// Payment methods
const PAYMENT_METHODS = {
  CASH: 'cash',
  UPI: 'upi',
  CARD: 'card',
  NETBANKING: 'netbanking',
};

// ============================================================
// CHECKOUT SCREEN COMPONENT
// ============================================================
const CheckoutScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();

  // Route params (from CartScreen)
  const {
    specialInstructions: routeInstructions,
  } = route.params || {};

  // Redux cart state
  const cartItems = useSelector(selectCartItems);
  const cartTotal = useSelector(selectCartTotal);
  const cartItemCount = useSelector(selectCartItemCount);
  const cartPostId = useSelector(selectCartPostId);
  const cartSellerId = useSelector(selectCartSellerId);
  const cartSellerName = useSelector(selectCartSellerName);
  const cartCommunityId = useSelector(selectCartCommunityId);

  // Current user
  const currentUser = auth().currentUser;
  const currentUserId = currentUser?.uid;

  // Local state
  const [loading, setLoading] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState(DELIVERY_METHODS.SELF_PICKUP);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.CASH);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [instructions, setInstructions] = useState(routeInstructions || '');
  const [sellerData, setSellerData] = useState(null);
  const [userData, setUserData] = useState(null);

  // ============================================================
  // HEADER SETUP
  // ============================================================
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Checkout',
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
  // LOAD USER DATA
  // ============================================================
  useEffect(() => {
    if (!currentUserId) return;

    const loadUserData = async () => {
      try {
        const userDoc = await firestore()
          .collection('users')
          .doc(currentUserId)
          .get();

        if (userDoc.exists) {
          const data = userDoc.data();
          setUserData(data);
          setContactName(`${data.firstName || ''} ${data.lastName || ''}`.trim());
          setContactPhone(data.phone || '');
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [currentUserId]);

  // ============================================================
  // LOAD SELLER DATA
  // ============================================================
  useEffect(() => {
    if (!cartSellerId) return;

    const loadSellerData = async () => {
      try {
        const sellerDoc = await firestore()
          .collection('users')
          .doc(cartSellerId)
          .get();

        if (sellerDoc.exists) {
          setSellerData({ id: sellerDoc.id, ...sellerDoc.data() });
        }
      } catch (error) {
        console.error('Error loading seller data:', error);
      }
    };

    loadSellerData();
  }, [cartSellerId]);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  // Price breakdown
  const itemTotal = cartTotal;
  const platformFee = Math.round(itemTotal * PLATFORM_FEE_PERCENT * 100) / 100;
  const deliveryFee = deliveryMethod === DELIVERY_METHODS.SELF_PICKUP ? 0 : 0;
  const grandTotal = itemTotal + platformFee + deliveryFee;

  // Validation
  const isFormValid = 
    paymentMethod &&
    contactName.trim().length > 0 &&
    contactPhone.trim().length >= 10;

  // ============================================================
  // PLACE ORDER
  // ============================================================
  const handlePlaceOrder = useCallback(async () => {
    if (!isFormValid) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty.');
      return;
    }

    setPlacingOrder(true);

    try {
      // 1. Create order document
      const orderData = {
        buyerId: currentUserId,
        buyerName: contactName.trim(),
        buyerPhone: contactPhone.trim(),
        sellerId: cartSellerId,
        sellerName: cartSellerName,
        communityId: cartCommunityId,
        postId: cartPostId,
        items: cartItems.map((item) => ({
          dishId: item.dishId,
          dishName: item.dishName || 'Unknown',
          quantity: item.quantity,
          pricePerPortion: item.pricePerPortion || 0,
          subtotal: item.subtotal || (item.quantity * (item.pricePerPortion || 0)),
          dishPhoto: item.dishPhoto || null,
        })),
        itemTotal: itemTotal,
        platformFee: platformFee,
        deliveryFee: deliveryFee,
        totalAmount: grandTotal,
        deliveryMethod: deliveryMethod,
        paymentMethod: paymentMethod,
        paymentStatus: 'pending',
        orderStatus: 'pending',
        specialInstructions: instructions.trim(),
        pickupLocation: sellerData?.location || '',
        estimatedReadyTime: firestore.Timestamp.fromDate(
          new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
        ),
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      const orderRef = await firestore().collection('orders').add(orderData);
      const orderId = orderRef.id;

      // 2. Update post - convert reserved to sold portions
      if (cartPostId) {
        const postRef = firestore().collection('posts').doc(cartPostId);
        const postDoc = await postRef.get();

        if (postDoc.exists) {
          const postData = postDoc.data();
          const updatedDishes = postData.dishes.map((dish) => {
            const cartItem = cartItems.find((item) => item.dishId === dish.dishId || item.dishId === dish.id);
            if (cartItem) {
              return {
                ...dish,
                portionsReserved: Math.max(0, (dish.portionsReserved || 0) - cartItem.quantity),
                portionsSold: (dish.portionsSold || 0) + cartItem.quantity,
              };
            }
            return dish;
          });

          await postRef.update({ 
            dishes: updatedDishes,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      // 3. Create chat channel between buyer and seller
      const chatData = {
        participants: [currentUserId, cartSellerId],
        participantNames: {
          [currentUserId]: contactName.trim(),
          [cartSellerId]: cartSellerName,
        },
        orderId: orderId,
        postId: cartPostId,
        communityId: cartCommunityId,
        lastMessage: null,
        lastMessageTime: null,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection('chats').add(chatData);

      // 4. Create notification for seller
      const notificationData = {
        userId: cartSellerId,
        type: 'new_order',
        title: 'New Order Received!',
        body: `${contactName.trim()} ordered ${cartItemCount} item${cartItemCount > 1 ? 's' : ''} for ₹${grandTotal.toFixed(2)}`,
        data: {
          orderId: orderId,
          postId: cartPostId,
          postTitle: cartItems[0]?.dishName || 'Food Order',
          buyerId: currentUserId,
          buyerName: contactName.trim(),
          communityId: cartCommunityId,
        },
        read: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection('notifications').add(notificationData);

      // 4b. Send push notification to seller
      const pushNotification = NotificationTemplates.newOrder(
        cartSellerName,
        contactName.trim(),
        grandTotal,
        orderId
      );
      await sendNotificationToUser(cartSellerId, pushNotification);

      // 5. Clear cart from Redux and AsyncStorage
      dispatch(clearCart());
      await AsyncStorage.removeItem(CART_STORAGE_KEY);

      // 6. Navigate to Order Confirmation
      setPlacingOrder(false);
      navigation.replace('OrderConfirmation', { orderId });

    } catch (error) {
      console.error('Error placing order:', error);
      setPlacingOrder(false);

      // Handle specific errors
      if (error.code === 'permission-denied') {
        Alert.alert('Error', 'You do not have permission to place this order.');
      } else {
        Alert.alert(
          'Order Failed',
          'Failed to place your order. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }
  }, [
    isFormValid,
    cartItems,
    currentUserId,
    contactName,
    contactPhone,
    cartSellerId,
    cartSellerName,
    cartCommunityId,
    cartPostId,
    itemTotal,
    platformFee,
    deliveryFee,
    grandTotal,
    deliveryMethod,
    paymentMethod,
    instructions,
    sellerData,
    dispatch,
    navigation,
  ]);

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  // Order Summary Section
  const renderOrderSummary = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Order Summary</Text>
      <View style={styles.orderItems}>
        {cartItems.map((item) => (
          <View key={item.dishId} style={styles.orderItemRow}>
            <Text style={styles.orderItemText}>
              {item.quantity}x {item.dishName || 'Unknown'}
            </Text>
            <Text style={styles.orderItemPrice}>
              ₹{(item.subtotal || item.quantity * (item.pricePerPortion || 0)).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.orderTotalRow}>
        <Text style={styles.orderTotalLabel}>Total: {cartItemCount} items</Text>
      </View>
    </View>
  );

  // Delivery Method Section
  const renderDeliveryMethod = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Delivery Method</Text>
      
      {/* Self Pickup Option */}
      <TouchableOpacity
        style={[
          styles.optionCard,
          deliveryMethod === DELIVERY_METHODS.SELF_PICKUP && styles.optionCardSelected,
        ]}
        onPress={() => setDeliveryMethod(DELIVERY_METHODS.SELF_PICKUP)}
        accessibilityLabel="Select self pickup"
      >
        <View style={styles.optionIcon}>
          <Text style={styles.optionIconText}>🚶</Text>
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Self Pickup</Text>
          <Text style={styles.optionSubtext}>Pick up from seller's location - Free</Text>
        </View>
        <View style={[
          styles.radioButton,
          deliveryMethod === DELIVERY_METHODS.SELF_PICKUP && styles.radioButtonSelected,
        ]}>
          {deliveryMethod === DELIVERY_METHODS.SELF_PICKUP && (
            <View style={styles.radioButtonInner} />
          )}
        </View>
      </TouchableOpacity>

      {/* Delivery Option (Disabled) */}
      <View style={[styles.optionCard, styles.optionCardDisabled]}>
        <View style={styles.optionIcon}>
          <Text style={[styles.optionIconText, styles.optionIconDisabled]}>🚴</Text>
        </View>
        <View style={styles.optionContent}>
          <Text style={[styles.optionTitle, styles.optionTitleDisabled]}>Delivery</Text>
          <Text style={styles.optionSubtext}>Coming Soon</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SOON</Text>
        </View>
      </View>
    </View>
  );

  // Pickup Details
  const renderPickupDetails = () => {
    if (deliveryMethod !== DELIVERY_METHODS.SELF_PICKUP) return null;

    const sellerLocation = sellerData?.location || 'Location will be shared after order confirmation';

    return (
      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>📍</Text>
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Pickup Location</Text>
          <Text style={styles.infoText}>{sellerLocation}</Text>
          <Text style={styles.infoSubtext}>Ready in approximately 30 minutes</Text>
        </View>
      </View>
    );
  };

  // Payment Method Section
  const renderPaymentMethod = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Payment Method</Text>
      
      {/* Cash on Pickup */}
      <TouchableOpacity
        style={[
          styles.optionCard,
          paymentMethod === PAYMENT_METHODS.CASH && styles.optionCardSelected,
        ]}
        onPress={() => setPaymentMethod(PAYMENT_METHODS.CASH)}
        accessibilityLabel="Select cash on pickup"
      >
        <View style={styles.optionIcon}>
          <Text style={styles.optionIconText}>💵</Text>
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Cash on Pickup</Text>
          <Text style={styles.optionSubtext}>Pay with cash when you pick up</Text>
        </View>
        <View style={[
          styles.radioButton,
          paymentMethod === PAYMENT_METHODS.CASH && styles.radioButtonSelected,
        ]}>
          {paymentMethod === PAYMENT_METHODS.CASH && (
            <View style={styles.radioButtonInner} />
          )}
        </View>
      </TouchableOpacity>

      {/* UPI on Pickup */}
      <TouchableOpacity
        style={[
          styles.optionCard,
          paymentMethod === PAYMENT_METHODS.UPI && styles.optionCardSelected,
        ]}
        onPress={() => setPaymentMethod(PAYMENT_METHODS.UPI)}
        accessibilityLabel="Select UPI on pickup"
      >
        <View style={styles.optionIcon}>
          <Text style={styles.optionIconText}>📱</Text>
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>UPI on Pickup</Text>
          <Text style={styles.optionSubtext}>Pay via UPI when you pick up</Text>
        </View>
        <View style={[
          styles.radioButton,
          paymentMethod === PAYMENT_METHODS.UPI && styles.radioButtonSelected,
        ]}>
          {paymentMethod === PAYMENT_METHODS.UPI && (
            <View style={styles.radioButtonInner} />
          )}
        </View>
      </TouchableOpacity>

      {/* Credit/Debit Card (Disabled) */}
      <View style={[styles.optionCard, styles.optionCardDisabled]}>
        <View style={styles.optionIcon}>
          <Text style={[styles.optionIconText, styles.optionIconDisabled]}>💳</Text>
        </View>
        <View style={styles.optionContent}>
          <Text style={[styles.optionTitle, styles.optionTitleDisabled]}>Credit/Debit Card</Text>
          <Text style={styles.optionSubtext}>Online payment</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SOON</Text>
        </View>
      </View>

      {/* Net Banking (Disabled) */}
      <View style={[styles.optionCard, styles.optionCardDisabled]}>
        <View style={styles.optionIcon}>
          <Text style={[styles.optionIconText, styles.optionIconDisabled]}>🏦</Text>
        </View>
        <View style={styles.optionContent}>
          <Text style={[styles.optionTitle, styles.optionTitleDisabled]}>Net Banking</Text>
          <Text style={styles.optionSubtext}>Pay via bank transfer</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SOON</Text>
        </View>
      </View>
    </View>
  );

  // Contact Information Section
  const renderContactInfo = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Your Contact Info</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Name *</Text>
        <TextInput
          style={styles.textInput}
          value={contactName}
          onChangeText={setContactName}
          placeholder="Your full name"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Phone Number *</Text>
        <TextInput
          style={styles.textInput}
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="10-digit mobile number"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="phone-pad"
          maxLength={10}
        />
      </View>

      <Text style={styles.helperText}>
        Seller will use this to coordinate pickup
      </Text>
    </View>
  );

  // Special Instructions Section
  const renderSpecialInstructions = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Special Instructions (Optional)</Text>
      <TextInput
        style={[styles.textInput, styles.textInputMultiline]}
        value={instructions}
        onChangeText={setInstructions}
        placeholder="Any special requests or instructions?"
        placeholderTextColor={COLORS.textMuted}
        multiline
        numberOfLines={3}
        maxLength={200}
        textAlignVertical="top"
      />
    </View>
  );

  // Price Breakdown Section
  const renderPriceBreakdown = () => (
    <View style={[styles.card, styles.priceCard]}>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Item Total</Text>
        <Text style={styles.priceValue}>₹{itemTotal.toFixed(2)}</Text>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabelMuted}>Platform Fee (2%)</Text>
        <Text style={styles.priceValueMuted}>₹{platformFee.toFixed(2)}</Text>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabelMuted}>Delivery/Pickup</Text>
        <Text style={styles.priceValueMuted}>
          {deliveryMethod === DELIVERY_METHODS.SELF_PICKUP ? 'Free' : `₹${deliveryFee.toFixed(2)}`}
        </Text>
      </View>
      <View style={styles.priceSeparator} />
      <View style={styles.priceRow}>
        <Text style={styles.priceTotalLabel}>Total Amount</Text>
        <Text style={styles.priceTotalValue}>₹{grandTotal.toFixed(2)}</Text>
      </View>
    </View>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================

  if (cartItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>Add items to proceed to checkout</Text>
        <TouchableOpacity
          style={styles.browseButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.browseButtonText}>Go Back</Text>
        </TouchableOpacity>
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
        {renderOrderSummary()}
        {renderDeliveryMethod()}
        {renderPickupDetails()}
        {renderPaymentMethod()}
        {renderContactInfo()}
        {renderSpecialInstructions()}
        {renderPriceBreakdown()}
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomTotal}>
          <Text style={styles.bottomTotalLabel}>Total Amount</Text>
          <Text style={styles.bottomTotalValue}>₹{grandTotal.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            (!isFormValid || placingOrder) && styles.placeOrderButtonDisabled,
          ]}
          onPress={handlePlaceOrder}
          disabled={!isFormValid || placingOrder}
          activeOpacity={0.8}
        >
          {placingOrder ? (
            <View style={styles.placeOrderLoading}>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.placeOrderButtonText}>Placing Order...</Text>
            </View>
          ) : (
            <Text style={styles.placeOrderButtonText}>Place Order</Text>
          )}
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
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140,
  },

  // Cards
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },

  // Order Summary
  orderItems: {
    marginBottom: 12,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderItemText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  orderTotalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  orderTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },

  // Option Cards
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  optionCardDisabled: {
    opacity: 0.6,
    backgroundColor: COLORS.background,
  },
  optionIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionIconText: {
    fontSize: 24,
  },
  optionIconDisabled: {
    opacity: 0.5,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  optionTitleDisabled: {
    color: COLORS.textMuted,
  },
  optionSubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: COLORS.primary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  badge: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.infoBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.infoText,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Input
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },

  // Price Breakdown
  priceCard: {
    marginBottom: 100,
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
    marginVertical: 12,
  },
  priceTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  priceTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  },
  bottomTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bottomTotalLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  bottomTotalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  placeOrderButton: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeOrderButtonDisabled: {
    backgroundColor: COLORS.disabled,
  },
  placeOrderButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  placeOrderLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
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
});

export default CheckoutScreen;

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  BackHandler,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import Clipboard from '@react-native-clipboard/clipboard';

// ============================================================
// CONSTANTS
// ============================================================
const COLORS = {
  primary: '#FF6B4A',
  primaryLight: '#FFF0ED',
  background: '#FFFFFF',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  error: '#FF3B30',
  border: '#E0E0E0',
  success: '#34C759',
  successLight: '#E8F5E9',
  infoBlue: '#E3F2FD',
  infoBlueBorder: '#90CAF9',
};

// ============================================================
// CONFETTI PARTICLE COMPONENT
// ============================================================
const ConfettiParticle = ({ delay, startX }) => {
  const animY = useRef(new Animated.Value(-20)).current;
  const animX = useRef(new Animated.Value(0)).current;
  const animOpacity = useRef(new Animated.Value(1)).current;
  const animRotate = useRef(new Animated.Value(0)).current;

  const colors = ['#FF6B4A', '#FFD700', '#4CAF50', '#2196F3', '#9C27B0', '#E91E63'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = 8 + Math.random() * 8;

  useEffect(() => {
    const duration = 2500 + Math.random() * 1000;
    const xMovement = (Math.random() - 0.5) * 100;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(animY, {
          toValue: 700,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(animX, {
          toValue: xMovement,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(animRotate, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(animOpacity, {
          toValue: 0,
          duration,
          delay: duration * 0.7,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const rotate = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${360 + Math.random() * 360}deg`],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: 0,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: size / 4,
        opacity: animOpacity,
        transform: [
          { translateY: animY },
          { translateX: animX },
          { rotate },
        ],
      }}
    />
  );
};

// ============================================================
// ORDER CONFIRMATION SCREEN COMPONENT
// ============================================================
const OrderConfirmationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [copied, setCopied] = useState(false);

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ============================================================
  // HEADER SETUP - Hide header for full screen
  // ============================================================
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
  }, [navigation]);

  // ============================================================
  // PREVENT BACK NAVIGATION
  // ============================================================
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Prevent back button - return true to indicate handled
        return true;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      };
    }, [])
  );

  // ============================================================
  // ANIMATIONS
  // ============================================================
  useEffect(() => {
    // Success icon bounce animation
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      delay: 300,
      useNativeDriver: true,
    }).start();

    // Hide confetti after animation
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  // ============================================================
  // LOAD ORDER DATA
  // ============================================================
  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const loadOrder = async () => {
      try {
        const orderDoc = await firestore()
          .collection('orders')
          .doc(orderId)
          .get();

        if (orderDoc.exists) {
          setOrder({ id: orderDoc.id, ...orderDoc.data() });
        }
      } catch (error) {
        console.error('Error loading order:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

  // ============================================================
  // NAVIGATION HANDLERS
  // ============================================================
  const handleCopyOrderId = useCallback(() => {
    if (orderId) {
      Clipboard.setString(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [orderId]);

  const handleMessageSeller = useCallback(() => {
    if (order?.sellerId) {
      navigation.navigate('Chat', {
        sellerId: order.sellerId,
        sellerName: order.sellerName,
        orderId: orderId,
      });
    }
  }, [navigation, order, orderId]);

  const handleViewOrderDetails = useCallback(() => {
    // For now, navigate back to communities - can add OrderDetail screen later
    navigation.reset({
      index: 0,
      routes: [{ name: 'Communities' }],
    });
  }, [navigation]);

  const handleBackToFeed = useCallback(() => {
    if (order?.communityId) {
      // Reset navigation stack and go to CommunityFeed
      navigation.reset({
        index: 0,
        routes: [
          { name: 'Communities' },
          { 
            name: 'CommunityFeed', 
            params: {
              communityId: order.communityId,
              communityName: order.communityName || 'Community',
            }
          }
        ],
      });
    } else {
      // Fallback to Communities screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Communities' }],
      });
    }
  }, [navigation, order]);

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </SafeAreaView>
    );
  }

  const formatOrderId = (id) => {
    if (!id) return 'N/A';
    return `#${id.slice(-8).toUpperCase()}`;
  };

  const getPaymentMethodText = (method) => {
    switch (method) {
      case 'cash': return 'Cash on Pickup';
      case 'upi': return 'UPI on Pickup';
      default: return 'Pay on Pickup';
    }
  };

  const itemCount = order?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  // Generate confetti particles
  const confettiParticles = [];
  if (showConfetti) {
    for (let i = 0; i < 50; i++) {
      confettiParticles.push(
        <ConfettiParticle
          key={i}
          delay={Math.random() * 500}
          startX={Math.random() * 400}
        />
      );
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Confetti Animation */}
      {showConfetti && (
        <View style={styles.confettiContainer} pointerEvents="none">
          {confettiParticles}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon with Animation */}
        <Animated.View
          style={[
            styles.successIconContainer,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.successIcon}>
            <Text style={styles.successCheckmark}>✓</Text>
          </View>
        </Animated.View>

        {/* Success Message */}
        <Animated.View style={[styles.successTextContainer, { opacity: fadeAnim }]}>
          <Text style={styles.successTitle}>Order Placed Successfully!</Text>
        </Animated.View>

        {/* Order ID with Copy Button */}
        <Animated.View style={[styles.orderIdContainer, { opacity: fadeAnim }]}>
          <Text style={styles.orderIdText}>Order ID: {formatOrderId(orderId)}</Text>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyOrderId}
            activeOpacity={0.7}
          >
            <Text style={styles.copyButtonText}>{copied ? '✓' : '📋'}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Order Details Card */}
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <Text style={styles.cardTitle}>Order Summary</Text>
          
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>From</Text>
            <Text style={styles.cardValue}>{order?.sellerName || 'Seller'}'s Kitchen</Text>
          </View>

          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Items</Text>
            <Text style={styles.cardValue}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Total Amount</Text>
            <Text style={styles.cardTotalValue}>₹{order?.totalAmount?.toFixed(2) || '0.00'}</Text>
          </View>

          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Payment</Text>
            <Text style={styles.cardValue}>{getPaymentMethodText(order?.paymentMethod)}</Text>
          </View>

          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Estimated Ready</Text>
            <Text style={styles.cardValue}>Ready in ~30 minutes</Text>
          </View>
        </Animated.View>

        {/* What's Next Section */}
        <Animated.View style={[styles.infoBox, { opacity: fadeAnim }]}>
          <Text style={styles.infoBoxTitle}>What's Next?</Text>
          
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>Seller is preparing your order</Text>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepText}>You'll be notified when ready</Text>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>Pick up from seller's location</Text>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={styles.stepText}>Pay on pickup</Text>
          </View>
        </Animated.View>

        {/* Message Seller Button */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <TouchableOpacity
            style={styles.messageButton}
            onPress={handleMessageSeller}
            activeOpacity={0.8}
          >
            <Text style={styles.messageButtonIcon}>💬</Text>
            <Text style={styles.messageButtonText}>Message Seller</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Bottom Buttons */}
      <Animated.View style={[styles.bottomBar, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.outlinedButton}
          onPress={handleViewOrderDetails}
          activeOpacity={0.8}
        >
          <Text style={styles.outlinedButtonText}>View My Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleBackToFeed}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Back to Feed</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
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

  // Confetti
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    zIndex: 100,
    overflow: 'hidden',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 140,
    alignItems: 'center',
  },

  // Success Icon
  successIconContainer: {
    marginBottom: 24,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successCheckmark: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.white,
  },

  // Success Text
  successTextContainer: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.success,
    textAlign: 'center',
  },

  // Order ID
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  orderIdText: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  copyButton: {
    marginLeft: 8,
    padding: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 6,
  },
  copyButtonText: {
    fontSize: 16,
  },

  // Card
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  cardValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  cardTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },

  // Info Box
  infoBox: {
    width: '100%',
    backgroundColor: COLORS.infoBlue,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.infoBlueBorder,
    padding: 16,
    marginBottom: 24,
  },
  infoBoxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },

  // Message Button
  messageButton: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    marginBottom: 24,
  },
  messageButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingTop: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  outlinedButton: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  outlinedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  primaryButton: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default OrderConfirmationScreen;

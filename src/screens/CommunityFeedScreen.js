import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import KitchenCard from '../components/KitchenCard';
import {
  selectCartItemCount,
  selectCartTotal,
  selectIsCartEmpty,
  selectCartExpiresAt,
  checkCartExpiry,
} from '../redux/cartSlice';
import {
  selectOrderNotifications,
} from '../redux/notificationsSlice';
import {
  fetchSellerOrders,
  setOrderCounts,
  selectActiveOrders,
} from '../redux/creatorOrdersSlice';

const COLORS = {
  primary: '#FF6B4A',
  primaryLight: '#FFF0ED',
  background: '#F5F5F5',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  border: '#E0E0E0',
  error: '#FF3B30',
  warning: '#FF9500',
  success: '#34C759',
};

// Helper to format date for section headers
const formatDateHeader = (date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const targetDate = new Date(date);
  
  // Reset times to compare just dates
  const isToday = targetDate.toDateString() === today.toDateString();
  const isYesterday = targetDate.toDateString() === yesterday.toDateString();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayName = dayNames[targetDate.getDay()];
  const monthName = monthNames[targetDate.getMonth()];
  const dayNum = targetDate.getDate();
  const year = targetDate.getFullYear();

  if (isToday) {
    return `Today • ${dayName}, ${monthName} ${dayNum}`;
  }
  if (isYesterday) {
    return `Yesterday • ${dayName}, ${monthName} ${dayNum}`;
  }
  return `${dayName}, ${monthName} ${dayNum}, ${year}`;
};

// Helper to get date key for grouping (YYYY-MM-DD)
const getDateKey = (timestamp) => {
  if (!timestamp) return 'unknown';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toISOString().split('T')[0];
};

// Group posts by date
const groupPostsByDate = (posts) => {
  const grouped = {};
  
  posts.forEach((post) => {
    const dateKey = getDateKey(post.createdAt);
    if (!grouped[dateKey]) {
      grouped[dateKey] = {
        title: dateKey,
        data: [],
      };
    }
    grouped[dateKey].data.push(post);
  });

  // Convert to array and sort by date descending
  return Object.values(grouped)
    .sort((a, b) => b.title.localeCompare(a.title))
    .map((section) => ({
      ...section,
      title: formatDateHeader(section.title),
    }));
};

const CommunityFeedScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { communityId, communityName } = route.params || {};

  const currentUserId = auth().currentUser?.uid || null;

  // Cart state from Redux
  const cartItemCount = useSelector(selectCartItemCount);
  const cartTotal = useSelector(selectCartTotal);
  const isCartEmpty = useSelector(selectIsCartEmpty);
  const cartExpiresAt = useSelector(selectCartExpiresAt);

  // Notification state from Redux
  const orderNotifications = useSelector(selectOrderNotifications);
  const activeOrders = useSelector(selectActiveOrders);

  // Find latest unread order notification for this community
  const latestOrderNotification = useMemo(() => {
    const communityNotifications = orderNotifications.filter(
      (n) => n.data?.communityId === communityId && !n.read
    );
    return communityNotifications[0] || null;
  }, [orderNotifications, communityId]);

  // Fetch seller orders on mount to get order counts
  useEffect(() => {
    if (currentUserId) {
      dispatch(fetchSellerOrders(currentUserId));
    }
  }, [currentUserId, dispatch]);

  // Calculate order counts per post from active orders
  useEffect(() => {
    if (activeOrders && activeOrders.length > 0) {
      const counts = {};
      activeOrders.forEach((order) => {
        if (order.postId) {
          counts[order.postId] = (counts[order.postId] || 0) + 1;
        }
      });
      dispatch(setOrderCounts(counts));
    }
  }, [activeOrders, dispatch]);

  // Cart timer state
  const [cartTimeRemaining, setCartTimeRemaining] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [community, setCommunity] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [postsError, setPostsError] = useState(null);

  // Cart expiry timer
  useEffect(() => {
    if (!cartExpiresAt) {
      setCartTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const remaining = cartExpiresAt - Date.now();
      if (remaining <= 0) {
        dispatch(checkCartExpiry());
        setCartTimeRemaining(null);
      } else {
        setCartTimeRemaining(remaining);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [cartExpiresAt, dispatch]);

  // Format cart timer
  const formatCartTime = useCallback((ms) => {
    if (!ms || ms <= 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Navigate to cart
  const handleGoToCart = useCallback(() => {
    navigation.navigate('Cart');
  }, [navigation]);

  // Header setup with profile menu
  useLayoutEffect(() => {
    navigation.setOptions({
      title: communityName || 'Community Feed',
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
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          {/* Cart icon with badge */}
          {!isCartEmpty && (
            <TouchableOpacity
              onPress={handleGoToCart}
              style={styles.headerCartButton}
              accessibilityLabel="Go to cart"
            >
              <Text style={styles.headerCartIcon}>🛒</Text>
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
              </View>
            </TouchableOpacity>
          )}
          {/* Menu button */}
          <TouchableOpacity
            onPress={() => setMenuVisible((v) => !v)}
            style={styles.headerMenuButton}
            accessibilityLabel="Community menu"
          >
            <Text style={styles.headerMenuIcon}>⋯</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, communityName, isCartEmpty, cartItemCount, handleGoToCart]);

  // Listen for community data
  useEffect(() => {
    if (!communityId) {
      setCommunity(null);
      setLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection('communities')
      .doc(communityId)
      .onSnapshot(
        (doc) => {
          if (!doc.exists) {
            setCommunity(null);
            setLoading(false);
            return;
          }
          const data = { id: doc.id, ...doc.data() };
          setCommunity(data);
          setLoading(false);
        },
        (error) => {
          console.error('Community feed listener error:', error);
          setLoading(false);
          Alert.alert('Error', 'Failed to load community.');
        }
      );

    return unsubscribe;
  }, [communityId]);

  // Listen for posts in this community (real-time)
  useEffect(() => {
    if (!communityId) {
      setPosts([]);
      return;
    }

    setPostsError(null);
    
    const unsubscribe = firestore()
      .collection('posts')
      .where('communityId', '==', communityId)
      .where('status', '==', 'active')
      .onSnapshot(
        (snapshot) => {
          const postsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          // Sort by createdAt descending (newest first)
          postsData.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          });
          setPosts(postsData);
          setRefreshing(false);
        },
        (error) => {
          console.error('Posts listener error:', error);
          setPostsError('Failed to load posts. Pull to refresh.');
          setRefreshing(false);
        }
      );

    return unsubscribe;
  }, [communityId]);

  // Real-time listener for orders on user's posts in this community
  useEffect(() => {
    if (!currentUserId || !posts.length) return;

    // Get post IDs that belong to the current user
    const userPostIds = posts
      .filter((p) => p.userId === currentUserId)
      .map((p) => p.id);

    if (userPostIds.length === 0) return;

    // Listen for active orders on user's posts
    const unsubscribe = firestore()
      .collection('orders')
      .where('postId', 'in', userPostIds.slice(0, 10)) // Firestore 'in' limit is 10
      .where('orderStatus', 'in', ['pending', 'confirmed', 'preparing', 'ready'])
      .onSnapshot(
        (snapshot) => {
          const counts = {};
          snapshot.docs.forEach((doc) => {
            const postId = doc.data().postId;
            counts[postId] = (counts[postId] || 0) + 1;
          });
          dispatch(setOrderCounts(counts));
        },
        (error) => {
          console.error('Orders listener error:', error);
        }
      );

    return unsubscribe;
  }, [currentUserId, posts, dispatch]);

  const adminIds = useMemo(() => {
    const ids = Array.isArray(community?.adminIds) ? community.adminIds : [];
    const creatorId = typeof community?.createdBy === 'string' ? community.createdBy : null;
    const merged = [...ids];
    if (creatorId && !merged.includes(creatorId)) merged.push(creatorId);
    return merged.filter(Boolean);
  }, [community?.adminIds, community?.createdBy]);

  const memberIds = useMemo(() => {
    return Array.isArray(community?.memberIds) ? community.memberIds : [];
  }, [community?.memberIds]);

  const isAdmin = useMemo(() => {
    if (!currentUserId) return false;
    return adminIds.includes(currentUserId);
  }, [adminIds, currentUserId]);

  const isMember = useMemo(() => {
    if (!currentUserId) return false;
    return memberIds.includes(currentUserId);
  }, [memberIds, currentUserId]);

  const isFounder = useMemo(() => {
    if (!currentUserId || !community?.createdBy) return false;
    return currentUserId === community.createdBy;
  }, [currentUserId, community?.createdBy]);

  // Group posts by date for SectionList
  const sections = useMemo(() => {
    return groupPostsByDate(posts);
  }, [posts]);

  useEffect(() => {
    let cancelled = false;
    const fetchAdmins = async () => {
      try {
        if (!adminIds.length) {
          setAdminUsers([]);
          return;
        }

        const fieldPath = firestore.FieldPath.documentId();
        const chunks = [];
        for (let i = 0; i < adminIds.length; i += 10) chunks.push(adminIds.slice(i, i + 10));

        const results = [];
        for (const c of chunks) {
          const snap = await firestore().collection('users').where(fieldPath, 'in', c).get();
          snap.forEach((d) => results.push({ id: d.id, ...d.data() }));
        }

        if (!cancelled) setAdminUsers(results);
      } catch (error) {
        console.error('Fetch admins (feed) error:', error);
        if (!cancelled) setAdminUsers([]);
      }
    };

    fetchAdmins();
    return () => {
      cancelled = true;
    };
  }, [adminIds]);

  const closeMenu = () => setMenuVisible(false);

  const handleMessageAdmin = useCallback(async () => {
    closeMenu();

    const emails = adminUsers
      .map((u) => (u.email || '').trim())
      .filter((e) => e.length > 0);

    if (!emails.length) {
      Alert.alert('Message admin', 'No admin contact information available.');
      return;
    }

    const subject = encodeURIComponent(`Message from Saveours: ${community?.name || 'Community'}`);
    const body = encodeURIComponent('Hi Admins,\n\n');
    const url = `mailto:${emails.join(',')}?subject=${subject}&body=${body}`;

    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert('Message admin', 'Unable to open email app on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.error('Open mailto error:', error);
      Alert.alert('Message admin', 'Could not open email app.');
    }
  }, [adminUsers, community?.name]);

  const handleLeaveCommunity = useCallback(() => {
    closeMenu();

    if (!communityId || !currentUserId) {
      Alert.alert('Error', 'You must be logged in.');
      return;
    }

    if (!isMember) {
      Alert.alert('Not a member', 'You are not a member of this community.');
      navigation.navigate('CommunityDetail', { communityId });
      return;
    }

    // Safety: prevent the only admin from leaving
    if (isAdmin && adminIds.length <= 1) {
      Alert.alert('Admin account', 'You are the only admin. Add another admin before leaving.');
      return;
    }

    Alert.alert('Leave community?', 'You will be removed from this community.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setWorking(true);
          try {
            await firestore().runTransaction(async (tx) => {
              const communityRef = firestore().collection('communities').doc(communityId);
              const userRef = firestore().collection('users').doc(currentUserId);
              const snap = await tx.get(communityRef);

              if (!snap.exists) throw new Error('NOT_FOUND');

              const data = snap.data();
              const mIds = Array.isArray(data.memberIds) ? data.memberIds : [];
              if (!mIds.includes(currentUserId)) return;

              tx.update(communityRef, {
                memberIds: firestore.FieldValue.arrayRemove(currentUserId),
                currentMembers: firestore.FieldValue.increment(-1),
                ...(isAdmin ? { adminIds: firestore.FieldValue.arrayRemove(currentUserId) } : {}),
              });

              tx.set(
                userRef,
                {
                  userId: currentUserId,
                  email: auth().currentUser?.email || '',
                  communities: firestore.FieldValue.arrayRemove(communityId),
                  updatedAt: firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            });

            Alert.alert('Left community', 'You have left the community.');
            navigation.navigate('Communities');
          } catch (error) {
            console.error('Leave community (feed) error:', error);
            Alert.alert('Error', 'Could not leave the community. Please try again.');
          }
          setWorking(false);
        },
      },
    ]);
  }, [adminIds.length, communityId, currentUserId, isAdmin, isMember, isFounder, navigation]);

  // Pull to refresh handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // The posts listener will update automatically, we just need to show the spinner briefly
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Navigate to post detail
  const handlePostPress = useCallback((post) => {
    navigation.navigate('FoodDetail', { postId: post.id, communityId });
  }, [navigation, communityId]);

  // Navigate to create new post
  const handleCreatePost = useCallback(() => {
    navigation.navigate('TodaysMenu', { communityId, communityName: community?.name || communityName });
  }, [navigation, communityId, community?.name, communityName]);

  // Render kitchen card
  const renderKitchenCard = useCallback(({ item }) => (
    <KitchenCard post={item} onPress={handlePostPress} />
  ), [handlePostPress]);

  // Render section header (date)
  const renderSectionHeader = useCallback(({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  ), []);

  // Key extractor for SectionList
  const keyExtractor = useCallback((item) => item.id, []);

  // Empty state component
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🍳</Text>
      <Text style={styles.emptyTitle}>No food posts yet</Text>
      <Text style={styles.emptySubtitle}>Be the first to share your delicious cooking!</Text>
      {isMember ? (
        <TouchableOpacity style={styles.emptyButton} onPress={handleCreatePost}>
          <Text style={styles.emptyButtonText}>Post Food</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ), [isMember, handleCreatePost]);

  if (loading) {
    return (
      <View style={styles.containerCenter}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  if (!community) {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.errorIcon}>😕</Text>
        <Text style={styles.errorTitle}>Community not found</Text>
        <Text style={styles.errorSubtitle}>This community may have been deleted.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Dropdown Menu */}
      {menuVisible ? (
        <>
          <Pressable style={styles.menuBackdrop} onPress={closeMenu} />
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={handleMessageAdmin}>
              <Text style={styles.menuText}>📧 Message admin</Text>
            </TouchableOpacity>
            {isMember && !isFounder ? (
              <TouchableOpacity
                style={[styles.menuItem, styles.lastMenuItem]}
                onPress={handleLeaveCommunity}
                disabled={working}
              >
                <Text style={[styles.menuText, styles.dangerText]}>
                  {working ? 'Leaving...' : '🚪 Leave community'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.lastMenuItem} />
            )}
          </View>
        </>
      ) : null}

      {/* Error State */}
      {postsError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{postsError}</Text>
        </View>
      ) : null}

      {/* Order Notification Banner for Creators */}
      {latestOrderNotification && (
        <TouchableOpacity
          style={styles.orderNotificationBanner}
          onPress={() => navigation.navigate('MyOrders', { 
            postId: latestOrderNotification.data?.postId,
            postTitle: latestOrderNotification.data?.postTitle,
          })}
          activeOpacity={0.8}
        >
          <View style={styles.notificationBannerContent}>
            <Text style={styles.notificationBannerIcon}>🛒</Text>
            <View style={styles.notificationBannerText}>
              <Text style={styles.notificationBannerTitle}>New Order Received!</Text>
              <Text style={styles.notificationBannerSubtitle} numberOfLines={1}>
                {latestOrderNotification.body || 'Tap to view order details'}
              </Text>
            </View>
          </View>
          <Text style={styles.notificationBannerArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Posts SectionList grouped by date */}
      <SectionList
        sections={sections}
        renderItem={renderKitchenCard}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        stickySectionHeadersEnabled={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      />

      {/* Floating Action Button */}
      {isMember ? (
        <TouchableOpacity
          style={[styles.fab, !isCartEmpty && styles.fabWithCart]}
          onPress={handleCreatePost}
          activeOpacity={0.8}
          accessibilityLabel="Create new food post"
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      ) : null}

      {/* Bottom Cart Bar */}
      {!isCartEmpty && (
        <View style={styles.bottomCartBar}>
          <View style={styles.cartInfoSection}>
            <Text style={styles.cartInfoIcon}>🛒</Text>
            <View style={styles.cartInfoDetails}>
              <Text style={styles.cartInfoCount}>
                {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
              </Text>
              <Text style={styles.cartInfoTotal}>₹{cartTotal.toFixed(2)}</Text>
            </View>
            {cartTimeRemaining && (
              <View style={styles.cartTimerContainer}>
                <Text style={styles.cartTimerIcon}>⏱️</Text>
                <Text style={styles.cartTimerText}>
                  {formatCartTime(cartTimeRemaining)}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.goToCartButton}
            onPress={handleGoToCart}
            activeOpacity={0.8}
          >
            <Text style={styles.goToCartText}>Go to Cart</Text>
            <Text style={styles.goToCartArrow}>→</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  containerCenter: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Section header (date)
  sectionHeader: {
    backgroundColor: COLORS.background,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textLight,
    letterSpacing: 0.3,
  },

  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 12,
  },

  // Header styles
  headerMenuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerMenuIcon: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    marginTop: -6,
  },
  headerNotificationButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerNotificationIcon: {
    fontSize: 22,
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Dropdown menu
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 200,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
  },
  dangerText: {
    color: COLORS.error,
  },

  // Error banner
  errorBanner: {
    backgroundColor: '#FFEBEE',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFCDD2',
  },
  errorBannerText: {
    color: COLORS.error,
    fontSize: 13,
    textAlign: 'center',
  },

  // Order notification banner
  orderNotificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  notificationBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  notificationBannerText: {
    flex: 1,
  },
  notificationBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 2,
  },
  notificationBannerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  notificationBannerArrow: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
    marginLeft: 8,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // Error state
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabWithCart: {
    bottom: 90, // Move up when cart bar is visible
  },
  fabIcon: {
    fontSize: 28,
    color: COLORS.white,
    fontWeight: '300',
    marginTop: -2,
  },

  // Header right container
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCartButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerCartIcon: {
    fontSize: 22,
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  cartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Bottom cart bar
  bottomCartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  cartInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cartInfoIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  cartInfoDetails: {
    flexDirection: 'column',
  },
  cartInfoCount: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  cartInfoTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  cartTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    backgroundColor: COLORS.background,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  cartTimerIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  cartTimerText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
  },
  goToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  goToCartText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  goToCartArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default CommunityFeedScreen;

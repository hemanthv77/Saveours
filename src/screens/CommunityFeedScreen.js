import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import KitchenCard from '../components/KitchenCard';

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

const CommunityFeedScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId, communityName } = route.params || {};

  const currentUserId = auth().currentUser?.uid || null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [community, setCommunity] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [postsError, setPostsError] = useState(null);

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
        <TouchableOpacity
          onPress={() => setMenuVisible((v) => !v)}
          style={styles.headerMenuButton}
          accessibilityLabel="Community menu"
        >
          <Text style={styles.headerMenuIcon}>⋯</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, communityName]);

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

  // Key extractor for FlatList
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

      {/* Posts FlatList */}
      <FlatList
        data={posts}
        renderItem={renderKitchenCard}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
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
          style={styles.fab}
          onPress={handleCreatePost}
          activeOpacity={0.8}
          accessibilityLabel="Create new food post"
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      ) : null}
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
  fabIcon: {
    fontSize: 28,
    color: COLORS.white,
    fontWeight: '300',
    marginTop: -2,
  },
});

export default CommunityFeedScreen;

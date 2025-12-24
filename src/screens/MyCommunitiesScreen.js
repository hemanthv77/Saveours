import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// Components
import CommunityCard from '../components/CommunityCard';

// Redux actions
import { setCommunities, setLoading } from '../redux/communitiesSlice';

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
  sectionBg: '#EBEBEB',
};

// ============================================================
// MY COMMUNITIES SCREEN COMPONENT
// ============================================================
const MyCommunitiesScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  // Local state
  const [adminCommunities, setAdminCommunities] = useState([]);
  const [memberCommunities, setMemberCommunities] = useState([]);
  const [loading, setLoadingState] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Get current user
  const currentUser = auth().currentUser;

  // ============================================================
  // FETCH COMMUNITIES
  // ============================================================
  useEffect(() => {
    if (!currentUser) {
      setLoadingState(false);
      return;
    }

    setLoadingState(true);

    // Fetch admin communities
    const unsubscribeAdmin = firestore()
      .collection('communities')
      .where('adminIds', 'array-contains', currentUser.uid)
      .onSnapshot(
        (snapshot) => {
          const adminData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            isAdmin: true,
          }));
          setAdminCommunities(adminData);
        },
        (error) => {
          console.error('Error fetching admin communities:', error);
          Alert.alert('Error', 'Failed to load communities you manage.');
        }
      );

    // Fetch member communities (where user is member but not admin)
    const unsubscribeMember = firestore()
      .collection('communities')
      .where('memberIds', 'array-contains', currentUser.uid)
      .onSnapshot(
        (snapshot) => {
          const memberData = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
            .filter((community) => !community.adminIds?.includes(currentUser.uid));
          setMemberCommunities(memberData);
          setLoadingState(false);
        },
        (error) => {
          console.error('Error fetching member communities:', error);
          Alert.alert('Error', 'Failed to load communities you joined.');
          setLoadingState(false);
        }
      );

    return () => {
      unsubscribeAdmin();
      unsubscribeMember();
    };
  }, [currentUser]);

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
  const onRefresh = useCallback(async () => {
    if (!currentUser) return;

    setRefreshing(true);

    try {
      // Fetch admin communities
      const adminSnapshot = await firestore()
        .collection('communities')
        .where('adminIds', 'array-contains', currentUser.uid)
        .get();
      const adminData = adminSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        isAdmin: true,
      }));
      setAdminCommunities(adminData);

      // Fetch member communities
      const memberSnapshot = await firestore()
        .collection('communities')
        .where('memberIds', 'array-contains', currentUser.uid)
        .get();
      const memberData = memberSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((community) => !community.adminIds?.includes(currentUser.uid));
      setMemberCommunities(memberData);
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh communities.');
    }

    setRefreshing(false);
  }, [currentUser]);

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleCommunityPress = (community) => {
    const communityId = community?.id;
    if (!communityId) return;

    const uid = auth().currentUser?.uid;
    const memberIds = Array.isArray(community?.memberIds) ? community.memberIds : [];
    const isMember = !!uid && memberIds.includes(uid);

    navigation.navigate(isMember ? 'CommunityFeed' : 'CommunityDetail', { communityId });
  };

  const handleCreateCommunity = () => {
    navigation.navigate('Communities');
  };

  const handleBrowseCommunities = () => {
    navigation.navigate('Communities');
  };

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================
  const renderCommunityCard = (community) => (
    <View key={community.id} style={styles.cardWrapper}>
      {community.isAdmin && (
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>Admin</Text>
        </View>
      )}
      <CommunityCard
        community={community}
        onPress={() => handleCommunityPress(community)}
      />
    </View>
  );

  const renderAdminEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🏠</Text>
      <Text style={styles.emptyText}>You don't manage any communities yet</Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={handleCreateCommunity}
      >
        <Text style={styles.emptyButtonText}>Create Community</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMemberEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🍽️</Text>
      <Text style={styles.emptyText}>You haven't joined any communities yet</Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={handleBrowseCommunities}
      >
        <Text style={styles.emptyButtonText}>Browse Communities</Text>
      </TouchableOpacity>
    </View>
  );

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your communities...</Text>
      </View>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* SECTION 1: ADMIN COMMUNITIES */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Communities I Manage</Text>
        </View>
        <View style={styles.sectionContent}>
          {adminCommunities.length > 0 ? (
            <View style={styles.cardsContainer}>
              {adminCommunities.map((community) =>
                renderCommunityCard(community)
              )}
            </View>
          ) : (
            renderAdminEmpty()
          )}
        </View>
      </View>

      {/* SECTION 2: MEMBER COMMUNITIES */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Communities I'm In</Text>
        </View>
        <View style={styles.sectionContent}>
          {memberCommunities.length > 0 ? (
            <View style={styles.cardsContainer}>
              {memberCommunities.map((community) =>
                renderCommunityCard(community)
              )}
            </View>
          ) : (
            renderMemberEmpty()
          )}
        </View>
      </View>
    </ScrollView>
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
  scrollContent: {
    paddingBottom: 24,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textLight,
  },
  // Sections
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    backgroundColor: COLORS.sectionBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sectionContent: {
    padding: 16,
  },
  // Cards
  cardsContainer: {
    gap: 16,
  },
  cardWrapper: {
    position: 'relative',
  },
  adminBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  adminBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Empty States
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MyCommunitiesScreen;

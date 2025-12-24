import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import JoinRequestModal from '../components/JoinRequestModal';

const COLORS = {
  primary: '#FF6B4A',
  background: '#F5F5F5',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  border: '#E0E0E0',
  error: '#FF3B30',
  successBg: '#EAF7EE',
  warningBg: '#FFF6D6',
  privateBg: '#FFF0EC',
  disabledBg: '#E6E6E6',
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const getInitials = (nameOrEmail) => {
  const text = (nameOrEmail || '').trim();
  if (!text) return '?';
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
};

const CommunityDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId } = route.params || {};

  const currentUser = auth().currentUser;
  const currentUserId = currentUser?.uid || null;

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [community, setCommunity] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  // Join request state (private communities)
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);

  // Navigation header styling per spec
  useLayoutEffect(() => {
    navigation.setOptions({
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

  // Fetch current user profile (name + avatar) for joinRequest metadata
  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUserId)
      .onSnapshot(
        (doc) => {
          if (!doc.exists) {
            setCurrentUserProfile(null);
            return;
          }
          setCurrentUserProfile({ id: doc.id, ...doc.data() });
        },
        () => {
          setCurrentUserProfile(null);
        }
      );
    return unsubscribe;
  }, [currentUserId]);

  // Real-time community listener
  useEffect(() => {
    if (!communityId) {
      setLoading(false);
      setCommunity(null);
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
          console.error('Community detail listener error:', error);
          setLoading(false);
          Alert.alert('Error', 'Failed to load community details.');
        }
      );

    return unsubscribe;
  }, [communityId]);

  // Set title dynamically
  useLayoutEffect(() => {
    navigation.setOptions({
      title: community?.name ? community.name : 'Community Details',
    });
  }, [navigation, community?.name]);

  const memberIds = useMemo(() => {
    return Array.isArray(community?.memberIds) ? community.memberIds : [];
  }, [community?.memberIds]);

  const adminIds = useMemo(() => {
    return Array.isArray(community?.adminIds) ? community.adminIds : [];
  }, [community?.adminIds]);

  const creatorId = useMemo(() => {
    const id = community?.createdBy;
    return typeof id === 'string' && id.trim().length ? id : null;
  }, [community?.createdBy]);

  const effectiveAdminIds = useMemo(() => {
    const ids = [...adminIds];
    if (creatorId && !ids.includes(creatorId)) ids.push(creatorId);
    return ids.filter(Boolean);
  }, [adminIds, creatorId]);

  const currentMembersDisplay = useMemo(() => {
    if (!community) return 0;
    if (typeof community.currentMembers === 'number') return community.currentMembers;
    return memberIds.length;
  }, [community, memberIds.length]);

  const maxCapacityDisplay = useMemo(() => {
    return typeof community?.maxCapacity === 'number' ? community.maxCapacity : 0;
  }, [community?.maxCapacity]);

  const isPrivate = !!community?.isPrivate;

  const isMember = useMemo(() => {
    if (!currentUserId) return false;
    return memberIds.includes(currentUserId);
  }, [memberIds, currentUserId]);

  const isAdmin = useMemo(() => {
    if (!currentUserId) return false;
    return effectiveAdminIds.includes(currentUserId);
  }, [effectiveAdminIds, currentUserId]);

  const isFull = useMemo(() => {
    if (!maxCapacityDisplay) return false;
    return currentMembersDisplay >= maxCapacityDisplay;
  }, [currentMembersDisplay, maxCapacityDisplay]);

  // Admin profiles
  useEffect(() => {
    const ids = effectiveAdminIds.filter(Boolean);
    if (!ids.length) {
      setAdminUsers([]);
      return;
    }

    let cancelled = false;

    const fetchAdmins = async () => {
      try {
        const fieldPath = firestore.FieldPath.documentId();
        const chunks = chunk(ids, 10);
        const results = [];
        for (const c of chunks) {
          const snap = await firestore()
            .collection('users')
            .where(fieldPath, 'in', c)
            .get();
          snap.forEach((d) => results.push({ id: d.id, ...d.data() }));
        }
        if (!cancelled) setAdminUsers(results);
      } catch (error) {
        console.error('Fetch admins error:', error);
        if (!cancelled) setAdminUsers([]);
      }
    };

    fetchAdmins();
    return () => {
      cancelled = true;
    };
  }, [effectiveAdminIds]);

  // Pending join request listener (private communities)
  useEffect(() => {
    if (!communityId || !currentUserId) {
      setPendingRequest(null);
      return;
    }

    const unsubscribe = firestore()
      .collection('joinRequests')
      .where('communityId', '==', communityId)
      .where('userId', '==', currentUserId)
      .where('status', '==', 'pending')
      .onSnapshot(
        (snapshot) => {
          if (snapshot.empty) {
            setPendingRequest(null);
            return;
          }
          const doc = snapshot.docs[0];
          setPendingRequest({ id: doc.id, ...doc.data() });
        },
        (error) => {
          console.error('Join request listener error:', error);
          setPendingRequest(null);
        }
      );

    return unsubscribe;
  }, [communityId, currentUserId]);

  const screeningQuestions = useMemo(() => {
    if (!isPrivate) return [];
    const sq = Array.isArray(community?.screeningQuestions) ? community.screeningQuestions : [];
    return sq
      .map((q) => ({
        questionId: q?.questionId || q?.id || q?.question || '',
        question: q?.question || '',
      }))
      .filter((q) => (q.question || '').trim().length > 0)
      .slice(0, 5);
  }, [community?.screeningQuestions, isPrivate]);

  const openRequestModal = () => {
    setRequestModalVisible(true);
  };

  const closeRequestModal = () => {
    setRequestModalVisible(false);
  };

  const handlePublicJoin = useCallback(async () => {
    if (!currentUserId) {
      Alert.alert('Login required', 'Please login to join this community.');
      return;
    }
    if (!communityId) return;

    setWorking(true);
    try {
      await firestore().runTransaction(async (tx) => {
        const communityRef = firestore().collection('communities').doc(communityId);
        const userRef = firestore().collection('users').doc(currentUserId);

        const communitySnap = await tx.get(communityRef);
        if (!communitySnap.exists) throw new Error('NOT_FOUND');

        const data = communitySnap.data();
        const mIds = Array.isArray(data.memberIds) ? data.memberIds : [];
        const maxCap = typeof data.maxCapacity === 'number' ? data.maxCapacity : 0;
        const curMembers = typeof data.currentMembers === 'number' ? data.currentMembers : mIds.length;

        if (mIds.includes(currentUserId)) {
          return;
        }

        if (maxCap > 0 && curMembers >= maxCap) {
          throw new Error('FULL');
        }

        tx.update(communityRef, {
          memberIds: firestore.FieldValue.arrayUnion(currentUserId),
          currentMembers: firestore.FieldValue.increment(1),
        });

        // Keep user document in sync
        tx.set(
          userRef,
          {
            userId: currentUserId,
            email: currentUser?.email || '',
            communities: firestore.FieldValue.arrayUnion(communityId),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      Alert.alert('Success', `Welcome to ${community?.name || 'the community'}!`);
      navigation.navigate('CommunityFeed', { communityId });
    } catch (error) {
      if (error?.message === 'FULL') {
        Alert.alert('Community Full', 'This community has reached its maximum capacity.');
      } else {
        console.error('Public join error:', error);
        Alert.alert('Error', 'Could not join the community. Please try again.');
      }
    }
    setWorking(false);
  }, [communityId, currentUserId, community?.name, currentUser?.email, navigation]);

  const handleSubmitJoinRequest = useCallback(async (answers) => {
    if (!currentUserId) {
      Alert.alert('Login required', 'Please login to request access.');
      return;
    }
    if (!communityId) return;
    if (pendingRequest) {
      closeRequestModal();
      return;
    }

    try {
      // Prevent duplicates (race-safe enough for UI; Firestore security rules should enforce too)
      const existing = await firestore()
        .collection('joinRequests')
        .where('communityId', '==', communityId)
        .where('userId', '==', currentUserId)
        .where('status', '==', 'pending')
        .limit(1)
        .get();
      if (!existing.empty) {
        Alert.alert('Request already pending', 'You already have a pending request for this community.');
        closeRequestModal();
        return;
      }

      const requestRef = firestore().collection('joinRequests').doc();
      await requestRef.set({
        requestId: requestRef.id,
        userId: currentUserId,
        userName: (currentUserProfile?.name || '').trim(),
        userEmail: (currentUser?.email || '').trim(),
        userProfilePic: currentUserProfile?.profilePictureUrl || '',
        communityId,
        communityName: community?.name || '',
        status: 'pending',
        answers: Array.isArray(answers) && answers.length ? answers : [],
        requestedAt: firestore.FieldValue.serverTimestamp(),
        respondedAt: null,
        respondedBy: null,
      });

      // Push notifications to admins require FCM + backend; not implemented here.
      Alert.alert('Request sent', "Request sent! You'll be notified when admins respond.");
      closeRequestModal();
    } catch (error) {
      console.error('Submit join request error:', error);
      Alert.alert('Error', 'Could not send request. Please try again.');
    }
  }, [community?.name, communityId, currentUser?.email, currentUserId, currentUserProfile, pendingRequest]);

  const handleLeave = useCallback(async () => {
    if (!currentUserId) return;
    if (!communityId) return;

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
                  email: currentUser?.email || '',
                  communities: firestore.FieldValue.arrayRemove(communityId),
                  updatedAt: firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            });
          } catch (error) {
            console.error('Leave community error:', error);
            Alert.alert('Error', 'Could not leave the community. Please try again.');
          }
          setWorking(false);
        },
      },
    ]);
  }, [adminIds.length, communityId, currentUser?.email, currentUserId, isAdmin]);

  const joinButtonState = useMemo(() => {
    if (!community) return { label: 'Join Community', disabled: true, kind: 'disabled' };
    if (isFull && !isMember) return { label: 'Community Full', disabled: true, kind: 'disabled' };
    if (pendingRequest) return { label: 'Request Pending ⏱', disabled: true, kind: 'pending' };
    if (isMember) return { label: 'Joined ✓', disabled: true, kind: 'joined' };
    return { label: 'Join Community', disabled: false, kind: 'primary' };
  }, [community, isFull, isMember, pendingRequest]);

  const handlePrimaryAction = () => {
    if (joinButtonState.disabled) return;
    if (isPrivate) {
      openRequestModal();
      return;
    }
    handlePublicJoin();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading community...</Text>
      </View>
    );
  }

  if (!community) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Community not found</Text>
        <Text style={styles.centerText}>It may have been deleted.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const badge = isPrivate
    ? { label: 'Private', bg: COLORS.privateBg, text: COLORS.primary }
    : { label: 'Public', bg: COLORS.successBg, text: '#1F7A3A' };

  const radiusKm = typeof community.radiusKm === 'number' ? community.radiusKm : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO IMAGE */}
        <View style={styles.heroWrap}>
          {community.imageUrl ? (
            <Image source={{ uri: community.imageUrl }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroPlaceholderText}>🍽️</Text>
            </View>
          )}
          <View style={styles.heroOverlay} pointerEvents="none" />
        </View>

        {/* INFO CARD */}
        <View style={styles.infoCard}>
          <Text style={styles.communityName}>{community.name}</Text>

          {/* Location */}
          <View style={styles.row}>
            <Text style={styles.rowIconPin}>📍</Text>
            <Text style={styles.rowText}>{community.location || 'No location set'}</Text>
          </View>

          {/* Members */}
          <View style={styles.row}>
            <Text style={styles.rowIconUsers}>👥</Text>
            <Text style={styles.rowText}>
              {currentMembersDisplay}
              {maxCapacityDisplay ? `/${maxCapacityDisplay}` : ''} members
            </Text>
          </View>

          {/* Privacy Badge */}
          <View style={[styles.privacyBadge, { backgroundColor: badge.bg }]}
            accessibilityLabel={`Community is ${badge.label}`}
          >
            <Text style={[styles.privacyBadgeText, { color: badge.text }]}> {badge.label} </Text>
          </View>

          {/* Description */}
          <Text style={styles.sectionLabel}>About this community</Text>
          <Text style={styles.description}>{community.description || 'No description yet.'}</Text>

          {/* Admins */}
          <Text style={styles.sectionLabel}>Admins</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.adminScroll}>
            {adminUsers.length ? (
              adminUsers.map((u) => {
                const displayName = (u.name || '').trim() || (u.email || '').trim() || 'Admin';
                const isCreator = !!creatorId && u.id === creatorId;
                return (
                  <View key={u.id} style={styles.adminItem}>
                    {u.profilePictureUrl ? (
                      <Image source={{ uri: u.profilePictureUrl }} style={styles.adminAvatar} />
                    ) : (
                      <View style={styles.adminAvatarFallback}>
                        <Text style={styles.adminAvatarText}>{getInitials(displayName)}</Text>
                      </View>
                    )}
                    <Text style={styles.adminName} numberOfLines={1}>
                      {displayName}{isCreator ? ' (Creator)' : ''}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.mutedText}>No admins listed.</Text>
            )}
          </ScrollView>

          {/* Radius */}
          {radiusKm !== null ? (
            <View style={styles.radiusBox}>
              <Text style={styles.radiusIcon}>📏</Text>
              <Text style={styles.radiusText}>Community radius: {radiusKm} km</Text>
            </View>
          ) : null}

          {/* Admin hint */}
          {isAdmin ? (
            <Text style={styles.adminNote}>You are an admin of this community.</Text>
          ) : null}
        </View>

        {/* Spacer so content isn't hidden under bottom bar */}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* STICKY BOTTOM ACTION */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.joinButton,
            joinButtonState.kind === 'joined' && styles.joinButtonJoined,
            joinButtonState.kind === 'pending' && styles.joinButtonPending,
            joinButtonState.kind === 'disabled' && styles.joinButtonDisabled,
            (working || joinButtonState.disabled) && styles.joinButtonDisabledOpacity,
          ]}
          onPress={handlePrimaryAction}
          disabled={working || joinButtonState.disabled}
          accessibilityLabel={joinButtonState.label}
        >
          <Text
            style={[
              styles.joinButtonText,
              joinButtonState.kind === 'joined' && styles.joinButtonTextJoined,
              joinButtonState.kind === 'pending' && styles.joinButtonTextPending,
              joinButtonState.kind === 'disabled' && styles.joinButtonTextDisabled,
            ]}
          >
            {working && !joinButtonState.disabled ? 'Joining...' : joinButtonState.label}
          </Text>
        </TouchableOpacity>

        {isMember ? (
          <TouchableOpacity
            style={[styles.leaveLink, working && styles.leaveLinkDisabled]}
            onPress={handleLeave}
            disabled={working}
            accessibilityLabel="Leave community"
          >
            <Text style={styles.leaveLinkText}>{working ? 'Please wait…' : 'Leave'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <JoinRequestModal
        visible={requestModalVisible}
        onClose={closeRequestModal}
        onSubmit={handleSubmitJoinRequest}
        communityName={community?.name || ''}
        screeningQuestions={screeningQuestions}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.background,
  },
  centerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  centerText: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 16,
    textAlign: 'center',
  },
  heroWrap: {
    width: '100%',
    height: 250,
    backgroundColor: '#EAEAEA',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderText: {
    fontSize: 48,
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  infoCard: {
    marginTop: -16,
    backgroundColor: COLORS.white,
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginHorizontal: 16,
  },
  communityName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  rowIconPin: {
    fontSize: 16,
    color: COLORS.primary,
  },
  rowIconUsers: {
    fontSize: 16,
    color: '#2F6FED',
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textLight,
  },
  privacyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  privacyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 4,
  },
  description: {
    fontSize: 15,
    color: COLORS.textLight,
    lineHeight: 22,
    marginBottom: 20,
  },
  adminScroll: {
    marginBottom: 20,
  },
  adminItem: {
    width: 72,
    marginRight: 12,
    alignItems: 'center',
  },
  adminAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EAEAEA',
  },
  adminAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminAvatarText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  adminName: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  mutedText: {
    color: COLORS.textMuted,
    fontSize: 13,
    paddingVertical: 8,
  },
  radiusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  radiusIcon: {
    fontSize: 18,
  },
  radiusText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  adminNote: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    padding: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  joinButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  joinButtonTextJoined: {
    color: '#1F7A3A',
  },
  joinButtonTextPending: {
    color: '#B25A00',
  },
  joinButtonTextDisabled: {
    color: COLORS.textMuted,
  },
  joinButtonJoined: {
    backgroundColor: COLORS.disabledBg,
  },
  joinButtonPending: {
    backgroundColor: COLORS.warningBg,
  },
  joinButtonDisabled: {
    backgroundColor: COLORS.disabledBg,
  },
  joinButtonDisabledOpacity: {
    opacity: 0.85,
  },
  leaveLink: {
    marginTop: 10,
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  leaveLinkText: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: 14,
  },
  leaveLinkDisabled: {
    opacity: 0.7,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 160,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 16,
  },
});

export default CommunityDetailScreen;

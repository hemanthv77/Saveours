import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import { launchImageLibrary } from 'react-native-image-picker';
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
  const [memberUsers, setMemberUsers] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberActionWorking, setMemberActionWorking] = useState(false);

  // Admin edit mode
  const [editMode, setEditMode] = useState(false);
  const [editWorking, setEditWorking] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    isPrivate: false,
    radiusKm: '',
  });
  const [draftImage, setDraftImage] = useState(null);
  const [draftScreeningQuestions, setDraftScreeningQuestions] = useState([]);

  // Join request state (private communities)
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);

  // Admin menu + join requests management
  const [adminMenuVisible, setAdminMenuVisible] = useState(false);
  const [joinRequestsModalVisible, setJoinRequestsModalVisible] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState([]);
  const [selectedJoinRequest, setSelectedJoinRequest] = useState(null);
  const [requestActionWorking, setRequestActionWorking] = useState(false);
  const [expandedRequests, setExpandedRequests] = useState(new Set());

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

  // Seed draft when entering edit mode or when community loads
  useEffect(() => {
    if (!community) return;
    if (!editMode) return;

    setDraft({
      name: (community.name || '').toString(),
      description: (community.description || '').toString(),
      isPrivate: !!community.isPrivate,
      radiusKm:
        typeof community.radiusKm === 'number' && Number.isFinite(community.radiusKm)
          ? String(community.radiusKm)
          : '',
    });
    setDraftImage(null);

    const raw = Array.isArray(community.screeningQuestions) ? community.screeningQuestions : [];
    const normalized = raw
      .map((q) => {
        const question = (q?.question || q || '').toString();
        const questionId = (q?.questionId || q?.id || '').toString();
        const trimmed = question.trim();
        const id = questionId.trim() || trimmed || '';
        return { questionId: id, question: trimmed };
      })
      .filter((q) => q.question && q.questionId)
      .slice(0, 5);
    setDraftScreeningQuestions(normalized);
  }, [community, editMode]);

  const makeId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const addDraftScreeningQuestion = () => {
    setDraftScreeningQuestions((prev) => {
      if (prev.length >= 5) {
        Alert.alert('Limit reached', 'You can add up to 5 screening questions.');
        return prev;
      }
      return [...prev, { questionId: makeId(), question: '' }];
    });
  };

  const updateDraftScreeningQuestion = (questionId, text) => {
    setDraftScreeningQuestions((prev) =>
      prev.map((q) => (q.questionId === questionId ? { ...q, question: text } : q))
    );
  };

  const removeDraftScreeningQuestion = (questionId) => {
    setDraftScreeningQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
  };

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

  const isFounder = useMemo(() => {
    if (!currentUserId || !creatorId) return false;
    return currentUserId === creatorId;
  }, [currentUserId, creatorId]);
  // Admin menu button in header (depends on isAdmin, so it must come after isAdmin is defined)
  useLayoutEffect(() => {
    if (!communityId) return;

    navigation.setOptions({
      headerRight: isAdmin
        ? () => (
            editMode ? (
              <TouchableOpacity
                onPress={() => {
                  if (editWorking) return;
                  setEditMode(false);
                  setDraftImage(null);
                }}
                style={styles.headerCancelButton}
                accessibilityLabel="Cancel editing"
              >
                <Text style={styles.headerCancelText}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => setAdminMenuVisible((v) => !v)}
                style={styles.headerMenuButton}
                accessibilityLabel="Admin menu"
              >
                <Text style={styles.headerMenuIcon}>⋯</Text>
                {pendingJoinRequests.length > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {pendingJoinRequests.length > 99 ? '99+' : pendingJoinRequests.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          )
        : undefined,
    });
  }, [communityId, editMode, editWorking, isAdmin, navigation]);

  // Fetch pending join requests for admins
  useEffect(() => {
    if (!isAdmin || !communityId) {
      setPendingJoinRequests([]);
      return;
    }

    const unsubscribe = firestore()
      .collection('joinRequests')
      .where('communityId', '==', communityId)
      .where('status', '==', 'pending')
      .onSnapshot(
        (snapshot) => {
          const requests = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
              const aTime = a.requestedAt?.toMillis?.() || 0;
              const bTime = b.requestedAt?.toMillis?.() || 0;
              return bTime - aTime; // descending order
            });
          setPendingJoinRequests(requests);
        },
        (error) => {
          console.error('Fetch pending join requests error:', error);
          setPendingJoinRequests([]);
        }
      );

    return unsubscribe;
  }, [communityId, isAdmin]);

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

  // Fetch member users for edit mode
  useEffect(() => {
    if (!editMode || !memberIds.length) {
      setMemberUsers([]);
      return;
    }

    let cancelled = false;

    const fetchMembers = async () => {
      try {
        const fieldPath = firestore.FieldPath.documentId();
        const chunks = chunk(memberIds, 10);
        const results = [];
        for (const c of chunks) {
          const snap = await firestore()
            .collection('users')
            .where(fieldPath, 'in', c)
            .get();
          snap.forEach((d) => results.push({ id: d.id, ...d.data() }));
        }
        if (!cancelled) setMemberUsers(results);
      } catch (error) {
        console.error('Fetch members error:', error);
        if (!cancelled) setMemberUsers([]);
      }
    };

    fetchMembers();
    return () => {
      cancelled = true;
    };
  }, [editMode, memberIds]);

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

  // Handle delete community (founder only)
  const handleDeleteCommunity = useCallback(async () => {
    if (!isFounder || !communityId) return;

    Alert.alert(
      'Delete Community?',
      'This action cannot be undone. All community data, members, and posts will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              // Delete all join requests for this community
              const joinRequestsSnap = await firestore()
                .collection('joinRequests')
                .where('communityId', '==', communityId)
                .get();
              
              const batch = firestore().batch();
              joinRequestsSnap.docs.forEach(doc => {
                batch.delete(doc.ref);
              });

              // Remove community from all members' user documents
              const memberIdsToUpdate = [...(memberIds || []), ...(adminIds || [])];
              const uniqueMemberIds = [...new Set(memberIdsToUpdate)];
              
              for (const memberId of uniqueMemberIds) {
                const userRef = firestore().collection('users').doc(memberId);
                batch.update(userRef, {
                  communities: firestore.FieldValue.arrayRemove(communityId),
                  updatedAt: firestore.FieldValue.serverTimestamp(),
                });
              }

              // Delete the community document
              const communityRef = firestore().collection('communities').doc(communityId);
              batch.delete(communityRef);

              await batch.commit();

              Alert.alert('Deleted', 'The community has been permanently deleted.', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              console.error('Delete community error:', error);
              Alert.alert('Error', 'Could not delete the community. Please try again.');
            }
            setWorking(false);
          },
        },
      ]
    );
  }, [isFounder, communityId, memberIds, adminIds, navigation]);

  // Handle approve/decline join request
  const handleJoinRequestAction = useCallback(async (request, action) => {
    if (!request?.id || !isAdmin) return;
    if (requestActionWorking) return;

    setRequestActionWorking(true);
    try {
      const requestRef = firestore().collection('joinRequests').doc(request.id);
      const communityRef = firestore().collection('communities').doc(communityId);
      const userRef = firestore().collection('users').doc(request.userId);

      if (action === 'approve') {
        await firestore().runTransaction(async (tx) => {
          const communitySnap = await tx.get(communityRef);
          if (!communitySnap.exists) throw new Error('Community not found');

          const data = communitySnap.data();
          const mIds = Array.isArray(data.memberIds) ? data.memberIds : [];
          const maxCap = typeof data.maxCapacity === 'number' ? data.maxCapacity : 0;
          const curMembers = typeof data.currentMembers === 'number' ? data.currentMembers : mIds.length;

          if (mIds.includes(request.userId)) {
            tx.update(requestRef, {
              status: 'approved',
              respondedAt: firestore.FieldValue.serverTimestamp(),
              respondedBy: currentUserId,
            });
            return;
          }

          if (maxCap > 0 && curMembers >= maxCap) {
            throw new Error('FULL');
          }

          tx.update(communityRef, {
            memberIds: firestore.FieldValue.arrayUnion(request.userId),
            currentMembers: firestore.FieldValue.increment(1),
          });

          tx.set(
            userRef,
            {
              userId: request.userId,
              email: request.userEmail || '',
              communities: firestore.FieldValue.arrayUnion(communityId),
              updatedAt: firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          tx.update(requestRef, {
            status: 'approved',
            respondedAt: firestore.FieldValue.serverTimestamp(),
            respondedBy: currentUserId,
          });
        });

        Alert.alert('Approved', `${request.userName || 'User'} has been added to the community.`);
      } else {
        await requestRef.update({
          status: 'declined',
          respondedAt: firestore.FieldValue.serverTimestamp(),
          respondedBy: currentUserId,
        });

        Alert.alert('Declined', 'The join request has been declined.');
      }

      setSelectedJoinRequest(null);
    } catch (error) {
      if (error?.message === 'FULL') {
        Alert.alert('Community Full', 'Cannot approve - the community is at maximum capacity.');
      } else {
        console.error('Join request action error:', error);
        Alert.alert('Error', 'Could not process the request. Please try again.');
      }
    }
    setRequestActionWorking(false);
  }, [communityId, currentUserId, isAdmin, requestActionWorking]);

  // Handle member actions (remove, make admin, revoke admin)
  const handleMemberAction = useCallback(async (member, action) => {
    if (!member?.id || !isAdmin || memberActionWorking) return;
    
    const isMemberFounder = member.id === creatorId;
    const isMemberAdmin = effectiveAdminIds.includes(member.id);
    
    // Founders cannot be removed or have their admin revoked
    if (isMemberFounder && (action === 'remove' || action === 'revokeAdmin')) {
      Alert.alert('Cannot Modify Founder', 'The founder of the community cannot be removed or demoted.');
      return;
    }
    
    // Only founders can revoke admin status or remove admins
    if (isMemberAdmin && !isFounder && (action === 'remove' || action === 'revokeAdmin')) {
      Alert.alert('Founder Only', 'Only the founder can remove or demote admins.');
      return;
    }
    
    // Prevent removing yourself if you're the only admin
    if (action === 'remove' && isMemberAdmin && effectiveAdminIds.length <= 1) {
      Alert.alert('Cannot Remove', 'You cannot remove the only admin from the community.');
      return;
    }
    
    // Prevent making yourself admin again
    if (action === 'makeAdmin' && isMemberAdmin) {
      Alert.alert('Already Admin', 'This user is already an admin.');
      return;
    }
    
    // Prevent revoking non-admin
    if (action === 'revokeAdmin' && !isMemberAdmin) {
      Alert.alert('Not Admin', 'This user is not an admin.');
      return;
    }

    setMemberActionWorking(true);
    try {
      const communityRef = firestore().collection('communities').doc(communityId);
      
      if (action === 'remove') {
        await communityRef.update({
          memberIds: firestore.FieldValue.arrayRemove(member.id),
          adminIds: firestore.FieldValue.arrayRemove(member.id),
          currentMembers: firestore.FieldValue.increment(-1),
        });
        Alert.alert('Removed', `${member.name || 'User'} has been removed from the community.`);
      } else if (action === 'makeAdmin') {
        await communityRef.update({
          adminIds: firestore.FieldValue.arrayUnion(member.id),
        });
        Alert.alert('Admin Added', `${member.name || 'User'} is now an admin.`);
      } else if (action === 'revokeAdmin') {
        await communityRef.update({
          adminIds: firestore.FieldValue.arrayRemove(member.id),
        });
        Alert.alert('Admin Revoked', `${member.name || 'User'} is now a regular member.`);
      }
      
      setSelectedMember(null);
    } catch (error) {
      console.error('Member action error:', error);
      Alert.alert('Error', 'Could not complete the action. Please try again.');
    }
    setMemberActionWorking(false);
  }, [communityId, isAdmin, isFounder, memberActionWorking, effectiveAdminIds, creatorId]);

  const toggleRequestExpansion = useCallback((requestId) => {
    setExpandedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  }, []);

  const joinButtonState = useMemo(() => {
    if (!community) return { label: 'Join Community', disabled: true, kind: 'disabled' };
    if (isMember) return { label: 'Go to feed', disabled: false, kind: 'primary' };
    if (isFull && !isMember) return { label: 'Community Full', disabled: true, kind: 'disabled' };
    if (pendingRequest) return { label: 'Request Pending ⏱', disabled: true, kind: 'pending' };
    return { label: 'Join Community', disabled: false, kind: 'primary' };
  }, [community, isFull, isMember, pendingRequest]);

  const handlePrimaryAction = () => {
    if (editMode) return;
    if (isMember) {
      navigation.navigate('CommunityFeed', { communityId });
      return;
    }
    if (joinButtonState.disabled) return;
    if (isPrivate) {
      openRequestModal();
      return;
    }
    handlePublicJoin();
  };

  const selectDraftImage = useCallback(async () => {
    if (!editMode) return;
    if (editWorking) return;

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.85,
        maxWidth: 1440,
        maxHeight: 1440,
        selectionLimit: 1,
        includeBase64: true,
      });

      if (result?.didCancel) return;
      if (result?.errorCode) {
        Alert.alert('Error', result.errorMessage || 'Failed to select image.');
        return;
      }

      const asset = result?.assets?.[0];
      if (!asset) return;
      if (!asset.uri && !asset.base64) {
        Alert.alert('Error', 'Selected image is unavailable. Please choose a different photo.');
        return;
      }

      setDraftImage(asset);
    } catch (e) {
      console.error('Select draft image error:', e);
      Alert.alert('Error', 'Failed to select image.');
    }
  }, [editMode, editWorking]);

  const saveCommunityChanges = useCallback(async () => {
    if (!isAdmin) return;
    if (!communityId) return;
    if (!community) return;

    const nextName = (draft.name || '').trim();
    const nextDescription = (draft.description || '').trim();
    const nextRadiusRaw = (draft.radiusKm || '').trim();

    if (nextName.length < 3) {
      Alert.alert('Validation', 'Community name must be at least 3 characters.');
      return;
    }
    if (nextDescription.length < 20) {
      Alert.alert('Validation', 'Description must be at least 20 characters.');
      return;
    }

    const sanitizedScreeningQuestions = (Array.isArray(draftScreeningQuestions)
      ? draftScreeningQuestions
      : []
    )
      .map((q) => ({
        questionId: (q?.questionId || '').toString().trim(),
        question: (q?.question || '').toString().trim(),
      }))
      .filter((q) => q.questionId && q.question)
      .slice(0, 5);

    if (draft.isPrivate && sanitizedScreeningQuestions.length) {
      const bad = sanitizedScreeningQuestions.find((q) => q.question.length < 10);
      if (bad) {
        Alert.alert('Validation', 'Each screening question must be at least 10 characters.');
        return;
      }
    }

    let nextRadiusKm = null;
    if (nextRadiusRaw.length) {
      const n = Number(nextRadiusRaw);
      if (!Number.isFinite(n) || n < 0 || n > 1000) {
        Alert.alert('Validation', 'Radius must be a number between 0 and 1000.');
        return;
      }
      nextRadiusKm = Math.round(n);
    }

    setEditWorking(true);
    try {
      let imageUrl = community.imageUrl || '';

      if (draftImage) {
        const safeName = (draftImage.fileName || 'community.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
        const imageRef = storage().ref(
          `communities/${communityId}/hero_${Date.now()}_${safeName}`
        );

        if (draftImage.base64) {
          await imageRef.putString(draftImage.base64, 'base64', {
            contentType: draftImage.type || 'image/jpeg',
          });
          imageUrl = await imageRef.getDownloadURL();
        } else if (draftImage.uri) {
          const uploadUri =
            Platform.OS === 'ios' && draftImage.uri.startsWith('file://')
              ? draftImage.uri.replace('file://', '')
              : draftImage.uri;
          await imageRef.putFile(uploadUri);
          imageUrl = await imageRef.getDownloadURL();
        }
      }

      const update = {
        name: nextName,
        description: nextDescription,
        isPrivate: !!draft.isPrivate,
        ...(nextRadiusKm !== null ? { radiusKm: nextRadiusKm } : {}),
        ...(imageUrl ? { imageUrl } : { imageUrl: '' }),
        screeningQuestions: draft.isPrivate ? sanitizedScreeningQuestions : [],
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection('communities').doc(communityId).set(update, { merge: true });

      Alert.alert('Saved', 'Community changes saved.');
      setEditMode(false);
      setDraftImage(null);
    } catch (e) {
      console.error('Save community changes error:', e);
      Alert.alert('Error', 'Could not save changes. Please try again.');
    }
    setEditWorking(false);
  }, [community, communityId, draft.description, draft.isPrivate, draft.name, draft.radiusKm, draftImage, draftScreeningQuestions, isAdmin]);

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
          {editMode && draftImage ? (
            <Image source={{ uri: draftImage.uri }} style={styles.heroImage} />
          ) : community.imageUrl ? (
            <Image source={{ uri: community.imageUrl }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroPlaceholderText}>🍽️</Text>
            </View>
          )}
          <View style={styles.heroOverlay} pointerEvents="none" />

          {editMode ? (
            <TouchableOpacity
              style={styles.changeImageButton}
              onPress={selectDraftImage}
              disabled={editWorking}
              accessibilityLabel={community.imageUrl || draftImage ? 'Change community image' : 'Add community image'}
            >
              <Text style={styles.changeImageButtonText}>
                {community.imageUrl || draftImage ? 'Change image' : 'Add image'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* INFO CARD */}
        <View style={styles.infoCard}>
          {editMode ? (
            <TextInput
              style={styles.communityNameInput}
              value={draft.name}
              onChangeText={(t) => setDraft((p) => ({ ...p, name: t }))}
              placeholder="Community name"
              placeholderTextColor={COLORS.textMuted}
              editable={!editWorking}
            />
          ) : (
            <Text style={styles.communityName}>{community.name}</Text>
          )}

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
          {editMode ? (
            <View style={styles.privacyEditRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.privacyEditTitle}>Private community</Text>
                <Text style={styles.privacyEditSubtitle}>
                  {draft.isPrivate ? 'Admins must approve new members' : 'Anyone can join instantly'}
                </Text>
              </View>
              <Switch
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.white}
                value={!!draft.isPrivate}
                onValueChange={(v) => setDraft((p) => ({ ...p, isPrivate: v }))}
                disabled={editWorking}
              />
            </View>
          ) : (
            <View
              style={[styles.privacyBadge, { backgroundColor: badge.bg }]}
              accessibilityLabel={`Community is ${badge.label}`}
            >
              <Text style={[styles.privacyBadgeText, { color: badge.text }]}> {badge.label} </Text>
            </View>
          )}

          {/* Description */}
          <Text style={styles.sectionLabel}>About this community</Text>
          {editMode ? (
            <TextInput
              style={styles.descriptionInput}
              value={draft.description}
              onChangeText={(t) => setDraft((p) => ({ ...p, description: t }))}
              placeholder="Describe your community..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
              editable={!editWorking}
            />
          ) : (
            <Text style={styles.description}>{community.description || 'No description yet.'}</Text>
          )}

          {/* Screening Questions (Private only) */}
          {editMode && draft.isPrivate ? (
            <>
              <Text style={styles.sectionLabel}>Screening Questions (Optional)</Text>
              <Text style={styles.helpText}>Ask questions to screen new members (max 5)</Text>

              <TouchableOpacity
                style={styles.addQuestionButton}
                onPress={addDraftScreeningQuestion}
                disabled={editWorking}
                accessibilityLabel="Add screening question"
              >
                <Text style={styles.addQuestionButtonText}>Add Question</Text>
              </TouchableOpacity>

              {draftScreeningQuestions.map((q) => (
                <View key={q.questionId} style={styles.questionRow}>
                  <TextInput
                    style={styles.questionInput}
                    value={q.question}
                    onChangeText={(t) => updateDraftScreeningQuestion(q.questionId, t)}
                    placeholder="e.g., Why do you want to join?"
                    placeholderTextColor={COLORS.textMuted}
                    maxLength={120}
                    editable={!editWorking}
                  />
                  <TouchableOpacity
                    style={styles.removeQuestionButton}
                    onPress={() => removeDraftScreeningQuestion(q.questionId)}
                    disabled={editWorking}
                    accessibilityLabel="Remove question"
                  >
                    <Text style={styles.removeQuestionText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : null}

          {/* Radius - moved before Admins */}
          {editMode ? (
            <View style={styles.radiusEditBox}>
              <Text style={styles.radiusIcon}>📏</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.radiusEditTitle}>Community radius (km)</Text>
                <TextInput
                  style={styles.radiusInput}
                  value={draft.radiusKm}
                  onChangeText={(t) => setDraft((p) => ({ ...p, radiusKm: t }))}
                  placeholder={radiusKm !== null ? String(radiusKm) : 'e.g. 10'}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  editable={!editWorking}
                />
              </View>
            </View>
          ) : radiusKm !== null ? (
            <View style={styles.radiusBox}>
              <Text style={styles.radiusIcon}>📏</Text>
              <Text style={styles.radiusText}>Community radius: {radiusKm} km</Text>
            </View>
          ) : null}

          {/* Admins */}
          <Text style={styles.sectionLabel}>Admins</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.adminScroll}>
            {adminUsers.length ? (
              adminUsers.map((u) => {
                const displayName = (u.name || '').trim() || (u.email || '').trim() || 'Admin';
                const isThisUserFounder = !!creatorId && u.id === creatorId;
                const canManageThisAdmin = editMode && isFounder && !isThisUserFounder;
                
                const adminContent = (
                  <>
                    {u.profilePictureUrl ? (
                      <Image source={{ uri: u.profilePictureUrl }} style={styles.adminAvatar} />
                    ) : (
                      <View style={styles.adminAvatarFallback}>
                        <Text style={styles.adminAvatarText}>{getInitials(displayName)}</Text>
                      </View>
                    )}
                    {isThisUserFounder && (
                      <View style={styles.founderBadge}>
                        <Text style={styles.founderBadgeText}>👑</Text>
                      </View>
                    )}
                    <Text style={styles.adminName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    {isThisUserFounder && (
                      <Text style={styles.founderLabel}>Founder</Text>
                    )}
                  </>
                );
                
                return canManageThisAdmin ? (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.adminItem}
                    onPress={() => setSelectedMember({ ...u, isAdmin: true })}
                  >
                    {adminContent}
                  </TouchableOpacity>
                ) : (
                  <View key={u.id} style={styles.adminItem}>
                    {adminContent}
                  </View>
                );
              })
            ) : (
              <Text style={styles.mutedText}>No admins listed.</Text>
            )}
          </ScrollView>

          {/* Members - only in edit mode, excluding admins */}
          {editMode ? (
            <>
              {(() => {
                const nonAdminMembers = memberUsers.filter(u => !effectiveAdminIds.includes(u.id));
                return (
                  <>
                    <Text style={styles.sectionLabel}>Members ({nonAdminMembers.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.adminScroll}>
                      {nonAdminMembers.length ? (
                        nonAdminMembers.map((u) => {
                          const displayName = (u.name || '').trim() || (u.email || '').trim() || 'Member';
                          return (
                            <TouchableOpacity
                              key={u.id}
                              style={styles.adminItem}
                              onPress={() => setSelectedMember(u)}
                            >
                              {u.profilePictureUrl ? (
                                <Image source={{ uri: u.profilePictureUrl }} style={styles.adminAvatar} />
                              ) : (
                                <View style={styles.adminAvatarFallback}>
                                  <Text style={styles.adminAvatarText}>{getInitials(displayName)}</Text>
                                </View>
                              )}
                              <Text style={styles.adminName} numberOfLines={1}>
                                {displayName}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        <Text style={styles.mutedText}>No members yet.</Text>
                      )}
                    </ScrollView>
                  </>
                );
              })()}
            </>
          ) : null}
        </View>

        {/* Spacer so content isn't hidden under bottom bar */}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* STICKY BOTTOM ACTION */}
      <View style={styles.bottomBar}>
        {editMode && isAdmin ? (
          <>
            <TouchableOpacity
              style={[styles.joinButton, (editWorking || working) && styles.joinButtonDisabledOpacity]}
              onPress={saveCommunityChanges}
              disabled={editWorking || working}
              accessibilityLabel="Save changes"
            >
              <Text style={styles.joinButtonText}>
                {editWorking ? 'Saving…' : 'Save changes'}
              </Text>
            </TouchableOpacity>
            {isFounder ? (
              <TouchableOpacity
                style={[styles.deleteLink, working && styles.deleteLinkDisabled]}
                onPress={handleDeleteCommunity}
                disabled={working || editWorking}
                accessibilityLabel="Delete community"
              >
                <Text style={styles.deleteLinkText}>{working ? 'Please wait…' : 'Delete Community'}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <>
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
                {working && !isMember && !joinButtonState.disabled ? 'Joining...' : joinButtonState.label}
              </Text>
            </TouchableOpacity>

            {isMember && !isFounder ? (
              <TouchableOpacity
                style={[styles.leaveLink, working && styles.leaveLinkDisabled]}
                onPress={handleLeave}
                disabled={working}
                accessibilityLabel="Leave community"
              >
                <Text style={styles.leaveLinkText}>{working ? 'Please wait…' : 'Leave'}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>

      <JoinRequestModal
        visible={requestModalVisible}
        onClose={closeRequestModal}
        onSubmit={handleSubmitJoinRequest}
        communityName={community?.name || ''}
        screeningQuestions={screeningQuestions}
      />

      {/* Member Details Dialog */}
      {selectedMember && editMode ? (
        <View style={styles.modalOverlay}>
          <View style={styles.memberDialog}>
            <TouchableOpacity
              style={styles.memberDialogCloseButton}
              onPress={() => setSelectedMember(null)}
            >
              <Text style={styles.memberDialogCloseText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.memberDialogContent}>
              {selectedMember.profilePictureUrl ? (
                <Image source={{ uri: selectedMember.profilePictureUrl }} style={styles.memberDialogAvatar} />
              ) : (
                <View style={styles.memberDialogAvatarFallback}>
                  <Text style={styles.memberDialogAvatarText}>
                    {getInitials(selectedMember.name || selectedMember.email)}
                  </Text>
                </View>
              )}

              <Text style={styles.memberDialogName}>
                {selectedMember.name || 'No name'}
              </Text>
              <Text style={styles.memberDialogEmail}>
                {selectedMember.email || 'No email'}
              </Text>

              {selectedMember.isAdmin || effectiveAdminIds.includes(selectedMember.id) ? (
                <View style={styles.memberDialogBadge}>
                  <Text style={styles.memberDialogBadgeText}>⭐ Admin</Text>
                </View>
              ) : null}

              <View style={styles.memberDialogActions}>
                {/* Show Make Admin for non-admins */}
                {!selectedMember.isAdmin && !effectiveAdminIds.includes(selectedMember.id) ? (
                  <TouchableOpacity
                    style={[styles.memberDialogActionButton, styles.makeAdminButton, memberActionWorking && styles.buttonDisabledOpacity]}
                    onPress={() => handleMemberAction(selectedMember, 'makeAdmin')}
                    disabled={memberActionWorking}
                  >
                    <Text style={styles.makeAdminButtonText}>⭐ Make Admin</Text>
                  </TouchableOpacity>
                ) : null}

                {/* Show Revoke Admin for admins (founder only, handled in handleMemberAction) */}
                {(selectedMember.isAdmin || effectiveAdminIds.includes(selectedMember.id)) && isFounder ? (
                  <TouchableOpacity
                    style={[styles.memberDialogActionButton, styles.revokeAdminButton, memberActionWorking && styles.buttonDisabledOpacity]}
                    onPress={() => handleMemberAction(selectedMember, 'revokeAdmin')}
                    disabled={memberActionWorking}
                  >
                    <Text style={styles.revokeAdminButtonText}>↩️ Revoke Admin</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.memberDialogActionButton, styles.removeMemberButton, memberActionWorking && styles.buttonDisabledOpacity]}
                  onPress={() => handleMemberAction(selectedMember, 'remove')}
                  disabled={memberActionWorking}
                >
                  <Text style={styles.removeMemberButtonText}>🚫 Remove from Community</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {/* Admin Dropdown Menu */}
      {adminMenuVisible && isAdmin ? (
        <>
          <TouchableOpacity
            style={styles.menuBackdrop}
            onPress={() => setAdminMenuVisible(false)}
            activeOpacity={1}
          />
          <View style={styles.adminDropdownMenu}>
            <TouchableOpacity
              style={styles.adminMenuItem}
              onPress={() => {
                setAdminMenuVisible(false);
                setEditMode(true);
              }}
            >
              <Text style={styles.adminMenuItemText}>Edit community</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.adminMenuItem, styles.adminMenuItemLast]}
              onPress={() => {
                setAdminMenuVisible(false);
                setJoinRequestsModalVisible(true);
              }}
            >
              <Text style={styles.adminMenuItemText}>
                Join requests {pendingJoinRequests.length ? `(${pendingJoinRequests.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      {/* Join Requests Modal */}
      {joinRequestsModalVisible && isAdmin ? (
        <View style={styles.modalOverlay}>
          <View style={styles.joinRequestsModal}>
            <View style={styles.joinRequestsHeader}>
              <Text style={styles.joinRequestsTitle}>Join Requests</Text>
              <TouchableOpacity
                onPress={() => {
                  setJoinRequestsModalVisible(false);
                  setSelectedJoinRequest(null);
                }}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedJoinRequest ? (
              <ScrollView style={styles.requestDetailScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.requestDetailCard}>
                  {selectedJoinRequest.userProfilePic ? (
                    <Image
                      source={{ uri: selectedJoinRequest.userProfilePic }}
                      style={styles.requestDetailAvatar}
                    />
                  ) : (
                    <View style={styles.requestDetailAvatarFallback}>
                      <Text style={styles.requestDetailAvatarText}>
                        {getInitials(selectedJoinRequest.userName || selectedJoinRequest.userEmail)}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.requestDetailName}>
                    {selectedJoinRequest.userName || 'Unknown User'}
                  </Text>
                  <Text style={styles.requestDetailEmail}>{selectedJoinRequest.userEmail}</Text>

                  {Array.isArray(selectedJoinRequest.answers) && selectedJoinRequest.answers.length ? (
                    <View style={styles.answersSection}>
                      <Text style={styles.answersSectionTitle}>Screening Answers</Text>
                      {selectedJoinRequest.answers.map((a, idx) => (
                        <View key={a.questionId || idx} style={styles.answerBlock}>
                          <Text style={styles.answerQuestion}>{idx + 1}. {a.question}</Text>
                          <Text style={styles.answerText}>{a.answer}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noAnswersText}>No screening answers provided.</Text>
                  )}
                </View>

                <View style={styles.requestActionButtons}>
                  <TouchableOpacity
                    style={[styles.declineButton, requestActionWorking && styles.buttonDisabledOpacity]}
                    onPress={() => handleJoinRequestAction(selectedJoinRequest, 'decline')}
                    disabled={requestActionWorking}
                  >
                    <Text style={styles.declineButtonText}>
                      {requestActionWorking ? 'Processing…' : 'Decline'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approveButton, requestActionWorking && styles.buttonDisabledOpacity]}
                    onPress={() => handleJoinRequestAction(selectedJoinRequest, 'approve')}
                    disabled={requestActionWorking}
                  >
                    <Text style={styles.approveButtonText}>
                      {requestActionWorking ? 'Processing…' : 'Approve'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.backToListButton}
                  onPress={() => setSelectedJoinRequest(null)}
                  disabled={requestActionWorking}
                >
                  <Text style={styles.backToListText}>← Back to list</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView style={styles.requestsListScroll} showsVerticalScrollIndicator={false}>
                {pendingJoinRequests.length === 0 ? (
                  <View style={styles.emptyRequestsContainer}>
                    <Text style={styles.emptyRequestsText}>No pending join requests.</Text>
                  </View>
                ) : (
                  pendingJoinRequests.map((req) => {
                    const isExpanded = expandedRequests.has(req.id);
                    return (
                      <View key={req.id}>
                        <TouchableOpacity
                          style={styles.requestListItem}
                          onPress={() => toggleRequestExpansion(req.id)}
                        >
                          {req.userProfilePic ? (
                            <Image source={{ uri: req.userProfilePic }} style={styles.requestListAvatar} />
                          ) : (
                            <View style={styles.requestListAvatarFallback}>
                              <Text style={styles.requestListAvatarText}>
                                {getInitials(req.userName || req.userEmail)}
                              </Text>
                            </View>
                          )}
                          <View style={styles.requestListInfo}>
                            <Text style={styles.requestListName} numberOfLines={1}>
                              {req.userName || 'Unknown User'}
                            </Text>
                            <Text style={styles.requestListEmail} numberOfLines={1}>
                              {req.userEmail}
                            </Text>
                          </View>
                          <Text style={styles.requestListArrow}>{isExpanded ? '▼' : '▶'}</Text>
                        </TouchableOpacity>
                        
                        {isExpanded && (
                          <View style={styles.expandedRequestContent}>
                            {req.answers && req.answers.length > 0 ? (
                              <View style={styles.answersSection}>
                                <Text style={styles.answersSectionTitle}>Answers to Screening Questions:</Text>
                                {req.answers.map((answer, idx) => (
                                  <View key={idx} style={styles.answerBlock}>
                                    <Text style={styles.answerQuestion}>Q: {answer.question}</Text>
                                    <Text style={styles.answerText}>A: {answer.answer}</Text>
                                  </View>
                                ))}
                              </View>
                            ) : (
                              <Text style={styles.noAnswersText}>No screening questions for this community</Text>
                            )}
                            
                            <View style={styles.requestActionButtons}>
                              <TouchableOpacity
                                style={[styles.declineButton, requestActionWorking && styles.buttonDisabledOpacity]}
                                onPress={() => handleJoinRequestAction(req, 'decline')}
                                disabled={requestActionWorking}
                              >
                                <Text style={styles.declineButtonText}>✗ Decline</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.approveButton, requestActionWorking && styles.buttonDisabledOpacity]}
                                onPress={() => handleJoinRequestAction(req, 'approve')}
                                disabled={requestActionWorking}
                              >
                                <Text style={styles.approveButtonText}>✓ Approve</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  headerMenuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  headerMenuIcon: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerCancelButton: {
    minWidth: 60,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: COLORS.border,
    borderRadius: 8,
    marginRight: 8,
  },
  headerCancelText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  adminDropdownMenu: {
    position: 'absolute',
    top: 8,
    right: 16,
    width: 200,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  adminMenuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  adminMenuItemLast: {
    borderBottomWidth: 0,
  },
  adminMenuItemText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  joinRequestsModal: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  joinRequestsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  joinRequestsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: COLORS.textMuted,
    fontWeight: '800',
  },
  requestsListScroll: {
    maxHeight: 400,
  },
  requestListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  requestListAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EAEAEA',
  },
  requestListAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestListAvatarText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 16,
  },
  requestListInfo: {
    flex: 1,
    marginLeft: 12,
  },
  requestListName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  requestListEmail: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  requestListArrow: {
    fontSize: 20,
    color: COLORS.textMuted,
    marginLeft: 8,
  },
  expandedRequestContent: {
    backgroundColor: '#F8F8F8',
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  memberDialog: {
    width: '85%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    position: 'relative',
  },
  memberDialogCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  memberDialogCloseText: {
    fontSize: 16,
    color: COLORS.textLight,
    fontWeight: '700',
  },
  memberDialogContent: {
    alignItems: 'center',
    paddingTop: 10,
  },
  memberDialogAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  memberDialogAvatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  memberDialogAvatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
  },
  memberDialogName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  memberDialogEmail: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  memberDialogBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  memberDialogBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF9800',
  },
  memberDialogActions: {
    width: '100%',
    marginTop: 8,
    gap: 10,
  },
  memberDialogActionButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  makeAdminButton: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  makeAdminButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF9800',
  },
  revokeAdminButton: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFA000',
  },
  revokeAdminButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFA000',
  },
  removeMemberButton: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  removeMemberButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.error,
  },
  emptyRequestsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyRequestsText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  requestDetailScroll: {
    padding: 16,
  },
  requestDetailCard: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  requestDetailAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EAEAEA',
    marginBottom: 12,
  },
  requestDetailAvatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestDetailAvatarText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 28,
  },
  requestDetailName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  requestDetailEmail: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  answersSection: {
    width: '100%',
    marginTop: 8,
  },
  answersSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
  },
  answerBlock: {
    marginBottom: 14,
  },
  answerQuestion: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 4,
  },
  answerText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    backgroundColor: '#F7F7F7',
    padding: 10,
    borderRadius: 8,
  },
  noAnswersText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  requestActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  declineButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.error,
  },
  approveButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#28A745',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  buttonDisabledOpacity: {
    opacity: 0.6,
  },
  backToListButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  backToListText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
  },
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
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  changeImageButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  changeImageButtonText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 12,
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
  communityNameInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
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
  descriptionInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 120,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  helpText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: -2,
    marginBottom: 12,
  },
  addQuestionButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  addQuestionButtonText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  questionRow: {
    marginBottom: 12,
  },
  questionInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingRight: 44,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: '#FFFFFF',
  },
  removeQuestionButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  removeQuestionText: {
    fontSize: 16,
    color: COLORS.textLight,
    fontWeight: 'bold',
  },
  privacyEditRow: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  privacyEditTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  privacyEditSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textMuted,
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
  founderBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 2,
  },
  founderBadgeText: {
    fontSize: 12,
  },
  founderLabel: {
    fontSize: 10,
    color: '#FFA000',
    fontWeight: '700',
    marginTop: 2,
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
  radiusEditBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  radiusEditTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  radiusInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: '#FFFFFF',
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
  deleteLink: {
    marginTop: 10,
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  deleteLinkText: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: 14,
  },
  deleteLinkDisabled: {
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

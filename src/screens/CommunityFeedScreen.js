import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const COLORS = {
  primary: '#FF6B4A',
  background: '#F5F5F5',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  border: '#E0E0E0',
  error: '#FF3B30',
};

const CommunityFeedScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId } = route.params || {};

  const currentUserId = auth().currentUser?.uid || null;

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [community, setCommunity] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);

  useLayoutEffect(() => {
    navigation.setOptions({
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
  }, [navigation]);

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

  useEffect(() => {
    navigation.setOptions({
      title: community?.name ? community.name : 'Community Feed',
    });
  }, [navigation, community?.name]);

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
  }, [adminIds.length, communityId, currentUserId, isAdmin, isMember, navigation]);

  if (loading) {
    return (
      <View style={styles.containerCenter}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.subtitle}>Loading...</Text>
      </View>
    );
  }

  if (!community) {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.title}>Community Feed</Text>
        <Text style={styles.subtitle}>Community not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {menuVisible ? (
        <>
          <Pressable style={styles.menuBackdrop} onPress={closeMenu} />
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={handleMessageAdmin}>
              <Text style={styles.menuText}>Message admin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.lastMenuItem]}
              onPress={handleLeaveCommunity}
              disabled={working}
            >
              <Text style={[styles.menuText, styles.dangerText]}>
                {working ? 'Leaving...' : 'Leave community'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      <View style={styles.feedHeader}>
        <Text style={styles.title}>Community Feed</Text>
        <Text style={styles.subtitle}>
          {isMember ? 'You are a member.' : 'You are not a member.'}
        </Text>
        <Text style={styles.meta}>communityId: {communityId || 'N/A'}</Text>
        <Text style={styles.metaMuted}>
          Feed content coming soon.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
  },
  containerCenter: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 12,
  },
  meta: {
    fontSize: 12,
    color: COLORS.text,
  },
  metaMuted: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  feedHeader: {
    marginTop: 12,
  },
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
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 180,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    zIndex: 10,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '700',
  },
  dangerText: {
    color: COLORS.error,
  },
});

export default CommunityFeedScreen;

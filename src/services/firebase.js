import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';

// Firebase configuration
// Replace these values with your actual Firebase project config
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// Firebase services
export const firebaseAuth = auth;
export const firebaseFirestore = firestore;
export const firebaseStorage = storage;

// Authentication methods
export const signUp = async (email, password) => {
  try {
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const signIn = async (email, password) => {
  try {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const signOut = async () => {
  try {
    await auth().signOut();
  } catch (error) {
    throw error;
  }
};

export const getCurrentUser = () => {
  return auth().currentUser;
};

// Firestore methods
export const createDocument = async (collection, data) => {
  try {
    const docRef = await firestore().collection(collection).add(data);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const getDocument = async (collection, docId) => {
  try {
    const doc = await firestore().collection(collection).doc(docId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (error) {
    throw error;
  }
};

export const updateDocument = async (collection, docId, data) => {
  try {
    await firestore().collection(collection).doc(docId).update(data);
  } catch (error) {
    throw error;
  }
};

export const deleteDocument = async (collection, docId) => {
  try {
    await firestore().collection(collection).doc(docId).delete();
  } catch (error) {
    throw error;
  }
};

// Storage methods
export const uploadImage = async (uri, path) => {
  try {
    const reference = storage().ref(path);
    await reference.putFile(uri);
    const url = await reference.getDownloadURL();
    return url;
  } catch (error) {
    throw error;
  }
};

// ============================================================
// PUSH NOTIFICATION METHODS
// ============================================================

// Request notification permission
export const requestNotificationPermission = async () => {
  try {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        // Android 13+ requires explicit permission
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true; // Android 12 and below auto-grant
    }
    
    // iOS permission request
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    return enabled;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

// Get FCM token
export const getFCMToken = async () => {
  try {
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Save FCM token to Firestore
export const saveFCMToken = async (userId, token) => {
  try {
    await firestore()
      .collection('users')
      .doc(userId)
      .update({
        fcmToken: token,
        fcmTokenUpdatedAt: firestore.FieldValue.serverTimestamp(),
      });
    console.log('FCM token saved to Firestore');
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
};

// Remove FCM token on logout
export const removeFCMToken = async (userId) => {
  try {
    await firestore()
      .collection('users')
      .doc(userId)
      .update({
        fcmToken: null,
      });
    await messaging().deleteToken();
    console.log('FCM token removed');
  } catch (error) {
    console.error('Error removing FCM token:', error);
  }
};

// Initialize push notifications for a user
export const initializePushNotifications = async (userId) => {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('Notification permission denied');
      return false;
    }

    const token = await getFCMToken();
    if (token && userId) {
      await saveFCMToken(userId, token);
    }

    // Listen for token refresh
    messaging().onTokenRefresh(async (newToken) => {
      console.log('FCM Token refreshed:', newToken);
      if (userId) {
        await saveFCMToken(userId, newToken);
      }
    });

    return true;
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return false;
  }
};

export default {
  firebaseAuth,
  firebaseFirestore,
  firebaseStorage,
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  uploadImage,
  requestNotificationPermission,
  getFCMToken,
  saveFCMToken,
  removeFCMToken,
  initializePushNotifications,
};

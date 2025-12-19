import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

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
};

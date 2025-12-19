import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';

// ============================================================
// ASYNC THUNKS
// ============================================================

/**
 * Fetch user profile data from Firestore
 */
export const fetchUserProfile = createAsyncThunk(
  'user/fetchUserProfile',
  async (userId, { rejectWithValue }) => {
    try {
      const userDoc = await firestore()
        .collection('users')
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        throw new Error('User profile not found');
      }

      return {
        id: userDoc.id,
        ...userDoc.data(),
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Update user profile in Firestore
 */
export const updateProfile = createAsyncThunk(
  'user/updateProfile',
  async ({ userId, data }, { rejectWithValue }) => {
    try {
      const updateData = {
        ...data,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore()
        .collection('users')
        .doc(userId)
        .update(updateData);

      return {
        userId,
        ...updateData,
      };
    } catch (error) {
      console.error('Error updating profile:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Upload profile picture to Firebase Storage
 */
export const uploadProfilePicture = createAsyncThunk(
  'user/uploadProfilePicture',
  async ({ userId, imageUri }, { rejectWithValue }) => {
    try {
      const imageRef = storage().ref(`users/${userId}/profile.jpg`);
      await imageRef.putFile(imageUri);
      const downloadUrl = await imageRef.getDownloadURL();

      // Update Firestore with new image URL
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          profilePictureUrl: downloadUrl,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      return downloadUrl;
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Sign out user from Firebase Auth and clear state
 */
export const signOutUser = createAsyncThunk(
  'user/signOutUser',
  async (_, { rejectWithValue }) => {
    try {
      await auth().signOut();
      return null;
    } catch (error) {
      console.error('Error signing out:', error);
      return rejectWithValue(error.message);
    }
  }
);

// ============================================================
// USER SLICE
// ============================================================

const initialState = {
  profile: null,
  loading: false,
  error: null,
  menuVisible: false,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    /**
     * Set user profile data
     */
    setUserProfile: (state, action) => {
      state.profile = action.payload;
      state.error = null;
    },

    /**
     * Update specific fields in user profile
     */
    updateUserProfile: (state, action) => {
      if (state.profile) {
        state.profile = {
          ...state.profile,
          ...action.payload,
        };
      }
    },

    /**
     * Set loading state
     */
    setLoading: (state, action) => {
      state.loading = action.payload;
    },

    /**
     * Set error message
     */
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },

    /**
     * Toggle profile menu visibility
     */
    toggleMenu: (state) => {
      state.menuVisible = !state.menuVisible;
    },

    /**
     * Clear user data on sign out
     */
    clearUser: (state) => {
      state.profile = null;
      state.loading = false;
      state.error = null;
      state.menuVisible = false;
    },
  },
  extraReducers: (builder) => {
    // Fetch User Profile
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
        state.error = null;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Update Profile
    builder
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        if (state.profile) {
          state.profile = {
            ...state.profile,
            ...action.payload,
          };
        }
        state.error = null;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Upload Profile Picture
    builder
      .addCase(uploadProfilePicture.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadProfilePicture.fulfilled, (state, action) => {
        state.loading = false;
        if (state.profile) {
          state.profile.profilePictureUrl = action.payload;
        }
        state.error = null;
      })
      .addCase(uploadProfilePicture.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Sign Out User
    builder
      .addCase(signOutUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signOutUser.fulfilled, (state) => {
        state.loading = false;
        state.profile = null;
        state.error = null;
        state.menuVisible = false;
      })
      .addCase(signOutUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

// ============================================================
// EXPORTS
// ============================================================

export const {
  setUserProfile,
  updateUserProfile,
  setLoading,
  setError,
  toggleMenu,
  clearUser,
} = userSlice.actions;

export default userSlice.reducer;

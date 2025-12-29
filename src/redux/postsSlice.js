import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// Initial state
const initialState = {
  list: [],
  loading: false,
  error: null,
  currentCommunityPosts: [],
  userPosts: [],
};

// ============================================================
// ASYNC THUNKS
// ============================================================

// Fetch posts for a specific community
export const fetchCommunityPosts = createAsyncThunk(
  'posts/fetchCommunityPosts',
  async (communityId, { rejectWithValue }) => {
    try {
      const snapshot = await firestore()
        .collection('posts')
        .where('communityId', '==', communityId)
        .where('status', '==', 'active')
        .get();

      const posts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Convert timestamps to serializable format
        createdAt: doc.data().createdAt?.toMillis() || null,
        expiresAt: doc.data().expiresAt?.toMillis() || null,
        updatedAt: doc.data().updatedAt?.toMillis() || null,
      }));

      // Sort by createdAt descending (newest first)
      posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      return { communityId, posts };
    } catch (error) {
      console.error('Fetch community posts error:', error);
      return rejectWithValue(error.message || 'Failed to fetch posts');
    }
  }
);

// Create a new post with image uploads
export const createPost = createAsyncThunk(
  'posts/createPost',
  async ({ postData, dishes }, { rejectWithValue }) => {
    try {
      const { userId, communityId } = postData;
      const postId = `${userId}_${Date.now()}`;
      const dishesData = [];

      // Process each dish and upload photos
      for (const dish of dishes) {
        const dishId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const photoUrls = [];

        // Upload each photo for the dish
        for (let i = 0; i < dish.photos.length; i++) {
          const photo = dish.photos[i];
          const path = `posts/${communityId}/${postId}/${dishId}/image_${i}.jpg`;
          const reference = storage().ref(path);
          await reference.putFile(photo.uri);
          const url = await reference.getDownloadURL();
          photoUrls.push(url);
        }

        dishesData.push({
          dishId,
          name: dish.name.trim(),
          photos: photoUrls,
          pricePerPortion: parseFloat(dish.price),
          portionsAvailable: parseInt(dish.portions, 10),
          portionsReserved: 0,
          portionsSold: 0,
        });
      }

      // Calculate end of day for expiry
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Create the post document
      const newPost = {
        postId,
        ...postData,
        dishes: dishesData,
        totalDishes: dishesData.length,
        createdAt: firestore.FieldValue.serverTimestamp(),
        expiresAt: firestore.Timestamp.fromDate(endOfDay),
        status: 'active',
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection('posts').doc(postId).set(newPost);

      // Return serializable version for Redux state
      return {
        id: postId,
        ...postData,
        dishes: dishesData,
        totalDishes: dishesData.length,
        createdAt: Date.now(),
        expiresAt: endOfDay.getTime(),
        status: 'active',
        updatedAt: Date.now(),
      };
    } catch (error) {
      console.error('Create post error:', error);
      return rejectWithValue(error.message || 'Failed to create post');
    }
  }
);

// Update post portions (when someone orders)
export const updatePostPortions = createAsyncThunk(
  'posts/updatePostPortions',
  async ({ postId, dishId, portionsReserved, portionsSold }, { rejectWithValue }) => {
    try {
      const postRef = firestore().collection('posts').doc(postId);
      const postSnap = await postRef.get();

      if (!postSnap.exists) {
        throw new Error('Post not found');
      }

      const postData = postSnap.data();
      const updatedDishes = postData.dishes.map((dish) => {
        if (dish.dishId === dishId) {
          return {
            ...dish,
            portionsReserved: portionsReserved ?? dish.portionsReserved,
            portionsSold: portionsSold ?? dish.portionsSold,
          };
        }
        return dish;
      });

      // Check if all dishes are sold out
      const allSoldOut = updatedDishes.every(
        (dish) => dish.portionsAvailable - dish.portionsReserved - dish.portionsSold <= 0
      );

      await postRef.update({
        dishes: updatedDishes,
        status: allSoldOut ? 'sold_out' : 'active',
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      return {
        postId,
        dishes: updatedDishes,
        status: allSoldOut ? 'sold_out' : 'active',
      };
    } catch (error) {
      console.error('Update post portions error:', error);
      return rejectWithValue(error.message || 'Failed to update portions');
    }
  }
);

// ============================================================
// SLICE
// ============================================================

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    setPosts: (state, action) => {
      state.list = action.payload;
      state.error = null;
    },
    addPost: (state, action) => {
      const post = action.payload;
      const existingIndex = state.list.findIndex((p) => p.id === post.id);
      
      if (existingIndex !== -1) {
        state.list[existingIndex] = post;
      } else {
        state.list.unshift(post); // Prepend new post
      }

      // Update currentCommunityPosts if same community
      if (state.currentCommunityPosts.length > 0) {
        const communityId = state.currentCommunityPosts[0]?.communityId;
        if (post.communityId === communityId) {
          const existingCommunityIndex = state.currentCommunityPosts.findIndex(
            (p) => p.id === post.id
          );
          if (existingCommunityIndex !== -1) {
            state.currentCommunityPosts[existingCommunityIndex] = post;
          } else {
            state.currentCommunityPosts.unshift(post);
          }
        }
      }
    },
    updatePost: (state, action) => {
      const { id, ...updates } = action.payload;
      
      // Update in main list
      const listIndex = state.list.findIndex((p) => p.id === id);
      if (listIndex !== -1) {
        state.list[listIndex] = { ...state.list[listIndex], ...updates };
      }

      // Update in currentCommunityPosts
      const communityIndex = state.currentCommunityPosts.findIndex((p) => p.id === id);
      if (communityIndex !== -1) {
        state.currentCommunityPosts[communityIndex] = {
          ...state.currentCommunityPosts[communityIndex],
          ...updates,
        };
      }

      // Update in userPosts
      const userIndex = state.userPosts.findIndex((p) => p.id === id);
      if (userIndex !== -1) {
        state.userPosts[userIndex] = { ...state.userPosts[userIndex], ...updates };
      }
    },
    removePost: (state, action) => {
      const postId = action.payload;
      state.list = state.list.filter((p) => p.id !== postId);
      state.currentCommunityPosts = state.currentCommunityPosts.filter((p) => p.id !== postId);
      state.userPosts = state.userPosts.filter((p) => p.id !== postId);
    },
    setCurrentCommunityPosts: (state, action) => {
      state.currentCommunityPosts = action.payload;
    },
    setUserPosts: (state, action) => {
      state.userPosts = action.payload;
    },
    clearCurrentCommunityPosts: (state) => {
      state.currentCommunityPosts = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchCommunityPosts
      .addCase(fetchCommunityPosts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCommunityPosts.fulfilled, (state, action) => {
        state.loading = false;
        state.currentCommunityPosts = action.payload.posts;
        
        // Merge into main list
        action.payload.posts.forEach((post) => {
          const existingIndex = state.list.findIndex((p) => p.id === post.id);
          if (existingIndex !== -1) {
            state.list[existingIndex] = post;
          } else {
            state.list.push(post);
          }
        });
      })
      .addCase(fetchCommunityPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // createPost
      .addCase(createPost.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.loading = false;
        state.list.unshift(action.payload);
        
        // Add to currentCommunityPosts if same community
        if (state.currentCommunityPosts.length > 0) {
          const communityId = state.currentCommunityPosts[0]?.communityId;
          if (action.payload.communityId === communityId) {
            state.currentCommunityPosts.unshift(action.payload);
          }
        }
      })
      .addCase(createPost.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // updatePostPortions
      .addCase(updatePostPortions.pending, (state) => {
        state.loading = true;
      })
      .addCase(updatePostPortions.fulfilled, (state, action) => {
        state.loading = false;
        const { postId, dishes, status } = action.payload;
        
        // Update in all lists
        [state.list, state.currentCommunityPosts, state.userPosts].forEach((list) => {
          const index = list.findIndex((p) => p.id === postId);
          if (index !== -1) {
            list[index] = { ...list[index], dishes, status };
          }
        });
      })
      .addCase(updatePostPortions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

// ============================================================
// SELECTORS
// ============================================================

export const selectAllPosts = (state) => state.posts.list;
export const selectPostsLoading = (state) => state.posts.loading;
export const selectPostsError = (state) => state.posts.error;
export const selectCurrentCommunityPosts = (state) => state.posts.currentCommunityPosts;
export const selectUserPosts = (state) => state.posts.userPosts;

// Select posts by community ID
export const selectPostsByCommunity = (state, communityId) => {
  return state.posts.list.filter((post) => post.communityId === communityId);
};

// Count active posts for a community
export const selectActivePostsCount = (state, communityId) => {
  return state.posts.list.filter(
    (post) => post.communityId === communityId && post.status === 'active'
  ).length;
};

// Select post by ID
export const selectPostById = (state, postId) => {
  return state.posts.list.find((post) => post.id === postId);
};

// ============================================================
// EXPORTS
// ============================================================

export const {
  setLoading,
  setError,
  clearError,
  setPosts,
  addPost,
  updatePost,
  removePost,
  setCurrentCommunityPosts,
  setUserPosts,
  clearCurrentCommunityPosts,
} = postsSlice.actions;

export default postsSlice.reducer;

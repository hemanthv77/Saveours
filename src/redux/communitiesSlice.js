import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  communities: [],
  selectedCommunity: null,
  loading: false,
  error: null,
};

const communitiesSlice = createSlice({
  name: 'communities',
  initialState,
  reducers: {
    setCommunities: (state, action) => {
      state.communities = action.payload;
      state.error = null;
    },
    addCommunity: (state, action) => {
      state.communities.unshift(action.payload);
    },
    updateCommunity: (state, action) => {
      const index = state.communities.findIndex(
        (c) => c.id === action.payload.id
      );
      if (index !== -1) {
        state.communities[index] = action.payload;
      }
    },
    removeCommunity: (state, action) => {
      state.communities = state.communities.filter(
        (c) => c.id !== action.payload
      );
    },
    setSelectedCommunity: (state, action) => {
      state.selectedCommunity = action.payload;
    },
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
  },
});

export const {
  setCommunities,
  addCommunity,
  updateCommunity,
  removeCommunity,
  setSelectedCommunity,
  setLoading,
  setError,
  clearError,
} = communitiesSlice.actions;

export default communitiesSlice.reducer;

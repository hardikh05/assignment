import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../utils/axios';

interface AnalyticsState {
  data: any;
  loading: boolean;
  error: string | null;
}

const initialState: AnalyticsState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchCampaignAnalytics = createAsyncThunk(
  'analytics/fetchCampaignAnalytics',
  async (campaignId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`/tracking/analytics/${campaignId}`);
      return response.data.data || response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch analytics');
    }
  }
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    clearAnalytics: (state) => { state.data = null; state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCampaignAnalytics.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchCampaignAnalytics.fulfilled, (state, action) => { state.loading = false; state.data = action.payload; })
      .addCase(fetchCampaignAnalytics.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; });
  },
});

export const { clearAnalytics } = analyticsSlice.actions;
export default analyticsSlice.reducer;

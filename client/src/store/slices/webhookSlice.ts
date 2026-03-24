import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../utils/axios';
import { Webhook } from '../../types';

interface WebhookState {
  webhooks: Webhook[];
  loading: boolean;
  error: string | null;
}

const initialState: WebhookState = {
  webhooks: [],
  loading: false,
  error: null,
};

export const fetchWebhooks = createAsyncThunk('webhooks/fetchWebhooks', async (_, { rejectWithValue }) => {
  try {
    const response = await axios.get('/webhooks');
    return response.data.data || response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch webhooks');
  }
});

export const createWebhook = createAsyncThunk('webhooks/createWebhook', async (data: Partial<Webhook>, { rejectWithValue }) => {
  try {
    const response = await axios.post('/webhooks', data);
    return response.data.data || response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to create webhook');
  }
});

export const updateWebhook = createAsyncThunk('webhooks/updateWebhook', async ({ id, data }: { id: string; data: Partial<Webhook> }, { rejectWithValue }) => {
  try {
    const response = await axios.put(`/webhooks/${id}`, data);
    return response.data.data || response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to update webhook');
  }
});

export const deleteWebhook = createAsyncThunk('webhooks/deleteWebhook', async (id: string, { rejectWithValue }) => {
  try {
    await axios.delete(`/webhooks/${id}`);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to delete webhook');
  }
});

const webhookSlice = createSlice({
  name: 'webhooks',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWebhooks.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchWebhooks.fulfilled, (state, action) => { state.loading = false; state.webhooks = action.payload; })
      .addCase(fetchWebhooks.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })
      .addCase(createWebhook.fulfilled, (state, action) => { state.webhooks.push(action.payload); })
      .addCase(updateWebhook.fulfilled, (state, action) => {
        const idx = state.webhooks.findIndex(w => w._id === action.payload._id);
        if (idx !== -1) state.webhooks[idx] = action.payload;
      })
      .addCase(deleteWebhook.fulfilled, (state, action) => {
        state.webhooks = state.webhooks.filter(w => w._id !== action.payload);
      });
  },
});

export default webhookSlice.reducer;

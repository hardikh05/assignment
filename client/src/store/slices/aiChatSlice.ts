import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../utils/axios';
import { AIChatMessage } from '../../types';

interface AIChatState {
  messages: AIChatMessage[];
  loading: boolean;
  error: string | null;
}

const initialState: AIChatState = {
  messages: [],
  loading: false,
  error: null,
};

export const sendChatMessage = createAsyncThunk(
  'aiChat/sendChatMessage',
  async (message: string, { rejectWithValue }) => {
    try {
      const response = await axios.post('/ai-chat/query', { message });
      return response.data.data || response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to send message');
    }
  }
);

const aiChatSlice = createSlice({
  name: 'aiChat',
  initialState,
  reducers: {
    addUserMessage: (state, action) => {
      state.messages.push({
        id: Date.now().toString(),
        role: 'user',
        content: action.payload,
        timestamp: new Date().toISOString(),
      });
    },
    clearChat: (state) => {
      state.messages = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendChatMessage.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        state.loading = false;
        state.messages.push({
          id: Date.now().toString(),
          role: 'assistant',
          content: action.payload.reply || action.payload.message || JSON.stringify(action.payload),
          timestamp: new Date().toISOString(),
          data: action.payload.data || null,
        });
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { addUserMessage, clearChat } = aiChatSlice.actions;
export default aiChatSlice.reducer;

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../utils/axios';
import { EmailTemplate } from '../../types';

interface TemplateState {
  templates: EmailTemplate[];
  loading: boolean;
  error: string | null;
}

const initialState: TemplateState = {
  templates: [],
  loading: false,
  error: null,
};

export const fetchTemplates = createAsyncThunk('templates/fetchTemplates', async (_, { rejectWithValue }) => {
  try {
    const response = await axios.get('/templates');
    return response.data.data || response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch templates');
  }
});

export const createTemplate = createAsyncThunk('templates/createTemplate', async (data: Partial<EmailTemplate>, { rejectWithValue }) => {
  try {
    const response = await axios.post('/templates', data);
    return response.data.data || response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to create template');
  }
});

export const updateTemplate = createAsyncThunk('templates/updateTemplate', async ({ id, data }: { id: string; data: Partial<EmailTemplate> }, { rejectWithValue }) => {
  try {
    const response = await axios.put(`/templates/${id}`, data);
    return response.data.data || response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to update template');
  }
});

export const deleteTemplate = createAsyncThunk('templates/deleteTemplate', async (id: string, { rejectWithValue }) => {
  try {
    await axios.delete(`/templates/${id}`);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to delete template');
  }
});

const templateSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTemplates.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchTemplates.fulfilled, (state, action) => { state.loading = false; state.templates = action.payload; })
      .addCase(fetchTemplates.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })
      .addCase(createTemplate.fulfilled, (state, action) => { state.templates.push(action.payload); })
      .addCase(updateTemplate.fulfilled, (state, action) => {
        const idx = state.templates.findIndex(t => t._id === action.payload._id);
        if (idx !== -1) state.templates[idx] = action.payload;
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.templates = state.templates.filter(t => t._id !== action.payload);
      });
  },
});

export default templateSlice.reducer;

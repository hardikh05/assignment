import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { Segment, SegmentRule } from '../../types';

interface PaginationParams {
  page: number;
  limit: number;
}

interface SegmentSliceState {
  segments: Segment[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

const initialState: SegmentSliceState = {
  segments: [],
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 100,
    total: 0,
  },
};

export const fetchSegments = createAsyncThunk(
  'segments/fetchSegments',
  async (params: PaginationParams) => {
    const response = await axios.get(`/segments?page=${params.page}&limit=${params.limit}`);
    return {
      segments: response.data.segments,
      pagination: response.data.pagination || { page: params.page, limit: params.limit, total: response.data.segments?.length || 0 },
    };
  }
);

export const createSegment = createAsyncThunk(
  'segments/createSegment',
  async (data: Partial<Segment>) => {
    const response = await axios.post('/segments', data);
    return response.data;
  }
);

export const updateSegment = createAsyncThunk(
  'segments/updateSegment',
  async ({ id, data }: { id: string; data: Partial<Segment> }) => {
    const response = await axios.put(`/segments/${id}`, data);
    return response.data;
  }
);

export const deleteSegment = createAsyncThunk(
  'segments/deleteSegment',
  async (id: string) => {
    await axios.delete(`/segments/${id}`);
    return id;
  }
);

export const previewSegment = createAsyncThunk(
  'segments/previewSegment',
  async ({ rules, ruleOperator }: { rules: SegmentRule[]; ruleOperator: 'AND' | 'OR' }) => {
    const response = await axios.post('/segments/preview', { rules, ruleOperator });
    return response.data;
  }
);

export const convertRules = createAsyncThunk(
  'segments/convertRules',
  async (description: string) => {
    const response = await axios.post('/segments/convert-rules', { description });
    return response.data;
  }
);

const segmentSlice = createSlice({
  name: 'segments',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSegments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSegments.fulfilled, (state, action) => {
        state.loading = false;
        state.segments = action.payload.segments;
        if (action.payload.pagination) {
          state.pagination = {
            page: action.payload.pagination.page,
            limit: action.payload.pagination.limit,
            total: action.payload.pagination.total,
          };
        }
      })
      .addCase(fetchSegments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch segments';
      })
      .addCase(createSegment.fulfilled, (state, action: PayloadAction<Segment>) => {
        state.segments.push(action.payload);
      })
      .addCase(updateSegment.fulfilled, (state, action: PayloadAction<Segment>) => {
        const index = state.segments.findIndex((s) => s._id === action.payload._id);
        if (index !== -1) {
          state.segments[index] = action.payload;
        }
      })
      .addCase(deleteSegment.fulfilled, (state, action: PayloadAction<string>) => {
        state.segments = state.segments.filter((s) => s._id !== action.payload);
      });
  },
});

export default segmentSlice.reducer; 
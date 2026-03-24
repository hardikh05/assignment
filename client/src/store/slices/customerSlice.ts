import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { Customer } from '../../types';

interface CustomerState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

const initialState: CustomerState = {
  customers: [],
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 100,
    total: 0,
  },
};

export const fetchCustomers = createAsyncThunk(
  'customers/fetchCustomers',
  async ({ page, limit }: { page: number; limit: number }) => {
    const response = await axios.get(`/customers?page=${page}&limit=${limit}`);
    return {
      customers: response.data.customers,
      pagination: response.data.pagination || { page, limit, total: response.data.customers?.length || 0 },
    };
  }
);

export const createCustomer = createAsyncThunk(
  'customers/createCustomer',
  async (customer: Partial<Customer>) => {
    const response = await axios.post('/customers', customer);
    return response.data;
  }
);

export const updateCustomer = createAsyncThunk(
  'customers/updateCustomer',
  async ({ _id, data }: { _id: string; data: Partial<Customer> }) => {
    const response = await axios.put(`/customers/${_id}`, data);
    return response.data;
  }
);

export const deleteCustomer = createAsyncThunk(
  'customers/deleteCustomer',
  async (_id: string) => {
    await axios.delete(`/customers/${_id}`);
    return _id;
  }
);

const customerSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.loading = false;
        state.customers = action.payload.customers;
        if (action.payload.pagination) {
          state.pagination = {
            page: action.payload.pagination.page,
            limit: action.payload.pagination.limit,
            total: action.payload.pagination.total,
          };
        }
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch customers';
      })
      .addCase(createCustomer.fulfilled, (state, action) => {
        state.customers.push(action.payload);
      })
      .addCase(updateCustomer.fulfilled, (state, action) => {
        const index = state.customers.findIndex((c) => c._id === action.payload._id);
        if (index !== -1) {
          state.customers[index] = action.payload;
        }
      })
      .addCase(deleteCustomer.fulfilled, (state, action) => {
        state.customers = state.customers.filter((c) => c._id !== action.payload);
      });
  },
});

export default customerSlice.reducer; 
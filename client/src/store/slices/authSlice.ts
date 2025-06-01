import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  loading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async (token: string) => {
    // Check if we have a token from window.__AUTH_TOKEN__ (set by our callback handler)
    const tokenToUse = (window as any).__AUTH_TOKEN__ || token;
    
    // Make sure we're using the correct API URL with the /api prefix
    const apiUrl = process.env.REACT_APP_API_URL || 'https://assignment-uf7q.onrender.com';
    const response = await axios.get(`${apiUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${tokenToUse}`,
      },
    });
    return { user: response.data, token: tokenToUse };
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem('token');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        localStorage.setItem('token', action.payload.token);
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Login failed';
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer; 
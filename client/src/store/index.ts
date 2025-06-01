import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import customerReducer from './slices/customerSlice';
import segmentReducer from './slices/segmentSlice';
import campaignReducer from './slices/campaignSlice';
import orderReducer from './slices/orderSlice';
import messageReducer from './slices/messageSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    customers: customerReducer,
    segments: segmentReducer,
    campaigns: campaignReducer,
    orders: orderReducer,
    messages: messageReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 
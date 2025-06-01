import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { Campaign } from '../../types';

export interface Customer {
  _id: string;
  name: string;
  email: string;
  phone: string;
  visits: number;
  totalSpent: number;
}

export interface CampaignStatistics {
  totalCustomers: number;
  totalVisits: number;
  totalSpent: number;
  averageSpent: number;
}

interface PaginationParams {
  page: number;
  limit: number;
}

interface CampaignState {
  campaigns: Campaign[];
  customers: Customer[];
  statistics: CampaignStatistics;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

const initialState: CampaignState = {
  campaigns: [],
  customers: [],
  statistics: {
    totalCustomers: 0,
    totalVisits: 0,
    totalSpent: 0,
    averageSpent: 0,
  },
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
  },
};

export const fetchCampaigns = createAsyncThunk(
  'campaigns/fetchCampaigns',
  async (params: PaginationParams, { rejectWithValue }) => {
    try {
      const response = await axios.get(`/campaigns?page=${params.page}&limit=${params.limit}`);
      return {
        campaigns: response.data.campaigns || [],
        total: response.data.total || 0,
        page: params.page,
        limit: params.limit
      };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch campaigns');
    }
  }
);

export const createCampaign = createAsyncThunk(
  'campaigns/createCampaign',
  async (campaignData: Partial<Campaign>) => {
    const response = await axios.post('/campaigns', campaignData);
    // Handle nested response structure with status and data properties
    if (response.data && response.data.status === 'success' && response.data.data) {
      return response.data.data; // Return just the campaign data
    }
    return response.data; // Fallback to the original response if structure is different
  }
);

export const updateCampaign = createAsyncThunk(
  'campaigns/updateCampaign',
  async ({ _id, data }: { _id: string; data: Partial<Campaign> }) => {
    const response = await axios.put(`/campaigns/${_id}`, data);
    // Handle nested response structure with status and data properties
    if (response.data && response.data.status === 'success' && response.data.data) {
      return response.data.data; // Return just the campaign data
    }
    return response.data; // Fallback to the original response if structure is different
  }
);

export const deleteCampaign = createAsyncThunk(
  'campaigns/deleteCampaign',
  async (id: string) => {
    await axios.delete(`/campaigns/${id}`);
    return id;
  }
);

export const fetchCampaignCustomers = createAsyncThunk(
  'campaigns/fetchCampaignCustomers',
  async (campaignId: string) => {
    try {
      const response = await axios.get(`/campaigns/${campaignId}/customers`);
      console.log('Campaign customers API response:', response.data);
      
      // Extract customers and statistics from the nested data structure
      const customers = response.data.data?.customers || [];
      const statistics = response.data.data?.statistics || {
        totalCustomers: 0,
        totalVisits: 0,
        totalSpent: 0,
        averageSpent: 0
      };
      
      // For completed campaigns, use the campaign's customer list if available
      if (customers.length === 0) {
        // Fetch the campaign details to get the customer list
        const campaignResponse = await axios.get(`/campaigns/${campaignId}`);
        const campaign = campaignResponse.data.data;
        
        if (campaign && campaign.customers && campaign.customers.length > 0) {
          // If the campaign has customers directly attached, use those
          const customerDetails = await Promise.all(
            campaign.customers.map(async (customerId: string) => {
              try {
                const customerResponse = await axios.get(`/customers/${customerId}`);
                return customerResponse.data.data || null;
              } catch (err) {
                console.error(`Error fetching customer ${customerId}:`, err);
                return null;
              }
            })
          );
          
          // Filter out null values and add to customers array
          const validCustomers = customerDetails.filter(c => c !== null);
          
          // Calculate statistics from the customer data
          if (validCustomers.length > 0) {
            statistics.totalCustomers = validCustomers.length;
            statistics.totalVisits = validCustomers.reduce((sum: number, customer: any) => sum + (customer.visits || 0), 0);
            statistics.totalSpent = validCustomers.reduce((sum: number, customer: any) => sum + (customer.totalSpent || 0), 0);
            statistics.averageSpent = statistics.totalCustomers > 0 ? statistics.totalSpent / statistics.totalCustomers : 0;
            
            return {
              customers: validCustomers,
              statistics
            };
          }
        }
      }
      
      // Calculate statistics from the customer data if not provided by API
      if (!statistics.totalCustomers && customers.length > 0) {
        statistics.totalCustomers = customers.length;
        statistics.totalVisits = customers.reduce((sum: number, customer: any) => sum + (customer.visits || 0), 0);
        statistics.totalSpent = customers.reduce((sum: number, customer: any) => sum + (customer.totalSpent || 0), 0);
        statistics.averageSpent = statistics.totalCustomers > 0 ? statistics.totalSpent / statistics.totalCustomers : 0;
      }
      
      console.log('Processed campaign data:', { customers, statistics });
      
      return {
        customers,
        statistics
      };
    } catch (error) {
      console.error('Error fetching campaign customers:', error);
      throw error;
    }
  }
);

export const sendCampaign = createAsyncThunk(
  'campaigns/sendCampaign',
  async (campaignId: string, { rejectWithValue }) => {
    try {
      console.log(`Sending campaign with ID: ${campaignId}`);
      const response = await axios.post(`/campaigns/${campaignId}/send`);
      console.log('Campaign send response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error sending campaign:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to send campaign');
    }
  }
);

const campaignSlice = createSlice({
  name: 'campaigns',
  initialState,
  reducers: {
    clearCustomers: (state) => {
      state.customers = [];
      state.statistics = initialState.statistics;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch campaigns
      .addCase(fetchCampaigns.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCampaigns.fulfilled, (state, action) => {
        state.loading = false;
        state.campaigns = action.payload.campaigns;
        state.pagination = {
          page: action.payload.page,
          limit: action.payload.limit,
          total: action.payload.total,
        };
      })
      .addCase(fetchCampaigns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to fetch campaigns';
        state.campaigns = [];
      })
      // Create campaign
      .addCase(createCampaign.fulfilled, (state, action) => {
        state.campaigns.push(action.payload);
      })
      // Update campaign
      .addCase(updateCampaign.fulfilled, (state, action) => {
        const index = state.campaigns.findIndex((c) => c._id === action.payload._id);
        if (index !== -1) {
          state.campaigns[index] = action.payload;
        }
      })
      // Delete campaign
      .addCase(deleteCampaign.fulfilled, (state, action) => {
        state.campaigns = state.campaigns.filter((c) => c._id !== action.payload);
      })
      // Fetch campaign customers
      .addCase(fetchCampaignCustomers.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.customers = [];
        state.statistics = initialState.statistics;
      })
      .addCase(fetchCampaignCustomers.fulfilled, (state, action) => {
        state.loading = false;
        state.customers = action.payload?.customers || [];
        state.statistics = action.payload?.statistics || {
          totalCustomers: 0,
          totalVisits: 0,
          totalSpent: 0,
          averageSpent: 0
        };
      })
      .addCase(fetchCampaignCustomers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch campaign customers';
        state.customers = [];
        state.statistics = initialState.statistics;
      })
      // Send campaign
      .addCase(sendCampaign.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendCampaign.fulfilled, (state, action) => {
        state.loading = false;
        const campaign = state.campaigns.find(c => c._id === action.meta.arg);
        if (campaign) {
          campaign.status = 'completed';
        }
      });
  },
});

export const { clearCustomers } = campaignSlice.actions;
export default campaignSlice.reducer;
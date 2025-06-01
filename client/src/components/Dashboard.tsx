import React, { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchCampaigns } from '../store/slices/campaignSlice';
import { fetchSegments } from '../store/slices/segmentSlice';
import { fetchCustomers } from '../store/slices/customerSlice';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Campaign, Customer } from '../types';

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { campaigns = [], loading: campaignsLoading, error: campaignsError } = useAppSelector((state) => state.campaigns);
  const { customers = [], loading: customersLoading, error: customersError } = useAppSelector((state) => state.customers);
  const { segments = [], loading: segmentsLoading, error: segmentsError } = useAppSelector((state) => state.segments);

  useEffect(() => {
    dispatch(fetchCampaigns({ page: 1, limit: 10 }));
    dispatch(fetchSegments({ page: 1, limit: 10 }));
    dispatch(fetchCustomers({ page: 1, limit: 100 }));
  }, [dispatch]);

  const totalCustomers = customers.length;
  const totalSegments = segments.length;
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c: Campaign) => c.status === 'draft').length;

  const customerSpendingData = customers
    .map((c) => ({
      name: c.name,
      spent: c.totalSpent,
    }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  let campaignStatusData = [
    { name: 'Draft', value: campaigns.filter((c: Campaign) => c.status === 'draft').length },
    { name: 'Completed', value: campaigns.filter((c: Campaign) => c.status === 'completed').length },
    { name: 'Failed', value: campaigns.filter((c: Campaign) => c.status === 'failed').length },
  ];
  // Filter out statuses with value 0 for better pie chart clarity
  campaignStatusData = campaignStatusData.filter(item => item.value > 0);

  const COLORS = ['#0088FE', '#00C49F', '#FF4C4C'];

  if (campaignsLoading || segmentsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (campaignsError || segmentsError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {campaignsError || segmentsError}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, overflow: 'hidden' }}>
      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Customers
              </Typography>
              <Typography variant="h4">{totalCustomers}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Segments
              </Typography>
              <Typography variant="h4">{totalSegments}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Campaigns
              </Typography>
              <Typography variant="h4">{totalCampaigns}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Active Campaigns
              </Typography>
              <Typography variant="h4">{activeCampaigns}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={8} md={7} sm={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Top Customers by Spending
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={customerSpendingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `₹${Number(value).toFixed(2)}`} />
                <Legend />
                <Bar dataKey="spent" fill="#8884d8" name="Total Spent" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4} md={5} sm={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Campaign Status
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={campaignStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  minAngle={5}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {campaignStatusData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 
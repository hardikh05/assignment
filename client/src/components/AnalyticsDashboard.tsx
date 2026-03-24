import React, { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchCampaigns } from '../store/slices/campaignSlice';
import {
  Box, Grid, Paper, Typography, Card, CardContent, CircularProgress, Alert,
  Select, MenuItem, FormControl, InputLabel, LinearProgress,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts';
import { Campaign } from '../types';

const COLORS = ['#0088FE', '#00C49F', '#FF4C4C', '#FFBB28', '#8884d8'];

const AnalyticsDashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { campaigns, loading } = useAppSelector((state) => state.campaigns);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');

  useEffect(() => {
    dispatch(fetchCampaigns({ page: 1, limit: 100 }));
  }, [dispatch]);

  const completedCampaigns = campaigns.filter((c: Campaign) => c.status === 'completed' && c.stats);

  const aggregateStats = completedCampaigns.reduce(
    (acc, c: Campaign) => {
      if (c.stats) {
        acc.totalSent += c.stats.sent;
        acc.totalDelivered += c.stats.delivered;
        acc.totalFailed += c.stats.failed;
        acc.totalOpened += c.stats.opened;
        acc.totalClicked += c.stats.clicked;
        acc.totalAudience += c.stats.totalAudience;
      }
      return acc;
    },
    { totalSent: 0, totalDelivered: 0, totalFailed: 0, totalOpened: 0, totalClicked: 0, totalAudience: 0 }
  );

  const deliveryRate = aggregateStats.totalSent > 0
    ? ((aggregateStats.totalDelivered / aggregateStats.totalSent) * 100).toFixed(1) : '0';
  const openRate = aggregateStats.totalDelivered > 0
    ? ((aggregateStats.totalOpened / aggregateStats.totalDelivered) * 100).toFixed(1) : '0';
  const clickRate = aggregateStats.totalDelivered > 0
    ? ((aggregateStats.totalClicked / aggregateStats.totalDelivered) * 100).toFixed(1) : '0';

  const campaignPerformanceData = completedCampaigns.map((c: Campaign) => ({
    name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
    delivered: c.stats?.delivered || 0,
    opened: c.stats?.opened || 0,
    clicked: c.stats?.clicked || 0,
    failed: c.stats?.failed || 0,
  }));

  const funnelData = [
    { name: 'Sent', value: aggregateStats.totalSent },
    { name: 'Delivered', value: aggregateStats.totalDelivered },
    { name: 'Opened', value: aggregateStats.totalOpened },
    { name: 'Clicked', value: aggregateStats.totalClicked },
  ];

  const statusDistribution = [
    { name: 'Draft', value: campaigns.filter((c: Campaign) => c.status === 'draft').length },
    { name: 'Scheduled', value: campaigns.filter((c: Campaign) => c.status === 'scheduled').length },
    { name: 'Completed', value: campaigns.filter((c: Campaign) => c.status === 'completed').length },
    { name: 'Failed', value: campaigns.filter((c: Campaign) => c.status === 'failed').length },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>Analytics Dashboard</Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: 'Total Sent', value: aggregateStats.totalSent, color: '#0088FE' },
          { label: 'Delivery Rate', value: `${deliveryRate}%`, color: '#00C49F' },
          { label: 'Open Rate', value: `${openRate}%`, color: '#FFBB28' },
          { label: 'Click Rate', value: `${clickRate}%`, color: '#8884d8' },
        ].map((stat) => (
          <Grid item xs={12} sm={6} md={3} key={stat.label}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">{stat.label}</Typography>
                <Typography variant="h4" sx={{ color: stat.color, fontWeight: 'bold' }}>{stat.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Campaign Performance</Typography>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={campaignPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="delivered" fill="#00C49F" name="Delivered" />
                <Bar dataKey="opened" fill="#FFBB28" name="Opened" />
                <Bar dataKey="clicked" fill="#8884d8" name="Clicked" />
                <Bar dataKey="failed" fill="#FF4C4C" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Delivery Funnel</Typography>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" />
                <Tooltip />
                <Bar dataKey="value" fill="#0088FE">
                  {funnelData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Status Distribution</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
                  {statusDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Campaign Details</Typography>
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {completedCampaigns.length === 0 ? (
                <Typography color="text.secondary">No completed campaigns yet.</Typography>
              ) : (
                completedCampaigns.map((c: Campaign) => (
                  <Box key={c._id} sx={{ mb: 2, p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
                    <Typography variant="subtitle2" fontWeight="bold">{c.name}</Typography>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Delivered: {c.stats?.delivered}/{c.stats?.totalAudience} | Opened: {c.stats?.opened} | Clicked: {c.stats?.clicked}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={c.stats?.totalAudience ? (c.stats.delivered / c.stats.totalAudience) * 100 : 0}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsDashboard;

import React, { useEffect, useState } from 'react';
import axios from '../utils/axios';
import {
  Box, Paper, Typography, CircularProgress, Alert, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Divider,
} from '@mui/material';
import {
  ShoppingCart as OrderIcon,
  Campaign as CampaignIcon,
  Email as MessageIcon,
  Circle as DotIcon,
} from '@mui/icons-material';

interface TimelineEvent {
  type: 'order' | 'message' | 'campaign';
  date: string;
  title: string;
  description: string;
  status: string;
  data: any;
}

interface Props {
  customerId: string;
  customerName: string;
  open: boolean;
  onClose: () => void;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'order': return <OrderIcon color="primary" />;
    case 'campaign': return <CampaignIcon color="secondary" />;
    case 'message': return <MessageIcon color="action" />;
    default: return <DotIcon />;
  }
};

const getStatusColor = (status: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
  switch (status) {
    case 'delivered': case 'completed': case 'shipped': return 'success';
    case 'failed': case 'cancelled': return 'error';
    case 'pending': case 'draft': return 'warning';
    case 'processing': return 'info';
    default: return 'default';
  }
};

const CustomerTimeline: React.FC<Props> = ({ customerId, customerName, open, onClose }) => {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && customerId) {
      setLoading(true);
      setError(null);
      axios.get(`/customers/${customerId}/activity`)
        .then(res => {
          setTimeline(res.data.data?.timeline || []);
        })
        .catch(err => {
          setError(err.response?.data?.message || 'Failed to load activity');
        })
        .finally(() => setLoading(false));
    }
  }, [open, customerId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Activity Timeline - {customerName}</DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!loading && timeline.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No activity found for this customer.
          </Typography>
        )}
        {timeline.map((event, idx) => (
          <Box key={idx}>
            <Box sx={{ display: 'flex', gap: 2, py: 1.5 }}>
              <Box sx={{ mt: 0.5 }}>{getIcon(event.type)}</Box>
              <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2">{event.title}</Typography>
                  <Chip label={event.status} size="small" color={getStatusColor(event.status)} variant="outlined" />
                </Box>
                <Typography variant="body2" color="text.secondary">{event.description}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(event.date).toLocaleString()}
                </Typography>
              </Box>
            </Box>
            {idx < timeline.length - 1 && <Divider />}
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomerTimeline;

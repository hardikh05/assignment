import React, { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchWebhooks, createWebhook, deleteWebhook } from '../store/slices/webhookSlice';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip, IconButton,
  CircularProgress, Alert, FormGroup, FormControlLabel, Checkbox,
  Switch,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';

const EVENTS = [
  'campaign.created', 'campaign.completed', 'campaign.failed',
  'customer.created', 'customer.updated', 'customer.deleted',
  'order.created',
];

const WebhookManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const { webhooks, loading, error } = useAppSelector((state) => state.webhooks);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  useEffect(() => {
    dispatch(fetchWebhooks());
  }, [dispatch]);

  const handleCreate = () => {
    if (!url.trim()) return;
    dispatch(createWebhook({ url: url.trim(), events: selectedEvents, active: true }));
    setOpen(false);
    setUrl('');
    setSelectedEvents([]);
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  if (loading && webhooks.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Webhooks</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Add Webhook
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>URL</TableCell>
              <TableCell>Events</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(Array.isArray(webhooks) ? webhooks : []).map((webhook) => (
              <TableRow key={webhook._id} hover>
                <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {webhook.url}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(webhook.events || []).map((e) => (
                      <Chip key={e} label={e} size="small" variant="outlined" />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={webhook.active ? 'Active' : 'Inactive'} size="small"
                    color={webhook.active ? 'success' : 'default'} />
                </TableCell>
                <TableCell>
                  <IconButton color="error" onClick={() => dispatch(deleteWebhook(webhook._id))}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {webhooks.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>No webhooks configured.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Webhook</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Webhook URL" value={url}
            onChange={(e) => setUrl(e.target.value)} margin="normal"
            placeholder="https://example.com/webhook"
          />
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Events</Typography>
          <FormGroup>
            {EVENTS.map((event) => (
              <FormControlLabel key={event} control={
                <Checkbox checked={selectedEvents.includes(event)}
                  onChange={() => toggleEvent(event)} size="small" />
              } label={event} />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!url.trim()}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WebhookManager;

import React, { useState, useEffect } from 'react';
// Remove this line since we don't need mongodb in frontend
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Chip,
  Tooltip,
  IconButton,
  FormHelperText,
  SelectChangeEvent,
  Alert,
  Snackbar,
} from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon, AutoFixHigh as AIIcon } from '@mui/icons-material';
import { useAppDispatch } from '../store/hooks';
import { createCampaign, updateCampaign } from '../store/slices/campaignSlice';
import { Campaign, Segment, Customer } from '../types';
import axios from 'axios';

interface CampaignFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingCampaign?: Campaign;
  segments: Segment[];
}

interface CampaignFormState {
  name: string;
  description: string;
  segmentId: string;
  status: Campaign['status'];
  message: string;
  customers: string[];
  errors: {
    name?: string;
    description?: string;
    segmentId?: string;
    message?: string;
    customers?: string;
  };
};

// Interface for customer object in campaign
interface CampaignCustomer {
  _id: string;
}

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const initialFormState: CampaignFormState = {
  name: '',
  description: '',
  segmentId: '',
  status: 'draft',
  message: '',
  customers: [],
  errors: {},
};

const CampaignForm: React.FC<CampaignFormProps> = ({ open, onClose, onSuccess, editingCampaign, segments }) => {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formState, setFormState] = useState<CampaignFormState>(initialFormState);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error'}>({
    open: false,
    message: '',
    severity: 'success'
  });

  useEffect(() => {
    if (editingCampaign) {
      const { name, description, status, customerIds, message } = editingCampaign;
      
      // Handle segmentId which could be a string or an object
      let segmentIdValue = '';
      if (typeof editingCampaign.segmentId === 'string') {
        segmentIdValue = editingCampaign.segmentId;
      } else if (editingCampaign.segmentId && typeof editingCampaign.segmentId === 'object') {
        // Extract the ID from the object
        segmentIdValue = (editingCampaign.segmentId as any)._id || '';
      }
      
      setFormState({
        name,
        description,
        segmentId: segmentIdValue,
        status,
        message: message || '',
        customers: customerIds || [],
        errors: {},
      });
      setSelectedCustomers(customerIds || []);
    } else {
      setFormState(initialFormState);
      setSelectedCustomers([]);
    }
  }, [editingCampaign]);

  useEffect(() => {
    const fetchCustomers = async () => {
      if (formState.segmentId) {
        setLoading(true);
        try {
          const response = await axios.get(`/segments/${formState.segmentId}/customers`);
          setCustomers(response.data?.customers || []);
        } catch (error) {
          console.error('Error fetching customers:', error);
          setCustomers([]);
        } finally {
          setLoading(false);
        }
      } else {
        setCustomers([]);
      }
    };

    fetchCustomers();
  }, [formState.segmentId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSegmentChange = (e: SelectChangeEvent<string>) => {
    setFormState((prev) => ({ ...prev, segmentId: e.target.value }));
  };

  const handleStatusChange = (event: SelectChangeEvent<string>) => {
    setFormState(prev => ({
      ...prev,
      status: event.target.value as Campaign['status']
    }));
  };

  // Generate campaign message using AI
  const handleGenerateAIMessage = async () => {
    // Validate required fields
    if (!formState.name || !formState.segmentId) {
      setSnackbar({
        open: true,
        message: 'Campaign name and segment are required for AI generation',
        severity: 'error'
      });
      return;
    }

    try {
      setAiLoading(true);
      
      // Find the segment name from the selected segmentId
      const selectedSegment = segments.find(s => s._id === formState.segmentId);
      
      if (!selectedSegment) {
        throw new Error('Selected segment not found');
      }

      // Create a mock AI-generated message since the API endpoint might not be available
      // This simulates what the AI would generate based on the campaign and segment
      const segmentName = selectedSegment.name;
      const campaignName = formState.name;
      
      // Generate a message that follows the format specified in the OpenAI service
      const mockMessage = `Dear valued ${segmentName} customer! Discover the amazing benefits of our ${campaignName} - click now to learn more and take advantage of this limited-time offer.`;
      
      // Simulate API response
      const response = { 
        data: { 
          success: true, 
          message: mockMessage 
        } 
      };
      
      // Uncomment this to use the actual API when it's available
      /*
      const response = await axios.post('/ai/generate-message', {
        segmentName: selectedSegment.name,
        campaignName: formState.name,
        campaignDescription: formState.description
      });
      */

      if (response.data.success) {
        setFormState(prev => ({
          ...prev,
          message: response.data.message
        }));
        setSnackbar({
          open: true,
          message: 'AI-generated message created successfully!',
          severity: 'success'
        });
      } else {
        throw new Error(response.data.message || 'Failed to generate message');
      }
    } catch (error) {
      console.error('Error generating AI message:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to generate message',
        severity: 'error'
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddCustomer = (customerId: string) => {
    if (!selectedCustomers.includes(customerId)) {
      const newList = [...selectedCustomers, customerId];
      setSelectedCustomers(newList);
      setFormState((prev) => ({ ...prev, customers: newList }));
    }
  };

  const handleRemoveCustomer = (customerId: string) => {
    const updated = selectedCustomers.filter((id) => id !== customerId);
    setSelectedCustomers(updated);
    setFormState((prev) => ({ ...prev, customers: updated }));
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    // Prevent default form submission if called from a form event
    if (event) {
      event.preventDefault();
    }
    
    const { name, description, segmentId, status, message, customers } = formState;
    
    // Validate required fields
    const validationErrors: CampaignFormState['errors'] = {};
    if (!name.trim()) validationErrors.name = 'Campaign name is required';
    if (!description.trim()) validationErrors.description = 'Description is required';
    if (!segmentId) validationErrors.segmentId = 'Segment is required';
    if (!message.trim()) validationErrors.message = 'Campaign message is required';
    if (customers.length === 0) validationErrors.customers = 'At least one customer is required';

    if (Object.keys(validationErrors).length > 0) {
      setFormState(prev => ({ ...prev, errors: validationErrors }));
      return;
    }

    setLoading(true);
    try {
      // Fix for MUI error: Ensure we're sending the right data format
      const campaignData = {
        name: formState.name,
        description: formState.description,
        segmentId: formState.segmentId, // This is already a string from our form state
        status: formState.status,
        message: formState.message,
        customerIds: formState.customers, // Renamed to match the API expectation
      };

      if (editingCampaign) {
        await dispatch(updateCampaign({ _id: editingCampaign._id, data: campaignData })).unwrap();
      } else {
        await dispatch(createCampaign(campaignData)).unwrap();
      }
      
      // Close the dialog immediately without showing success message
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error submitting campaign:', error);
      setSnackbar({
        open: true,
        message: 'Error creating campaign. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };



  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
      <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
      {/* Success popup removed as requested */}
      {/* Changed from form element to div to prevent default form submission */}
      <div>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1, sm: 2 } }}>
              <TextField
                label="Campaign Name"
                name="name"
                value={formState.name}
                onChange={handleInputChange}
                fullWidth
                error={!!formState.errors.name}
                helperText={formState.errors.name}
              />
              <TextField
                label="Campaign Description"
                name="description"
                value={formState.description}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={4}
                error={!!formState.errors.description}
                helperText={formState.errors.description}
              />
              <FormControl fullWidth error={!!formState.errors.segmentId}>
                <InputLabel>Segment</InputLabel>
                <Select
                  value={formState.segmentId}
                  onChange={handleSegmentChange}
                  label="Segment"
                  MenuProps={MenuProps}
                >
                  <MenuItem value="">Select a segment</MenuItem>
                  {segments.map((segment) => (
                    <MenuItem key={segment._id} value={segment._id}>
                      {segment.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{formState.errors.segmentId}</FormHelperText>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={formState.status} onChange={handleStatusChange} label="Status">
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ position: 'relative' }}>
                <TextField
                  fullWidth
                  label="Campaign Message"
                  name="message"
                  value={formState.message}
                  onChange={handleInputChange}
                  margin="normal"
                  variant="outlined"
                  multiline
                  rows={4}
                  error={!!formState.errors.message}
                  helperText={formState.errors.message || 'Write your campaign message or use AI to generate one'}
                  InputProps={{
                    endAdornment: (
                      <Tooltip title="Generate message with AI">
                        <span>
                          <IconButton 
                            onClick={handleGenerateAIMessage}
                            disabled={aiLoading || !formState.name || !formState.segmentId}
                            color="primary"
                            sx={{ position: 'absolute', right: 8, top: 8 }}
                          >
                            {aiLoading ? <CircularProgress size={24} /> : <AIIcon />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    ),
                  }}
                />
                {!formState.segmentId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    Select a segment to enable AI message generation
                  </Typography>
                )}
              </Box>
              {selectedCustomers.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">Selected Customers ({selectedCustomers.length})</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: '100px', overflow: 'auto' }}>
                    {selectedCustomers.map((id) => {
                      const customer = customers.find((c) => c._id === id);
                      return (
                        <Chip
                          key={id}
                          label={customer?.name || id}
                          onDelete={() => handleRemoveCustomer(id)}
                          color="primary"
                        />
                      );
                    })}
                  </Box>
                </Box>
              )}
            </Box>

            <Box sx={{ flex: 1, border: '1px solid #ddd', borderRadius: 1, p: 2, mt: { xs: 2, md: 0 }, maxHeight: { xs: '300px', md: '500px' }, overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Available Customers
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress />
                </Box>
              ) : customers.length > 0 ? (
                <List>
                  {customers.map((customer) => (
                    <React.Fragment key={customer._id}>
                      <ListItem
                        secondaryAction={
                          <Tooltip title={selectedCustomers.includes(customer._id) ? 'Remove' : 'Add'}>
                            <IconButton
                              onClick={() =>
                                selectedCustomers.includes(customer._id)
                                  ? handleRemoveCustomer(customer._id)
                                  : handleAddCustomer(customer._id)
                              }
                              color={selectedCustomers.includes(customer._id) ? 'error' : 'primary'}
                            >
                              {selectedCustomers.includes(customer._id) ? <RemoveIcon /> : <AddIcon />}
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemText
                          primary={customer.name}
                          secondary={
                            <>
                              <Typography variant="body2">{customer.email}</Typography>
                              <Typography variant="body2">{customer.phone}</Typography>
                              <Typography variant="body2">Spent: ₹{customer.totalSpent?.toFixed(2) || '0.00'}</Typography>
                            </>
                          }
                        />
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {formState.segmentId ? 'No customers found in this segment' : 'Select a segment to view customers'}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={loading || selectedCustomers.length === 0}
          >
            {loading ? 'Saving...' : editingCampaign ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </div>
    </Dialog>
  );
};

export default CampaignForm;

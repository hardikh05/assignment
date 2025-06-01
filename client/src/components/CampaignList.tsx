import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { Campaign, Segment } from '../types';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams, GridRowModel, GridRowParams, GridRowSelectionModel } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import CampaignForm from './CampaignForm';
import {
  fetchCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  fetchCampaignCustomers,
  sendCampaign,
  clearCustomers,
} from '../store/slices/campaignSlice';
import { fetchSegments } from '../store/slices/segmentSlice';
import { addMessage } from '../store/slices/messageSlice';
import Messages from './Messages';
import axios from 'axios';
import { CampaignState, CampaignStats } from '../types';

interface CampaignFormData {
  name: string;
  description: string;
  segmentId: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'failed';
  message?: string;
  scheduledFor?: string;
}

const defaultStatistics = {
  totalCustomers: 0,
  totalVisits: 0,
  totalSpent: 0,
  averageSpent: 0
};

const CampaignList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { 
    campaigns = [], 
    customers = [], 
    statistics = defaultStatistics, 
    loading, 
    error,
    pagination 
  } = useAppSelector((state) => state.campaigns);
  const { segments = [] } = useAppSelector((state) => state.segments);
  const [campaignSegments, setCampaignSegments] = useState<Record<string, Segment>>({});
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'edit' | 'view'>('view');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedCampaigns, setSelectedCampaigns] = useState<GridRowSelectionModel>([]);
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    description: '',
    segmentId: '',
    status: 'draft',
    message: '',
    scheduledFor: undefined,
  });

  const campaignStats = statistics;

  useEffect(() => {
    const loadData = async () => {
      try {
        await dispatch(fetchCampaigns({ page: 1, limit: pagination.limit }));
        await dispatch(fetchSegments({ page: 1, limit: 100 }));
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    
    loadData();
  }, [dispatch, pagination.limit]);
  
  // Fetch all segments when component mounts
  useEffect(() => {
    dispatch(fetchSegments({ page: 1, limit: 100 }));
  }, [dispatch]);

  // Fetch segment information for each campaign
  useEffect(() => {
    const fetchSegmentForCampaigns = async () => {
      // Use Record type to properly type the segmentMap
      const segmentMap: Record<string, Segment> = {};
      const segmentsToFetch: string[] = [];
      
      // First identify all segment IDs we need to fetch
      for (const campaign of campaigns) {
        // Make sure segmentId is a string and valid
        let segmentId: string | undefined = '';
        if (typeof campaign.segmentId === 'string') {
          segmentId = campaign.segmentId;
        } else if (campaign.segmentId && typeof campaign.segmentId === 'object') {
          // If the object already has a name, use it directly
          if ((campaign.segmentId as any).name) {
            segmentMap[String((campaign.segmentId as any)._id)] = campaign.segmentId as any;
            continue;
          }
          // Handle object case
          segmentId = (campaign.segmentId as any)._id || String(campaign.segmentId);
        }
        
        // Skip if we already have this segment or if it's invalid
        if (!segmentId || campaignSegments[segmentId]) continue;
        
        // Check if we already have this segment in the Redux store
        const existingSegment = segments.find((s: Segment) => s._id === segmentId);
        if (existingSegment) {
          segmentMap[segmentId] = existingSegment;
        } else if (segmentId.match(/^[0-9a-fA-F]{24}$/)) {
          // Add to list of segments to fetch
          segmentsToFetch.push(segmentId);
        }
      }
      
      // Fetch all missing segments in parallel
      if (segmentsToFetch.length > 0) {
        try {
          const responses = await Promise.all(
            segmentsToFetch.map(segmentId => 
              axios.get(`/segments/${segmentId}`)
                .catch(error => {
                  console.error(`Error fetching segment ${segmentId}:`, error);
                  return { data: null };
                })
            )
          );
          
          // Process all responses
          for (let i = 0; i < responses.length; i++) {
            // Ensure we have a valid segmentId
            if (i >= segmentsToFetch.length) continue;
            
            const response = responses[i];
            const segmentId = segmentsToFetch[i];
            
            // TypeScript safety check
            if (typeof segmentId !== 'string') continue;
            
            // Process the response if we have data
            if (response && response.data) {
              // Handle different API response formats
              if (response.data.data) {
                // Use type assertion to tell TypeScript this is a valid key
                segmentMap[segmentId as keyof typeof segmentMap] = response.data.data;
              } else if (response.data._id) {
                // Direct segment object
                segmentMap[segmentId as keyof typeof segmentMap] = response.data;
              }
            }
          }
        } catch (error) {
          console.error('Error fetching segments:', error);
        }
      }
      
      // Update state with all fetched segments
      if (Object.keys(segmentMap).length > 0) {
        setCampaignSegments(prev => ({ ...prev, ...segmentMap }));
      }
    };
    
    if (campaigns.length > 0) {
      fetchSegmentForCampaigns();
    }
  // Removed campaignSegments from dependency array to prevent infinite loops
  }, [campaigns, segments, dispatch]);

  const handlePageChange = (page: number) => {
    dispatch(fetchCampaigns({ 
      page: page + 1, // DataGrid is 0-based, our API is 1-based
      limit: pagination.limit 
    }));
  };

  // handleOpen function removed as it's not properly connected to the CampaignForm

  const handleClose = () => {
    setOpen(false);
    setMode('view');
    setSelectedCampaign(null);
    setFormData({
      name: '',
      description: '',
      segmentId: '',
      status: 'draft',
      message: '',
      scheduledFor: undefined,
    });
  };

  const handleEdit = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      segmentId: campaign.segmentId.toString(),
      status: campaign.status,
      message: campaign.message || '',
      scheduledFor: campaign.scheduledFor ? new Date(campaign.scheduledFor).toISOString().split('T')[0] : undefined,
    });
    setMode('edit'); // Explicitly set mode to edit
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate segmentId
    if (!formData.segmentId.match(/^[0-9a-fA-F]{24}$/)) {
      dispatch(addMessage({
        id: Date.now().toString(),
        type: 'error',
        message: 'Please enter a valid Segment ID',
        read: false
      }));
      return;
    }

    const campaignData: Partial<Campaign> = {
      name: formData.name,
      description: formData.description,
      segmentId: formData.segmentId,
      status: formData.status as 'draft' | 'completed' | 'failed',
      message: formData.message,
      scheduledFor: formData.scheduledFor ? new Date(formData.scheduledFor).toISOString() : undefined,
    };

    try {
      if (selectedCampaign) {
        await dispatch(updateCampaign({ _id: selectedCampaign._id, data: campaignData }));
      } else {
        await dispatch(createCampaign(campaignData));
      }
      handleClose();
    } catch (error) {
      console.error('Error saving campaign:', error);
      dispatch(addMessage({
        id: Date.now().toString(),
        type: 'error',
      }));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dispatch(deleteCampaign(id));
      // Refresh the campaign list after deletion
      dispatch(fetchCampaigns({ page: 1, limit: 100 }));
      dispatch(addMessage({
        id: Date.now().toString(),
        type: 'success',
        message: 'Campaign deleted successfully',
        read: false
      }));
    } catch (error) {
      console.error('Error deleting campaign:', error);
      dispatch(addMessage({
        id: Date.now().toString(),
        type: 'error',
      }));
    }
  };

  // State for Add Campaign form dialog
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const handleOpenAddForm = () => {
    setAddFormOpen(true);
  };

  const handleCloseAddForm = () => {
    setAddFormOpen(false);
  };
  
  const handleOpenEditForm = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setEditFormOpen(true);
  };

  const handleCloseEditForm = () => {
    setEditFormOpen(false);
    setEditingCampaign(null);
  };
  
  const handleFormSuccess = () => {
    // Refresh the campaign list after successful form submission
    dispatch(fetchCampaigns({ 
      page: pagination.page, 
      limit: pagination.limit 
    }));
  };

  const handleAddCampaignSuccess = () => {
    handleCloseAddForm();
    // Refresh the campaigns list
    dispatch(fetchCampaigns({ page: 1, limit: pagination.limit }));
  };

  // Row click handler has been removed as per user request


  const handleSendCampaign = async (campaign: Campaign) => {
    try {
      await dispatch(sendCampaign(campaign._id));
      // Refresh the campaign list after sending
      dispatch(fetchCampaigns({
        page: pagination.page,
        limit: pagination.limit
      }));
    } catch (error) {
      console.error('Error sending campaign:', error);
      dispatch(addMessage({
        id: Date.now().toString(),
        type: 'error',
      }));
    }
  };

  const handleDialogClose = () => {
    setSelectedCampaign(null);
    setMode('view');
    setFormData({
      name: '',
      description: '',
      segmentId: '',
      status: 'draft',
      message: '',
      scheduledFor: undefined,
    });
    dispatch(clearCustomers());
    setOpen(false);
  };

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'draft': return 'default';
      case 'completed': return 'success';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const formatScheduledTime = (scheduledFor: string | Date) => {
    if (!scheduledFor) return '';
    const date = new Date(scheduledFor);
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', width: 200 },
    { 
      field: 'segment',
      headerName: 'Segment',
      width: 200,
      valueGetter: (params) => {
        // This is used for sorting and filtering
        const campaign = params.row;
        let segmentId = '';
        
        // Handle different segmentId formats
        if (typeof campaign.segmentId === 'string') {
          segmentId = campaign.segmentId;
        } else if (campaign.segmentId && typeof campaign.segmentId === 'object') {
          // Check if the object has a name property first
          if ((campaign.segmentId as any).name) {
            return (campaign.segmentId as any).name;
          }
          segmentId = (campaign.segmentId as any)._id || String(campaign.segmentId);
        }
        
        // Get segment name from our maps
        if (segmentId) {
          // Check if the segment exists in our local cache
          const cachedSegment = campaignSegments[segmentId];
          if (cachedSegment && cachedSegment.name) {
            return cachedSegment.name;
          }
          // Fall back to segments from Redux store
          const segment = segments.find(s => s._id === segmentId);
          if (segment) {
            return segment.name;
          }
        }
        return 'Unknown Segment';
      },
      renderCell: (params: GridRenderCellParams<Campaign>) => {
        const campaign = params.row;
        let segmentId = '';
        let segmentName = 'Unknown Segment';
        
        // Handle different segmentId formats
        if (typeof campaign.segmentId === 'string') {
          segmentId = campaign.segmentId;
        } else if (campaign.segmentId && typeof campaign.segmentId === 'object') {
          if ((campaign.segmentId as any).name) {
            // If the segmentId object has a name property, use it directly
            segmentName = (campaign.segmentId as any).name;
            return (
              <Typography variant="body2">
                {segmentName}
              </Typography>
            );
          }
          segmentId = (campaign.segmentId as any)._id || String(campaign.segmentId);
        }
        
        if (!segmentId) {
          return (
            <Typography variant="body2">No Segment</Typography>
          );
        }
        
        // First check if we have the segment in our campaignSegments state
        const campaignSegment = campaignSegments[segmentId];
        if (campaignSegment && campaignSegment.name) {
          segmentName = campaignSegment.name;
        } else {
          // Fall back to segments from Redux store
          const segment = segments.find(s => s._id === segmentId);
          segmentName = segment?.name || 'Loading segment...';
        }
        
        return (
          <Typography variant="body2">
            {segmentName}
          </Typography>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 250,
      renderCell: (params: GridRenderCellParams<Campaign>) => {
        const campaign = params.row;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Chip 
              label={campaign.status.toUpperCase()} 
              color={getStatusColor(campaign.status)}
              size="small"
            />
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      renderCell: (params: GridRenderCellParams<Campaign>) => {
        const campaign = params.row;
        const handleView = async (e: React.MouseEvent) => {
          // Ensure event doesn't propagate to parent elements
          e.stopPropagation();
          e.preventDefault();
          
          // Prevent any row click handlers from firing
          e.nativeEvent.stopImmediatePropagation();
          
          if (campaign && campaign._id) {
            setMode('view');
            setSelectedCampaign(campaign);
            try {
              await dispatch(fetchCampaignCustomers(campaign._id));
              setOpen(true);
            } catch (error) {
              console.error('Error fetching campaign customers:', error);
              dispatch(addMessage({
                id: Date.now().toString(),
                type: 'error',
              }));
            }
          }
        };
        const handleEdit = (e: React.MouseEvent) => {
          // Stop event propagation and prevent default behavior
          e.stopPropagation();
          e.preventDefault();
          
          // Completely stop the event from reaching parent elements
          e.nativeEvent.stopImmediatePropagation();
          
          if (campaign && campaign._id) {
            setMode('edit');
            setSelectedCampaign(campaign);
            setFormData({
              name: campaign.name,
              description: campaign.description || '',
              segmentId: campaign.segmentId.toString(),
              status: campaign.status,
              message: campaign.message || '',
              scheduledFor: campaign.scheduledFor ? new Date(campaign.scheduledFor).toISOString().split('T')[0] : undefined,
            });
            setOpen(true);
          }
        };
        const handleSend = (e: React.MouseEvent) => {
          e.stopPropagation();
          handleSendCampaign(campaign);
        };
        const handleDeleteCampaign = (e: React.MouseEvent) => {
          e.stopPropagation();
          const campaignId = params.row._id;
          if (campaignId && window.confirm('Are you sure you want to delete this campaign?')) {
            dispatch(deleteCampaign(campaignId));
            dispatch(fetchCampaigns({ page: 1, limit: 100 }));

          }
        };
        // Add a class to all action buttons for propagation check
        return (
          <Box>
            <IconButton
              size="small"
              className="campaign-action-btn view-btn"
              onClick={handleView}
              title="View details"
            >
              <VisibilityIcon />
            </IconButton>
            <IconButton
              size="small"
              className="campaign-action-btn edit-btn"
              title={campaign.status !== 'draft' ? 'Only draft campaigns can be edited' : 'Edit campaign'}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEditForm(campaign);
              }}
              disabled={campaign.status !== 'draft'}
              color={campaign.status !== 'draft' ? 'default' : 'primary'}
              sx={{
                opacity: campaign.status !== 'draft' ? 0.5 : 1,
                '&:hover': {
                  backgroundColor: campaign.status !== 'draft' ? 'transparent' : 'action.hover',
                }
              }}
            >
              <EditIcon />
            </IconButton>
            {campaign.status === 'draft' && (
              <IconButton
                size="small"
                className="campaign-action-btn"
                onClick={handleSend}
                color="primary"
              >
                <SendIcon />
              </IconButton>
            )}
            {!(campaign.status === 'completed' ) && (
              <IconButton
                size="small"
                className="campaign-action-btn"
                color="default"
                onClick={handleDeleteCampaign}
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        );
      },
    },
  ];

  // We no longer need scheduled campaign processing since we removed the scheduled status

  return (
    <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
      {/* Add Campaign Form Dialog */}
      <CampaignForm
        open={addFormOpen}
        onClose={handleCloseAddForm}
        onSuccess={handleFormSuccess}
        segments={segments}
      />
      
      {/* Edit Campaign Form Dialog */}
      <CampaignForm
        open={editFormOpen}
        onClose={handleCloseEditForm}
        onSuccess={handleFormSuccess}
        editingCampaign={editingCampaign || undefined}
        segments={segments}
      />
      {/* Campaign Edit Dialog */}
      {/* Only one dialog is ever rendered at a time, based on mode and open */}
      {open && mode === 'edit' && (
        <Dialog open={open} onClose={handleDialogClose} maxWidth="md" fullWidth>
          <DialogTitle>Edit Campaign</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
              <FormControl fullWidth>
                <InputLabel>Segment</InputLabel>
                <Select
                  value={formData.segmentId}
                  onChange={(e: SelectChangeEvent) => setFormData({ ...formData, segmentId: e.target.value })}
                  label="Segment"
                >
                  {segments.map((segment) => (
                    <MenuItem key={segment._id} value={segment._id}>
                      {segment.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
              <TextField
                type="date"
                label="Schedule For"
                value={formData.scheduledFor || ''}
                onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {/* Campaign Details Dialog */}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 0 } }}>
        <Typography variant="h5">Campaigns</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Messages />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddForm}
            sx={{ ml: 2 }}
          >
            Add Campaign
          </Button>
        </Box>
      </Box>


      <DataGrid
        rows={campaigns}
        columns={columns}
        rowCount={pagination.total}
        pagination
        paginationMode="server"
        initialState={{
          pagination: {
            paginationModel: { pageSize: 10 },
          },
        }}
        pageSizeOptions={[5, 10, 25, 50, 100]}
        onPaginationModelChange={(model) => handlePageChange(model.page)}
        loading={loading}
        getRowId={(row) => row._id}
        disableRowSelectionOnClick
        autoHeight
        sx={{
          '& .MuiDataGrid-row': {
            '&:hover': {
              backgroundColor: 'transparent !important'
            }
          },
          '& .MuiDataGrid-cell': {
            cursor: 'default'
          }
        }}
      />

{open && mode === 'view' && selectedCampaign && (
        <Dialog open={open} onClose={handleDialogClose} maxWidth="md" fullWidth>
          <DialogTitle>Campaign Details</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6">Campaign Information</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography>Name: {selectedCampaign.name}</Typography>
                <Typography>Status: {selectedCampaign.status}</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Segment:</strong> {
                    (() => {
                      // Handle different segmentId formats
                      if (selectedCampaign.segmentId && typeof selectedCampaign.segmentId === 'object') {
                        // If the segmentId object has a name property, use it directly
                        if ((selectedCampaign.segmentId as any).name) {
                          return (selectedCampaign.segmentId as any).name;
                        }
                      }
                      
                      // Get the segmentId, handling potential object references
                      let segmentId = '';
                      if (typeof selectedCampaign.segmentId === 'string') {
                        segmentId = selectedCampaign.segmentId;
                      } else if (selectedCampaign.segmentId && typeof selectedCampaign.segmentId === 'object') {
                        segmentId = (selectedCampaign.segmentId as any)._id || String(selectedCampaign.segmentId);
                      }

                      if (!segmentId) return 'No Segment';
                      
                      // Check in campaignSegments first
                      const campaignSegment = campaignSegments[segmentId];
                      if (campaignSegment && campaignSegment.name) {
                        return campaignSegment.name;
                      }
                      
                      // Fall back to segments from Redux store
                      const segment = segments.find(s => s._id === segmentId);
                      if (segment && segment.name) {
                        return segment.name;
                      }
                      
                      // If we still don't have a segment name, try to fetch it
                      if (segmentId) {
                        // Trigger a segment fetch (will be handled by the useEffect)
                        setTimeout(() => {
                          dispatch(fetchSegments({ page: 1, limit: 100 }));
                        }, 0);
                      }
                      
                      return 'Loading segment...';
                    })()
                  }
                </Typography>
                {selectedCampaign.scheduledFor && (
                  <Typography>
                    Scheduled For: {formatScheduledTime(selectedCampaign.scheduledFor)}
                  </Typography>
                )}
                {selectedCampaign.message && (
                  <Typography>
                    Message: {selectedCampaign.message}
                  </Typography>
                )}
              </Box>
              <Typography variant="h6">Campaign Statistics</Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                  <CircularProgress size={32} />
                </Box>
              ) : (
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={3}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2">Total Customers</Typography>
                      <Typography variant="h4">{statistics?.totalCustomers ?? 0}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2">Total Visits</Typography>
                      <Typography variant="h4">{statistics?.totalVisits ?? 0}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2">Total Spent</Typography>
                      <Typography variant="h4">₹{statistics?.totalSpent?.toFixed(2) ?? '0.00'}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2">Average Spent</Typography>
                      <Typography variant="h4">₹{statistics?.averageSpent?.toFixed(2) ?? '0.00'}</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              )}
              <Typography variant="h6">Customers</Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                  <CircularProgress size={32} />
                </Box>
              ) : customers.length > 0 ? (
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {customers.map((customer, index) => (
                    <Chip
                      key={index}
                      label={customer.name}
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              ) : (
                <Typography color="text.secondary" sx={{ my: 1 }}>
                  No customers for this campaign.
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose}>Close</Button>
          </DialogActions>
        </Dialog>
      )}




      {/* Error Message */}
      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default CampaignList;
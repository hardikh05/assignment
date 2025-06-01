import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { RootState } from '../store';
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../store/slices/customerSlice';
import { Customer } from '../types';
import { addMessage } from '../store/slices/messageSlice';
import { DataGrid, GridColDef, GridRenderCellParams, GridRowModel } from '@mui/x-data-grid';

interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  customFields: Record<string, string>;
}

const CustomerList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { customers, loading, error } = useAppSelector((state: RootState) => state.customers);
  const [open, setOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    email: '',
    phone: '',
    customFields: {},
  });

  useEffect(() => {
    dispatch(fetchCustomers({ page: 1, limit: 100 }));
  }, [dispatch]);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedCustomer(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      customFields: {},
    });
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || '',
      customFields: customer.customFields || {},
    });
    setOpen(true);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    if (!phone) return true;
    return /^[0-9]{10,}$/.test(phone);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedCustomer) {
        await dispatch(updateCustomer({ _id: selectedCustomer._id, data: formData }));
      } else {
        const newCustomer = {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
        };
        await dispatch(createCustomer(newCustomer));
      }
      handleClose();
    } catch (err: any) {
      console.error('Error saving customer:', err);
      dispatch(addMessage({ 
        type: 'error', 
        message: err.message || 'Failed to save customer. Please try again.' 
      }));
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await dispatch(deleteCustomer(id));
      } catch (err: any) {
        dispatch(addMessage({ 
          type: 'error', 
          message: err.message || 'Failed to delete customer. Please try again.' 
        }));
      }
    }
  };

  const columns: GridColDef[] = [
    {
      field: '_id',
      headerName: 'ID',
      flex: 0.5,
      minWidth: 80,
      // Hide this column from view
      filterable: false,
      sortable: false,
      disableColumnMenu: true,
    },
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'email', headerName: 'Email', flex: 1 },
    { field: 'phone', headerName: 'Phone', flex: 1 },
    {
      field: 'totalSpent',
      headerName: 'Total Spent',
      flex: 1,
      renderCell: (params: GridRenderCellParams<Customer>) => {
        const totalSpent = params.row.totalSpent || 0;
        return `₹${totalSpent.toFixed(2)}`;
      },
    },
    {
      field: 'visits',
      headerName: 'Visits',
      flex: 1,
      renderCell: (params: GridRenderCellParams<Customer>) => {
        const visits = params.row.visits || params.row.totalVisits || 0;
        return visits.toString();
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      renderCell: (params: GridRenderCellParams<Customer>) => (
        <Box>
          <IconButton onClick={() => handleEdit(params.row)} size="small">
            <EditIcon />
          </IconButton>
          <IconButton onClick={() => handleDelete(params.row._id)} size="small">
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: { xs: 500, sm: 600 }, width: '100%', overflow: 'hidden', p: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: { xs: 1, sm: 0 }, mb: 2 }}>
        <Typography variant="h5">Customers</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpen}
        >
          Add Customer
        </Button>
      </Box>

      <DataGrid<Customer>
        rows={customers}
        columns={columns}
        getRowId={(row: GridRowModel<Customer>) => row._id}
        disableColumnMenu
        disableRowSelectionOnClick
        autoHeight
        density="standard"
        initialState={{
          sorting: {
            sortModel: [
              {
                field: 'name',
                sort: 'asc'
              }
            ]
          },
          pagination: {
            paginationModel: { pageSize: 10 }
          },
          columns: {
            columnVisibilityModel: {
              _id: false
            }
          }
        }}
        pageSizeOptions={[5, 10, 25]}
        sx={{ 
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: 'background.paper'
          },
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          },
          '& .MuiDataGrid-cell': {
            wordBreak: 'break-word',
            whiteSpace: 'normal',
            lineHeight: '1.2rem'
          },
          '& .MuiDataGrid-main': {
            overflow: 'auto'
          },
          '& .customer-action-btn': {
            padding: { xs: '4px', sm: '8px' }
          }
        }}
      />

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { maxHeight: '90vh', width: { xs: '95%', sm: '80%', md: '600px' } } }}>
        <DialogTitle>
          {selectedCustomer ? 'Edit Customer' : 'Add Customer'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, maxHeight: { xs: '70vh', sm: '80vh' }, overflow: 'auto', px: { xs: 1, sm: 2 } }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              margin="normal"
              error={!validateEmail(formData.email)}
              helperText={!validateEmail(formData.email) ? 'Please enter a valid email address' : ''}
            />
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              margin="normal"
              error={!validatePhone(formData.phone)}
              helperText={!validatePhone(formData.phone) ? 'Please enter a valid phone number' : ''}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={!validateEmail(formData.email) || !validatePhone(formData.phone)}
          >
            {selectedCustomer ? 'Save Changes' : 'Add Customer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerList; 
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  IconButton,
  MenuItem,
  Paper,
  Chip,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridRowSelectionModel,
  GridCallbackDetails,
  GridRowModel,
} from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  RemoveCircle as RemoveIcon,
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../store';
import {
  fetchOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  Order,
  OrderItem,
  ShippingAddress,
} from '../store/slices/orderSlice';
import { addMessage } from '../store/slices/messageSlice';
import { fetchCustomers } from '../store/slices/customerSlice';
import { Customer } from '../types';

interface OrderFormData {
  customerId: string;
  items: OrderItem[];
  status: Order['status'];
  shippingAddress: ShippingAddress;
  totalAmount: number;
}

const initialFormState: OrderFormData = {
  customerId: '',
  items: [],
  status: 'pending',
  shippingAddress: {
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
  },
  totalAmount: 0,
};

const OrderList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { orders, loading } = useAppSelector((state: RootState) => state.orders);
  const { customers } = useAppSelector((state: RootState) => state.customers);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<OrderFormData>(initialFormState);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  useEffect(() => {
    dispatch(fetchOrders({ page: 1, limit: 100 }));
    dispatch(fetchCustomers({ page: 1, limit: 100 }));
  }, [dispatch]);

  useEffect(() => {
    const total = formData.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    setFormData((prev) => ({ ...prev, totalAmount: total }));
  }, [formData.items]);

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setFormData(initialFormState);
    setEditingOrder(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOrder) {
        await dispatch(updateOrder({ _id: editingOrder._id, ...formData })).unwrap();
      } else {
        await dispatch(createOrder(formData)).unwrap();
      }
      handleClose();
    } catch (err) {
      console.error('Failed to save order:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        await dispatch(deleteOrder(id)).unwrap();
      } catch (err) {
        console.error('Failed to delete order:', err);
      }
    }
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setFormData({
      customerId: typeof order.customerId === 'string' ? order.customerId : order.customerId._id,
      items: order.items,
      status: order.status,
      shippingAddress: order.shippingAddress,
      totalAmount: order.totalAmount,
    });
    setOpen(true);
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'processing': return 'info';
      case 'shipped': return 'primary';
      case 'delivered': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const columns: GridColDef[] = [
    {
      field: '_id',
      headerName: 'ID',
      flex: 0.5,
      minWidth: 80,
      filterable: false,
      sortable: false,
      disableColumnMenu: true,
    },
    { field: 'orderNumber', headerName: 'Order Number', flex: 1, minWidth: 150 },
    {
      field: 'customerId',
      headerName: 'Customer',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => {
        const customer = params.row.customerId;
        if (!customer) return '[Unknown Customer]';
        if (typeof customer === 'object') return `${customer.name} (${customer.email})`;
        const found = customers.find((c) => c._id === customer);
        return found ? `${found.name} (${found.email})` : '[Unknown Customer]';
      },
    },
    {
      field: 'items',
      headerName: 'Total Items',
      flex: 1,
      minWidth: 120,
      renderCell: (params) => {
        const totalItems = params.row.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        return (
          <Box display="flex" alignItems="center" height="100%">
            <Typography variant="body2">
              {totalItems} items
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'totalAmount',
      headerName: 'Total Amount',
      flex: 1,
      minWidth: 120,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" height="100%">
          <Typography variant="body2" fontWeight="bold">
            ₹{params.row.totalAmount.toFixed(2)}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      minWidth: 120,
      renderCell: (params) => (
        <Chip
          label={params.row.status.charAt(0).toUpperCase() + params.row.status.slice(1)}
          color={getStatusColor(params.row.status)}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 0.7,
      minWidth: 100,
      renderCell: (params) => (
        <Box>
          <IconButton onClick={() => handleEdit(params.row)} size="small"><EditIcon /></IconButton>
          <IconButton onClick={() => handleDelete(params.row._id)} size="small"><DeleteIcon /></IconButton>
        </Box>
      ),
    },
  ];

  const calculateTotalAmount = (items: OrderItem[]): number => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  return (
    <Box sx={{ width: '100%', overflow: 'auto', p: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: { xs: 1, sm: 0 }, mb: 2 }}>
        <Typography variant="h5">Orders</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
          Add Order
        </Button>
      </Box>

      <Paper sx={{ height: { xs: 500, sm: 600 }, width: '100%', overflow: 'hidden' }}>
        <DataGrid
          rows={orders}
          columns={columns}
          getRowId={(row) => row._id}
          disableColumnMenu
          disableRowSelectionOnClick
          autoHeight
          density="standard"
          initialState={{
            sorting: {
              sortModel: [
                {
                  field: 'createdAt',
                  sort: 'desc'
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
            }
          }}
        />
      </Paper>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '90vh', width: { xs: '95%', sm: '80%', md: '800px' } } }}>
        <DialogTitle>{editingOrder ? 'Edit Order' : 'Add Order'}</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, maxHeight: { xs: '70vh', sm: '80vh' }, overflow: 'auto', px: { xs: 1, sm: 2 } }}>
            <FormControl fullWidth margin="normal" sx={{ mb: { xs: 2, sm: 3 } }}>
              <InputLabel>Customer</InputLabel>
              <Select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value as string })}
                label="Customer"
                required
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300
                    }
                  }
                }}
              >
                <MenuItem value="">Select a customer</MenuItem>
                {customers.map((customer) => (
                  <MenuItem key={customer._id} value={customer._id}>
                    {customer.name} ({customer.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box mt={3}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1">Items</Typography>
              </Box>
              {formData.items.map((item, i) => (
                <Box key={i} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 2 }}>
                  <TextField
                    label="Name"
                    value={item.name}
                    onChange={(e) => {
                      const items = [...formData.items];
                      const item = items[i];
                      if (item) {
                        item.name = e.target.value;
                      }
                      setFormData({ ...formData, items });
                    }}
                    fullWidth
                    required
                  />
                  <TextField
                    label="Qty"
                    type="number"
                    inputProps={{ min: 1 }}
                    value={item.quantity}
                    onChange={(e) => {
                      const items = [...formData.items];
                      const item = items[i];
                      if (item) {
                        item.quantity = parseInt(e.target.value) || 1;
                      }
                      setFormData({ ...formData, items });
                    }}
                    fullWidth
                    required
                  />
                  <TextField
                    label="Price"
                    type="number"
                    inputProps={{ min: 0, step: 0.01 }}
                    value={item.price}
                    onChange={(e) => {
                      const items = [...formData.items];
                      const item = items[i];
                      if (item) {
                        item.price = parseFloat(e.target.value) || 0;
                      }
                      setFormData({ ...formData, items });
                    }}
                    fullWidth
                    required
                  />
                  {formData.items.length > 1 && (
                    <IconButton 
                      onClick={() => {
                        const items = formData.items.filter((_, index) => index !== i);
                        setFormData({ ...formData, items });
                      }}
                    >
                      <RemoveIcon color="error" />
                    </IconButton>
                  )}
                </Box>
              ))}
              <Button
                variant="text"
                onClick={() => setFormData({ ...formData, items: [...formData.items, { name: '', quantity: 1, price: 0 }] })}
                sx={{ mt: 1 }}
              >
                + Add Item
              </Button>

              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Total Items:</Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {formData.items.reduce((sum, item) => sum + item.quantity, 0)} items
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Total Amount:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    ₹{calculateTotalAmount(formData.items).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box mt={3}>
              <Typography variant="subtitle1" gutterBottom>Shipping Address</Typography>
              {['street', 'city', 'state', 'zipCode', 'country'].map((field) => (
                <TextField
                  key={field}
                  label={field.charAt(0).toUpperCase() + field.slice(1)}
                  fullWidth
                  value={(formData.shippingAddress as any)[field]}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      shippingAddress: {
                        ...formData.shippingAddress,
                        [field]: e.target.value,
                      },
                    });
                  }}
                  sx={{ mt: 1 }}
                  required
                />
              ))}
            </Box>

            <FormControl fullWidth margin="normal">
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Order['status'] })}
                required
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="shipped">Shipped</MenuItem>
                <MenuItem value="delivered">Delivered</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrderList; 

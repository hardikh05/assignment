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
  MenuItem,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Grid,
} from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import axios from '../utils/axios';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderFormData {
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: string;
}

interface OrderFormProps {
  open: boolean;
  onClose: () => void;
  editingOrder?: any;
  customerId?: string;
}

const OrderForm: React.FC<OrderFormProps> = ({
  open,
  onClose,
  editingOrder,
  customerId,
}) => {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [formData, setFormData] = useState<OrderFormData>({
    customerId: customerId || '',
    items: [{ name: '', quantity: 1, price: 0 }],
    totalAmount: 0,
    status: 'pending',
    shippingAddress: '',
  });

  useEffect(() => {
    fetchCustomers();
    if (editingOrder) {
      setFormData({
        customerId: editingOrder.customerId,
        items: editingOrder.items,
        totalAmount: editingOrder.totalAmount,
        status: editingOrder.status,
        shippingAddress: editingOrder.shippingAddress,
      });
    }
  }, [editingOrder, customerId]);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/customers?limit=100');
      setCustomers(response.data.customers);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { name: '', quantity: 1, price: 0 }],
    });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      items: newItems,
      totalAmount: calculateTotal(newItems),
    });
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = formData.items.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setFormData({
      ...formData,
      items: newItems,
      totalAmount: calculateTotal(newItems),
    });
  };

  const calculateTotal = (items: OrderItem[]) => {
    return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingOrder) {
        await axios.put(`/orders/${editingOrder._id}`, formData);
      } else {
        await axios.post('/orders', formData);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save order:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {editingOrder ? 'Edit Order' : 'Create Order'}
      </DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid sx={{ gridColumn: { xs: 'span 12' } }}>
              <TextField
                fullWidth
                select
                label="Customer"
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                required
                disabled={!!customerId}
              >
                {customers.map((customer) => (
                  <MenuItem key={customer._id} value={customer._id}>
                    {customer.name} ({customer.email})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid sx={{ gridColumn: { xs: 'span 12' } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1">Order Items</Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddItem}
                  variant="outlined"
                  size="small"
                >
                  Add Item
                </Button>
              </Box>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <List>
                  {formData.items.map((item, index) => (
                    <ListItem key={index}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid sx={{ gridColumn: { xs: 'span 4' } }}>
                          <TextField
                            fullWidth
                            label="Item Name"
                            value={item.name}
                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                            required
                          />
                        </Grid>
                        <Grid sx={{ gridColumn: { xs: 'span 3' } }}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Quantity"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                            required
                            inputProps={{ min: 1 }}
                          />
                        </Grid>
                        <Grid sx={{ gridColumn: { xs: 'span 3' } }}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Price"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value))}
                            required
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                        </Grid>
                        <Grid sx={{ gridColumn: { xs: 'span 2' } }}>
                          <IconButton
                            onClick={() => handleRemoveItem(index)}
                            disabled={formData.items.length === 1}
                          >
                            <RemoveIcon />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            <Grid sx={{ gridColumn: { xs: 'span 12' } }}>
              <TextField
                fullWidth
                select
                label="Status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as OrderFormData['status'] })}
                required
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="shipped">Shipped</MenuItem>
                <MenuItem value="delivered">Delivered</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
            </Grid>

            <Grid sx={{ gridColumn: { xs: 'span 12' } }}>
              <TextField
                fullWidth
                label="Shipping Address"
                value={formData.shippingAddress}
                onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                multiline
                rows={2}
                required
              />
            </Grid>

            <Grid sx={{ gridColumn: { xs: 'span 12' } }}>
              <Typography variant="h6" align="right">
                Total Amount: ₹{formData.totalAmount.toFixed(2)}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OrderForm; 
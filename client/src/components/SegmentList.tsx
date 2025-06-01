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
  Paper,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, Add as AddRuleIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { RootState } from '../store';
import {
  fetchSegments,
  createSegment,
  updateSegment,
  deleteSegment,
} from '../store/slices/segmentSlice';
import { Segment, SegmentRule, SegmentFormData } from '../types';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';

const initialFormState: SegmentFormData = {
  name: '',
  description: '',
  rules: [],
  ruleOperator: 'AND',
};

const SegmentList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { segments, loading, error } = useAppSelector((state) => state.segments);
  const [open, setOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [formData, setFormData] = useState<SegmentFormData>(initialFormState);

  useEffect(() => {
    dispatch(fetchSegments({ page: 1, limit: 100 }));
  }, [dispatch]);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedSegment(null);
    setFormData(initialFormState);
  };

  const handleEdit = (segment: Segment) => {
    setSelectedSegment(segment);
    setFormData({
      name: segment.name,
      description: segment.description || '',
      rules: segment.rules,
      ruleOperator: segment.ruleOperator,
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name.trim()) {
      alert('Please enter a segment name');
      return;
    }

    if (formData.rules.length === 0) {
      alert('Please add at least one rule');
      return;
    }

    // Validate rules
    const invalidRules = formData.rules.filter(
      rule => !rule.field.trim() || !rule.operator || !rule.value
    );
    if (invalidRules.length > 0) {
      alert('Please fill in all fields for each rule');
      return;
    }

    try {
      if (selectedSegment) {
        await dispatch(updateSegment({
          id: selectedSegment._id,
          data: {
            name: formData.name,
            description: formData.description,
            rules: formData.rules,
            ruleOperator: formData.ruleOperator,
          },
        }));
      } else {
        await dispatch(createSegment({
          name: formData.name,
          description: formData.description,
          rules: formData.rules,
          ruleOperator: formData.ruleOperator,
        }));
      }
      handleClose();
    } catch (error) {
      console.error('Error saving segment:', error);
      alert('Failed to save segment. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this segment?')) {
      try {
        await dispatch(deleteSegment(id)).unwrap();
        // Refresh the segments list after successful deletion
        dispatch(fetchSegments({ page: 1, limit: 100 }));
      } catch (error) {
        console.error('Error deleting segment:', error);
        alert('Failed to delete segment. Please try again.');
      }
    }
  };

  const handleAddRule = () => {
    setFormData({
      ...formData,
      rules: [
        ...formData.rules,
        { field: '', operator: 'equals', value: '' },
      ],
    });
  };

  const handleUpdateRule = (index: number, field: keyof SegmentRule, value: string) => {
    const newRules = [...formData.rules];
    newRules[index] = { ...newRules[index], [field]: value } as SegmentRule;
    setFormData({ ...formData, rules: newRules });
  };

  const handleRemoveRule = (index: number) => {
    const newRules = formData.rules.filter((_, i) => i !== index);
    setFormData({ ...formData, rules: newRules });
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'description', headerName: 'Description', flex: 1.5, minWidth: 200 },
    {
      field: 'rules',
      headerName: 'Rules',
      flex: 0.8,
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<Segment>) => {
        const segment = params.row as Segment;
        return `${segment.rules?.length || 0} rules`;
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 0.7,
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<Segment>) => {
        const row = params.row as Segment;
        return (
          <Box>
            <IconButton onClick={() => handleEdit(row)} size="small" className="segment-action-btn">
              <EditIcon />
            </IconButton>
            <IconButton onClick={() => handleDelete(row._id)} size="small" className="segment-action-btn">
              <DeleteIcon />
            </IconButton>
          </Box>
        );
      },
    },
  ];

  return (
    <Box sx={{ width: '100%', overflow: 'auto', p: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: { xs: 1, sm: 0 }, mb: 2 }}>
        <Typography variant="h5">Segments</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpen}
        >
          Add Segment
        </Button>
      </Box>

      <Paper sx={{ height: { xs: 500, sm: 600 }, width: '100%', overflow: 'hidden' }}>
        <DataGrid
          rows={segments}
          columns={columns}
          getRowId={(row) => row._id}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10, page: 0 },
            },
            sorting: {
              sortModel: [
                {
                  field: 'name',
                  sort: 'asc'
                }
              ]
            }
          }}
          pageSizeOptions={[5, 10, 25]}
          disableRowSelectionOnClick
          loading={loading}
          autoHeight
          density="standard"
          sx={{
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: 'background.paper'
            },
            '& .MuiDataGrid-row': {
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
            '& .segment-action-btn': {
              padding: { xs: '4px', sm: '8px' }
            }
          }}
        />
      </Paper>

      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="md" 
        fullWidth 
        PaperProps={{ 
          sx: { 
            maxHeight: '90vh', 
            width: { xs: '95%', sm: '80%', md: '800px' } 
          } 
        }}
      >
        <DialogTitle>
          {selectedSegment ? 'Edit Segment' : 'Add Segment'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, maxHeight: { xs: '70vh', sm: '80vh' }, overflow: 'auto', px: { xs: 1, sm: 2 } }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
              error={!formData.name}
              helperText={!formData.name ? 'Name is required' : ''}
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              margin="normal"
              multiline
              rows={4}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Rule Operator</InputLabel>
              <Select
                value={formData.ruleOperator}
                onChange={(e) => setFormData({ ...formData, ruleOperator: e.target.value as 'AND' | 'OR' })}
                required
              >
                <MenuItem value="AND">AND</MenuItem>
                <MenuItem value="OR">OR</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
              Rules
            </Typography>
            
            {formData.rules.map((rule, index) => (
              <Box key={index} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 2, alignItems: { xs: 'stretch', sm: 'center' } }}>
                <TextField
                  label="Field"
                  value={rule.field}
                  onChange={(e) => handleUpdateRule(index, 'field', e.target.value)}
                  required
                  error={!rule.field}
                  helperText={!rule.field ? 'Field is required' : ''}
                  sx={{ flex: 1 }}
                />
                <TextField
                  select
                  label="Operator"
                  value={rule.operator}
                  onChange={(e) => handleUpdateRule(index, 'operator', e.target.value)}
                  required
                  error={!rule.operator}
                  helperText={!rule.operator ? 'Operator is required' : ''}
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="equals">Equals</MenuItem>
                  <MenuItem value="notEquals">Not Equals</MenuItem>
                  <MenuItem value="greaterThan">Greater Than</MenuItem>
                  <MenuItem value="lessThan">Less Than</MenuItem>
                </TextField>
                <TextField
                  label="Value"
                  value={rule.value}
                  onChange={(e) => handleUpdateRule(index, 'value', e.target.value)}
                  required
                  error={!rule.value}
                  helperText={!rule.value ? 'Value is required' : ''}
                  sx={{ flex: 1 }}
                />
                <IconButton
                  onClick={() => handleRemoveRule(index)}
                  color="error"
                  sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, mt: { xs: 1, sm: 0 } }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}

            <Button
              startIcon={<AddRuleIcon />}
              onClick={handleAddRule}
              sx={{ mt: 1 }}
            >
              Add Rule
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={
              !formData.name || 
              formData.rules.length === 0 ||
              formData.rules.some(rule => !rule.field || !rule.operator || !rule.value)
            }
          >
            {selectedSegment ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default SegmentList;
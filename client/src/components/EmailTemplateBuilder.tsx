import React, { useEffect, useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchTemplates, createTemplate, deleteTemplate } from '../store/slices/templateSlice';
import {
  Box, Paper, Typography, Button, Grid, Card, CardContent,
  CardActions, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Alert, IconButton, Chip,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Visibility as PreviewIcon } from '@mui/icons-material';

const EmailTemplateBuilder: React.FC = () => {
  const dispatch = useAppDispatch();
  const { templates, loading, error } = useAppSelector((state) => state.templates);
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const [form, setForm] = useState({ name: '', subject: '', htmlContent: '' });

  // Sanitize HTML to prevent XSS attacks
  const sanitizedPreviewHtml = useMemo(() => DOMPurify.sanitize(previewHtml), [previewHtml]);

  useEffect(() => {
    dispatch(fetchTemplates());
  }, [dispatch]);

  const handleCreate = () => {
    if (!form.name.trim() || !form.htmlContent.trim()) return;
    dispatch(createTemplate(form));
    setOpen(false);
    setForm({ name: '', subject: '', htmlContent: '' });
  };

  const handlePreview = (html: string) => {
    setPreviewHtml(html);
    setPreviewOpen(true);
  };

  if (loading && templates.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Email Templates</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          New Template
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {(Array.isArray(templates) ? templates : []).map((template) => (
          <Grid item xs={12} sm={6} md={4} key={template._id}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>{template.name}</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Subject: {template.subject || 'No subject'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Created: {new Date(template.createdAt).toLocaleDateString()}
                </Typography>
              </CardContent>
              <CardActions>
                <IconButton size="small" onClick={() => handlePreview(template.htmlContent)} title="Preview">
                  <PreviewIcon />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => dispatch(deleteTemplate(template._id))} title="Delete">
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
        {templates.length === 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No templates yet. Create your first one!</Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Create Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Email Template</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Template Name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} margin="normal" />
          <TextField fullWidth label="Subject Line" value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })} margin="normal" />
          <TextField fullWidth label="HTML Content" value={form.htmlContent}
            onChange={(e) => setForm({ ...form, htmlContent: e.target.value })}
            margin="normal" multiline rows={10} placeholder="<html>...</html>" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.name.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog with Dark Mode toggle */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Email Preview
            <Box>
              <Chip label="Light" onClick={() => setPreviewMode('light')}
                color={previewMode === 'light' ? 'primary' : 'default'} sx={{ mr: 1 }} />
              <Chip label="Dark" onClick={() => setPreviewMode('dark')}
                color={previewMode === 'dark' ? 'primary' : 'default'} />
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{
            p: 2, borderRadius: 1, minHeight: 300,
            bgcolor: previewMode === 'dark' ? '#1a1a2e' : '#ffffff',
            color: previewMode === 'dark' ? '#e0e0e0' : '#000000',
            border: '1px solid',
            borderColor: 'divider',
          }}>
            <div dangerouslySetInnerHTML={{ __html: sanitizedPreviewHtml }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmailTemplateBuilder;

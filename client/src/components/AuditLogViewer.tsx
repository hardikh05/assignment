import React, { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchAuditLogs } from '../store/slices/auditLogSlice';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Alert, Chip, TablePagination,
} from '@mui/material';

const getActionColor = (action: string) => {
  if (action.includes('create') || action.includes('add')) return 'success';
  if (action.includes('delete') || action.includes('remove')) return 'error';
  if (action.includes('update') || action.includes('edit')) return 'warning';
  return 'default';
};

const AuditLogViewer: React.FC = () => {
  const dispatch = useAppDispatch();
  const { logs, loading, error, pagination } = useAppSelector((state) => state.auditLogs);

  useEffect(() => {
    dispatch(fetchAuditLogs({ page: 1, limit: 20 }));
  }, [dispatch]);

  const handlePageChange = (_: unknown, newPage: number) => {
    dispatch(fetchAuditLogs({ page: newPage + 1, limit: pagination.limit }));
  };

  if (loading && logs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>Audit Log</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Resource</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(Array.isArray(logs) ? logs : []).map((log) => (
              <TableRow key={log._id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>{log.userName || 'System'}</TableCell>
                <TableCell>
                  <Chip label={log.action} size="small" color={getActionColor(log.action) as any} variant="outlined" />
                </TableCell>
                <TableCell>{log.resource}</TableCell>
                <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.details ? JSON.stringify(log.details).substring(0, 100) : '-'}
                </TableCell>
              </TableRow>
            ))}
            {(!logs || logs.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>No audit logs found.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {pagination.total > 0 && (
          <TablePagination
            component="div"
            count={pagination.total}
            page={pagination.page - 1}
            onPageChange={handlePageChange}
            rowsPerPage={pagination.limit}
            rowsPerPageOptions={[20]}
          />
        )}
      </TableContainer>
    </Box>
  );
};

export default AuditLogViewer;

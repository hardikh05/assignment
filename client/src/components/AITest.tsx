import React, { useState } from 'react';
import { Box, Button, Typography, CircularProgress, Paper } from '@mui/material';
import axios from 'axios';

const AITest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testAIEndpoint = async () => {
    setLoading(true);
    setError(null);
    try {
      // Test the AI test endpoint
      const response = await axios.get('/ai-test');
      setResult(response.data);
    } catch (err: any) {
      console.error('Error testing AI endpoint:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const testGenerateMessage = async () => {
    setLoading(true);
    setError(null);
    try {
      // Test the AI message generation endpoint
      const response = await axios.post('/ai/generate-message', {
        segmentName: 'Test Segment',
        campaignName: 'Test Campaign',
        campaignDescription: 'This is a test campaign description'
      });
      setResult(response.data);
    } catch (err: any) {
      console.error('Error generating AI message:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        AI Feature Test
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={testAIEndpoint}
          disabled={loading}
        >
          Test AI Endpoint
        </Button>
        
        <Button 
          variant="contained" 
          color="secondary" 
          onClick={testGenerateMessage}
          disabled={loading}
        >
          Test Generate Message
        </Button>
      </Box>
      
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <CircularProgress />
        </Box>
      )}
      
      {error && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: '#ffebee' }}>
          <Typography color="error">Error: {error}</Typography>
        </Paper>
      )}
      
      {result && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Result:</Typography>
          <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: '300px' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </Paper>
      )}
    </Box>
  );
};

export default AITest;

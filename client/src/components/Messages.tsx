import React from 'react';
import { useAppSelector } from '../store/hooks';
import { Alert, Snackbar, Stack } from '@mui/material';
import { RootState } from '../store';

const Messages: React.FC = () => {
  const messages = useAppSelector((state) => state.messages.messages);

  return (
    <Stack spacing={1} sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 2000 }}>
      {messages.map((message) => (
        <Snackbar
          key={message.id}
          open={true}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert severity={message.type} sx={{ width: '100%' }}>
            {message.message}
          </Alert>
        </Snackbar>
      ))}
    </Stack>
  );
};

export default Messages; 
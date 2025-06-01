import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  Divider,
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { login } from '../store/slices/authSlice';
import axios from 'axios';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      window.location.href = `${process.env['REACT_APP_API_URL']}/api/auth/google`;
    } catch (err) {
      console.error('Google login error:', err);
      setLoginError('Failed to initiate Google login');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const response = await axios.post('/auth/login', { email, password });
      const { token } = response.data;
      
      if (!token) {
        throw new Error('No token received from server');
      }

      // Store token in localStorage first
      localStorage.setItem('token', token);
      
      // Then dispatch login action
      const result = await dispatch(login(token)).unwrap();
      
      if (result) {
        navigate('/');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError(err.response?.data?.message || 'Failed to login. Please check your credentials.');
      // Clear any existing token on error
      localStorage.removeItem('token');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      dispatch(login(token))
        .unwrap()
        .then(() => {
          navigate('/');
        })
        .catch((err) => {
          console.error('Token validation error:', err);
          localStorage.removeItem('token');
          setLoginError('Session expired. Please login again.');
        });
    }
  }, [dispatch, navigate]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400,
        }}
      >
        <Typography variant="h4" gutterBottom align="center">
          Welcome to ECHO
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom align="center">
          Please sign in to continue
        </Typography>
        {(error || loginError) && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {loginError || error}
          </Alert>
        )}
        <Box component="form" onSubmit={handleEmailLogin} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            margin="normal"
            error={!!loginError}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            margin="normal"
            error={!!loginError}
          />
          <Button
            fullWidth
            variant="contained"
            type="submit"
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Sign in with Email'}
          </Button>
        </Box>
        <Divider sx={{ my: 3 }}>OR</Divider>
        <Button
          fullWidth
          variant="outlined"
          onClick={handleGoogleLogin}
          disabled={loading}
          startIcon={<GoogleIcon />}
        >
          Sign in with Google
        </Button>
      </Paper>
    </Box>
  );
};

export default Login; 
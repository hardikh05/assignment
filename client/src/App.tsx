import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from './store/hooks';
import { login } from './store/slices/authSlice';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CampaignList from './components/CampaignList';
import CustomerList from './components/CustomerList';
import SegmentList from './components/SegmentList';
import OrderList from './components/OrderList';
import LandingPage from './components/LandingPage';
import AuthCallback from './components/AuthCallback';
import { ThemeProvider } from './contexts/ThemeContext';

const App: React.FC = () => {
  const { token } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Check if we have a token from our callback handler
    const authToken = (window as any).__AUTH_TOKEN__;
    if (authToken && !token) {
      // We have a token from the callback but not in Redux state, so dispatch login
      dispatch(login(authToken));
      // Clear the global variable after using it
      delete (window as any).__AUTH_TOKEN__;
    }
  }, [dispatch, token]);

  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={!token ? <LandingPage /> : <Navigate to="/" />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/"
          element={token ? <Layout /> : <Navigate to="/login" />}
        >
          <Route index element={<Dashboard />} />
          <Route path="campaigns" element={<CampaignList />} />
          <Route path="customers" element={<CustomerList />} />
          <Route path="segments" element={<SegmentList />} />
          <Route path="orders" element={<OrderList />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
};

export default App; 
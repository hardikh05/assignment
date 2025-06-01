import axios from 'axios';

// Configure axios defaults
axios.defaults.baseURL = (process.env['REACT_APP_API_URL'] || 'http://localhost:5000') + '/api';

// Add a request interceptor
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login if it's a 401 error and we're not already on the login page
    if (error.response?.status === 401 && window.location.pathname !== '/') {
      // Clear token and redirect to login page (root route)
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default axios; 
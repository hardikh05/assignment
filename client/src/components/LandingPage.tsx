import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Grid,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import CampaignIcon from '@mui/icons-material/Campaign';
import PeopleIcon from '@mui/icons-material/People';
import SegmentIcon from '@mui/icons-material/Segment';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleGoogleLogin = async () => {
    try {
      window.location.href = `${process.env['REACT_APP_API_URL'] || ''}/api/auth/google`;
    } catch (err) {
      console.error('Google login error:', err);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #5e35b1 0%, #00bcd4 100%)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h5" fontWeight="bold" color="white" sx={{ pl: 3 }}>
          ECHO
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleGoogleLogin}
          startIcon={<GoogleIcon />}
          sx={{
            borderRadius: '24px',
            px: 3,
            backgroundColor: 'white',
            color: theme.palette.primary.main,
            '&:hover': {
              backgroundColor: '#f5f5f5',
            },
          }}
        >
          Sign in with Google
        </Button>
      </Box>

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ mt: isMobile ? 4 : 8, mb: 8 }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box>
              <Typography
                variant={isMobile ? 'h3' : 'h2'}
                fontWeight="bold"
                color="white"
                gutterBottom
              >
                Supercharge Your Marketing Campaigns
              </Typography>
              <Typography
                variant="h6"
                color="rgba(255, 255, 255, 0.9)"
                paragraph
                sx={{ mb: 4 }}
              >
                Manage customers, create segments, and launch targeted campaigns with our powerful marketing platform.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleGoogleLogin}
                startIcon={<GoogleIcon />}
                sx={{
                  borderRadius: '28px',
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  backgroundColor: 'white',
                  color: theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: '#f5f5f5',
                  },
                }}
              >
                Get Started Now
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper
              elevation={10}
              sx={{
                borderRadius: '16px',
                overflow: 'hidden',
                transform: 'perspective(1500px) rotateY(-15deg)',
                transition: 'transform 0.3s ease-in-out',
                '&:hover': {
                  transform: 'perspective(1500px) rotateY(-5deg)',
                },
              }}
            >
              <Box
                component="img"
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
                alt="Dashboard Preview"
                sx={{
                  width: '100%',
                  height: 'auto',
                }}
              />
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        <Typography
          variant="h4"
          fontWeight="bold"
          color="white"
          align="center"
          gutterBottom
          sx={{ mb: 6 }}
        >
          Powerful Features
        </Typography>
        <Grid container spacing={4}>
          {[
            {
              icon: <CampaignIcon sx={{ fontSize: 48 }} />,
              title: 'Smart Campaigns',
              description:
                'Create highly targeted marketing messages that personalize content for each customer segment.',
            },
            {
              icon: <PeopleIcon sx={{ fontSize: 48 }} />,
              title: 'Customer Management',
              description:
                'Organize and manage your customer database with powerful filtering and segmentation tools.',
            },
            {
              icon: <SegmentIcon sx={{ fontSize: 48 }} />,
              title: 'Smart Segmentation',
              description:
                'Group customers based on behavior, demographics, and purchase history to create targeted campaigns.',
            },
            {
              icon: <ShoppingCartIcon sx={{ fontSize: 48 }} />,
              title: 'Order Tracking',
              description:
                'Monitor customer orders and use purchase data to inform your marketing strategies and campaigns.',
            },
          ].map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Paper
                elevation={4}
                sx={{
                  p: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  borderRadius: '16px',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                  },
                }}
              >
                <Box
                  sx={{
                    mb: 2,
                    p: 2,
                    borderRadius: '50%',
                    backgroundColor: theme.palette.primary.main,
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {feature.icon}
                </Box>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Footer */}
      <Box
        sx={{
          p: 4,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          mt: 'auto',
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" color="white" align="center">
            © {new Date().getFullYear()} ECHO. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;

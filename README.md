# ECHO - AI-Powered Marketing Platform

ECHO is a cutting-edge marketing automation platform that helps businesses create, manage, and optimize their marketing campaigns with AI-powered insights and automation.

## Key Features

- **Secure Authentication**
  - Google OAuth 2.0 login
  - Role-based access control

- **Customer Segmentation**
  - Dynamic customer segmentation
  - Advanced filtering and targeting
  - Real-time customer data analysis

- **Campaign Management**
  - Create and schedule marketing campaigns
  - Track campaign performance
  - Real-time engagement analytics

- **AI-Powered Capabilities**
  - AI-generated campaign messages
  - Smart content suggestions
  - Performance predictions
  - Automated customer insights

## Tech Stack

- **Frontend**
  - React.js with TypeScript
  - Material-UI (MUI) for components
  - Redux for state management
  - React Router for navigation

- **Backend**
  - Node.js with Express
  - TypeScript for type safety
  - RESTful API architecture

- **Database**
  - MongoDB for flexible data storage
  - Mongoose for schema modeling

- **AI Integration**
  - OpenAI API for AI features
  - Custom prompt engineering

- **Authentication**
  - Google OAuth 2.0
  - JWT for session management

## Project Structure

```
echo-platform/
├── client/                 # React frontend application
│   ├── public/             # Static assets
│   └── src/                # Source code
│       ├── components/     # Reusable UI components
│       ├── store/          # Redux store and slices
│       ├── types/          # TypeScript type definitions
│       └── App.tsx         # Main application component
│
├── server/                # Node.js backend
│   ├── src/
│   │   ├── config/      # Configuration files
│   │   ├── controllers/   # Request handlers
│   │   ├── models/       # Database models
│   │   ├── routes/       # API routes
│   │   └── utils/        # Utility functions
│   └── .env              # Environment variables
│
└── README.md             # Project documentation
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or Atlas)
- Google Cloud Platform account (for OAuth)
- OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd echo-platform
   ```

2. Install dependencies:
   ```bash
   # Install backend dependencies
   cd server
   npm install
   
   # Install frontend dependencies
   cd ../client
   npm install
   ```

3. Set up environment variables:
   - Create `.env` files in both `client` and `server` directories
   - Configure your environment variables (see `.env.example` for reference)

4. Start the development servers:
   ```bash
   # In the server directory
   npm run dev
   
   # In a new terminal, from the client directory
   npm start
   ```

   The application will be available at `http://localhost:3000`

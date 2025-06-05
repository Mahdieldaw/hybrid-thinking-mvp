# Web Application

## Overview

The Hybrid Thinking web application provides a user-friendly interface for interacting with the platform's intelligence orchestration capabilities. It enables users to run hybrid prompts across multiple AI models, manage workflows, and view results in real-time.

## Features

- Real-time dashboard for model coordination
- Workflow creation and management
- Hybrid prompt execution
- Model provider credential management
- Result visualization and comparison
- User authentication and profile management

## Architecture

The web application is built using React, Redux, and Socket.io, following a modern frontend architecture:

```
web-app/
├── public/             # Static assets
├── src/
│   ├── components/     # React components
│   ├── pages/          # Page components
│   ├── store/          # Redux store
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API services
│   ├── utils/          # Utility functions
│   └── App.tsx         # Main application component
├── package.json
└── tsconfig.json
```

## Technology Stack

- **React**: UI library
- **Redux Toolkit**: State management
- **Socket.io**: Real-time communication
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **React Router**: Routing
- **React Query**: Data fetching and caching

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Hybrid Thinking backend services running

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/hybrid-thinking.git

# Navigate to the web app directory
cd hybrid-thinking/apps/web-app

# Install dependencies
npm install
```

### Development

```bash
# Start the development server
npm run dev

# The app will be available at http://localhost:3000
```

### Building for Production

```bash
# Build the app
npm run build

# Preview the production build
npm run preview
```

## Application Structure

### Pages

The application includes the following main pages:

- **Dashboard**: Overview of recent jobs and workflows
- **Hybrid Prompt**: Interface for running hybrid prompts
- **Workflows**: Workflow management interface
- **Results**: Detailed view of job results
- **Settings**: User and model provider settings
- **Profile**: User profile management

### Components

Key components include:

- **ModelSelector**: Component for selecting models
- **PromptEditor**: Rich text editor for prompts
- **ResultsViewer**: Component for viewing and comparing results
- **WorkflowEditor**: YAML editor for workflows
- **ModelProviderSettings**: Interface for managing model provider credentials

### State Management

The application uses Redux Toolkit for state management:

```typescript
// Store configuration
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import jobsReducer from './slices/jobsSlice';
import workflowsReducer from './slices/workflowsSlice';
import providersReducer from './slices/providersSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    jobs: jobsReducer,
    workflows: workflowsReducer,
    providers: providersReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### WebSocket Integration

The application uses Socket.io for real-time updates:

```typescript
// WebSocket service
import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { addJob, updateJob, updateModelResult, setJobComplete } from '../store/slices/jobsSlice';

let socket: Socket | null = null;

export const connectWebSocket = (token: string) => {
  if (socket) {
    socket.disconnect();
  }
  
  socket = io(process.env.REACT_APP_WS_URL || 'wss://api.hybridthinking.ai/v1/ws', {
    query: { token },
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity
  });
  
  socket.on('connect', () => {
    console.log('Connected to WebSocket');
  });
  
  socket.on('job:started', (data) => {
    store.dispatch(addJob(data.payload));
  });
  
  socket.on('job:model:result', (data) => {
    store.dispatch(updateModelResult(data.payload));
  });
  
  socket.on('job:complete', (data) => {
    store.dispatch(setJobComplete(data.payload));
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket');
  });
  
  return socket;
};

export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const sendWebSocketMessage = (type: string, payload: any) => {
  if (!socket || !socket.connected) {
    throw new Error('WebSocket not connected');
  }
  
  socket.emit(type, {
    type,
    payload,
    timestamp: new Date().toISOString()
  });
};
```

## Authentication

The application uses JWT for authentication:

```typescript
// Auth service
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../services/api';
import { connectWebSocket, disconnectWebSocket } from '../services/websocket';

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { token, user } = response.data;
      
      // Store token in local storage
      localStorage.setItem('token', token);
      
      // Connect WebSocket
      connectWebSocket(token);
      
      return { token, user };
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Login failed' });
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    // Remove token from local storage
    localStorage.removeItem('token');
    
    // Disconnect WebSocket
    disconnectWebSocket();
    
    return null;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: localStorage.getItem('token') || null,
    user: null,
    loading: false,
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.token = null;
        state.user = null;
      });
  }
});

export default authSlice.reducer;
```

## API Integration

The application uses Axios for API requests:

```typescript
// API service
import axios from 'axios';

const baseURL = process.env.REACT_APP_API_URL || 'https://api.hybridthinking.ai/v1';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## Responsive Design

The application is fully responsive, supporting desktop, tablet, and mobile devices:

```typescript
// Responsive component example
import { useMediaQuery } from '../hooks/useMediaQuery';

const ResponsiveComponent = () => {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(min-width: 641px) and (max-width: 1024px)');
  
  return (
    <div className={`container ${isMobile ? 'mobile' : ''} ${isTablet ? 'tablet' : ''}`}>
      {isMobile ? (
        <MobileView />
      ) : isTablet ? (
        <TabletView />
      ) : (
        <DesktopView />
      )}
    </div>
  );
};
```

## Theming and Styling

The application uses Tailwind CSS with a customizable theme:

```typescript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          // ...other shades
          900: '#0c4a6e'
        },
        secondary: {
          // ...color shades
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace']
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ]
};
```

## Testing

The application includes comprehensive tests:

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

Test structure:

```
__tests__/
├── unit/
│   ├── components/
│   ├── hooks/
│   └── slices/
├── integration/
│   └── pages/
└── e2e/
    └── cypress/
```

## Deployment

The application can be deployed using various methods:

### Static Hosting

```bash
# Build the app
npm run build

# Deploy to static hosting (e.g., Netlify, Vercel)
# The build output will be in the dist/ directory
```

### Docker

```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

## Environment Variables

The application uses environment variables for configuration:

```
# .env.example
REACT_APP_API_URL=https://api.hybridthinking.ai/v1
REACT_APP_WS_URL=wss://api.hybridthinking.ai/v1/ws
REACT_APP_AUTH_DOMAIN=auth.hybridthinking.ai
REACT_APP_VERSION=$npm_package_version
```

## Future Enhancements

[TODO: Define specific enhancements for the web application]

1. **Workflow Templates**: Library of pre-built workflow templates
2. **Advanced Visualization**: Enhanced visualization of model comparisons
3. **Collaborative Features**: Real-time collaboration on workflows
4. **Offline Support**: Progressive Web App features for offline usage

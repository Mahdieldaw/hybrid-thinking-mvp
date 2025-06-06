import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowEngine, ClaudeAdapter, GeminiAdapter, ChatGPTBrowserAdapter, InMemoryAdapterRegistry } from '@hybrid-thinking/engine';
import { initializeDatabase } from './database'; // Assuming database.ts sets up and returns db
import { TokenVaultService } from './services/TokenVaultService';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000', // Allow React dev server
    methods: ['GET', 'POST']
  }
});

app.use(express.json());

// Basic JWT validation (replace with a robust solution)
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secret-key'; // Use environment variable in production

const validateJWT = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7, authHeader.length);
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        return res.sendStatus(403); // Forbidden
      }
      // req.user = user; // Attach user to request if needed
      next();
    });
  } else {
    res.sendStatus(401); // Unauthorized
  }
};

// Token Management Routes
app.post('/api/v1/tokens', validateJWT, async (req, res) => {
  try {
    const { userId, providerId, credentialType, credentials, encryptionKey } = req.body;
    if (!userId || !providerId || !credentialType || !credentials || !encryptionKey) {
      return res.status(400).json({ error: 'Missing required token fields or encryptionKey' });
    }
    await tokenVaultService.storeToken(userId, providerId, credentialType, credentials, encryptionKey);
    res.json({ status: 'success', message: 'Token stored successfully' });
  } catch (error: any) {
    console.error('Error storing token:', error);
    res.status(500).json({ error: 'Failed to store token', details: error.message });
  }
});


interface TokenSummary {
  providerId: string;
  type: string;
  isValid: boolean;
  lastChecked?: string;
}

app.get('/api/v1/tokens', validateJWT, async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const encryptionKey = req.query.encryptionKey as string; // Key must be passed to decrypt
    if (!userId || !encryptionKey) {
      return res.status(400).json({ error: 'User ID and encryptionKey are required' });
    }
    const tokens = await tokenVaultService.listTokens(userId, encryptionKey);
    const tokenSummaries: TokenSummary[] = tokens.map(token => ({
      providerId: token.providerId,
      type: token.credentialType,
      isValid: token.isValid, // Assuming listTokens might return this, or you'd infer it
      lastChecked: token.lastChecked?.toISOString() // Assuming lastChecked is a Date
    }));
    res.json({ tokens: tokenSummaries });
  } catch (error: any) {
    console.error('Error listing tokens:', error);
    res.status(500).json({ error: 'Failed to list tokens', details: error.message });
  }
});


app.delete('/api/v1/tokens/:providerId', validateJWT, async (req, res) => {
  try {
    const { providerId } = req.params;
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    await tokenVaultService.deleteToken(userId, providerId);
    res.status(200).json({ status: 'success', message: 'Token deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting token:', error);
    res.status(500).json({ error: 'Failed to delete token', details: error.message });
  }
});


// Prompt Execution Routes
app.post('/api/v1/run-prompt', validateJWT, async (req, res) => {
  try {
    const { userId, promptText, requestedModels, executionMode, callbackUrl, encryptionKey } = req.body;
    if (!userId || !promptText || !requestedModels || !encryptionKey) {
      return res.status(400).json({ error: 'Missing required fields for running prompt or encryptionKey' });
    }
    const jobId = uuidv4();
    // Asynchronously run the prompt, don't await here for HTTP endpoint
    workflowEngine.runHybridPrompt(userId, promptText, requestedModels, jobId, encryptionKey)
      .then(jobResult => {
        // Optionally, if a callbackUrl is provided, notify it.
        // For WebSocket, the client is already listening.
        console.log(`Job ${jobId} completed via HTTP request.`);
        if (callbackUrl) {
          // fetch(callbackUrl, { method: 'POST', body: JSON.stringify(jobResult) });
        }
      })
      .catch(error => {
        console.error(`Error in background job ${jobId} initiated by HTTP:`, error);
        // Potentially log this error more permanently
      });

    res.json({ jobId, status: 'processing_started' });
  } catch (error: any) {
    console.error('Error initiating prompt run:', error);
    res.status(500).json({ error: 'Failed to start prompt execution', details: error.message });
  }
});


app.get('/api/v1/jobs/:jobId', validateJWT, async (req, res) => {
  try {
    const { jobId } = req.params;
    // This would ideally fetch from a persistent job store (e.g., PromptLogs)
    // For now, if workflowEngine keeps state or logs, we might query it, or just return a placeholder
    const jobState = await workflowEngine.getJobState(jobId); // Assuming WorkflowEngine has such a method
    if (jobState) {
      res.json(jobState);
    } else {
      res.status(404).json({ error: 'Job not found' });
    }
  } catch (error: any) {
    console.error('Error fetching job state:', error);
    res.status(500).json({ error: 'Failed to fetch job state', details: error.message });
  }
});


// WebSocket Event Handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('job:run:prompt', async (data: { userId: string; promptText: string; requestedModels: string[]; encryptionKey: string; }) => {
    const jobId = uuidv4();
    try {
      const { userId, promptText, requestedModels, encryptionKey } = data;
      if (!userId || !promptText || !requestedModels || !encryptionKey) {
        socket.emit('job:error', {
            jobId,
            message: 'Missing required fields for running prompt or encryptionKey',
            error: { code: 'BAD_REQUEST' }
        });
        return;
      }

      console.log(`[Socket ${socket.id}] Received job:run:prompt for user ${userId}, job ID ${jobId}`);
      socket.emit('job:status:update', { jobId, status: 'received', message: 'Job received by gateway.' });

      // No need to await here, runHybridPrompt handles its own async operations and emits events
      workflowEngine.runHybridPrompt(userId, promptText, requestedModels, jobId, encryptionKey, socket)
        .then(finalState => {
          // This .then() might be redundant if runHybridPrompt already emits job:completed
          // but can be a final confirmation or for logging.
          console.log(`[Socket ${socket.id}] Job ${jobId} processing finished by WorkflowEngine.`);
        })
        .catch(error => {
          // This catch is for errors during the *initiation* or unhandled errors within runHybridPrompt
          console.error(`[Socket ${socket.id}] Critical error for job ${jobId}:`, error);
          socket.emit('job:error', {
            jobId,
            message: 'Critical error during prompt execution.',
            error: { code: 'WORKFLOW_ENGINE_FAILURE', details: error.message }
          });
        });

    } catch (error: any) {
      // Catch synchronous errors in this handler
      console.error(`[Socket ${socket.id}] Synchronous error in job:run:prompt handler for job ${jobId}:`, error);
      socket.emit('job:error', {
        jobId,
        message: 'Failed to initiate prompt processing due to an internal server error.',
        error: { code: 'GATEWAY_HANDLER_ERROR', details: error.message }
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Server Startup
const PORT = process.env.PORT || 4000;

let tokenVaultService: TokenVaultService;
let workflowEngine: WorkflowEngine;

async function startServer() {
  try {
    const db = await initializeDatabase(); // Initialize DB first
    console.log('Database initialized successfully.');

    tokenVaultService = new TokenVaultService(db);
    console.log('TokenVaultService initialized.');

    // Initialize Adapter Registry
    const adapterRegistry = new InMemoryAdapterRegistry();
    // Adapters will be registered dynamically or based on config/credentials
    // For now, let's assume they might be added if credentials are found or on demand.
    // Example: if (process.env.CLAUDE_API_KEY) adapterRegistry.registerAdapter(new ClaudeAdapter(process.env.CLAUDE_API_KEY));
    //          if (process.env.GEMINI_API_KEY) adapterRegistry.registerAdapter(new GeminiAdapter(process.env.GEMINI_API_KEY));
    // The WorkflowEngine will use the TokenVaultService to get API keys when needed.

    workflowEngine = new WorkflowEngine(adapterRegistry, tokenVaultService, db);
    console.log('WorkflowEngine initialized.');

    httpServer.listen(PORT, () => {
      console.log(`API Gateway running on http://localhost:${PORT}`);
      console.log(`WebSocket server listening on ws://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start the API Gateway:', error);
    process.exit(1);
  }
}

startServer();

// Placeholder for TokenVaultService event handling if needed via io
// Example: tokenVaultService.on('tokenRefreshed', ({ userId, providerId }) => {
//   const userSocket = findSocketByUserId(userId); // You'd need a way to map userId to socket
//   if (userSocket) userSocket.emit('token:status', { providerId, status: 'refreshed' });
// });

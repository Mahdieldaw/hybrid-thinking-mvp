import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

function verifyJWT(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = auth.split(' ')[1];
  try {
    // [TODO: Use your JWT secret]
    (req as any).user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/tokens', verifyJWT, (req: Request, res: Response) => {
  // [TODO: implement handler]
  res.status(501).json({ error: 'Not implemented' });
});

app.get('/tokens/:providerId', verifyJWT, (req: Request, res: Response) => {
  // [TODO: implement handler]
  res.status(501).json({ error: 'Not implemented' });
});

app.delete('/tokens/:providerId', verifyJWT, (req: Request, res: Response) => {
  // [TODO: implement handler]
  res.status(501).json({ error: 'Not implemented' });
});

app.post('/run-hybrid', verifyJWT, (req: Request, res: Response) => {
  // [TODO: implement handler]
  res.status(501).json({ error: 'Not implemented' });
});

app.get('/jobs/:jobId', verifyJWT, (req: Request, res: Response) => {
  // [TODO: implement handler]
  res.status(501).json({ error: 'Not implemented' });
});

app.get('/jobs', verifyJWT, (req: Request, res: Response) => {
  // [TODO: implement handler]
  res.status(501).json({ error: 'Not implemented' });
});

app.post('/webhook', verifyJWT, (req: Request, res: Response) => {
  // [TODO: implement handler]
  res.status(501).json({ error: 'Not implemented' });
});

export default app;

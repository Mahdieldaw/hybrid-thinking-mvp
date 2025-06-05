"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
function verifyJWT(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = auth.split(' ')[1];
    try {
        // [TODO: Use your JWT secret]
        req.user = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
        next();
    }
    catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
app.post('/tokens', verifyJWT, (req, res) => {
    // [TODO: implement handler]
    res.status(501).json({ error: 'Not implemented' });
});
app.get('/tokens/:providerId', verifyJWT, (req, res) => {
    // [TODO: implement handler]
    res.status(501).json({ error: 'Not implemented' });
});
app.delete('/tokens/:providerId', verifyJWT, (req, res) => {
    // [TODO: implement handler]
    res.status(501).json({ error: 'Not implemented' });
});
app.post('/run-hybrid', verifyJWT, (req, res) => {
    // [TODO: implement handler]
    res.status(501).json({ error: 'Not implemented' });
});
app.get('/jobs/:jobId', verifyJWT, (req, res) => {
    // [TODO: implement handler]
    res.status(501).json({ error: 'Not implemented' });
});
app.get('/jobs', verifyJWT, (req, res) => {
    // [TODO: implement handler]
    res.status(501).json({ error: 'Not implemented' });
});
app.post('/webhook', verifyJWT, (req, res) => {
    // [TODO: implement handler]
    res.status(501).json({ error: 'Not implemented' });
});
exports.default = app;

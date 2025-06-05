// services/socket.ts
import { io } from 'socket.io-client';

const socket = io('ws://localhost:4000'); // [TODO: replace with env/config if needed]

export default socket;

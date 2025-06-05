import { Server } from 'socket.io';

export function setupWebSocket(server: any) {
  const io = new Server(server, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    socket.on('job:run:prompt', (data) => {
      // [TODO: implement handler]
    });
    socket.on('job:run:workflow', (data) => {
      // [TODO: implement handler]
    });
    socket.on('extension:run_prompt', (data) => {
      // [TODO: implement handler]
    });
    socket.on('extension:health_check', (data) => {
      // [TODO: implement handler]
    });
  });
}

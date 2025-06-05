"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocket = void 0;
const socket_io_1 = require("socket.io");
function setupWebSocket(server) {
    const io = new socket_io_1.Server(server, {
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
exports.setupWebSocket = setupWebSocket;

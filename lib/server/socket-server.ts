import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { ActivityLog } from './mongodb-activity';

let io: SocketServer | null = null;

export function initSocketServer(server: HttpServer) {
    io = new SocketServer(server, {
        cors: {
            origin: '*', // Adjust this for production
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] 🔌 Client connected: ${socket.id}`);

        socket.on('disconnect', () => {
            console.log(`[Socket] 🔌 Client disconnected: ${socket.id}`);
        });
    });

    console.log('[Socket] ✅ Socket.io server initialized');
    return io;
}

export function getSocketIO(): SocketServer | null {
    return io;
}

export function emitActivity(activity: ActivityLog | (Omit<ActivityLog, 'timestamp'> & { timestamp: Date })) {
    if (io) {
        const connectedClients = io.sockets.sockets.size;
        console.log(`[Socket] 📡 Emitting activity event to ${connectedClients} clients: ${activity.type} - ${activity.message}`);
        io.emit('activity', activity);
    } else {
        console.warn('[Socket] ⚠️  Cannot emit activity - Socket.io not initialized');
    }
}

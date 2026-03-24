import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Join a campaign room for live updates
    socket.on('join:campaign', (campaignId: string) => {
      socket.join(`campaign:${campaignId}`);
      console.log(`[Socket.io] ${socket.id} joined campaign:${campaignId}`);
    });

    socket.on('leave:campaign', (campaignId: string) => {
      socket.leave(`campaign:${campaignId}`);
    });

    // Join dashboard room for global stats
    socket.on('join:dashboard', () => {
      socket.join('dashboard');
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

// Emit campaign progress during send
export function emitCampaignProgress(campaignId: string, data: {
  totalAudience: number;
  sent: number;
  delivered: number;
  failed: number;
  progress: number; // 0-100
  status: string;
}) {
  if (io) {
    io.to(`campaign:${campaignId}`).emit('campaign:progress', { campaignId, ...data });
    io.to('dashboard').emit('campaign:progress', { campaignId, ...data });
  }
}

// Emit when campaign completes
export function emitCampaignComplete(campaignId: string, stats: any) {
  if (io) {
    io.to(`campaign:${campaignId}`).emit('campaign:complete', { campaignId, stats });
    io.to('dashboard').emit('campaign:complete', { campaignId, stats });
  }
}

// Emit general dashboard stats update
export function emitDashboardUpdate(data: any) {
  if (io) {
    io.to('dashboard').emit('dashboard:update', data);
  }
}

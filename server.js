// server.js
import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = username;
    socket.to(roomId).emit('userJoined', username);
  });

  socket.on('message', ({ roomId, text, userId, username }) => {
    const payload = {
      id: Date.now().toString(),
      text,
      timestamp: new Date().toISOString(),
      userId,
      username,
    };
    io.to(roomId).emit('message', payload);
  });

  socket.on('leaveRoom', ({ roomId }) => {
    socket.leave(roomId);
    const username = socket.data.username;
    if (username) {
      socket.to(roomId).emit('userLeft', username);
    }
    if (socket.data.roomId === roomId) {
      socket.data.roomId = null;
    }
  });

  socket.on('disconnect', () => {
    const { roomId, username } = socket.data || {};
    if (roomId && username) {
      socket.to(roomId).emit('userLeft', username);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});

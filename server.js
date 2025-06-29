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

const reportCounts = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = username;
    socket.to(roomId).emit('userJoined', username);
  });


  socket.on('message', ({ roomId, text, userId, username, image, codeSnippet }) => {
    const payload = {
      id: Date.now().toString(),
      text,
      timestamp: new Date().toISOString(),
      userId,
      username,
      image,
      codeSnippet,
      reactions: {}
    };
    io.to(roomId).emit('message', payload);
  });

  socket.on('reaction', ({ roomId, messageId, emoji, userId }) => {
    io.to(roomId).emit('reaction', { messageId, emoji, userId });
  });

  socket.on('reportMessage', ({ roomId, messageId }) => {
    reportCounts[messageId] = (reportCounts[messageId] || 0) + 1;
    if (reportCounts[messageId] >= 3) {
      io.to(roomId).emit('messageRemoved', { messageId });
    }
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

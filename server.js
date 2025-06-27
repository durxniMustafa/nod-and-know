const { createServer } = require('http');
const { Server } = require('socket.io');

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  let currentRoom = null;
  let username = socket.handshake.query.username || 'Anon';

  socket.on('join', ({ roomId, username: name }) => {
    currentRoom = roomId;
    username = name || username;
    socket.join(roomId);
    socket.to(roomId).emit('user_joined', username);
  });

  socket.on('message', ({ roomId, message }) => {
    io.to(roomId).emit('message', message);
  });

  socket.on('leave', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user_left', username);
    currentRoom = null;
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      socket.to(currentRoom).emit('user_left', username);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

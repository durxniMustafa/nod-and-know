// server.js
import { createServer } from 'http';
import { Server } from 'socket.io';
import OpenAI from 'openai';

const httpServer = createServer();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  socket.on('message', async ({ roomId, text, userId, username }) => {
    const payload = {
      id: Date.now().toString(),
      text,
      timestamp: new Date().toISOString(),
      userId,
      username,
    };
    io.to(roomId).emit('message', payload);

    if (text && text.includes('@AI')) {
      const question = text.replace('@AI', '').trim();
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a helpful assistant focused on security best practices.' },
            { role: 'user', content: question },
          ],
          max_tokens: 200,
        });
        const aiPayload = {
          id: Date.now().toString(),
          text: completion.choices[0]?.message?.content?.trim() || 'I could not generate a response.',
          timestamp: new Date().toISOString(),
          userId: 'bot',
          username: 'SecurityBot',
        };
        io.to(roomId).emit('message', aiPayload);
      } catch (err) {
        console.error('OpenAI error:', err);
      }
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

// server.js
import { createServer } from 'http';
import { Server } from 'socket.io';

// Simple wrapper to call DeepSeek's chat API
async function callDeepSeek(prompt) {
  const apiKey = "sk-ec21af60d61d4325a27680ce6721f4f2"
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY environment variable not set');
  }

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API error: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, username, topic }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = username;
    socket.data.topic = topic;
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

    if (text.trim().startsWith('@ai')) {
      const prompt = text.replace(/^@ai\s*/, '') ||
        `Tell me more about: ${socket.data.topic || ''}`;
      try {
        const reply = await callDeepSeek(prompt);
        const aiPayload = {
          id: Date.now().toString() + '_ai',
          text: reply,
          timestamp: new Date().toISOString(),
          userId: 'deepseek',
          username: 'AI Assistant',
        };
        io.to(roomId).emit('message', aiPayload);
      } catch (err) {
        console.error(err);
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

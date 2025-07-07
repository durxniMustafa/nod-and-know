// server.js
import { createServer } from 'http';
import { Server } from 'socket.io';

// Simple wrapper to call DeepSeek's chat API with context messages
async function callDeepSeek(messages) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
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
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API error: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';

  try {
    const parsed = JSON.parse(content);
    return {
      answer: parsed.answer || '',
      followUp: Array.isArray(parsed.follow_up) ? parsed.follow_up : [],
    };
  } catch {
    return { answer: content, followUp: [] };
  }
}

const httpServer = createServer();

// Store recent chat history per room for better AI context
const chatHistory = {};

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

    // Track conversation history for AI context
    if (!chatHistory[roomId]) chatHistory[roomId] = [];
    chatHistory[roomId].push({ role: 'user', content: text });
    chatHistory[roomId] = chatHistory[roomId].slice(-10);

    if (text.trim().startsWith('@ai')) {
      const userPrompt = text.replace(/^@ai\s*/, '') ||
        `Tell me more about: ${socket.data.topic || ''}`;
      try {
        const history = chatHistory[roomId] || [];
        const messages = [
          { role: 'system', content: 'You are a helpful security assistant. Answer the user question concisely and provide two short follow-up questions in JSON: {"answer": "...", "follow_up": ["q1", "q2"]}' },
          ...history,
          { role: 'user', content: userPrompt },
        ];
        const reply = await callDeepSeek(messages);
        chatHistory[roomId].push({ role: 'assistant', content: reply.answer });
        chatHistory[roomId] = chatHistory[roomId].slice(-10);
        const aiPayload = {
          id: Date.now().toString() + '_ai',
          text: reply.answer,
          followUp: reply.followUp,
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

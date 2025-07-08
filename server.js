// server.js
import { createServer } from 'http';
import { Server } from 'socket.io';

// ANSI color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

// Helper function for formatted logging
function log(type, message, data = '') {
  const timestamp = new Date().toLocaleTimeString();
  const typeColors = {
    info: colors.blue,
    success: colors.green,
    warning: colors.yellow,
    error: colors.red,
    ai: colors.cyan,
  };

  console.log(
    `${colors.bright}[${timestamp}]${colors.reset} ${typeColors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`,
    data
  );
}

// Simple wrapper to call DeepSeek's chat API with context messages
async function callDeepSeek(messages) {
  const apiKey = process.env.DEEPSEEK_API_KEY || "";
  if (!apiKey) {
    throw new Error('DeepSeek API key not configured. Please set DEEPSEEK_API_KEY environment variable.');
  }

  log('ai', '🤖 Sending request to DeepSeek AI...');

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
    log('error', `DeepSeek API returned error: ${res.status}`, text);
    throw new Error(`DeepSeek API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';

  try {
    const parsed = JSON.parse(content);
    log('ai', '✅ AI response received successfully');
    return {
      answer: parsed.answer || content,
      followUp: Array.isArray(parsed.follow_up) ? parsed.follow_up : [],
    };
  } catch {
    log('warning', '⚠️  AI response not in expected JSON format, using plain text');
    // Try to extract content if it looks like it might have JSON structure
    const answerMatch = content.match(/"answer":\s*"([^"]+)"/);
    if (answerMatch) {
      return { answer: answerMatch[1], followUp: [] };
    }
    return { answer: content, followUp: [] };
  }
}

const httpServer = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url && req.url.startsWith('/ai-answer')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const question = url.searchParams.get('q');

    log('info', `📥 HTTP AI request received: ${question?.substring(0, 50)}${question?.length > 50 ? '...' : ''}`);

    if (!question) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Please provide a question parameter (?q=your-question)' }));
      log('warning', '⚠️  AI request rejected: Missing question parameter');
      return;
    }

    try {
      const answer = await callDeepSeek([
        { role: 'user', content: `Answer concisely and clearly: ${question}` }
      ]);

      // Format the response for HTTP endpoint
      let formattedResponse = {
        answer: answer.answer,
        timestamp: new Date().toISOString()
      };

      if (answer.followUp && answer.followUp.length > 0) {
        formattedResponse.suggestions = answer.followUp;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(formattedResponse, null, 2));
      log('success', '✨ AI answer delivered successfully');
    } catch (err) {
      log('error', '❌ AI request failed:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Unable to process your request. Please try again later.',
        details: err.message
      }));
    }
    return;
  }
  res.writeHead(404);
  res.end();
});

// Store recent chat history per room for better AI context
const chatHistory = {};
const activeRooms = new Map(); // Track active rooms and participants

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  log('info', `🔌 New connection established: ${socket.id}`);

  socket.on('joinRoom', ({ roomId, username, topic }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = username;
    socket.data.topic = topic;

    // Track room participants
    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Set());
    }
    activeRooms.get(roomId).add(username);

    socket.to(roomId).emit('userJoined', username);
    log('success', `👋 ${username} joined room: ${roomId} (Topic: ${topic || 'General Chat'})`);
    log('info', `👥 Room ${roomId} now has ${activeRooms.get(roomId).size} participants`);
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
    log('info', `💬 [${roomId}] ${username}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);

    // Track conversation history for AI context
    if (!chatHistory[roomId]) chatHistory[roomId] = [];
    chatHistory[roomId].push({ role: 'user', content: `${username}: ${text}` });
    chatHistory[roomId] = chatHistory[roomId].slice(-10); // Keep last 10 messages

    // Handle AI mentions
    if (text.trim().toLowerCase().startsWith('@ai')) {
      log('ai', `🤖 AI assistance requested in room ${roomId}`);

      const userPrompt = text.replace(/^@ai\s*/i, '').trim() ||
        `Tell me more about: ${socket.data.topic || 'this topic'}`;

      try {
        const history = chatHistory[roomId] || [];
        const messages = [
          {
            role: 'system',
            content: 'You are a helpful security assistant in a chat room. Provide clear, conversational answers. Always respond in this exact JSON format: {"answer": "your helpful response here", "follow_up": ["relevant question 1", "relevant question 2"]}. Keep your main answer concise but informative. Make follow-up questions engaging and relevant to the topic.'
          },
          ...history.slice(-5), // Include last 5 messages for context
          { role: 'user', content: userPrompt },
        ];

        const reply = await callDeepSeek(messages);

        // Add AI response to history
        chatHistory[roomId].push({ role: 'assistant', content: reply.answer });
        chatHistory[roomId] = chatHistory[roomId].slice(-10);

        // Format the AI response with follow-up questions
        let formattedText = reply.answer;

        // Add follow-up questions if available
        if (reply.followUp && reply.followUp.length > 0) {
          formattedText += '\n\n💡 **You might also want to know:**';
          reply.followUp.forEach((question, index) => {
            formattedText += `\n${index + 1}. ${question}`;
          });
        }

        const aiPayload = {
          id: Date.now().toString() + '_ai',
          text: formattedText,
          timestamp: new Date().toISOString(),
          userId: 'deepseek',
          username: '🤖 AI Assistant',
        };

        io.to(roomId).emit('message', aiPayload);
        log('ai', `✅ AI responded in room ${roomId}`);

        // Log follow-up questions if any
        if (reply.followUp && reply.followUp.length > 0) {
          log('ai', `💡 Suggested follow-ups: ${reply.followUp.join(' | ')}`);
        }
      } catch (err) {
        log('error', `❌ AI response failed in room ${roomId}:`, err.message);

        // Send error message to room
        const errorPayload = {
          id: Date.now().toString() + '_error',
          text: '⚠️ Sorry, I encountered an error processing your request. Please try again in a moment.',
          timestamp: new Date().toISOString(),
          userId: 'system',
          username: '🔧 System',
        };
        io.to(roomId).emit('message', errorPayload);
      }
    }
  });

  socket.on('leaveRoom', ({ roomId }) => {
    socket.leave(roomId);
    const username = socket.data.username;

    if (username && activeRooms.has(roomId)) {
      activeRooms.get(roomId).delete(username);
      if (activeRooms.get(roomId).size === 0) {
        activeRooms.delete(roomId);
        delete chatHistory[roomId]; // Clean up chat history
        log('info', `🧹 Room ${roomId} is now empty and has been cleaned up`);
      } else {
        log('info', `👥 Room ${roomId} now has ${activeRooms.get(roomId).size} participants`);
      }
      socket.to(roomId).emit('userLeft', username);
      log('info', `👋 ${username} left room: ${roomId}`);
    }

    if (socket.data.roomId === roomId) {
      socket.data.roomId = null;
    }
  });

  socket.on('disconnect', () => {
    const { roomId, username } = socket.data || {};
    if (roomId && username) {
      if (activeRooms.has(roomId)) {
        activeRooms.get(roomId).delete(username);
        if (activeRooms.get(roomId).size === 0) {
          activeRooms.delete(roomId);
          delete chatHistory[roomId];
          log('info', `🧹 Room ${roomId} is now empty and has been cleaned up`);
        }
      }
      socket.to(roomId).emit('userLeft', username);
      log('warning', `⚡ ${username} disconnected from room: ${roomId}`);
    } else {
      log('info', `🔌 Connection closed: ${socket.id}`);
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log('\n' + colors.bright + '═'.repeat(60) + colors.reset);
  log('success', `🚀 WebSocket server is running!`);
  log('info', `📡 Listening on port: ${PORT}`);
  log('info', `🌐 WebSocket endpoint: ws://localhost:${PORT}`);
  log('info', `🔗 HTTP AI endpoint: http://localhost:${PORT}/ai-answer?q=your-question`);
  log('info', `🤖 AI Provider: DeepSeek Chat`);
  log('info', `📊 Active rooms: ${activeRooms.size}`);
  console.log(colors.bright + '═'.repeat(60) + colors.reset + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('warning', '⚠️  Received SIGTERM, shutting down gracefully...');
  httpServer.close(() => {
    log('success', '✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('warning', '⚠️  Received SIGINT, shutting down gracefully...');
  httpServer.close(() => {
    log('success', '✅ Server closed successfully');
    process.exit(0);
  });
});
// server.js
import { createServer } from 'http';
import { Server } from 'socket.io';
import os from 'os';

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

// Simple cache for AI responses
const aiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCacheKey(prompt) {
  return Buffer.from(prompt.slice(-200)).toString('base64').slice(0, 32);
}

function getCachedResponse(key) {
  const cached = aiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  aiCache.delete(key);
  return null;
}

function setCachedResponse(key, data) {
  aiCache.set(key, { data, timestamp: Date.now() });
  // Clean old cache entries
  if (aiCache.size > 100) {
    const oldestKeys = Array.from(aiCache.keys()).slice(0, 20);
    oldestKeys.forEach(k => aiCache.delete(k));
  }
}

function isPrivate(ip) {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

function getServerIP() {
  const nets = os.networkInterfaces();
  let fallback = null;
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        if (isPrivate(net.address)) {
          return net.address;
        }
        if (!fallback) {
          fallback = net.address;
        }
      }
    }
  }
  return fallback || '127.0.0.1';
}

// Enhanced AI wrapper with better prompts and caching
async function callDeepSeek(messages, context = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY || "sk-68df5077e3264402b50a293e4f5b82da";
  if (!apiKey) {
    throw new Error('DeepSeek API key not configured');
  }

  // Create cache key from the last message
  const lastMessage = messages[messages.length - 1]?.content || '';
  const cacheKey = getCacheKey(lastMessage);

  // Check cache first
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    log('ai', '💾 Returning cached response');
    return cached;
  }

  log('ai', '🤖 Generating AI response...');
  const startTime = Date.now();

  // Enhanced system prompt for better responses
  const systemPrompt = {
    role: 'system',
    content: `You are a knowledgeable cybersecurity expert assistant in a live chat room discussing "${context.topic || 'security topics'}". 

Your responses should be:
- Conversational and engaging, like talking to a friend
- Practical and actionable when giving advice
- Educational but not overwhelming
- Include real-world examples when relevant
- Ask follow-up questions to encourage discussion

Always respond in this JSON format:
{
  "answer": "Your main response here (2-4 sentences max for chat)",
  "follow_up": ["Engaging follow-up question 1", "Engaging follow-up question 2"],
  "quick_tips": ["Quick tip 1", "Quick tip 2"] (optional, only for how-to questions)
}

Keep your main answer concise for chat flow, but make it valuable and specific.`
  };

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [systemPrompt, ...messages.slice(-5)], // Include system prompt + last 5 messages
        temperature: 0.8, // Slightly more creative
        max_tokens: 800,
        presence_penalty: 0.1, // Encourage diverse responses
        frequency_penalty: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log('error', `DeepSeek API error: ${response.status}`, errorText);
      throw new Error(`AI service unavailable (${response.status})`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    if (!content) {
      throw new Error('Empty response from AI');
    }

    const responseTime = Date.now() - startTime;
    log('ai', `✅ AI response generated in ${responseTime}ms`);

    let result;
    try {
      const parsed = JSON.parse(content);
      result = {
        answer: parsed.answer || content,
        followUp: Array.isArray(parsed.follow_up) ? parsed.follow_up : [],
        quickTips: Array.isArray(parsed.quick_tips) ? parsed.quick_tips : [],
        responseTime,
      };
    } catch {
      log('warning', '⚠️ AI response not in JSON format, parsing text');

      // Try to extract answer from text format
      const lines = content.split('\n').filter(line => line.trim());
      const answer = lines[0] || content;

      result = {
        answer: answer.replace(/^(Answer:|Response:)\s*/i, ''),
        followUp: [],
        quickTips: [],
        responseTime,
      };
    }

    // Cache the result
    setCachedResponse(cacheKey, result);
    return result;

  } catch (error) {
    log('error', 'AI request failed:', error.message);
    throw error;
  }
}

// Better HTTP AI endpoint
const httpServer = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url && req.url.startsWith('/ai-answer')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const question = url.searchParams.get('q');

    if (!question) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing question parameter' }));
      return;
    }

    try {
      const answer = await callDeepSeek([
        { role: 'user', content: question }
      ]);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        answer: answer.answer,
        suggestions: answer.followUp,
        tips: answer.quickTips,
        timestamp: new Date().toISOString(),
        responseTime: answer.responseTime
      }));

    } catch (err) {
      log('error', '❌ HTTP AI request failed:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'AI service temporarily unavailable',
        fallback: "I'm having trouble connecting to the AI service right now. Please try again in a moment."
      }));
    }
    return;
  }

  // Return server IP address for client-side QR generation
  if (req.method === 'GET' && req.url === '/ip') {
    const ip = getServerIP();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ip }));
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      aiCache: aiCache.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  res.writeHead(404);
  res.end();
});

// Store recent chat history per room for better AI context
const chatHistory = {};
const activeRooms = new Map();

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  log('info', `🔌 New connection: ${socket.id}`);

  socket.on('joinRoom', ({ roomId, username, topic }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = username;
    socket.data.topic = topic;

    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Set());
    }
    activeRooms.get(roomId).add(username);

    socket.to(roomId).emit('userJoined', username);
    log('success', `👋 ${username} joined room: ${roomId}`);
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
    log('info', `💬 [${roomId}] ${username}: ${text.substring(0, 100)}`);

    // Track conversation history for AI context
    if (!chatHistory[roomId]) chatHistory[roomId] = [];
    chatHistory[roomId].push({ role: 'user', content: `${username}: ${text}` });
    chatHistory[roomId] = chatHistory[roomId].slice(-8); // Keep last 8 messages

    // Enhanced AI mentions handling
    if (text.trim().toLowerCase().startsWith('@ai')) {
      log('ai', `🤖 AI assistance requested in room ${roomId}`);

      // Show typing indicator immediately
      io.to(roomId).emit('aiTyping', { isTyping: true });

      const userPrompt = text.replace(/^@ai\s*/i, '').trim() ||
        `Tell me more about: ${socket.data.topic || 'this security topic'}`;

      try {
        const history = chatHistory[roomId] || [];
        const messages = [
          ...history.slice(-3), // Last 3 messages for context
          { role: 'user', content: userPrompt },
        ];

        const reply = await callDeepSeek(messages, {
          topic: socket.data.topic,
          roomId,
          username
        });

        // Stop typing indicator
        io.to(roomId).emit('aiTyping', { isTyping: false });

        // Add AI response to history
        chatHistory[roomId].push({ role: 'assistant', content: reply.answer });
        chatHistory[roomId] = chatHistory[roomId].slice(-8);

        // Format the enhanced AI response
        let formattedText = reply.answer;

        // Add quick tips if available
        if (reply.quickTips && reply.quickTips.length > 0) {
          formattedText += '\n\n🔧 **Quick Tips:**';
          reply.quickTips.forEach((tip, index) => {
            formattedText += `\n• ${tip}`;
          });
        }

        // Add follow-up questions
        if (reply.followUp && reply.followUp.length > 0) {
          formattedText += '\n\n💭 **Let\'s discuss:**';
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
          responseTime: reply.responseTime,
          followUp: reply.followUp,
          quickTips: reply.quickTips
        };

        io.to(roomId).emit('message', aiPayload);
        log('ai', `✅ AI responded in room ${roomId} (${reply.responseTime}ms)`);

      } catch (err) {
        io.to(roomId).emit('aiTyping', { isTyping: false });
        log('error', `❌ AI response failed in room ${roomId}:`, err.message);

        const errorPayload = {
          id: Date.now().toString() + '_error',
          text: '⚠️ I\'m having trouble thinking right now. Could you try rephrasing your question?',
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
        delete chatHistory[roomId];
      }
      socket.to(roomId).emit('userLeft', username);
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
        }
      }
      socket.to(roomId).emit('userLeft', username);
    }
    log('info', `🔌 Connection closed: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log('\n' + colors.bright + '═'.repeat(60) + colors.reset);
  log('success', `🚀 Enhanced AI Chat Server running!`);
  log('info', `📡 Port: ${PORT}`);
  log('info', `🌐 WebSocket: ws://localhost:${PORT}`);
  log('info', `🔗 AI API: http://localhost:${PORT}/ai-answer?q=question`);
  log('info', `🏥 Health: http://localhost:${PORT}/health`);
  log('info', `🤖 AI: DeepSeek with enhanced responses`);
  console.log(colors.bright + '═'.repeat(60) + colors.reset + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('warning', '⚠️ Shutting down gracefully...');
  httpServer.close(() => {
    log('success', '✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('warning', '⚠️ Shutting down gracefully...');
  httpServer.close(() => {
    log('success', '✅ Server closed');
    process.exit(0);
  });
});
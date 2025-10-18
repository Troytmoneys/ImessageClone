import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

const app = express();
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');
const hasBuiltClient = fs.existsSync(distPath);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

if (hasBuiltClient) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io')) {
      next();
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT ?? 5174;

const directory = {
  'u-alex': {
    id: 'u-alex',
    name: 'Alex Chen',
    avatar: 'https://i.pravatar.cc/160?img=20',
  },
  'u-marco': {
    id: 'u-marco',
    name: 'Marco Silva',
    avatar: 'https://i.pravatar.cc/160?img=15',
  },
  'u-sienna': {
    id: 'u-sienna',
    name: 'Sienna Patel',
    avatar: 'https://i.pravatar.cc/160?img=26',
  },
  'u-zoe': {
    id: 'u-zoe',
    name: 'Zoë Martínez',
    avatar: 'https://i.pravatar.cc/160?img=46',
  },
  'u-ray': {
    id: 'u-ray',
    name: 'Ray Okafor',
    avatar: 'https://i.pravatar.cc/160?img=33',
  },
};

const chats = [
  {
    id: 'chat-product',
    name: 'Product Design Handoff',
    avatar: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=200&q=60',
    type: 'group',
    accent: '#1a73e8',
    members: ['u-alex', 'u-marco', 'u-sienna', 'u-zoe'],
  },
  {
    id: 'chat-marco',
    name: directory['u-marco'].name,
    avatar: directory['u-marco'].avatar,
    type: 'direct',
    accent: '#34c759',
    members: ['u-marco'],
  },
  {
    id: 'chat-zoe',
    name: directory['u-zoe'].name,
    avatar: directory['u-zoe'].avatar,
    type: 'direct',
    accent: '#ff9500',
    members: ['u-zoe'],
  },
];

const messagesByChat = {
  'chat-product': [
    {
      id: 'm1',
      sender: 'u-alex',
      type: 'text',
      content: 'Dropping the final hero screens here. Everything is exported at 3x.',
      timestamp: 'Today 9:41 AM',
      status: 'Read',
    },
    {
      id: 'm2',
      sender: 'u-marco',
      type: 'image',
      content: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=600&q=60',
      caption: 'Hero exploration – dark mode',
      timestamp: 'Today 9:42 AM',
      status: 'Delivered',
    },
    {
      id: 'm3',
      sender: 'u-sienna',
      type: 'text',
      content: "Love this! I'll plug it into the motion study and share shortly.",
      timestamp: 'Today 9:45 AM',
      status: 'Read',
    },
    {
      id: 'm4',
      sender: 'u-alex',
      type: 'poll',
      content: {
        question: 'Which navigation style do we prefer?',
        options: [
          { id: 'opt-1', label: 'Floating pill', votes: 5 },
          { id: 'opt-2', label: 'Docked tabs', votes: 3 },
          { id: 'opt-3', label: 'Side rail', votes: 1 },
        ],
      },
      timestamp: 'Today 10:04 AM',
      status: 'Delivered',
    },
  ],
  'chat-marco': [
    {
      id: 'm5',
      sender: 'u-marco',
      type: 'audio',
      duration: '0:37',
      timestamp: 'Yesterday',
      status: 'Read',
    },
    {
      id: 'm6',
      sender: 'u-marco',
      type: 'text',
      content: "Let's review analytics after the leadership sync?",
      timestamp: 'Yesterday',
      status: 'Delivered',
    },
  ],
  'chat-zoe': [
    {
      id: 'm7',
      sender: 'u-zoe',
      type: 'text',
      content: 'Do you want to co-host the customer advisory call on Friday?',
      timestamp: 'Monday',
      status: 'Delivered',
    },
  ],
};

const connectedUsers = new Map();
const activeCalls = new Map();

const formatTimestamp = (date) => {
  const now = new Date();
  const comparison = new Date(date);
  const isToday = comparison.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = comparison.toDateString() === yesterday.toDateString();
  const time = comparison.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) {
    return `Today ${time}`;
  }
  if (isYesterday) {
    return `Yesterday ${time}`;
  }
  return `${comparison.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
};

const ensureDirectoryEntry = (profile) => {
  if (!profile?.id) return null;
  if (!directory[profile.id]) {
    directory[profile.id] = {
      id: profile.id,
      name: profile.name ?? profile.id,
      avatar:
        profile.avatar ??
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.name ?? profile.id)}`,
    };
  }
  return directory[profile.id];
};

const normalizeMessage = (message) => ({
  ...message,
  timestamp: message.timestamp ?? formatTimestamp(new Date()),
  status: message.status ?? 'Delivered',
});

const getParticipantsPayload = (call) =>
  Array.from(call.participants.values()).map((participant) => ({
    socketId: participant.socketId,
    userId: participant.userId,
    name: participant.name,
  }));

io.on('connection', (socket) => {
  socket.on('auth:login', (profile = {}, ack) => {
    const assignedId = profile.id || `u-${socket.id.slice(0, 8)}`;
    const record = {
      id: assignedId,
      name: profile.name || 'Guest User',
      username: profile.username || assignedId,
      email: profile.email,
      avatar: profile.avatar,
    };
    connectedUsers.set(socket.id, record);
    ensureDirectoryEntry(record);
    socket.join('lobby');
    socket.emit('state:init', {
      directory,
      chats,
      messages: messagesByChat,
    });
    if (typeof ack === 'function') {
      ack({ id: assignedId });
    }
  });

  socket.on('chat:join', (chatId) => {
    if (chatId) {
      socket.join(chatId);
    }
  });

  socket.on('typing', ({ chatId, userId, name, isTyping }) => {
    if (!chatId || !userId) return;
    socket.to(chatId).emit('typing', { chatId, userId, name, isTyping: Boolean(isTyping) });
  });

  socket.on('chat:create', ({ userId, requester }) => {
    const requesterProfile = connectedUsers.get(socket.id) || requester;
    if (!userId) {
      socket.emit('chat:error', { message: 'Enter a user ID to start a chat.' });
      return;
    }
    const normalizedId = userId.trim();
    const target = directory[normalizedId];
    if (!target) {
      socket.emit('chat:error', { message: 'No user found with that ID.' });
      return;
    }
    const requesterId = requesterProfile?.id || `guest-${socket.id.slice(0, 5)}`;
    ensureDirectoryEntry({ id: requesterId, name: requesterProfile?.name });
    const chatId = `chat-${[normalizedId, requesterId].sort().join('-')}`;
    let existingChat = chats.find((chat) => chat.id === chatId);
    if (!existingChat) {
      existingChat = {
        id: chatId,
        name: target.name,
        avatar: target.avatar,
        type: 'direct',
        accent: '#0a84ff',
        members: Array.from(new Set([normalizedId, requesterId])),
      };
      chats.unshift(existingChat);
      messagesByChat[chatId] = messagesByChat[chatId] || [
        {
          id: `${chatId}-welcome`,
          sender: normalizedId,
          type: 'text',
          content: 'Hey there! Welcome to our new chat.',
          timestamp: formatTimestamp(new Date()),
          status: 'Delivered',
        },
      ];
    }
    io.emit('chat:new', {
      chat: existingChat,
      messages: messagesByChat[chatId],
      directory: {
        [requesterId]: directory[requesterId],
        [normalizedId]: directory[normalizedId],
      },
    });
  });

  socket.on('message:send', ({ chatId, message }) => {
    if (!chatId || !message) return;
    const enriched = normalizeMessage(message);
    if (!messagesByChat[chatId]) {
      messagesByChat[chatId] = [];
    }
    messagesByChat[chatId].push(enriched);
    io.to(chatId).emit('message:new', { chatId, message: enriched });
  });

  socket.on('message:update', ({ chatId, message }) => {
    if (!chatId || !message) return;
    const existing = messagesByChat[chatId];
    if (!existing) return;
    const index = existing.findIndex((item) => item.id === message.id);
    if (index >= 0) {
      existing[index] = { ...existing[index], ...message, edited: true };
      io.to(chatId).emit('message:update', { chatId, message: existing[index] });
    }
  });

  socket.on('message:delete', ({ chatId, messageId }) => {
    if (!chatId || !messageId) return;
    if (messagesByChat[chatId]) {
      messagesByChat[chatId] = messagesByChat[chatId].filter((message) => message.id !== messageId);
      io.to(chatId).emit('message:delete', { chatId, messageId });
    }
  });

  socket.on('call:initiate', ({ chatId, type, initiator, name }) => {
    if (!chatId) return;
    const callId = `${chatId}-${Date.now()}`;
    const profile = connectedUsers.get(socket.id) || { id: initiator, name };
    const call = {
      chatId,
      type: type === 'audio' ? 'audio' : 'video',
      initiator: socket.id,
      participants: new Map(),
    };
    const participant = {
      socketId: socket.id,
      userId: profile?.id || initiator,
      name: profile?.name || name || 'Caller',
    };
    call.participants.set(socket.id, participant);
    activeCalls.set(callId, call);
    socket.join(callId);
    socket.to(chatId).emit('call:ring', {
      callId,
      chatId,
      type: call.type,
      initiator: participant.userId,
      initiatorName: participant.name,
    });
    socket.emit('call:ready', {
      callId,
      chatId,
      type: call.type,
      participants: getParticipantsPayload(call),
    });
  });

  socket.on('call:join', ({ callId }) => {
    const call = activeCalls.get(callId);
    if (!call) {
      socket.emit('call:ended', { callId });
      return;
    }
    const profile = connectedUsers.get(socket.id) || {
      id: `guest-${socket.id.slice(0, 5)}`,
      name: 'Guest Participant',
    };
    const participant = {
      socketId: socket.id,
      userId: profile.id,
      name: profile.name,
    };
    call.participants.set(socket.id, participant);
    socket.join(callId);
    socket.emit('call:ready', {
      callId,
      chatId: call.chatId,
      type: call.type,
      participants: getParticipantsPayload(call),
    });
    socket.to(callId).emit('call:user-joined', {
      callId,
      participant,
    });
  });

  socket.on('call:signal', ({ callId, target, data }) => {
    if (!callId || !target || !data) return;
    io.to(target).emit('call:signal', { callId, from: socket.id, data });
  });

  const leaveCall = (callId) => {
    const call = activeCalls.get(callId);
    if (!call) return;
    call.participants.delete(socket.id);
    socket.leave(callId);
    socket.to(callId).emit('call:user-left', { callId, participantId: socket.id });
    if (call.participants.size === 0) {
      activeCalls.delete(callId);
      io.to(call.chatId).emit('call:ended', { callId });
    }
  };

  socket.on('call:leave', ({ callId }) => {
    leaveCall(callId);
  });

  socket.on('call:decline', ({ callId }) => {
    const call = activeCalls.get(callId);
    const profile = connectedUsers.get(socket.id);
    if (call) {
      socket.to(call.chatId).emit('call:declined', {
        callId,
        userId: profile?.id,
      });
    }
  });

  socket.on('disconnect', () => {
    connectedUsers.delete(socket.id);
    Array.from(activeCalls.entries()).forEach(([callId, call]) => {
      if (call.participants.has(socket.id)) {
        call.participants.delete(socket.id);
        socket.to(callId).emit('call:user-left', { callId, participantId: socket.id });
        if (call.participants.size === 0) {
          activeCalls.delete(callId);
          io.to(call.chatId).emit('call:ended', { callId });
        }
      }
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Realtime server listening on port ${PORT}`);
});

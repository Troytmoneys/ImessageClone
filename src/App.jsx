import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const baseDirectory = {
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

const initialChats = [
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
    name: baseDirectory['u-marco'].name,
    avatar: baseDirectory['u-marco'].avatar,
    type: 'direct',
    accent: '#34c759',
    members: ['u-marco'],
  },
  {
    id: 'chat-zoe',
    name: baseDirectory['u-zoe'].name,
    avatar: baseDirectory['u-zoe'].avatar,
    type: 'direct',
    accent: '#ff9500',
    members: ['u-zoe'],
  },
];

const initialMessages = {
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
      sender: 'me',
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
      sender: 'me',
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
      sender: 'me',
      type: 'text',
      content: "Let's review analytics after the leadership sync?",
      timestamp: 'Yesterday',
      status: 'Delivered',
    },
  ],
  'chat-zoe': [
    {
      id: 'm7',
      sender: 'me',
      type: 'text',
      content: 'Do you want to co-host the customer advisory call on Friday?',
      timestamp: 'Monday',
      status: 'Delivered',
    },
  ],
};

const gradientBackground = {
  background:
    'radial-gradient(circle at 20% 20%, rgba(82,139,255,0.32), transparent 40%), radial-gradient(circle at 80% 0%, rgba(52,199,89,0.25), transparent 35%), linear-gradient(135deg, #040509 0%, #11121a 35%, #0c1224 100%)',
};

function App() {
  const [authMode, setAuthMode] = useState('login');
  const [user, setUser] = useState(null);
  const [directory, setDirectory] = useState(baseDirectory);
  const [chats, setChats] = useState(initialChats);
  const [messagesByChat, setMessagesByChat] = useState(initialMessages);
  const [selectedChatId, setSelectedChatId] = useState(initialChats[0].id);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callState, setCallState] = useState({
    type: 'video',
    muted: false,
    cameraOff: false,
    screenShare: false,
    ringing: false,
    gridView: true,
    portraitMode: false,
    sharePlay: false,
  });
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showEffectsMenu, setShowEffectsMenu] = useState(false);
  const [composerEffect, setComposerEffect] = useState('standard');
  const [composerValue, setComposerValue] = useState('');
  const [toast, setToast] = useState(null);
  const [pinnedChatIds, setPinnedChatIds] = useState([initialChats[0].id]);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageActionTarget, setMessageActionTarget] = useState(null);
  const [typingIndicator, setTypingIndicator] = useState(null);
  const [unreadChatIds, setUnreadChatIds] = useState(() => new Set());
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [incomingCall, setIncomingCall] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [callError, setCallError] = useState(null);
  const toastTimeout = useRef(null);
  const typingTimeout = useRef(null);
  const socketRef = useRef(null);
  const callSessionRef = useRef({ callId: null, chatId: null, type: 'video' });
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const peersRef = useRef(new Map());
  const participantDirectoryRef = useRef(new Map());
  const selectedChatIdRef = useRef(selectedChatId);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if ('Notification' in window && Notification.permission === 'default') {
      setShowNotificationBanner(true);
    }

    return () => {
      if (toastTimeout.current) {
        clearTimeout(toastTimeout.current);
      }
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
    };
  }, []);

  const showToast = (message) => {
    if (!message) return;
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }
    setToast(message);
    toastTimeout.current = setTimeout(() => setToast(null), 2600);
  };

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? chats[0],
    [selectedChatId, chats]
  );

  const normalizeMessage = useCallback(
    (incoming) => {
      if (!incoming) return incoming;
      const normalized = { ...incoming };
      if (user?.id && normalized.sender === user.id) {
        normalized.sender = 'me';
      }
      if (Array.isArray(normalized.reactions) && user?.id) {
        normalized.reactions = normalized.reactions.map((reaction) =>
          reaction.by === user.id ? { ...reaction, by: 'me' } : reaction
        );
      }
      if (!normalized.timestamp) {
        normalized.timestamp = 'Just now';
      }
      return normalized;
    },
    [user?.id]
  );

  const updateMessages = useCallback((chatId, mapper) => {
    setMessagesByChat((prev) => {
      const existing = prev[chatId] ?? [];
      return {
        ...prev,
        [chatId]: mapper(existing),
      };
    });
  }, []);

  const applyMessageUpdate = useCallback(
    (chatId, incomingMessage) => {
      const normalized = normalizeMessage(incomingMessage);
      setMessagesByChat((prev) => {
        const existing = prev[chatId] ?? [];
        const index = existing.findIndex((message) => message.id === normalized.id);
        if (index >= 0) {
          const next = [...existing];
          next[index] = { ...existing[index], ...normalized };
          return { ...prev, [chatId]: next };
        }
        return {
          ...prev,
          [chatId]: [...existing, normalized],
        };
      });
    },
    [normalizeMessage]
  );

  const removeRemoteParticipant = useCallback((peerId) => {
    participantDirectoryRef.current.delete(peerId);
    setRemoteParticipants((prev) => prev.filter((participant) => participant.id !== peerId));
    const existing = peersRef.current.get(peerId);
    if (existing) {
      existing.close();
      peersRef.current.delete(peerId);
    }
  }, []);

  const cleanupCall = useCallback(() => {
    peersRef.current.forEach((connection) => connection.close());
    peersRef.current.clear();
    setRemoteParticipants([]);
    participantDirectoryRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    callSessionRef.current = { callId: null, chatId: null, type: 'video' };
    setIncomingCall(null);
    setCallState((prev) => ({ ...prev, ringing: false }));
    setCallError(null);
  }, []);

  const ensureLocalStream = useCallback(
    async (callType) => {
      if (localStreamRef.current) {
        if (localVideoRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        return localStreamRef.current;
      }

      try {
        const constraints = {
          audio: true,
          video: callType === 'video',
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setCallState((prev) => ({ ...prev, cameraOff: callType === 'audio' }));
        setCallError(null);
        return stream;
      } catch (error) {
        const message = error?.message ?? 'Unable to access camera or microphone.';
        setCallError(message);
        throw error;
      }
    },
    []
  );

  const createPeerConnection = useCallback(
    async (peerId, callId, callType, isInitiator = false) => {
      const socket = socketRef.current;
      if (!socket || peersRef.current.has(peerId)) {
        return peersRef.current.get(peerId) ?? null;
      }

      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('call:signal', {
            callId,
            target: peerId,
            data: { type: 'candidate', candidate: event.candidate },
          });
        }
      };

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          const info = participantDirectoryRef.current.get(peerId);
          setRemoteParticipants((prev) => {
            const filtered = prev.filter((participant) => participant.id !== peerId);
            return [
              ...filtered,
              { id: peerId, stream: remoteStream, userId: info?.userId, name: info?.name },
            ];
          });
        }
      };

      peerConnection.onconnectionstatechange = () => {
        if (
          peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'disconnected' ||
          peerConnection.connectionState === 'closed'
        ) {
          removeRemoteParticipant(peerId);
        }
      };

      peersRef.current.set(peerId, peerConnection);

      const stream = await ensureLocalStream(callType);
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      if (isInitiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('call:signal', {
          callId,
          target: peerId,
          data: { type: 'offer', sdp: peerConnection.localDescription },
        });
      }

      return peerConnection;
    },
    [ensureLocalStream, removeRemoteParticipant]
  );

  const handleCallReady = useCallback(
    async ({ callId, chatId, type, participants = [] }) => {
      callSessionRef.current = { callId, chatId, type };
      setCallState((prev) => ({ ...prev, type, ringing: false, cameraOff: type === 'audio' }));
      setShowCallModal(true);
      setIncomingCall(null);
      setCallError(null);
      participants.forEach((participant) => {
        const peerId =
          typeof participant === 'string' ? participant : participant?.socketId ?? participant?.id;
        if (!peerId) return;
        const meta =
          typeof participant === 'object'
            ? {
                socketId: participant.socketId ?? peerId,
                userId: participant.userId,
                name: participant.name,
              }
            : null;
        if (meta) {
          participantDirectoryRef.current.set(peerId, meta);
        }
      });
      setRemoteParticipants((prev) => [...prev]);
      try {
        await ensureLocalStream(type);
      } catch (error) {
        showToast('Unable to access camera or microphone for the call.');
        if (socketRef.current) {
          socketRef.current.emit('call:leave', { callId });
        }
        return;
      }

      const socket = socketRef.current;
      const socketId = socket?.id ?? '';
      participants.forEach((participant) => {
        const peerId =
          typeof participant === 'string' ? participant : participant?.socketId ?? participant?.id;
        if (!peerId || peerId === socketId) return;
        const shouldInitiate = socketId ? socketId < peerId : true;
        createPeerConnection(peerId, callId, type, shouldInitiate);
      });
    },
    [createPeerConnection, ensureLocalStream, showToast]
  );

  const updateMessage = useCallback(
    (chatId, messageId, transformer) => {
      updateMessages(chatId, (existing) =>
        existing.map((message) =>
          message.id === messageId ? { ...message, ...transformer(message) } : message
        )
      );
    },
    [updateMessages]
  );

  const removeMessage = useCallback(
    (chatId, messageId) => {
      updateMessages(chatId, (existing) => existing.filter((message) => message.id !== messageId));
    },
    [updateMessages]
  );

  const handleAuthSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    const safeUsername = (payload.username || payload.email || 'guest')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    const profile = {
      id: safeUsername ? `u-${safeUsername}` : `u-guest-${Date.now()}`,
      name: payload.name || 'Guest User',
      username: safeUsername || 'guest',
      email: payload.email || `${payload.username}@example.com`,
    };
    setUser(profile);
    if (!selectedChatId && chats.length) {
      setSelectedChatId(chats[0].id);
    }
  };

  const handleSendMessage = (type, data) => {
    if (!selectedChat || !user) return;
    const trimmed = typeof data === 'string' ? data.trim() : '';
    if (type === 'text' && !trimmed) {
      return;
    }

    const chatId = selectedChat.id;
    const messageId = `${chatId}-${Date.now()}`;
    const localMessage = {
      id: messageId,
      sender: 'me',
      type,
      timestamp: 'Just now',
      status: 'Sending…',
      effect: composerEffect,
    };

    const outgoingMessage = {
      ...localMessage,
      sender: user.id,
      status: 'Sent',
      timestamp: new Date().toISOString(),
    };

    if (type === 'text') {
      localMessage.content = trimmed;
      outgoingMessage.content = trimmed;
    }
    if (type === 'image') {
      localMessage.content = data.url;
      localMessage.caption = data.caption;
      outgoingMessage.content = data.url;
      outgoingMessage.caption = data.caption;
    }
    if (type === 'file') {
      localMessage.fileName = data.fileName;
      localMessage.fileSize = data.fileSize;
      outgoingMessage.fileName = data.fileName;
      outgoingMessage.fileSize = data.fileSize;
    }
    if (type === 'audio') {
      const duration = data?.duration ?? '0:15';
      localMessage.duration = duration;
      outgoingMessage.duration = duration;
    }
    if (type === 'poll') {
      localMessage.content = data;
      outgoingMessage.content = data;
    }

    updateMessages(chatId, (existing) => [...existing, localMessage]);
    setComposerValue('');
    setShowEffectsMenu(false);
    setComposerEffect('standard');
    showToast(
      type === 'poll'
        ? 'Poll sent. Everyone in this chat will receive a notification.'
        : 'Delivered to everyone in the conversation across devices.'
    );

    if (socketRef.current) {
      socketRef.current.emit('message:send', { chatId, message: outgoingMessage });
    }
  };

  const handleAddChatById = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const userId = formData.get('userId');
    if (!userId) return;
    const trimmedId = userId.trim();
    if (socketRef.current && user) {
      socketRef.current.emit('chat:create', { userId: trimmedId, requester: user });
      showToast('Creating conversation…');
      setShowNewChatModal(false);
      return;
    }
    const directoryEntry = directory[trimmedId];
    if (!directoryEntry) {
      alert('No user found with that ID. Try u-alex, u-marco, u-sienna, u-zoe, or u-ray.');
      return;
    }
    const existingChat = chats.find((chat) => chat.type === 'direct' && chat.members.includes(directoryEntry.id));
    if (existingChat) {
      setSelectedChatId(existingChat.id);
      setShowNewChatModal(false);
      return;
    }
    const newChat = {
      id: `chat-${directoryEntry.id}`,
      name: directoryEntry.name,
      avatar: directoryEntry.avatar,
      type: 'direct',
      accent: '#0a84ff',
      members: [directoryEntry.id],
    };
    setChats((prev) => [newChat, ...prev]);
    setMessagesByChat((prev) => ({
      ...prev,
      [newChat.id]: [
        {
          id: `${newChat.id}-welcome`,
          sender: directoryEntry.id,
          type: 'text',
          content: 'Hey there! Welcome to our new chat.',
          timestamp: 'Just now',
          status: 'Read',
        },
      ],
    }));
    setSelectedChatId(newChat.id);
    setShowNewChatModal(false);
  };

  const handleRequestNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser.');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setShowNotificationBanner(false);
      if (result === 'granted') {
        alert('Awesome! You will receive message and ringing alerts instantly.');
      }
    } catch (error) {
      console.error(error);
      setShowNotificationBanner(false);
    }
  };

  const handleCallButton = (type) => {
    if (!selectedChat || !user) return;
    const chatId = selectedChat.id;
    callSessionRef.current = { callId: null, chatId, type };
    setCallState({
      type,
      muted: false,
      cameraOff: type === 'audio',
      screenShare: false,
      ringing: true,
      gridView: true,
      portraitMode: false,
      sharePlay: false,
    });
    setIncomingCall(null);
    setCallError(null);
    setShowCallModal(true);
    if (socketRef.current) {
      socketRef.current.emit('call:initiate', {
        chatId,
        type,
        initiator: user.id,
        name: user.name,
      });
    }
    showToast(type === 'video' ? 'Starting a FaceTime video ring on all linked devices…' : 'Calling everyone with FaceTime audio…');
  };

  const toggleCallControl = (key) => {
    setCallState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'muted' && localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next.muted;
        });
      }
      if (key === 'cameraOff' && localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = !next.cameraOff;
        });
      }
      return next;
    });
  };

  const leaveCall = () => {
    const activeCall = callSessionRef.current;
    if (socketRef.current && activeCall?.callId) {
      socketRef.current.emit('call:leave', { callId: activeCall.callId });
    }
    cleanupCall();
    setShowCallModal(false);
  };

  const acceptCall = () => {
    if (!incomingCall || !socketRef.current) return;
    const { callId, chatId, type } = incomingCall;
    callSessionRef.current = { callId, chatId, type };
    setCallState((prev) => ({ ...prev, type, cameraOff: type === 'audio', ringing: false }));
    socketRef.current.emit('call:join', { callId });
    setIncomingCall(null);
  };

  const declineCall = () => {
    if (incomingCall && socketRef.current) {
      socketRef.current.emit('call:decline', { callId: incomingCall.callId });
    }
    setIncomingCall(null);
    if (!callSessionRef.current.callId) {
      setShowCallModal(false);
      return;
    }
    cleanupCall();
    setShowCallModal(false);
  };

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    if (typeof window === 'undefined') {
      return undefined;
    }

    const explicitUrl = import.meta.env.VITE_REALTIME_URL;
    const port = import.meta.env.VITE_REALTIME_PORT || '5174';
    const url =
      explicitUrl || `${window.location.protocol}//${window.location.hostname}:${port}`;

    setConnectionStatus('connecting');

    const socket = io(url, { transports: ['websocket'] });
    socketRef.current = socket;

    const joinChats = (chatList) => {
      chatList?.forEach((chat) => {
        if (chat?.id) {
          socket.emit('chat:join', chat.id);
        }
      });
    };

    socket.on('connect', () => setConnectionStatus('connected'));
    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      cleanupCall();
    });

    socket.emit('auth:login', user, (serverProfile) => {
      if (serverProfile?.id && serverProfile.id !== user.id) {
        setUser((prev) => ({ ...prev, id: serverProfile.id }));
      }
    });

    socket.on('state:init', ({ directory: nextDirectory, chats: incomingChats, messages }) => {
      if (nextDirectory) {
        setDirectory((prev) => ({ ...prev, ...nextDirectory }));
      }
      if (incomingChats?.length) {
        setChats(incomingChats);
        joinChats(incomingChats);
      }
      if (messages) {
        const normalized = Object.fromEntries(
          Object.entries(messages).map(([chatId, list]) => [
            chatId,
            list.map((item) => normalizeMessage(item)),
          ])
        );
        setMessagesByChat((prev) => ({ ...prev, ...normalized }));
      }
    });

    socket.on('chat:new', ({ chat, messages, directory: directoryUpdate }) => {
      if (directoryUpdate) {
        setDirectory((prev) => ({ ...prev, ...directoryUpdate }));
      }
      if (chat) {
        setChats((prev) => {
          const filtered = prev.filter((item) => item.id !== chat.id);
          return [chat, ...filtered];
        });
        setMessagesByChat((prev) => ({
          ...prev,
          [chat.id]: (messages ?? []).map((item) => normalizeMessage(item)),
        }));
        socket.emit('chat:join', chat.id);
        if (chat.id !== selectedChatIdRef.current) {
          setUnreadChatIds((prev) => {
            const next = new Set(prev);
            next.add(chat.id);
            return next;
          });
        }
      }
    });

    socket.on('chat:error', (payload) => {
      const message = payload?.message ?? payload ?? 'Unable to complete chat request.';
      showToast(message);
    });

    socket.on('message:new', ({ chatId, message }) => {
      applyMessageUpdate(chatId, { ...message, status: 'Delivered' });
      if (chatId !== selectedChatIdRef.current) {
        setUnreadChatIds((prev) => {
          const next = new Set(prev);
          next.add(chatId);
          return next;
        });
      }
    });

    socket.on('message:update', ({ chatId, message }) => {
      applyMessageUpdate(chatId, message);
    });

    socket.on('message:delete', ({ chatId, messageId }) => {
      removeMessage(chatId, messageId);
    });

    socket.on('typing', ({ chatId, userId, name, isTyping }) => {
      if (userId === user.id) return;
      if (isTyping) {
        setTypingIndicator({ chatId, memberId: userId, name });
      } else {
        setTypingIndicator((prev) => (prev?.memberId === userId ? null : prev));
      }
    });

    socket.on('call:ring', (payload) => {
      if (!payload) return;
      if (payload.initiator === user.id) {
        return;
      }
      callSessionRef.current = {
        callId: payload.callId,
        chatId: payload.chatId,
        type: payload.type,
      };
      setSelectedChatId(payload.chatId);
      setIncomingCall(payload);
      setCallState((prev) => ({
        ...prev,
        type: payload.type,
        ringing: true,
        cameraOff: payload.type === 'audio',
      }));
      setShowCallModal(true);
    });

    socket.on('call:ready', handleCallReady);

    socket.on('call:user-joined', async ({ callId, participant }) => {
      if (callSessionRef.current.callId !== callId || !participant) return;
      const peerId = participant.socketId ?? participant.id;
      if (!peerId) return;
      participantDirectoryRef.current.set(peerId, {
        socketId: peerId,
        userId: participant.userId,
        name: participant.name,
      });
      setRemoteParticipants((prev) => [...prev]);
      const socketId = socket.id ?? '';
      const shouldInitiate = socketId ? socketId < peerId : true;
      await createPeerConnection(peerId, callId, callSessionRef.current.type, shouldInitiate);
    });

    socket.on('call:user-left', ({ callId, participantId }) => {
      if (callSessionRef.current.callId !== callId) return;
      removeRemoteParticipant(participantId);
    });

    socket.on('call:signal', async ({ callId, from, data }) => {
      if (callSessionRef.current.callId !== callId) return;
      let peer = peersRef.current.get(from);
      if (!peer) {
        peer = await createPeerConnection(from, callId, callSessionRef.current.type, false);
      }
      if (!peer) return;
      if (data?.type === 'offer') {
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('call:signal', {
          callId,
          target: from,
          data: { type: 'answer', sdp: peer.localDescription },
        });
      } else if (data?.type === 'answer') {
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data?.type === 'candidate' && data.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    socket.on('call:ended', ({ callId }) => {
      if (!callSessionRef.current.callId || callSessionRef.current.callId === callId) {
        cleanupCall();
        setShowCallModal(false);
      }
    });

    socket.on('call:error', ({ message }) => {
      setCallError(message ?? 'Call encountered an issue.');
    });

    socket.on('call:declined', ({ callId }) => {
      if (callSessionRef.current.callId === callId) {
        showToast('Participant declined the call.');
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    user,
    applyMessageUpdate,
    cleanupCall,
    createPeerConnection,
    handleCallReady,
    normalizeMessage,
    removeMessage,
    removeRemoteParticipant,
    showToast,
  ]);

  useEffect(() => {
    if (!socketRef.current || !user || !selectedChat) {
      return undefined;
    }
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    socketRef.current.emit('typing', {
      chatId: selectedChat.id,
      userId: user.id,
      name: user.name,
      isTyping: Boolean(composerValue),
    });
    if (composerValue) {
      typingTimeout.current = setTimeout(() => {
        socketRef.current?.emit('typing', {
          chatId: selectedChat.id,
          userId: user.id,
          name: user.name,
          isTyping: false,
        });
      }, 1600);
    }
    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
    };
  }, [composerValue, selectedChat, user]);

  const filteredChats = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const matches = chats.filter((chat) => {
      if (!term) return true;
      const preview = (messagesByChat[chat.id] ?? []).slice(-1)[0];
      const text = [chat.name, preview?.content, preview?.caption]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(term);
    });
    const pinned = matches.filter((chat) => pinnedChatIds.includes(chat.id));
    const others = matches.filter((chat) => !pinnedChatIds.includes(chat.id));
    return { pinned, others };
  }, [chats, pinnedChatIds, searchTerm, messagesByChat]);

  const handleSelectChat = (chatId) => {
    setSelectedChatId(chatId);
    setShowInfoPanel(false);
    setMessageActionTarget(null);
    setUnreadChatIds((prev) => {
      const next = new Set(prev);
      next.delete(chatId);
      return next;
    });
  };

  const togglePin = (chatId) => {
    setPinnedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  const markUnread = () => {
    setUnreadChatIds((prev) => {
      const next = new Set(prev);
      next.add(selectedChat.id);
      return next;
    });
  };

  const activeActionMessage = messageActionTarget
    ? messagesByChat[messageActionTarget.chatId]?.find((item) => item.id === messageActionTarget.messageId)
    : null;

  const handleReact = (emoji) => {
    if (!messageActionTarget || !user) return;
    const { chatId, messageId } = messageActionTarget;
    let updatedReactions = null;
    updateMessage(chatId, messageId, (current) => {
      const reactions = current.reactions ?? [];
      const userReaction = reactions.find((reaction) => reaction.by === 'me' || reaction.by === user.id);
      if (userReaction && userReaction.emoji === emoji) {
        updatedReactions = reactions.filter(
          (reaction) => reaction.by !== 'me' && reaction.by !== user.id
        );
        return { reactions: updatedReactions };
      }
      const others = reactions.filter((reaction) => reaction.by !== 'me' && reaction.by !== user.id);
      updatedReactions = [...others, { emoji, by: 'me' }];
      return { reactions: updatedReactions };
    });
    if (updatedReactions && socketRef.current) {
      const payloadReactions = updatedReactions.map((reaction) => ({
        ...reaction,
        by: reaction.by === 'me' ? user.id : reaction.by,
      }));
      socketRef.current.emit('message:update', {
        chatId,
        message: {
          id: messageId,
          reactions: payloadReactions,
        },
      });
    }
    setMessageActionTarget(null);
  };

  const handleEdit = () => {
    if (!messageActionTarget || !user) return;
    const { chatId, messageId } = messageActionTarget;
    const existingMessage = messagesByChat[chatId]?.find((item) => item.id === messageId);
    if (!existingMessage) return;
    const next = prompt('Edit message', existingMessage.content ?? '');
    if (next === null) return;
    updateMessage(chatId, messageId, () => ({ content: next, edited: true, timestamp: 'Edited just now' }));
    if (socketRef.current) {
      socketRef.current.emit('message:update', {
        chatId,
        message: {
          id: messageId,
          content: next,
          edited: true,
          timestamp: new Date().toISOString(),
        },
      });
    }
    setMessageActionTarget(null);
  };

  const handleUnsend = () => {
    if (!messageActionTarget) return;
    const { chatId, messageId } = messageActionTarget;
    removeMessage(chatId, messageId);
    if (socketRef.current) {
      socketRef.current.emit('message:delete', { chatId, messageId });
    }
    setMessageActionTarget(null);
    showToast('You unsent a message.');
  };

  if (!user) {
    return (
      <div className="auth-screen" style={gradientBackground}>
        <div className="glass-card">
          <div className="auth-header">
            <img
              src="/apple-imessage-mark.svg"
              alt="Messages icon"
              className="auth-icon"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
            <div>
              <h1>Sign in to Messages</h1>
              <p>Continue to stay in sync across web, iPhone, iPad and Safari.</p>
            </div>
          </div>
          <div className="auth-toggle">
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => setAuthMode('signup')}
            >
              Sign Up
            </button>
          </div>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === 'signup' && (
              <label>
                Name
                <input required name="name" placeholder="Olivia Harper" />
              </label>
            )}
            <label>
              Username
              <input required name="username" placeholder="olivia.harper" />
            </label>
            <label>
              Email
              <input required type="email" name="email" placeholder="name@example.com" />
            </label>
            <label>
              Password
              <input required type="password" name="password" placeholder="••••••••" />
            </label>
            <button type="submit" className="primary">Continue</button>
          </form>
          <div className="separator">
            <span />
            <p>or</p>
            <span />
          </div>
          <button type="button" className="google-button" onClick={() => setUser({ name: 'Google User', username: 'google-user' })}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  const chatMessages = messagesByChat[selectedChat.id] ?? [];
  const memberDetails = selectedChat.members.map((memberId) => directory[memberId]).filter(Boolean);

  return (
    <div className="app" style={gradientBackground}>
      {showNotificationBanner && (
        <div className="notification-banner">
          <div>
            <strong>Enable notifications</strong>
            <p>Receive new messages and FaceTime rings immediately on web and Safari.</p>
          </div>
          <button type="button" onClick={handleRequestNotifications}>
            Allow
          </button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      <div className="layout">
        <aside className="sidebar">
          <header className="sidebar-header">
            <div className="user-chip">
              <span className="avatar-fallback">{user.name ? user.name[0] : 'Y'}</span>
              <div>
                <h2>{user.name || 'You'}</h2>
                <p>@{user.username}</p>
              </div>
            </div>
            <button className="pill-button" onClick={() => setShowNewChatModal(true)}>
              <span>＋</span>
              New Chat
            </button>
          </header>
          <div className="chat-search">
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search" />
          </div>
          <div className="chat-list">
            {[filteredChats.pinned, filteredChats.others].map((group, index) => (
              <React.Fragment key={index === 0 ? 'pinned' : 'recents'}>
                {index === 0 && group.length > 0 && <p className="list-label">Pinned</p>}
                {index === 1 && filteredChats.pinned.length > 0 && group.length > 0 && <p className="list-label">Recents</p>}
                {group.map((chat) => {
                  const preview = (messagesByChat[chat.id] ?? []).slice(-1)[0];
                  const isActive = chat.id === selectedChat.id;
                  const hasUnread = unreadChatIds.has(chat.id);
                  return (
                    <div key={chat.id} className={`chat-row-wrapper ${hasUnread ? 'unread' : ''}`}>
                      <button className={`chat-row ${isActive ? 'active' : ''}`} onClick={() => handleSelectChat(chat.id)}>
                        <div className="chat-avatar" style={{ borderColor: chat.accent }}>
                          <img src={chat.avatar} alt={chat.name} />
                          {hasUnread && <span className="badge" />}
                        </div>
                        <div className="chat-summary">
                          <div className="chat-summary-header">
                            <h3>{chat.name}</h3>
                            <span className="timestamp">{preview?.timestamp ?? 'No messages yet'}</span>
                          </div>
                          <p className="preview-text">
                            {preview?.type === 'text' && preview.content}
                            {preview?.type === 'image' && '📷 Image'}
                            {preview?.type === 'poll' && '📊 Poll shared'}
                            {preview?.type === 'audio' && `🎤 Audio · ${preview.duration}`}
                            {!preview && 'Start the conversation'}
                          </p>
                        </div>
                      </button>
                      <div className="chat-row-actions">
                        <button
                          type="button"
                          className={`pin ${pinnedChatIds.includes(chat.id) ? 'active' : ''}`}
                          onClick={() => togglePin(chat.id)}
                          aria-label="Toggle pin"
                        >
                          📌
                        </button>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </aside>
        <main className="chat-panel">
          <header className="chat-header">
            <button className="avatar-button" onClick={() => setShowInfoPanel(true)}>
              <img src={selectedChat.avatar} alt={selectedChat.name} />
            </button>
            <div className="chat-header-meta" onClick={() => setShowInfoPanel(true)}>
              <h2>{selectedChat.name}</h2>
              <p>
                {selectedChat.members.length > 1
                  ? `${selectedChat.members.length} people`
                  : directory[selectedChat.members[0]]?.name ?? 'Direct message'}
              </p>
            </div>
            <div className="chat-header-actions">
              <button className="icon-button" title="FaceTime Audio" onClick={() => handleCallButton('audio')}>
                📞
              </button>
              <button className="icon-button" title="FaceTime Video" onClick={() => handleCallButton('video')}>
                🎥
              </button>
              <button className="icon-button" title="Mark as unread" onClick={markUnread}>
                🔵
              </button>
            </div>
          </header>
          <section className="transcript" role="log" aria-live="polite">
            {chatMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                sender={directory[message.sender]}
                showName={selectedChat.members.length > 1 && message.sender !== 'me'}
                onOpenActions={() => setMessageActionTarget({ chatId: selectedChat.id, messageId: message.id })}
              />
            ))}
            {typingIndicator?.chatId === selectedChat.id && (
              <div className="typing-indicator">
                <span className="typing-avatar">{directory[typingIndicator.memberId]?.name?.[0] ?? '…'}</span>
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <p>{typingIndicator.name} is typing…</p>
              </div>
            )}
          </section>
          <footer className="composer" role="form">
            <div className="composer-actions">
              <label className="icon-button" title="Send image">
                🖼️
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      handleSendMessage('image', { url: reader.result, caption: file.name });
                    };
                    reader.readAsDataURL(file);
                    event.target.value = '';
                  }}
                />
              </label>
              <button className="icon-button" title="Create poll" onClick={() => setShowPollModal(true)}>
                📊
              </button>
              <button className="icon-button" title="Record audio" onClick={() => handleSendMessage('audio', { duration: '0:29' })}>
                🎤
              </button>
              <div className="effects-wrapper">
                <button
                  className={`icon-button effects ${showEffectsMenu ? 'active' : ''}`}
                  type="button"
                  onClick={() => setShowEffectsMenu((prev) => !prev)}
                  title="Message effects"
                >
                  ✨
                </button>
                {showEffectsMenu && (
                  <div className="effects-menu">
                    {[
                      { id: 'standard', label: 'Standard' },
                      { id: 'slam', label: 'Slam' },
                      { id: 'loud', label: 'Loud' },
                      { id: 'gentle', label: 'Gentle' },
                      { id: 'invisible', label: 'Invisible Ink' },
                    ].map((effect) => (
                      <button
                        key={effect.id}
                        type="button"
                        className={composerEffect === effect.id ? 'active' : ''}
                        onClick={() => setComposerEffect(effect.id)}
                      >
                        {effect.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <form
              className="composer-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSendMessage('text', composerValue);
              }}
            >
              <input
                value={composerValue}
                onChange={(event) => setComposerValue(event.target.value)}
                placeholder="iMessage"
              />
              {composerEffect !== 'standard' && <span className="effect-chip">{composerEffect}</span>}
              <button type="submit" className="send-button">
                <span role="img" aria-label="Send">⬆️</span>
              </button>
            </form>
          </footer>
          {messageActionTarget && (
            <MessageActionSheet
              message={activeActionMessage}
              onClose={() => setMessageActionTarget(null)}
              onReact={handleReact}
              onEdit={handleEdit}
              onUnsend={handleUnsend}
            />
          )}
        </main>
      </div>

      {showInfoPanel && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-content">
            <button className="close" onClick={() => setShowInfoPanel(false)} aria-label="Close">✕</button>
            <div className="modal-body">
              <div className="chat-avatar-large">
                <img src={selectedChat.avatar} alt={selectedChat.name} />
                <button
                  className="pill-button"
                  onClick={() => {
                    const next = prompt('Paste an image URL to update the chat icon');
                    if (!next) return;
                    setChats((prev) =>
                      prev.map((chat) => (chat.id === selectedChat.id ? { ...chat, avatar: next } : chat))
                    );
                  }}
                >
                  Change photo
                </button>
              </div>
              <h3>{selectedChat.name}</h3>
              <p className="modal-subtitle">Group Members</p>
              <ul className="member-list">
                {memberDetails.map((member) => (
                  <li key={member.id}>
                    <img src={member.avatar} alt={member.name} />
                    <div>
                      <strong>{member.name}</strong>
                      <span>{member.id}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="info-actions">
                <button type="button" onClick={() => togglePin(selectedChat.id)}>
                  {pinnedChatIds.includes(selectedChat.id) ? 'Unpin Conversation' : 'Pin Conversation'}
                </button>
                <button type="button" onClick={markUnread}>Mark as unread</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCallModal && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-content call-modal">
            <div className="call-preview">
              <div className="call-grid">
                <div className={`call-tile local ${callState.cameraOff ? 'inactive' : ''}`}>
                  {callState.cameraOff || !localStreamRef.current ? (
                    <div className="camera-off">Camera off</div>
                  ) : (
                    <video ref={localVideoRef} autoPlay muted playsInline />
                  )}
                  <span className="tile-label">{user?.name ?? 'You'}</span>
                </div>
                {remoteParticipants.length === 0 && (
                  <div className="call-tile placeholder">
                    <div className="waiting">Waiting for others…</div>
                    <span className="tile-label">Participants</span>
                  </div>
                )}
                {remoteParticipants.map((participant) => (
                  <RemoteParticipantTile
                    key={participant.id}
                    participant={participant}
                    directory={directory}
                  />
                ))}
              </div>
              {incomingCall && (
                <div className="incoming-banner">
                  {incomingCall.initiatorName ?? 'Someone'} is calling…
                </div>
              )}
              {callState.ringing && !incomingCall && <div className="ringing">Ringing…</div>}
              {callError && <div className="call-error">{callError}</div>}
              <div className="call-flags">
                <span className={`connection ${connectionStatus}`}>{connectionStatus}</span>
                {callState.gridView && <span>Grid</span>}
                {callState.portraitMode && <span>Portrait</span>}
                {callState.sharePlay && <span>SharePlay</span>}
              </div>
            </div>
            <div className="call-controls">
              <h3>{callState.type === 'video' ? 'FaceTime Video' : 'FaceTime Audio'}</h3>
              <p>
                {incomingCall
                  ? `${incomingCall.initiatorName ?? 'Someone'} invited you to join ${selectedChat?.name ?? 'this call'}`
                  : `Connected with ${selectedChat?.name ?? 'participants'}`}
              </p>
              {incomingCall ? (
                <div className="incoming-actions">
                  <button className="primary" onClick={acceptCall}>
                    Join Call
                  </button>
                  <button className="danger" onClick={declineCall}>
                    Decline
                  </button>
                </div>
              ) : (
                <div className="control-row">
                  <button onClick={() => toggleCallControl('muted')} className={callState.muted ? 'active' : ''}>
                    {callState.muted ? 'Unmute' : 'Mute'}
                  </button>
                  {callState.type === 'video' && (
                    <button onClick={() => toggleCallControl('cameraOff')} className={callState.cameraOff ? 'active' : ''}>
                      {callState.cameraOff ? 'Show Video' : 'Hide Video'}
                    </button>
                  )}
                  <button onClick={() => toggleCallControl('screenShare')} className={callState.screenShare ? 'active' : ''}>
                    {callState.screenShare ? 'Stop Share' : 'Share Screen'}
                  </button>
                  <button onClick={() => toggleCallControl('gridView')} className={callState.gridView ? 'active' : ''}>
                    {callState.gridView ? 'Grid View' : 'Tiles'}
                  </button>
                  <button onClick={() => toggleCallControl('portraitMode')} className={callState.portraitMode ? 'active' : ''}>
                    {callState.portraitMode ? 'Portrait On' : 'Portrait Off'}
                  </button>
                  <button onClick={() => toggleCallControl('sharePlay')} className={callState.sharePlay ? 'active' : ''}>
                    {callState.sharePlay ? 'End SharePlay' : 'Start SharePlay'}
                  </button>
                  <button onClick={() => toggleCallControl('ringing')} className={callState.ringing ? 'active' : ''}>
                    Ring Again
                  </button>
                  <button className="danger" onClick={leaveCall}>
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showNewChatModal && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-content">
            <button className="close" onClick={() => setShowNewChatModal(false)} aria-label="Close">✕</button>
            <div className="modal-body">
              <h3>Start a new message</h3>
              <p className="modal-subtitle">Enter a teammate's user ID to connect instantly.</p>
              <form className="new-chat-form" onSubmit={handleAddChatById}>
                <label>
                  User ID
                  <input name="userId" placeholder="u-marco" />
                </label>
                <button type="submit" className="primary">Create chat</button>
              </form>
              <p className="directory-hint">Directory preview: {Object.keys(directory).join(', ')}</p>
            </div>
          </div>
        </div>
      )}

      {showPollModal && (
        <PollComposer
          onClose={() => setShowPollModal(false)}
          onSubmit={(payload) => {
            handleSendMessage('poll', payload);
            setShowPollModal(false);
          }}
        />
      )}
    </div>
  );
}

function RemoteParticipantTile({ participant, directory }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  const displayName =
    participant.name ??
    (participant.userId ? directory[participant.userId]?.name ?? participant.userId : null) ??
    'Participant';

  return (
    <div className="call-tile">
      {participant.stream ? (
        <video ref={videoRef} autoPlay playsInline />
      ) : (
        <div className="camera-off">No video</div>
      )}
      <span className="tile-label">{displayName}</span>
    </div>
  );
}

function MessageBubble({ message, sender, onOpenActions, showName }) {
  const isMine = message.sender === 'me';
  const classes = ['message-bubble', isMine ? 'mine' : 'theirs'];
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenActions?.();
    }
  };

  return (
    <div
      className={classes.join(' ')}
      role="button"
      tabIndex={0}
      onClick={onOpenActions}
      onKeyDown={handleKeyDown}
    >
      {showName && <span className="sender-name">{sender?.name ?? 'Participant'}</span>}
      {message.type === 'text' && <p>{message.content}</p>}
      {message.type === 'image' && (
        <figure>
          <img src={message.content} alt={message.caption ?? 'Shared media'} />
          {message.caption && <figcaption>{message.caption}</figcaption>}
        </figure>
      )}
      {message.type === 'poll' && (
        <div className="poll-card">
          <h4>{message.content.question}</h4>
          <ul>
            {message.content.options.map((option) => (
              <li key={option.id}>
                <span>{option.label}</span>
                <span className="vote-chip">{option.votes} votes</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            Vote
          </button>
        </div>
      )}
      {message.type === 'audio' && (
        <div className="audio-message">
          <span className="waveform" />
          <span>{message.duration}</span>
        </div>
      )}
      {message.type === 'file' && (
        <div className="file-card">
          <div>
            <strong>{message.fileName}</strong>
            <p>{message.fileSize}</p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            Download
          </button>
        </div>
      )}
      {message.effect && message.effect !== 'standard' && (
        <span className={`effect-tag effect-${message.effect}`}>{message.effect}</span>
      )}
      <span className="timestamp">
        {isMine && message.status ? `${message.status} · ` : ''}
        {message.timestamp}
        {message.edited && ' · Edited'}
      </span>
      {message.reactions?.length ? (
        <div className="reaction-row">
          {message.reactions.map((reaction) => (
            <span key={`${reaction.by}-${reaction.emoji}`} className="reaction-chip">
              {reaction.emoji}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MessageActionSheet({ message, onClose, onReact, onEdit, onUnsend }) {
  if (!message) return null;
  const canEdit = message.sender === 'me' && message.type === 'text';
  const canUnsend = message.sender === 'me';
  return (
    <div className="action-sheet" role="dialog" aria-modal="true" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="action-sheet-content">
        <div className="reaction-picker">
          {['❤️', '👍', '👎', '😂', '‼️', '❓'].map((emoji) => (
            <button key={emoji} onClick={() => onReact(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
        <div className="action-buttons">
          {canEdit && (
            <button type="button" onClick={onEdit}>
              Edit
            </button>
          )}
          {canUnsend && (
            <button type="button" onClick={onUnsend}>
              Undo Send
            </button>
          )}
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PollComposer({ onSubmit, onClose }) {
  const [question, setQuestion] = useState('Design system token strategy?');
  const [options, setOptions] = useState(['Use semantic tokens', 'Stick with functional tokens']);

  const handleOptionChange = (index, value) => {
    setOptions((prev) => prev.map((opt, idx) => (idx === index ? value : opt)));
  };

  const addOption = () => {
    setOptions((prev) => [...prev, 'New option']);
  };

  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      question,
      options: options.filter(Boolean).map((label, index) => ({ id: `opt-${index + 1}`, label, votes: 0 })),
    });
  };

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-content">
        <button className="close" onClick={onClose} aria-label="Close">✕</button>
        <div className="modal-body">
          <h3>Create a poll</h3>
          <form className="poll-form" onSubmit={submit}>
            <label>
              Question
              <input value={question} onChange={(event) => setQuestion(event.target.value)} />
            </label>
            <div className="poll-options">
              {options.map((option, index) => (
                <label key={index}>
                  Option {index + 1}
                  <input value={option} onChange={(event) => handleOptionChange(index, event.target.value)} />
                </label>
              ))}
            </div>
            <div className="poll-buttons">
              <button type="button" onClick={addOption}>Add option</button>
              <button type="submit" className="primary">Share poll</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;

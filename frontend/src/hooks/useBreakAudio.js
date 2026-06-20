import { useCallback, useEffect, useRef, useState } from "react";

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    ...(import.meta.env.VITE_TURN_URL
      ? [
          {
            urls: import.meta.env.VITE_TURN_URL,
            username: import.meta.env.VITE_TURN_USERNAME || undefined,
            credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined,
          },
        ]
      : []),
  ],
};

export default function useBreakAudio({
  socket,
  groupId,
  enabled,
  micAllowed = true,
}) {
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const audioContextRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const localSourceRef = useRef(null);
  const peerAudioGraphRef = useRef(new Map());
  const speakerLevelsRef = useRef({ local: 0, peers: {} });
  const joinTimeoutRef = useRef(null);
  const disconnectedTimeoutRef = useRef(new Map());
  const speakerFrameRef = useRef(null);
  const joinedRef = useRef(false);
  const [joined, setJoined] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [remotePeers, setRemotePeers] = useState([]);
  const [audioError, setAudioError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("idle");
  const [debugEvents, setDebugEvents] = useState([]);
  const [speakerLevels, setSpeakerLevels] = useState({ local: 0, peers: {} });

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  const pushDebugEvent = useCallback((label, detail = "") => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugEvents(prev => [
      { id: `${Date.now()}-${Math.random()}`, timestamp, label, detail },
      ...prev,
    ].slice(0, 12));
  }, []);

  const syncRemotePeers = useCallback(() => {
    setRemotePeers(
      [...remoteStreamsRef.current.entries()].map(([socketId, value]) => ({
        socketId,
        user: value.user,
        stream: value.stream,
      })),
    );
  }, []);

  useEffect(() => {
    if (!localStreamRef.current) return;
    const shouldTransmit = Boolean(micAllowed && micEnabled);
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = shouldTransmit;
    });
    if (!shouldTransmit && joinedRef.current) {
      pushDebugEvent(
        "mic:blocked",
        micAllowed ? "Microphone muted by you" : "Microphone muted by teacher",
      );
    }
  }, [micAllowed, micEnabled, pushDebugEvent]);

  const stopSpeakerMeter = useCallback(() => {
    if (speakerFrameRef.current) {
      cancelAnimationFrame(speakerFrameRef.current);
      speakerFrameRef.current = null;
    }
  }, []);

  const closeAudioContext = useCallback(() => {
    if (localSourceRef.current) {
      localSourceRef.current.disconnect();
      localSourceRef.current = null;
    }
    if (localAnalyserRef.current) {
      localAnalyserRef.current.disconnect();
      localAnalyserRef.current = null;
    }
    peerAudioGraphRef.current.forEach(graph => {
      graph.source?.disconnect?.();
      graph.analyser?.disconnect?.();
    });
    peerAudioGraphRef.current.clear();
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    speakerLevelsRef.current = { local: 0, peers: {} };
    setSpeakerLevels({ local: 0, peers: {} });
    stopSpeakerMeter();
  }, [stopSpeakerMeter]);

  const ensureAudioContext = useCallback(async () => {
    if (audioContextRef.current) {
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume().catch(() => {});
      }
      return audioContextRef.current;
    }
    const AudioContextCtor =
      window.AudioContext || window.webkitAudioContext || null;
    if (!AudioContextCtor) return null;
    const context = new AudioContextCtor();
    audioContextRef.current = context;
    if (context.state === "suspended") {
      await context.resume().catch(() => {});
    }
    return context;
  }, []);

  const readLevel = useCallback(analyser => {
    if (!analyser) return 0;
    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);
    let sum = 0;
    for (let index = 0; index < buffer.length; index += 1) {
      const value = (buffer[index] - 128) / 128;
      sum += value * value;
    }
    return Math.min(1, Math.sqrt(sum / buffer.length) * 2.2);
  }, []);

  const startSpeakerMeter = useCallback(() => {
    if (speakerFrameRef.current) return;
    const tick = () => {
      const nextPeers = {};
      for (const [socketId, graph] of peerAudioGraphRef.current.entries()) {
        nextPeers[socketId] = readLevel(graph.analyser);
      }
      const nextLocal = readLevel(localAnalyserRef.current);
      speakerLevelsRef.current = { local: nextLocal, peers: nextPeers };
      setSpeakerLevels({ local: nextLocal, peers: nextPeers });
      speakerFrameRef.current = requestAnimationFrame(tick);
    };
    speakerFrameRef.current = requestAnimationFrame(tick);
  }, [readLevel]);

  const attachLocalLevelMeter = useCallback(
    async stream => {
      const context = await ensureAudioContext();
      if (!context || !stream) return;
      if (localSourceRef.current) {
        localSourceRef.current.disconnect();
        localSourceRef.current = null;
      }
      if (localAnalyserRef.current) {
        localAnalyserRef.current.disconnect();
        localAnalyserRef.current = null;
      }
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      localSourceRef.current = source;
      localAnalyserRef.current = analyser;
      startSpeakerMeter();
    },
    [ensureAudioContext, startSpeakerMeter],
  );

  const attachPeerLevelMeter = useCallback(
    async (socketId, stream) => {
      if (!socketId || !stream) return;
      const context = await ensureAudioContext();
      if (!context) return;
      const existing = peerAudioGraphRef.current.get(socketId);
      existing?.source?.disconnect?.();
      existing?.analyser?.disconnect?.();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      peerAudioGraphRef.current.set(socketId, { source, analyser });
      startSpeakerMeter();
    },
    [ensureAudioContext, startSpeakerMeter],
  );

  const destroyPeer = useCallback(
    socketId => {
      const timeoutId = disconnectedTimeoutRef.current.get(socketId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        disconnectedTimeoutRef.current.delete(socketId);
      }
      const connection = peerConnectionsRef.current.get(socketId);
      if (connection) {
        connection.onicecandidate = null;
        connection.ontrack = null;
        connection.close();
        peerConnectionsRef.current.delete(socketId);
      }
      const graph = peerAudioGraphRef.current.get(socketId);
      if (graph) {
        graph.source?.disconnect?.();
        graph.analyser?.disconnect?.();
        peerAudioGraphRef.current.delete(socketId);
      }
      remoteStreamsRef.current.delete(socketId);
      syncRemotePeers();
    },
    [syncRemotePeers],
  );

  const leaveAudio = useCallback(({ preserveError = false } = {}) => {
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
    disconnectedTimeoutRef.current.forEach(timeoutId => clearTimeout(timeoutId));
    disconnectedTimeoutRef.current.clear();
    if (socket && groupId && joinedRef.current) {
      socket.emit("session:voice:leave", { groupId });
    }
    peerConnectionsRef.current.forEach(connection => connection.close());
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidatesRef.current.clear();
    closeAudioContext();
    syncRemotePeers();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setJoined(false);
    setMicEnabled(true);
    if (!preserveError) {
      setAudioError("");
    }
    setConnectionStatus("idle");
    pushDebugEvent("leave", "Audio room left");
  }, [groupId, socket, syncRemotePeers, pushDebugEvent, closeAudioContext]);

  const ensurePeerConnection = useCallback(
    (peerSocketId, peerUser) => {
      if (peerConnectionsRef.current.has(peerSocketId)) {
        return peerConnectionsRef.current.get(peerSocketId);
      }

      const connection = new RTCPeerConnection(rtcConfig);
      pushDebugEvent("peer:create", `${peerSocketId}`);
      connection.oniceconnectionstatechange = () => {
        pushDebugEvent(
          "peer:ice-state",
          `${peerSocketId} -> ${connection.iceConnectionState}`,
        );
        if (
          connection.iceConnectionState === "connected" ||
          connection.iceConnectionState === "completed"
        ) {
          const timeoutId = disconnectedTimeoutRef.current.get(peerSocketId);
          if (timeoutId) {
            clearTimeout(timeoutId);
            disconnectedTimeoutRef.current.delete(peerSocketId);
          }
          setConnectionStatus("connected");
        }
        if (connection.iceConnectionState === "disconnected") {
          if (disconnectedTimeoutRef.current.has(peerSocketId)) return;
          const timeoutId = setTimeout(() => {
            disconnectedTimeoutRef.current.delete(peerSocketId);
            const currentConnection = peerConnectionsRef.current.get(peerSocketId);
            if (currentConnection?.iceConnectionState === "disconnected") {
              destroyPeer(peerSocketId);
            }
          }, 10000);
          disconnectedTimeoutRef.current.set(peerSocketId, timeoutId);
        }
        if (
          connection.iceConnectionState === "failed" ||
          connection.iceConnectionState === "closed"
        ) {
          destroyPeer(peerSocketId);
        }
      };
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          connection.addTrack(track, localStreamRef.current);
        });
      }

      connection.onicecandidate = event => {
        if (!event.candidate || !socket) return;
        pushDebugEvent("peer:ice-candidate", `${peerSocketId}`);
        socket.emit("session:voice:ice-candidate", {
          groupId,
          targetSocketId: peerSocketId,
          candidate: event.candidate,
        });
      };

      connection.ontrack = event => {
        const [stream] = event.streams;
        pushDebugEvent("peer:track", `${peerSocketId}`);
        remoteStreamsRef.current.set(peerSocketId, {
          user: peerUser,
          stream,
        });
        attachPeerLevelMeter(peerSocketId, stream);
        syncRemotePeers();
      };

      connection.onconnectionstatechange = () => {
        pushDebugEvent(
          "peer:conn-state",
          `${peerSocketId} -> ${connection.connectionState}`,
        );
        if (connection.connectionState === "connected") {
          const timeoutId = disconnectedTimeoutRef.current.get(peerSocketId);
          if (timeoutId) {
            clearTimeout(timeoutId);
            disconnectedTimeoutRef.current.delete(peerSocketId);
          }
        }
        if (
          connection.connectionState === "closed" ||
          connection.connectionState === "failed"
        ) {
          destroyPeer(peerSocketId);
        }
      };

      peerConnectionsRef.current.set(peerSocketId, connection);
      return connection;
    },
    [
      destroyPeer,
      groupId,
      socket,
      syncRemotePeers,
      pushDebugEvent,
      attachPeerLevelMeter,
    ],
  );

  const joinAudio = async () => {
    if (!socket || !groupId || joined) return;
    if (!enabled) {
      setAudioError("Audio is not available for your role in this phase yet.");
      pushDebugEvent("join:block", "Role/phase not allowed");
      return;
    }
    const secureEnough =
      window.isSecureContext ||
      ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (!secureEnough) {
      const message =
        "Microphone access on phones requires HTTPS or localhost. Your current URL is not a secure context.";
      setAudioError(message);
      pushDebugEvent("join:block", "Insecure context");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setAudioError("This browser cannot access microphone input for session audio.");
      pushDebugEvent("join:block", "Browser cannot access microphone");
      return;
    }
    try {
      pushDebugEvent("join:start", "Requesting microphone permission");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach(track => {
        track.enabled = Boolean(micAllowed);
      });
      await attachLocalLevelMeter(stream);
      setMicEnabled(true);
      setJoined(true);
      setConnectionStatus("requesting-room");
      setAudioError("");
      pushDebugEvent("join:mic", "Microphone granted");
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = setTimeout(() => {
        setConnectionStatus(prev =>
          prev === "connected" ? prev : "error",
        );
        setAudioError(
          "Voice join timed out. If this keeps happening, the server join ack or room negotiation is failing.",
        );
        pushDebugEvent("join:timeout", "No voice join ack in time");
      }, 8000);
      socket.emit("session:voice:join", { groupId });
    } catch (err) {
      setAudioError(
        err?.message ||
          "Microphone permission is required to join session audio.",
      );
      pushDebugEvent("join:error", err?.message || "Mic permission failed");
      throw err;
    }
  };

  const toggleMic = () => {
    if (!micAllowed) {
      setAudioError("Your microphone is currently muted by the teacher.");
      pushDebugEvent("mic:block", "Teacher muted the microphone");
      return;
    }
    const nextEnabled = !micEnabled;
    localStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = nextEnabled;
    });
    setMicEnabled(nextEnabled);
  };

  useEffect(() => {
    if (!socket || !groupId) return;

    const handlePeers = ({ groupId: payloadGroupId, peers = [] }) => {
      if (
        payloadGroupId?.toString() !== groupId.toString() ||
        !localStreamRef.current
      )
        return;
      pushDebugEvent("voice:peers", `${peers.length} peer(s)`);
      setConnectionStatus(peers.length ? "connecting" : "waiting-for-peers");
      peers.forEach(peer => {
        ensurePeerConnection(peer.socketId, peer.user);
      });
    };

    const handleJoined = ({ groupId: payloadGroupId, peersCount = 0 }) => {
      if (payloadGroupId?.toString() !== groupId.toString()) return;
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      pushDebugEvent("voice:joined", `${peersCount} existing peer(s)`);
      setConnectionStatus(peersCount > 0 ? "connecting" : "waiting-for-peers");
    };

    const handleUserJoined = async ({
      groupId: payloadGroupId,
      socketId,
      user,
    }) => {
      if (
        payloadGroupId?.toString() !== groupId.toString() ||
        !localStreamRef.current
      )
        return;
      pushDebugEvent("voice:user-joined", `${socketId}`);
      setConnectionStatus("connecting");
      const connection = ensurePeerConnection(socketId, user);
      if (connection.signalingState !== "stable") return;
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      socket.emit("session:voice:offer", {
        groupId,
        targetSocketId: socketId,
        offer,
      });
    };

    const handleOffer = async ({
      groupId: payloadGroupId,
      sourceSocketId,
      sourceUser,
      offer,
    }) => {
      if (
        payloadGroupId?.toString() !== groupId.toString() ||
        !localStreamRef.current
      )
        return;
      pushDebugEvent("voice:offer", `${sourceSocketId}`);
      const connection = ensurePeerConnection(sourceSocketId, sourceUser);
      setConnectionStatus("connecting");
      await connection.setRemoteDescription(new RTCSessionDescription(offer));
      const pending = pendingCandidatesRef.current.get(sourceSocketId) || [];
      for (const candidate of pending) {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current.delete(sourceSocketId);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      socket.emit("session:voice:answer", {
        groupId,
        targetSocketId: sourceSocketId,
        answer,
      });
    };

    const handleAnswer = async ({
      groupId: payloadGroupId,
      sourceSocketId,
      answer,
    }) => {
      if (payloadGroupId?.toString() !== groupId.toString()) return;
      const connection = peerConnectionsRef.current.get(sourceSocketId);
      if (!connection) return;
      pushDebugEvent("voice:answer", `${sourceSocketId}`);
      setConnectionStatus("connecting");
      await connection.setRemoteDescription(new RTCSessionDescription(answer));
      const pending = pendingCandidatesRef.current.get(sourceSocketId) || [];
      for (const candidate of pending) {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current.delete(sourceSocketId);
    };

    const handleIceCandidate = async ({
      groupId: payloadGroupId,
      sourceSocketId,
      sourceUser,
      candidate,
    }) => {
      if (payloadGroupId?.toString() !== groupId.toString()) return;
      const connection =
        peerConnectionsRef.current.get(sourceSocketId) ||
        ensurePeerConnection(sourceSocketId, sourceUser);
      if (!candidate) return;
      pushDebugEvent("voice:ice-candidate", `${sourceSocketId}`);
      if (connection.remoteDescription) {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
        return;
      }
      const pending = pendingCandidatesRef.current.get(sourceSocketId) || [];
      pending.push(candidate);
      pendingCandidatesRef.current.set(sourceSocketId, pending);
    };

    const handleUserLeft = ({ groupId: payloadGroupId, socketId }) => {
      if (payloadGroupId && payloadGroupId?.toString() !== groupId.toString())
        return;
      pushDebugEvent("voice:user-left", `${socketId}`);
      destroyPeer(socketId);
    };

    const handleSocketError = payload => {
      const message = payload?.message || "";
      if (!message.toLowerCase().includes("audio")) return;
      pushDebugEvent("voice:error", message);
      leaveAudio({ preserveError: true });
      setAudioError(message);
      setConnectionStatus("error");
    };

    socket.on("session:voice:peers", handlePeers);
    socket.on("session:voice:joined", handleJoined);
    socket.on("session:voice:user-joined", handleUserJoined);
    socket.on("session:voice:offer", handleOffer);
    socket.on("session:voice:answer", handleAnswer);
    socket.on("session:voice:ice-candidate", handleIceCandidate);
      socket.on("session:voice:user-left", handleUserLeft);
      socket.on("socketError", handleSocketError);

    return () => {
      socket.off("session:voice:peers", handlePeers);
      socket.off("session:voice:joined", handleJoined);
      socket.off("session:voice:user-joined", handleUserJoined);
      socket.off("session:voice:offer", handleOffer);
      socket.off("session:voice:answer", handleAnswer);
      socket.off("session:voice:ice-candidate", handleIceCandidate);
      socket.off("session:voice:user-left", handleUserLeft);
      socket.off("socketError", handleSocketError);
    };
  }, [
    socket,
    groupId,
    destroyPeer,
    ensurePeerConnection,
    leaveAudio,
    pushDebugEvent,
  ]);

  useEffect(() => () => leaveAudio(), [leaveAudio]);

  return {
    joined,
    micEnabled,
    remotePeers,
    audioError,
    connectionStatus,
    debugEvents,
    joinAudio,
    leaveAudio,
    toggleMic,
    speakerLevels,
  };
}

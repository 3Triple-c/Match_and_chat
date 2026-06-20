import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { useSocketStore } from "../../stores/socketStore";
import { useAuthStore } from "../../stores/authStore";
import { useGroupStore } from "../../stores/groupStore";
import useBreakAudio from "../../hooks/useBreakAudio";

const PHASE_COPY = {
  teaching: "Focus, listen, and take notes while the teacher leads.",
  discussion: "Discuss what was taught and clear up the hard parts together.",
  break: "Reset, breathe, and get ready for the next study block.",
  quiz: "Pause the room and test understanding together.",
  reveal:
    "The next teacher has been chosen. Reveal them, wrap up, and close the session cleanly.",
};

const BREAK_THEME_LIBRARY = {
  "lofi-focus": {
    label: "Lo-fi Focus",
    description: "Soft pulse, warm light, and a calm reset.",
    accent: "#a5c2b1",
    glow: "#dce9df",
  },
  "ambient-calm": {
    label: "Ambient Calm",
    description: "Quiet, airy ambience that keeps the room reflective.",
    accent: "#7aa08a",
    glow: "#dde9e0",
  },
  "afrobeat-chill": {
    label: "Afrobeat Chill",
    description: "Gentle rhythm with a social, easygoing pulse.",
    accent: "#e0c0a5",
    glow: "#f2ddcb",
  },
  "jazz-room": {
    label: "Jazz Room",
    description: "Smooth and polished with a warm lounge feel.",
    accent: "#c78a8c",
    glow: "#efd0d1",
  },
  "rain-room": {
    label: "Rain Room",
    description: "Low-key rainfall ambience for a softer mental reset.",
    accent: "#607d8b",
    glow: "#d8e2e7",
  },
};

const formatShortCountdown = target => {
  if (!target) return "--:--";
  const remainingMs = new Date(target).getTime() - Date.now();
  const totalSeconds = Math.max(Math.floor(remainingMs / 1000), 0);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const formatLongCountdown = target => {
  if (!target) return "Not set";
  const remainingMs = new Date(target).getTime() - Date.now();
  const totalSeconds = Math.max(Math.floor(remainingMs / 1000), 0);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
    2,
    "0",
  );
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const readTextLikeFile = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });

const readFileAsDataUrl = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const drawStrokeSet = (canvas, strokes, liveStrokes = []) => {
  const context = canvas?.getContext("2d");
  if (!context || !canvas) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 3;

  [...(strokes || []), ...(liveStrokes || [])].forEach(stroke => {
    if (!stroke?.points?.length) return;
    context.strokeStyle = stroke.color || "#263238";
    context.beginPath();
    stroke.points.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.stroke();
  });
};

export default function StudySessionPanel({ groupId, activeGroup }) {
  const user = useAuthStore(state => state.user);
  const refreshMe = useAuthStore(state => state.me);
  const { socket, connected } = useSocketStore();
  const {
    fetchGroupDetails,
    fetchMyGroups,
    updateSessionSettings,
    clearNextSessionPlan,
    updateNextSessionPlan,
    voteNextSessionTime,
    finalizeNextSessionPlan,
  } = useGroupStore();
  const {
    currentSession,
    sessionHistory,
    loading,
    actionLoading,
    quizSubmitting,
    error,
    fetchCurrentSession,
    createLobby,
    importMaterial,
    withdrawMaterial,
    startSession,
    endSession,
    advancePhase,
    submitQuizAnswers,
    toggleChatFreeze,
    updatePrompt,
    approveSpeaker,
    addBreakTrack,
    setBreakTheme,
    controlBreakMedia,
    updatePlan,
    markTeacherReady,
    revealTeacher,
    fetchSessionHistory,
    setCurrentSession,
  } = useSessionStore();

  const canvasRef = useRef(null);
  const drawingRef = useRef(null);
  const drawingFrameRef = useRef(null);
  const pendingPointRef = useRef(null);
  const whiteboardSyncTimeoutRef = useRef(null);
  const lastLocalWhiteboardEditRef = useRef(0);
  const lastSessionStatusRef = useRef(null);
  const whiteboardTextRef = useRef("");
  const whiteboardStrokesRef = useRef([]);
  const remoteLiveStrokeMapRef = useRef(new Map());
  const remoteAudioRefs = useRef(new Map());
  const roomMusicRef = useRef(null);
  const roomMusicFadeFrameRef = useRef(null);
  const floatingReactionTimersRef = useRef(new Map());
  const [tick, setTick] = useState(Date.now());
  const [quizAnswers, setQuizAnswers] = useState({});
  const [promptDraft, setPromptDraft] = useState("");
  const [whiteboardText, setWhiteboardText] = useState("");
  const [whiteboardStrokes, setWhiteboardStrokes] = useState([]);
  const [remoteLiveStrokes, setRemoteLiveStrokes] = useState([]);
  const [localLiveStroke, setLocalLiveStroke] = useState(null);
  const [strokeColor, setStrokeColor] = useState("#263238");
  const [trackDraft, setTrackDraft] = useState({ title: "", url: "" });
  const [roomVolume, setRoomVolume] = useState(0.82);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [planDraft, setPlanDraft] = useState({
    focusTopic: "",
    prepNotes: "",
    sourceType: "topic",
    sourceLabel: "",
    sourceLink: "",
    sourceText: "",
  });
  const [materialDraft, setMaterialDraft] = useState({
    focusTopic: "",
    prepNotes: "",
    sourceType: "topic",
    sourceLabel: "",
    sourceLink: "",
    sourceText: "",
  });
  const [settingsDraft, setSettingsDraft] = useState({
    teachingMinutes: 1,
    discussionMinutes: 1,
    quizMinutes: 1,
    breakMinutes: 1,
    minimumTeachingMinutes: 1,
  });
  const [materialImportMessage, setMaterialImportMessage] = useState("");
  const [teachingWarning, setTeachingWarning] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const userId = user?.id || user?._id;
  const teacherId =
    currentSession?.teacherUser?._id || currentSession?.teacherUser;
  const isTeacher = teacherId?.toString() === userId?.toString();
  const groupCreatorId = activeGroup?.createBy?._id || activeGroup?.createBy;
  const isGroupCreator = groupCreatorId?.toString() === userId?.toString();
  const myParticipant = currentSession?.participants?.find(
    participant =>
      (participant.user?._id || participant.user)?.toString() === userId,
  );
  const sessionAudioEnabled =
    (currentSession?.status === "lobby" ||
      currentSession?.status === "active") &&
    (currentSession?.status === "lobby" ||
      (currentSession?.currentPhase === "teaching" &&
        (isTeacher ||
          isGroupCreator ||
          (myParticipant?.speakApproved && !myParticipant?.speakMuted))) ||
      currentSession?.currentPhase === "discussion" ||
      currentSession?.currentPhase === "break" ||
      currentSession?.currentPhase === "reveal");
  const micTransmissionAllowed =
    !!currentSession &&
    !myParticipant?.speakRevoked &&
    !myParticipant?.speakMuted &&
    (currentSession?.status === "lobby" ||
      isTeacher ||
      isGroupCreator ||
      currentSession?.currentPhase === "discussion" ||
      currentSession?.currentPhase === "break" ||
      currentSession?.currentPhase === "reveal" ||
      (currentSession?.currentPhase === "teaching" &&
        myParticipant?.speakApproved));
  const {
    joined: joinedBreakAudio,
    micEnabled,
    remotePeers,
    audioError,
    connectionStatus,
    debugEvents,
    speakerLevels,
    joinAudio,
    leaveAudio,
    toggleMic,
  } = useBreakAudio({
    socket,
    groupId,
    enabled: sessionAudioEnabled,
    micAllowed: micTransmissionAllowed,
  });

  const syncRemoteLiveStrokeState = useCallback(() => {
    setRemoteLiveStrokes([...remoteLiveStrokeMapRef.current.values()]);
  }, []);

  const spawnFloatingReaction = useCallback(emoji => {
    if (!emoji) return;
    const id = `${Date.now()}-${Math.random()}`;
    const left = 10 + Math.floor(Math.random() * 76);
    const drift = (Math.random() * 34 - 17).toFixed(1);
    const duration = 1800 + Math.floor(Math.random() * 1200);
    const size = 0.95 + Math.random() * 0.4;
    const delay = Math.floor(Math.random() * 200);
    setFloatingReactions(prev => [
      {
        id,
        emoji,
        left,
        drift,
        duration,
        size,
        delay,
      },
      ...prev,
    ].slice(0, 18));
    const timeoutId = window.setTimeout(() => {
      setFloatingReactions(prev => prev.filter(item => item.id !== id));
      floatingReactionTimersRef.current.delete(id);
    }, duration + delay + 250);
    floatingReactionTimersRef.current.set(id, timeoutId);
  }, []);

  useEffect(() => {
    fetchCurrentSession(groupId);
    fetchSessionHistory(groupId);
    fetchGroupDetails(groupId);
  }, [groupId, fetchCurrentSession, fetchSessionHistory, fetchGroupDetails]);

  useEffect(() => {
    if (!socket || !groupId) return;

    socket.emit("session:join", { groupId });
    const handleSessionState = session => {
      const sessionGroupId = session?.group?._id || session?.group;
      if (!session || sessionGroupId?.toString() === groupId.toString()) {
        const previousStatus = lastSessionStatusRef.current;
        const nextStatus = session?.status || null;
        lastSessionStatusRef.current = nextStatus;
        setCurrentSession(session);
        const justClosed =
          (previousStatus === "lobby" || previousStatus === "active") &&
          (!session || session?.status === "ended");
        if (justClosed) {
          fetchGroupDetails(groupId);
          fetchMyGroups();
          fetchSessionHistory(groupId);
          refreshMe();
        }
      }
    };
    const handleTeachingWarning = payload => {
      setTeachingWarning(payload?.message || "Teaching time is nearly over.");
      window.setTimeout(() => setTeachingWarning(""), 10000);
    };
    const handleWhiteboardState = payload => {
      if (payload?.groupId?.toString() !== groupId.toString()) return;
      if (Date.now() - lastLocalWhiteboardEditRef.current < 220) return;
      const nextBoard = payload?.whiteboard || {};
      const persistedIds = new Set(
        (nextBoard.strokes || []).map(stroke => stroke.id),
      );
      remoteLiveStrokeMapRef.current.forEach((_, strokeId) => {
        if (persistedIds.has(strokeId)) {
          remoteLiveStrokeMapRef.current.delete(strokeId);
        }
      });
      syncRemoteLiveStrokeState();
      setWhiteboardText(nextBoard.content || "");
      setWhiteboardStrokes(nextBoard.strokes || []);
      whiteboardTextRef.current = nextBoard.content || "";
      whiteboardStrokesRef.current = nextBoard.strokes || [];
    };
    const handleWhiteboardStrokeLive = payload => {
      if (payload?.groupId?.toString() !== groupId.toString()) return;
      const {
        strokeId,
        color,
        point,
        finished = false,
        user: strokeUser,
      } = payload || {};
      if (!strokeId) return;

      if (finished) {
        remoteLiveStrokeMapRef.current.delete(strokeId);
        syncRemoteLiveStrokeState();
        return;
      }

      const existing = remoteLiveStrokeMapRef.current.get(strokeId);
      const nextPoints = [...(existing?.points || [])];
      if (point) {
        const lastPoint = nextPoints[nextPoints.length - 1];
        const distance = lastPoint
          ? Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y)
          : Infinity;
        if (distance >= 1.2) {
          nextPoints.push(point);
        }
      }

      remoteLiveStrokeMapRef.current.set(strokeId, {
        id: strokeId,
        color: color || existing?.color || "#263238",
        user: strokeUser || existing?.user || null,
        points: nextPoints,
      });
      syncRemoteLiveStrokeState();
    };
    const handleBreakReaction = payload => {
      if (payload?.groupId?.toString() !== groupId.toString()) return;
      spawnFloatingReaction(payload?.emoji);
    };

    socket.on("session:state", handleSessionState);
    socket.on("session:teachingWarning", handleTeachingWarning);
    socket.on("session:whiteboardState", handleWhiteboardState);
    socket.on("session:whiteboardStrokeLive", handleWhiteboardStrokeLive);
    socket.on("session:break:reaction", handleBreakReaction);
    return () => {
      if (whiteboardSyncTimeoutRef.current) {
        clearTimeout(whiteboardSyncTimeoutRef.current);
      }
      if (drawingFrameRef.current) {
        cancelAnimationFrame(drawingFrameRef.current);
      }
      socket.off("session:state", handleSessionState);
      socket.off("session:teachingWarning", handleTeachingWarning);
      socket.off("session:whiteboardState", handleWhiteboardState);
      socket.off("session:whiteboardStrokeLive", handleWhiteboardStrokeLive);
      socket.off("session:break:reaction", handleBreakReaction);
    };
  }, [
    socket,
    groupId,
    setCurrentSession,
    fetchGroupDetails,
    fetchMyGroups,
    fetchSessionHistory,
    refreshMe,
    syncRemoteLiveStrokeState,
    spawnFloatingReaction,
  ]);

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (currentSession?.status !== "active" || !currentSession?.phaseEndsAt)
      return undefined;
    const remainingMs =
      new Date(currentSession.phaseEndsAt).getTime() - Date.now();
    const timeout = window.setTimeout(
      () => {
        fetchCurrentSession(groupId);
      },
      Math.max(remainingMs, 0) + 1200,
    );
    return () => window.clearTimeout(timeout);
  }, [
    currentSession?.status,
    currentSession?.phaseEndsAt,
    groupId,
    fetchCurrentSession,
  ]);

  useEffect(() => {
    if (!feedbackMessage) return undefined;
    const timeout = window.setTimeout(() => setFeedbackMessage(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedbackMessage]);

  const breakMedia = currentSession?.collaboration?.breakMedia;
  const breakTheme =
    BREAK_THEME_LIBRARY[breakMedia?.theme] || BREAK_THEME_LIBRARY["lofi-focus"];
  const breakActivityFeed = breakMedia?.activityFeed || [];
  const breakCountdown = formatShortCountdown(currentSession?.phaseEndsAt);
  const breakEnergy = Math.min(
    1,
    0.18 +
      ((speakerLevels.local || 0) +
        Object.values(speakerLevels.peers || {}).reduce(
          (sum, level) => sum + level,
          0,
        )) /
        3,
  );

  useEffect(() => {
    remoteAudioRefs.current.forEach(element => {
      if (element) {
        element.volume = roomVolume;
      }
    });
    if (roomMusicRef.current) {
      roomMusicRef.current.volume = roomVolume;
    }
  }, [roomVolume, remotePeers.length]);

  useEffect(() => {
    const audio = roomMusicRef.current;
    const shouldPlayMusic =
      Boolean(audio) &&
      currentSession?.status === "active" &&
      currentSession?.currentPhase === "break" &&
      Boolean(breakMedia?.currentTrack?.url) &&
      Boolean(breakMedia?.isPlaying);

    if (!audio) return undefined;

    if (roomMusicFadeFrameRef.current) {
      cancelAnimationFrame(roomMusicFadeFrameRef.current);
      roomMusicFadeFrameRef.current = null;
    }

    if (!breakMedia?.currentTrack?.url) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return undefined;
    }

    audio.volume = roomVolume;
    audio.muted = false;

    if (!shouldPlayMusic) {
      const startVolume = Number.isFinite(audio.volume) ? audio.volume : roomVolume;
      const startTime = performance.now();
      const fadeDuration = 650;
      const fadeOut = now => {
        const progress = Math.min(1, (now - startTime) / fadeDuration);
        audio.volume = Math.max(0, startVolume * (1 - progress));
        if (progress < 1) {
          roomMusicFadeFrameRef.current = requestAnimationFrame(fadeOut);
          return;
        }
        audio.pause();
        audio.volume = roomVolume;
        roomMusicFadeFrameRef.current = null;
      };
      if (!audio.paused) {
        roomMusicFadeFrameRef.current = requestAnimationFrame(fadeOut);
      } else {
        audio.volume = roomVolume;
      }
      return undefined;
    }

    const nextUrl = breakMedia.currentTrack.url;
    const currentSrc = audio.getAttribute("src") || "";
    const expectedSrc = new URL(nextUrl, window.location.href).toString();
    const playbackBaseSeconds = breakMedia.playbackPositionSeconds || 0;
    const targetOffsetSeconds = breakMedia.lastActionAt
      ? Math.max(
          0,
          playbackBaseSeconds +
            (Date.now() - new Date(breakMedia.lastActionAt).getTime()) / 1000,
        )
      : playbackBaseSeconds;

    const startPlayback = () => {
      try {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime = Math.min(
            targetOffsetSeconds,
            Math.max(audio.duration - 0.25, 0),
          );
        } else if (targetOffsetSeconds > 0) {
          audio.currentTime = targetOffsetSeconds;
        }
      } catch (error) {
        void error;
      }
      audio.volume = roomVolume;
      audio.play().catch(() => {});
    };

    const attachAndStart = () => {
      if (roomMusicRef.current && currentSrc !== expectedSrc) {
        audio.src = nextUrl;
        audio.load();
      }
      if (audio.readyState >= 1) {
        startPlayback();
        return;
      }
      const onReady = () => {
        audio.removeEventListener("loadedmetadata", onReady);
        startPlayback();
      };
      audio.addEventListener("loadedmetadata", onReady, { once: true });
    };

    attachAndStart();

    return undefined;
  }, [
    breakMedia?.currentTrack?.url,
    breakMedia?.isPlaying,
    breakMedia?.playbackPositionSeconds,
    breakMedia?.lastActionAt,
    currentSession?.currentPhase,
    currentSession?.status,
    roomVolume,
  ]);

  useEffect(
    () => () => {
      floatingReactionTimersRef.current.forEach(timeoutId =>
        clearTimeout(timeoutId),
      );
      floatingReactionTimersRef.current.clear();
      if (roomMusicFadeFrameRef.current) {
        cancelAnimationFrame(roomMusicFadeFrameRef.current);
        roomMusicFadeFrameRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    setPromptDraft(currentSession?.controls?.activePrompt || "");
  }, [currentSession?.controls?.activePrompt]);

  useEffect(() => {
    whiteboardTextRef.current = whiteboardText;
  }, [whiteboardText]);

  useEffect(() => {
    whiteboardStrokesRef.current = whiteboardStrokes;
  }, [whiteboardStrokes]);

  useEffect(() => {
    if (drawingRef.current) return;
    if (Date.now() - lastLocalWhiteboardEditRef.current < 220) return;
    setWhiteboardText(currentSession?.collaboration?.whiteboard?.content || "");
    setWhiteboardStrokes(
      currentSession?.collaboration?.whiteboard?.strokes || [],
    );
  }, [
    currentSession?.collaboration?.whiteboard?.content,
    currentSession?.collaboration?.whiteboard?.strokes,
  ]);

  useEffect(() => {
    if (currentSession?.status === "active") return;
    remoteLiveStrokeMapRef.current.clear();
    setRemoteLiveStrokes([]);
  }, [currentSession?.status]);

  useEffect(() => {
    setPlanDraft({
      focusTopic:
        activeGroup?.nextSessionPlan?.topic ?? activeGroup?.topic ?? "",
      prepNotes: activeGroup?.nextSessionPlan?.prepNotes ?? "",
      sourceType: activeGroup?.nextSessionPlan?.sourceType ?? "topic",
      sourceLabel: activeGroup?.nextSessionPlan?.sourceLabel ?? "",
      sourceLink: activeGroup?.nextSessionPlan?.sourceLink ?? "",
      sourceText: activeGroup?.nextSessionPlan?.sourceText ?? "",
    });
  }, [activeGroup?.topic, activeGroup?.nextSessionPlan]);

  useEffect(() => {
    setMaterialDraft({
      focusTopic: currentSession?.planning?.focusTopic ?? "",
      prepNotes: currentSession?.planning?.prepNotes ?? "",
      sourceType: currentSession?.planning?.sourceType ?? "topic",
      sourceLabel: currentSession?.planning?.sourceLabel ?? "",
      sourceLink: currentSession?.planning?.sourceLink ?? "",
      sourceText: currentSession?.planning?.sourceText ?? "",
    });
  }, [currentSession?.planning]);

  useEffect(() => {
    setSettingsDraft({
      teachingMinutes: activeGroup?.sessionSettings?.teachingMinutes || 1,
      discussionMinutes: activeGroup?.sessionSettings?.discussionMinutes || 1,
      quizMinutes: activeGroup?.sessionSettings?.quizMinutes || 1,
      breakMinutes: activeGroup?.sessionSettings?.breakMinutes || 1,
      minimumTeachingMinutes:
        activeGroup?.sessionSettings?.minimumTeachingMinutes || 1,
    });
  }, [activeGroup?.sessionSettings]);

  useEffect(() => {
    const liveStrokes = localLiveStroke
      ? [localLiveStroke, ...remoteLiveStrokes]
      : remoteLiveStrokes;
    drawStrokeSet(canvasRef.current, whiteboardStrokes, liveStrokes);
  }, [whiteboardStrokes, remoteLiveStrokes, localLiveStroke]);

  const onlineCount =
    currentSession?.participants?.filter(participant => participant.isOnline)
      .length || 0;
  const currentSubmission = currentSession?.quiz?.submissions?.find(
    submission =>
      (submission.user?._id || submission.user)?.toString() === userId,
  );
  const votedTimeValue = activeGroup?.nextSessionPlan?.votes?.find(
    vote => (vote.user?._id || vote.user)?.toString() === userId,
  )?.time;
  const speakQueue =
    currentSession?.participants?.filter(
      participant => participant.speakRequested,
    ) || [];
  const isMicRevoked = !!myParticipant?.speakRevoked;
  const canEditWhiteboard =
    currentSession?.status === "active" &&
    currentSession?.currentPhase !== "quiz" &&
    (isTeacher ||
      (currentSession?.currentPhase === "discussion" && !isMicRevoked) ||
      (currentSession?.currentPhase === "break" && !isMicRevoked) ||
      (myParticipant?.speakApproved &&
        !myParticipant?.speakMuted &&
        !isMicRevoked));
  const isLiveSession =
    currentSession?.status === "lobby" || currentSession?.status === "active";
  const hasOpenSession = isLiveSession;
  const canManageMaterials =
    isTeacher &&
    (currentSession?.status === "lobby" ||
      (currentSession?.status === "active" &&
        ["teaching", "discussion", "break"].includes(
          currentSession?.currentPhase,
        )));
  const plannedTeacherId =
    activeGroup?.nextSessionPlan?.teacherUser?._id ||
    activeGroup?.nextSessionPlan?.teacherUser;
  const revealedOrPersistedTeacherId =
    currentSession?.nextTeacherUser?._id ||
    currentSession?.nextTeacherUser ||
    plannedTeacherId;
  const isAssignedPlannedTeacher =
    revealedOrPersistedTeacherId?.toString() === userId?.toString();
  const canClearWhiteboard =
    isTeacher ||
    (!isMicRevoked &&
      currentSession?.currentPhase === "discussion" &&
      whiteboardStrokes.some(stroke => stroke.user?.toString?.() === userId));
  const revealedTeacher =
    currentSession?.status === "active"
      ? currentSession?.nextTeacherUser || null
      : currentSession?.nextTeacherUser ||
        activeGroup?.nextSessionPlan?.teacherUser ||
        null;
  const upcomingTime =
    currentSession?.scheduledFor ||
    activeGroup?.nextSessionPlan?.scheduledFor ||
    null;
  const creatorOnlineOnApp = !!activeGroup?.createBy?.isOnlineOnApp;
  const plannedScheduledTime =
    activeGroup?.nextSessionPlan?.scheduledFor || null;
  const plannedScheduledTimeReached =
    !!plannedScheduledTime &&
    Date.now() >= new Date(plannedScheduledTime).getTime() + 1000;
  const scheduledTimeReached =
    !!currentSession?.scheduledFor &&
    Date.now() >= new Date(currentSession.scheduledFor).getTime() + 1000;
  const canFallbackTeacherStart =
    currentSession?.status === "lobby" &&
    isTeacher &&
    !isGroupCreator &&
    !creatorOnlineOnApp &&
    scheduledTimeReached;
  const canCreateLobbyNow =
    !hasOpenSession &&
    (isGroupCreator ||
      (isAssignedPlannedTeacher &&
        !creatorOnlineOnApp &&
        plannedScheduledTimeReached));
  const canCurrentUserStartSession =
    currentSession?.status === "lobby" &&
    (isGroupCreator || canFallbackTeacherStart);
  const hasVisibleTeachingMaterial = !!(
    currentSession?.planning?.sourceLabel ||
    currentSession?.planning?.sourceLink ||
    currentSession?.planning?.sourceText ||
    currentSession?.planning?.focusTopic ||
    currentSession?.planning?.prepNotes
  );
  const isQuizPhase = currentSession?.currentPhase === "quiz";
  const handlePlanSave = async e => {
    e.preventDefault();
    await updateNextSessionPlan(groupId, {
      topic: planDraft.focusTopic,
      prepNotes: planDraft.prepNotes,
      sourceType: planDraft.sourceType,
      sourceLabel: planDraft.sourceLabel,
      sourceLink: planDraft.sourceLink,
      sourceText: planDraft.sourceText,
    });
    await fetchGroupDetails(groupId);
    await fetchMyGroups();
    setFeedbackMessage("Next session plan updated and voting opened.");
  };

  const handleMaterialSave = async e => {
    e.preventDefault();
    await updatePlan(groupId, {
      focusTopic: materialDraft.focusTopic,
      prepNotes: materialDraft.prepNotes,
      sourceType: materialDraft.sourceType,
      sourceLabel: materialDraft.sourceLabel,
      sourceLink: materialDraft.sourceLink,
      sourceText: materialDraft.sourceText,
    });
    setFeedbackMessage("Teaching materials saved for this session.");
  };

  const handleSettingsSave = async e => {
    e.preventDefault();
    await updateSessionSettings(groupId, settingsDraft);
    setFeedbackMessage("Session settings saved.");
  };

  const handleClearPlannedSession = async () => {
    await clearNextSessionPlan(groupId);
    await fetchGroupDetails(groupId);
    await fetchMyGroups();
    setFeedbackMessage(
      "Planned session cleared. The next teacher stays assigned.",
    );
  };

  const handleSaveDirectPlannedSession = async e => {
    return handlePlanSave(e);
  };

  const handleEndSession = async () => {
    await endSession(groupId);
    await fetchGroupDetails(groupId);
    await fetchMyGroups();
    await refreshMe();
    setFeedbackMessage("Session ended.");
  };

  const handleCreateLobby = async () => {
    await createLobby(groupId);
    await fetchGroupDetails(groupId);
    setFeedbackMessage("Lobby created.");
  };

  const handleStartSession = async () => {
    await startSession(groupId);
    setFeedbackMessage("Session started.");
  };

  const handleTeacherReady = async () => {
    await markTeacherReady(groupId);
    setFeedbackMessage("Teacher marked as ready.");
  };

  const handleTeacherSpeakAction = async (participant, action) => {
    const participantName =
      participant.user?.name || participant.user?.email || "Member";
    try {
      await approveSpeaker(
        groupId,
        participant.user?._id || participant.user,
        action,
      );
      await fetchCurrentSession(groupId);
      const messages = {
        approve: `Mic approved for ${participantName}.`,
        mute: `Muted ${participantName}.`,
        unmute: `Unmuted ${participantName}.`,
        revoke: `Mic revoked for ${participantName}. They must request again before speaking.`,
      };
      setFeedbackMessage(messages[action] || "Mic permission updated.");
    } catch (err) {
      setFeedbackMessage(
        err?.response?.data?.message ||
          err?.message ||
          `Could not update mic access for ${participantName}.`,
      );
    }
  };

  const handleRevealTeacher = async () => {
    await revealTeacher(groupId);
    await fetchGroupDetails(groupId);
    setFeedbackMessage("Next teacher revealed.");
  };

  const handleAdvancePhase = async () => {
    await advancePhase(groupId);
    setFeedbackMessage("Advancing to the next mode...");
  };

  const handleVoteForNextSessionTime = async value => {
    await voteNextSessionTime(groupId, value);
    setFeedbackMessage("Your time vote was recorded.");
  };

  const handleFinalizeVote = async () => {
    await finalizeNextSessionPlan(groupId);
    setFeedbackMessage("The next session time was finalized.");
  };

  const handleImportMaterial = async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let contentBase64 = "";
      if (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
      ) {
        const dataUrl = await readFileAsDataUrl(file);
        contentBase64 = dataUrl.split(",")[1] || "";
      } else {
        const content = await readTextLikeFile(file);
        contentBase64 = btoa(unescape(encodeURIComponent(content)));
      }

      const result = await importMaterial(groupId, {
        fileName: file.name,
        mimeType: file.type,
        contentBase64,
      });
      const imported = result?.importedMaterial;
      if (imported) {
        setMaterialDraft(prev => ({
          ...prev,
          sourceType: imported.sourceType || prev.sourceType,
          sourceLabel: imported.sourceLabel || file.name,
          sourceText: imported.sourceText || prev.sourceText,
        }));
      }
      setMaterialImportMessage(
        "Teaching material attached to this study session.",
      );
      setFeedbackMessage("Teaching material saved.");
    } catch (err) {
      setMaterialImportMessage(
        err?.response?.data?.message ||
          err?.message ||
          "That file could not be imported. Try pasting the key text instead.",
      );
    } finally {
      e.target.value = "";
    }
  };

  const handleWithdrawMaterial = async () => {
    await withdrawMaterial(groupId);
    setMaterialDraft(prev => ({
      ...prev,
      sourceType: "topic",
      sourceLabel: "",
      sourceLink: "",
      sourceText: "",
    }));
    setMaterialImportMessage("Uploaded file withdrawn from this session.");
    setFeedbackMessage("Uploaded file withdrawn.");
  };

  const emitWhiteboard = useCallback(
    (nextText, nextStrokes, clear = false) => {
      if (!socket || !connected || !canEditWhiteboard) return;
      lastLocalWhiteboardEditRef.current = Date.now();
      socket.emit("session:whiteboardSync", {
        groupId,
        content: nextText,
        strokes: nextStrokes,
        clear,
      });
    },
    [socket, connected, canEditWhiteboard, groupId],
  );

  const queueWhiteboardSync = useCallback(
    (nextText, nextStrokes, clear = false) => {
      if (whiteboardSyncTimeoutRef.current) {
        clearTimeout(whiteboardSyncTimeoutRef.current);
      }
      whiteboardSyncTimeoutRef.current = setTimeout(() => {
        emitWhiteboard(nextText, nextStrokes, clear);
        whiteboardSyncTimeoutRef.current = null;
      }, 120);
    },
    [emitWhiteboard],
  );

  const emitLiveStrokePoint = useCallback(
    (strokeId, color, point) => {
      if (!socket || !connected || !canEditWhiteboard || !point) return;
      socket.emit("session:whiteboardStrokeLive", {
        groupId,
        strokeId,
        color,
        point,
        finished: false,
      });
    },
    [socket, connected, canEditWhiteboard, groupId],
  );

  const emitLiveStrokeFinished = useCallback(
    strokeId => {
      if (!socket || !connected || !strokeId) return;
      socket.emit("session:whiteboardStrokeLive", {
        groupId,
        strokeId,
        finished: true,
      });
    },
    [socket, connected, groupId],
  );

  const getCanvasPoint = event => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startStroke = event => {
    if (!canEditWhiteboard) return;
    const point = getCanvasPoint(event);
    const stroke = {
      id: `${Date.now()}-${Math.random()}`,
      color: strokeColor,
      points: [point],
      user: userId,
    };
    drawingRef.current = stroke;
    pendingPointRef.current = null;
    setLocalLiveStroke(stroke);
    emitLiveStrokePoint(stroke.id, stroke.color, point);
  };

  const moveStroke = event => {
    if (!drawingRef.current) return;
    pendingPointRef.current = getCanvasPoint(event);
    if (drawingFrameRef.current) return;

    drawingFrameRef.current = requestAnimationFrame(() => {
      drawingFrameRef.current = null;
      if (!drawingRef.current || !pendingPointRef.current) return;
      const point = pendingPointRef.current;
      pendingPointRef.current = null;
      const lastPoint =
        drawingRef.current.points[drawingRef.current.points.length - 1];
      const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
      if (distance < 1.5) return;

      drawingRef.current = {
        ...drawingRef.current,
        points: [...drawingRef.current.points, point].slice(-160),
      };
      setLocalLiveStroke(drawingRef.current);
      emitLiveStrokePoint(
        drawingRef.current.id,
        drawingRef.current.color,
        point,
      );
    });
  };

  const finishStroke = () => {
    if (drawingFrameRef.current) {
      cancelAnimationFrame(drawingFrameRef.current);
      drawingFrameRef.current = null;
    }
    if (pendingPointRef.current && drawingRef.current) {
      const point = pendingPointRef.current;
      pendingPointRef.current = null;
      drawingRef.current = {
        ...drawingRef.current,
        points: [...drawingRef.current.points, point].slice(-160),
      };
    }
    if (!drawingRef.current) return;
    const finishedStroke = drawingRef.current;
    const finishedStrokeId = finishedStroke.id;
    drawingRef.current = null;
    setLocalLiveStroke(null);
    const nextPersistedStrokes = [
      ...whiteboardStrokesRef.current,
      finishedStroke,
    ].slice(-120);
    setWhiteboardStrokes(nextPersistedStrokes);
    whiteboardStrokesRef.current = nextPersistedStrokes;
    emitLiveStrokeFinished(finishedStrokeId);
    queueWhiteboardSync(whiteboardTextRef.current, nextPersistedStrokes);
  };

  const handleWhiteboardText = event => {
    const nextText = event.target.value;
    setWhiteboardText(nextText);
    whiteboardTextRef.current = nextText;
    queueWhiteboardSync(nextText, whiteboardStrokesRef.current);
  };

  const clearWhiteboard = () => {
    remoteLiveStrokeMapRef.current.clear();
    syncRemoteLiveStrokeState();
    setLocalLiveStroke(null);
    if (isTeacher) {
      setWhiteboardText("");
      setWhiteboardStrokes([]);
      whiteboardTextRef.current = "";
      whiteboardStrokesRef.current = [];
      emitWhiteboard("", [], true);
      setFeedbackMessage("Whiteboard cleared.");
      return;
    }

    const nextOwnFiltered = whiteboardStrokesRef.current.filter(
      stroke => stroke.user?.toString?.() !== userId,
    );
    setWhiteboardStrokes(nextOwnFiltered);
    whiteboardStrokesRef.current = nextOwnFiltered;
    emitWhiteboard(whiteboardTextRef.current, nextOwnFiltered, false);
    setFeedbackMessage("Your whiteboard strokes were cleared.");
  };

  const undoWhiteboardStroke = useCallback(() => {
    if (!canEditWhiteboard) return;
    setWhiteboardStrokes(prev => {
      if (!prev.length) return prev;
      let nextStrokes = prev;
      if (isTeacher) {
        nextStrokes = prev.slice(0, -1);
      } else {
        const lastOwnIndex = [...prev]
          .map((stroke, index) => ({ stroke, index }))
          .reverse()
          .find(item => item.stroke.user?.toString?.() === userId)?.index;
        if (lastOwnIndex === undefined) {
          return prev;
        }
        nextStrokes = prev.filter((_, index) => index !== lastOwnIndex);
      }
      whiteboardStrokesRef.current = nextStrokes;
      queueWhiteboardSync(whiteboardTextRef.current, nextStrokes);
      return nextStrokes;
    });
  }, [canEditWhiteboard, isTeacher, queueWhiteboardSync, userId]);

  const requestSpeak = () => {
    if (!socket || !connected) return;
    socket.emit("session:requestSpeak", { groupId });
    setFeedbackMessage("Mic request sent to the teacher.");
  };

  const sendBreakReaction = emoji => {
    if (!socket || !connected) {
      setFeedbackMessage("Connect to session audio first so the room can see your reaction.");
      return;
    }
    spawnFloatingReaction(emoji);
    socket.emit("session:break:react", { groupId, emoji });
    setFeedbackMessage(`Reaction sent: ${emoji}`);
  };

  const submitPrompt = e => {
    e.preventDefault();
    updatePrompt(groupId, promptDraft);
  };

  const submitTrack = e => {
    e.preventDefault();
    if (!trackDraft.title.trim()) return;
    const normalizedUrl = normalizeBreakTrackUrl(trackDraft.url);
    addBreakTrack(groupId, {
      title: trackDraft.title,
      url: normalizedUrl,
    }).then(() => {
      setTrackDraft({ title: "", url: "" });
      setFeedbackMessage("Break track added.");
    });
  };

  const normalizeBreakTrackUrl = input => {
    const value = input.trim();
    if (!value) return "";
    if (/^(https?:)?\/\//i.test(value)) return value;
    if (value.startsWith("/")) return value;
    const cleanValue = value.replace(/^\.\/+/, "").replace(/^\/+/, "");
    return `/music/${cleanValue}`;
  };

  const BREAK_TRACK_SUGGESTIONS = [
    { title: "Lo-fi Focus", url: "/music/lofi-focus.mp3" },
    { title: "Ambient Calm", url: "/music/ambient-calm.mp3" },
    { title: "Jazz Room", url: "/music/jazz-room.mp3" },
  ];

  const chooseBreakTheme = theme => {
    if (!isTeacher || !theme) return;
    setBreakTheme(groupId, theme)
      .then(() => {
        setFeedbackMessage(
          `Break vibe set to ${BREAK_THEME_LIBRARY[theme]?.label || theme}.`,
        );
      })
      .catch(() => {});
  };

  const submitQuiz = e => {
    e.preventDefault();
    const answers = currentSession?.quiz?.questions?.map((_, index) =>
      Number(quizAnswers[index]),
    );
    submitQuizAnswers(groupId, answers);
  };

  useEffect(() => {
    const handleKeyDown = event => {
      if (!canEditWhiteboard) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoWhiteboardStroke();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canEditWhiteboard, undoWhiteboardStroke]);

  return (
    <div className="panel session-panel">
      <div className="card-header">
        <div>
          <p className="section-kicker">Structured Session</p>
          <h3>
            {currentSession?.status === "active"
              ? `${currentSession.currentPhase} mode`
              : currentSession?.status === "lobby"
                ? "Lobby ready"
                : "No live session"}
          </h3>
          <p className="muted">
            {currentSession?.status
              ? PHASE_COPY[currentSession.currentPhase] ||
                "Prepare the group and keep the learning flow intentional."
              : "Use the lobby to prepare, finalize the next session, and keep your group streak alive."}
          </p>
        </div>
        <div className="session-status-block">
          <span className="badge">{currentSession?.status || "idle"}</span>
          <strong>
            {currentSession?.status === "active"
              ? currentSession?.phaseEndsAt &&
                new Date(currentSession.phaseEndsAt).getTime() <= tick
                ? "Switching..."
                : formatShortCountdown(currentSession.phaseEndsAt, tick)
              : connected
                ? "Connected"
                : "Offline"}
          </strong>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {feedbackMessage && (
        <div className="session-feedback-banner">{feedbackMessage}</div>
      )}
      {teachingWarning && (
        <div className="session-warning-banner">{teachingWarning}</div>
      )}
      {currentSession?.controls?.activePrompt && (
        <div className="session-prompt-banner">
          <strong>Teacher prompt:</strong>{" "}
          {currentSession.controls.activePrompt}
          <span className="muted">
            {" "}
            This is a short instruction the teacher sends to guide the room
            right now.
          </span>
        </div>
      )}

      {(currentSession?.status === "lobby" ||
        currentSession?.status === "active") && (
        <div className="quiz-panel">
          <div className="card-header">
            <div>
              <h4>Session Audio</h4>
              <p className="muted">
                {currentSession?.status === "lobby" &&
                  "Use this in the lobby to grant mic permission and check the room before the class starts."}
                {currentSession?.currentPhase === "teaching" &&
                  "The teacher leads audio here. Approved unmuted speakers can join in too."}
                {currentSession?.currentPhase === "discussion" &&
                  "Discussion opens the room more freely. The teacher can still mute participants."}
                {currentSession?.currentPhase === "break" &&
                  "Break keeps the room socially alive while the music and mic stay available."}
                {currentSession?.currentPhase === "quiz" &&
                  "Quiz keeps audio minimized so the room can focus."}
                {currentSession?.currentPhase === "reveal" &&
                  "Wrap up the room while the next teacher reveal happens."}
              </p>
            </div>
            <span className="badge">
              {sessionAudioEnabled ? "Audio available" : "Audio locked"}
            </span>
          </div>
          <p className="muted">
            {connectionStatus === "idle" && "Not joined yet."}
            {connectionStatus === "error" &&
              "Audio connection failed. Check the message below and try again."}
            {connectionStatus === "requesting-room" &&
              "Microphone permission granted. Joining the room..."}
            {connectionStatus === "waiting-for-peers" &&
              "You are in the room. Waiting for another person to connect."}
            {connectionStatus === "connecting" &&
              "Connecting to the other participants..."}
            {connectionStatus === "connected" &&
              "You are connected. Speech should now carry to the room."}
          </p>
          <div className="actions">
            {!joinedBreakAudio ? (
              <button
                className="btn btn-primary"
                disabled={!sessionAudioEnabled}
                onClick={() => {
                  joinAudio().catch(() => {});
                }}
              >
                {sessionAudioEnabled
                  ? "Join Session Audio"
                  : "Wait for your phase permission"}
              </button>
            ) : (
              <>
                <button
                  className="btn btn-primary"
                  onClick={toggleMic}
                  disabled={!micTransmissionAllowed}
                >
                  {!micTransmissionAllowed
                    ? "Muted by teacher"
                    : micEnabled
                      ? "Mute My Mic"
                      : "Unmute My Mic"}
                </button>
                <button className="btn btn-ghost" onClick={leaveAudio}>
                  Leave Audio
                </button>
              </>
            )}
          </div>
          <p className="muted">
            {joinedBreakAudio
              ? `${remotePeers.length} peer(s) connected in session audio.`
              : audioError ||
                "Join the room audio when this phase and your role allow it."}
          </p>
          {joinedBreakAudio && (
            <div className="stack-list compact">
              <div className="stack-item row">
                <span>My mic</span>
                <span className="muted">
                  {!micTransmissionAllowed
                    ? "Muted by teacher"
                    : speakerLevels.local > 0.12
                      ? "Speaking"
                      : "Listening"}
                </span>
                <div
                  className={`audio-meter ${
                    speakerLevels.local > 0.12 ? "speaking" : ""
                  }`}
                >
                  {[9, 7, 3, 6, 4].map((multiplier, index) => (
                    <span
                      key={`local-meter-${index}`}
                      style={{
                        height: `${Math.max(
                          6,
                          Math.round(
                            (speakerLevels.local || 0) * 26 * multiplier + 8,
                          ),
                        )}px`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          {(audioError || debugEvents.length > 0) && (
            <details className="compact-details" open={Boolean(audioError)}>
              <summary>Audio debug</summary>
              {audioError && <p className="muted">{audioError}</p>}
              <div className="stack-list compact">
                {debugEvents.map(event => (
                  <div key={event.id} className="stack-item">
                    <strong>{event.label}</strong>
                    <span className="muted">
                      {event.timestamp}
                      {event.detail ? ` · ${event.detail}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
          {joinedBreakAudio && remotePeers.length > 0 && (
            <div className="stack-list compact">
              {remotePeers.map(peer => (
                <div key={peer.socketId} className="stack-item row">
                  <span>{peer.user?.name || peer.user?.email || "Peer"}</span>
                  <span className="muted">
                    {(speakerLevels.peers?.[peer.socketId] || 0) > 0.12
                      ? "Speaking"
                      : "Connected"}
                  </span>
                  <div
                    className={`audio-meter ${
                      (speakerLevels.peers?.[peer.socketId] || 0) > 0.12
                        ? "speaking"
                        : ""
                    }`}
                  >
                    {[0.35, 0.55, 0.8, 0.6, 0.42].map((multiplier, index) => (
                      <span
                        key={`${peer.socketId}-meter-${index}`}
                        style={{
                          height: `${Math.max(
                            6,
                            Math.round(
                              (speakerLevels.peers?.[peer.socketId] || 0) *
                                26 *
                                multiplier +
                                6,
                            ),
                          )}px`,
                        }}
                      />
                    ))}
                  </div>
                  <audio
                    autoPlay
                    playsInline
                    ref={element => {
                      if (!element) {
                        remoteAudioRefs.current.delete(peer.socketId);
                        return;
                      }
                      remoteAudioRefs.current.set(peer.socketId, element);
                      element.volume = roomVolume;
                      element.muted = false;
                      if (
                        peer.stream &&
                        element.srcObject !== peer.stream
                      ) {
                        element.srcObject = peer.stream;
                        element.play().catch(() => {});
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="detail-grid">
        <div>
          <div className="stat-label">Teacher</div>
          <div>{currentSession?.teacherUser?.name || "Not assigned"}</div>
        </div>
        <div>
          <div className="stat-label">Group streak</div>
          <div>{activeGroup?.studyStreak || 0} days</div>
        </div>
        <div>
          <div className="stat-label">Presence</div>
          <div>{onlineCount} online</div>
        </div>
        <div>
          <div className="stat-label">Your role</div>
          <div>
            {isTeacher
              ? "Teacher"
              : myParticipant?.speakRevoked
                ? myParticipant?.speakRequested
                  ? "Mic revoked, request pending"
                  : "Mic revoked"
                : myParticipant?.speakApproved && myParticipant?.speakMuted
                  ? "Approved but muted"
                  : myParticipant?.speakApproved
                    ? "Approved speaker"
                    : myParticipant?.speakRequested
                      ? "Request pending"
                      : "Student"}
          </div>
        </div>
        <div>
          <div className="stat-label">Next teacher</div>
          <div>{revealedTeacher?.name || "To be revealed at session end"}</div>
        </div>
        <div>
          <div className="stat-label">Next session</div>
          <div>
            {upcomingTime
              ? new Date(upcomingTime).toLocaleString()
              : "Not finalized"}
          </div>
        </div>
      </div>

      {(revealedTeacher ||
        upcomingTime ||
        activeGroup?.nextSessionPlan?.topic) && (
        <div className="summary-card session-next-card">
          <strong>Upcoming Session Plan</strong>
          <span className="muted">
            Next teacher:{" "}
            {currentSession?.status === "active"
              ? "Hidden until session end"
              : revealedTeacher?.name || "Waiting for reveal"}
          </span>
          <span className="muted">
            Topic: {activeGroup?.nextSessionPlan?.topic || "Pending topic"}
          </span>
          <span className="muted">
            Starts:{" "}
            {upcomingTime
              ? new Date(upcomingTime).toLocaleString()
              : "Not finalized yet"}
          </span>
          {!hasOpenSession &&
            activeGroup?.nextSessionPlan?.planStatus === "voting" &&
            activeGroup?.nextSessionPlan?.voteWindowEndsAt && (
              <span className="muted">
                Time vote window:{" "}
                {formatLongCountdown(
                  activeGroup.nextSessionPlan.voteWindowEndsAt,
                  tick,
                )}
              </span>
            )}
          {upcomingTime && (
            <span className="muted">
              Countdown: {formatLongCountdown(upcomingTime, tick)}
            </span>
          )}
          {!hasOpenSession && isGroupCreator && (
            <div className="actions">
              <button
                className="btn btn-danger"
                onClick={handleClearPlannedSession}
              >
                Delete Planned Session
              </button>
              {activeGroup?.nextSessionPlan?.planStatus === "voting" && (
                <button className="btn btn-ghost" onClick={handleFinalizeVote}>
                  Finalize Vote Result
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!hasOpenSession && isGroupCreator && (
        <div className="quiz-panel">
          <div className="card-header">
            <div>
              <h4>Planned Next Session</h4>
              <p className="muted">
                Set what should be taught next. Once saved, the time poll opens
                for the group.
              </p>
            </div>
          </div>
          <form
            className="whiteboard-form"
            onSubmit={handleSaveDirectPlannedSession}
          >
            <input
              value={planDraft.focusTopic}
              onChange={e =>
                setPlanDraft(prev => ({ ...prev, focusTopic: e.target.value }))
              }
              placeholder="What should be taught next?"
            />
            <textarea
              rows={4}
              value={planDraft.prepNotes}
              onChange={e =>
                setPlanDraft(prev => ({ ...prev, prepNotes: e.target.value }))
              }
              placeholder="Summarize what the group agreed should be covered next."
            />
            <select
              value={planDraft.sourceType}
              onChange={e =>
                setPlanDraft(prev => ({ ...prev, sourceType: e.target.value }))
              }
            >
              <option value="topic">Topic only</option>
              <option value="notes">Study notes</option>
              <option value="pdf">PDF material</option>
              <option value="link">Link/article</option>
            </select>
            <div className="actions">
              <button className="btn btn-primary" disabled={actionLoading}>
                Save Planned Session
              </button>
            </div>
          </form>
        </div>
      )}

      {!hasOpenSession &&
        activeGroup?.nextSessionPlan?.planStatus === "voting" &&
        activeGroup?.nextSessionPlan?.listedTimeOptions?.length > 0 && (
          <div className="quiz-panel">
            <div className="card-header">
              <div>
                <h4>Vote For The Next Session Time</h4>
                <p className="muted">
                  Everyone gets one confirmed vote. If fewer than half the group
                  votes, the creator will need to update the plan again.
                </p>
              </div>
              <span className="badge">
                {activeGroup?.nextSessionPlan?.planStatus || "draft"}
              </span>
            </div>
            <div className="participant-list">
              {activeGroup.nextSessionPlan.listedTimeOptions.map(option => (
                <button
                  key={option.value}
                  className={`interest-pill ${
                    votedTimeValue &&
                    new Date(votedTimeValue).toISOString() ===
                      new Date(option.value).toISOString()
                      ? "primary"
                      : ""
                  }`}
                  disabled={
                    actionLoading ||
                    !!votedTimeValue ||
                    activeGroup?.nextSessionPlan?.planStatus === "finalized"
                  }
                  onClick={() => handleVoteForNextSessionTime(option.value)}
                >
                  {option.label} | {option.voteCount || 0} vote
                  {(option.voteCount || 0) === 1 ? "" : "s"}
                </button>
              ))}
            </div>
          </div>
        )}

      <div className="participant-list">
        {currentSession?.participants?.map(participant => (
          <span
            key={participant.user?._id || participant.user}
            className={`chip ${participant.isOnline ? "chip-online" : ""}`}
          >
            {participant.user?.name || participant.user?.email || "Member"}
            {participant.speakRequested ? " - wants mic" : ""}
            {participant.speakRevoked ? " - revoked" : ""}
            {participant.speakApproved && participant.speakMuted
              ? " - muted"
              : ""}
          </span>
        ))}
      </div>

      <div className="actions">
        {!hasOpenSession &&
          (canCreateLobbyNow ? (
            <button
              className="btn btn-primary"
              disabled={actionLoading}
              onClick={handleCreateLobby}
            >
              {actionLoading ? "Creating..." : "Create Lobby"}
            </button>
          ) : (
            <span className="muted">
              Waiting for the creator, or for the assigned teacher after the
              scheduled time if the creator is unavailable.
            </span>
          ))}
        {currentSession?.status === "lobby" && (
          <>
            {canCurrentUserStartSession ? (
              <button
                className="btn btn-primary"
                disabled={actionLoading}
                onClick={handleStartSession}
              >
                {actionLoading ? "Starting..." : "Start Session"}
              </button>
            ) : (
              <span className="muted">
                {isTeacher
                  ? "Waiting for the creator to start, unless the scheduled time passes and the creator is unavailable."
                  : "Waiting for the creator to start the session."}
              </span>
            )}
            <div className="break-room-controls">
              <label className="break-volume-control" htmlFor="break-room-volume">
                <span>Room volume</span>
                <input
                  id="break-room-volume"
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(roomVolume * 100)}
                  onChange={e => setRoomVolume(Number(e.target.value) / 100)}
                />
                <strong>{Math.round(roomVolume * 100)}%</strong>
              </label>
            </div>
            {isTeacher && (
              <button
                className="btn btn-ghost"
                disabled={actionLoading}
                onClick={handleTeacherReady}
              >
                {currentSession?.teacherPrepared
                  ? "Teacher Ready"
                  : "Mark Ready"}
              </button>
            )}
          </>
        )}
        {currentSession?.status === "active" &&
          !isTeacher &&
          (currentSession.currentPhase === "teaching" ||
            myParticipant?.speakRevoked) && (
            <button className="btn btn-ghost" onClick={requestSpeak}>
              {myParticipant?.speakRequested
                ? "Waiting for teacher"
                : myParticipant?.speakRevoked
                  ? "Request Mic Again"
                  : "Request Mic"}
            </button>
          )}
        {currentSession?.status === "active" && isTeacher && (
          <>
            <button
              className="btn btn-primary"
              disabled={actionLoading}
              onClick={handleAdvancePhase}
            >
              {actionLoading ? "Advancing..." : "Advance Phase"}
            </button>
            <button
              className="btn btn-ghost"
              disabled={actionLoading}
              onClick={() => toggleChatFreeze(groupId)}
            >
              {currentSession?.controls?.chatFrozen
                ? "Unfreeze Chat"
                : "Freeze Chat"}
            </button>
          </>
        )}
        {isLiveSession && (isTeacher || isGroupCreator) && (
          <button
            className="btn btn-ghost"
            disabled={actionLoading}
            onClick={handleEndSession}
          >
            End Session
          </button>
        )}
        {currentSession?.status === "active" &&
          currentSession?.currentPhase === "reveal" &&
          ((currentSession?.revealAvailableTo === "creator" &&
            isGroupCreator) ||
            (currentSession?.revealAvailableTo === "teacher" && isTeacher)) && (
            <button
              className="btn btn-primary"
              disabled={actionLoading}
              onClick={handleRevealTeacher}
            >
              Reveal Teacher
            </button>
          )}
      </div>

      {currentSession?.status === "lobby" &&
        currentSession?.teacherPrepared &&
        isGroupCreator && (
          <div className="summary-card">
            <strong>The teacher is ready.</strong>
            <span className="muted">
              Materials and teaching setup are ready now. You can start the
              session once the assigned teacher is present.
            </span>
          </div>
        )}

      {canManageMaterials && (
        <details className="quiz-panel" open={!isQuizPhase}>
          <summary className="card-header">
            <div>
              <h4>Teaching Materials</h4>
              <p className="muted">
                Only the current teacher can update links, notes, or upload
                material before and during teaching.
              </p>
            </div>
            <span className="badge">
              {isQuizPhase ? "Collapsed in quiz" : "Open"}
            </span>
          </summary>
          <form className="whiteboard-form" onSubmit={handleMaterialSave}>
            <input
              value={materialDraft.sourceLabel}
              onChange={e =>
                setMaterialDraft(prev => ({
                  ...prev,
                  sourceLabel: e.target.value,
                }))
              }
              placeholder="Material label"
            />
            <input
              value={materialDraft.sourceLink}
              onChange={e =>
                setMaterialDraft(prev => ({
                  ...prev,
                  sourceLink: e.target.value,
                }))
              }
              placeholder="Material link"
            />
            <textarea
              rows={3}
              value={materialDraft.sourceText}
              onChange={e =>
                setMaterialDraft(prev => ({
                  ...prev,
                  sourceText: e.target.value,
                }))
              }
              placeholder="Paste teaching notes or excerpts for the next quiz/source context."
            />
            <input
              type="file"
              accept=".txt,.md,.csv,.json,.js,.py,.html,.css,.pdf"
              onChange={handleImportMaterial}
            />
            {materialImportMessage && (
              <span className="muted">{materialImportMessage}</span>
            )}
            <div className="actions">
              <button className="btn btn-primary" disabled={actionLoading}>
                Save Materials
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={actionLoading || !hasVisibleTeachingMaterial}
                onClick={handleWithdrawMaterial}
              >
                Withdraw Uploaded File
              </button>
            </div>
          </form>
        </details>
      )}

      {hasVisibleTeachingMaterial && (
        <details className="quiz-panel" open={!isQuizPhase}>
          <summary className="card-header">
            <div>
              <h4>Session Material</h4>
              <p className="muted">
                Everyone in the room can view the material the teacher is using
                for this session.
              </p>
            </div>
            <span className="badge">
              {isQuizPhase ? "Collapsed in quiz" : "Open"}
            </span>
          </summary>
          <div className="stack-list compact">
            {currentSession?.planning?.focusTopic && (
              <div className="stack-item">
                <strong>Topic</strong>
                <span className="muted">
                  {currentSession.planning.focusTopic}
                </span>
              </div>
            )}
            {currentSession?.planning?.sourceLabel && (
              <div className="stack-item">
                <strong>Material label</strong>
                <span className="muted">
                  {currentSession.planning.sourceLabel}
                </span>
              </div>
            )}
            {currentSession?.planning?.sourceLink && (
              <div className="stack-item">
                <strong>Link</strong>
                <a
                  href={currentSession.planning.sourceLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  {currentSession.planning.sourceLink}
                </a>
              </div>
            )}
            {currentSession?.planning?.prepNotes && (
              <div className="stack-item">
                <strong>Notes</strong>
                <span className="muted">
                  {currentSession.planning.prepNotes}
                </span>
              </div>
            )}
            {currentSession?.planning?.sourceText && (
              <div className="stack-item">
                <strong>Source text</strong>
                <span className="muted">
                  {currentSession.planning.sourceText}
                </span>
              </div>
            )}
          </div>
        </details>
      )}

      {isGroupCreator && (
        <div className="quiz-panel">
          <div className="card-header">
            <div>
              <h4>Persistent Session Settings</h4>
              <p className="muted">
                These defaults carry into future sessions until you change them.
              </p>
            </div>
          </div>
          <form className="session-settings-form" onSubmit={handleSettingsSave}>
            <input
              type="number"
              min="1"
              value={settingsDraft.teachingMinutes}
              onChange={e =>
                setSettingsDraft(prev => ({
                  ...prev,
                  teachingMinutes: Number(e.target.value),
                }))
              }
              placeholder="Teaching minutes"
            />
            <input
              type="number"
              min="1"
              value={settingsDraft.discussionMinutes}
              onChange={e =>
                setSettingsDraft(prev => ({
                  ...prev,
                  discussionMinutes: Number(e.target.value),
                }))
              }
              placeholder="Discussion minutes"
            />

            <input
              type="number"
              min="1"
              value={settingsDraft.breakMinutes}
              onChange={e =>
                setSettingsDraft(prev => ({
                  ...prev,
                  breakMinutes: Number(e.target.value),
                }))
              }
              placeholder="Break minutes"
            />
            <input
              type="number"
              min="1"
              value={settingsDraft.quizMinutes}
              onChange={e =>
                setSettingsDraft(prev => ({
                  ...prev,
                  quizMinutes: Number(e.target.value),
                }))
              }
              placeholder="Quiz minutes"
            />
            <input
              type="number"
              min="1"
              value={settingsDraft.minimumTeachingMinutes}
              onChange={e =>
                setSettingsDraft(prev => ({
                  ...prev,
                  minimumTeachingMinutes: Number(e.target.value),
                }))
              }
              placeholder="Minimum teaching minutes"
            />
            <button className="btn btn-primary" disabled={actionLoading}>
              Save Settings
            </button>
          </form>
        </div>
      )}

      {(currentSession?.status === "active" ||
        currentSession?.status === "lobby") &&
        isTeacher && (
          <div className="quiz-panel">
            <div className="card-header">
              <div>
                <h4>Teacher Controls</h4>
                <p className="muted">
                  Approve, mute, unmute, or revoke mic access as the session
                  flows, including lobby mic checks.
                </p>
              </div>
            </div>
            {currentSession?.status === "active" && (
              <form className="teacher-prompt-form" onSubmit={submitPrompt}>
                <input
                  value={promptDraft}
                  onChange={e => setPromptDraft(e.target.value)}
                  placeholder="A short instruction the teacher sends to guide the room right now."
                />
                <button className="btn btn-primary" disabled={actionLoading}>
                  Update Prompt
                </button>
              </form>
            )}

            <div className="stack-list compact">
              {currentSession?.participants?.map(participant => (
                <div
                  key={participant.user?._id || participant.user}
                  className="stack-item row"
                >
                  <span>
                    {participant.user?.name ||
                      participant.user?.email ||
                      "Member"}
                    {(participant.user?._id || participant.user)?.toString() ===
                      userId?.toString() && speakerLevels.local > 0.12
                      ? " - speaking"
                      : ""}
                  </span>
                  {!(
                    (participant.user?._id || participant.user)?.toString() ===
                    teacherId?.toString()
                  ) && (
                    <div className="actions">
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={actionLoading}
                        onClick={() =>
                          handleTeacherSpeakAction(participant, "approve")
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={actionLoading}
                        onClick={() =>
                          handleTeacherSpeakAction(participant, "mute")
                        }
                      >
                        Mute
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={actionLoading}
                        onClick={() =>
                          handleTeacherSpeakAction(participant, "unmute")
                        }
                      >
                        Unmute
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={actionLoading}
                        onClick={() =>
                          handleTeacherSpeakAction(participant, "revoke")
                        }
                      >
                        Revoke
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {speakQueue.length > 0 && (
              <p className="muted">
                {speakQueue.length} participant(s) currently waiting for mic
                approval.
              </p>
            )}
          </div>
        )}

      {currentSession?.status === "active" && (
        <details className="quiz-panel" open={!isQuizPhase}>
          <summary className="card-header">
            <div>
              <h4>Realtime Whiteboard</h4>
              <p className="muted">
                Live text notes and quick sketching for worked examples.
              </p>
            </div>
            <span className="badge">
              {isQuizPhase
                ? "Collapsed in quiz"
                : canEditWhiteboard
                  ? "Editable"
                  : "Locked"}
            </span>
          </summary>
          <textarea
            rows={5}
            value={whiteboardText}
            onChange={handleWhiteboardText}
            disabled={!canEditWhiteboard}
            placeholder="Type shared notes here. Everyone in the room sees updates in real time."
          />
          <div className="whiteboard-tools">
            {["#263238", "#607d8b", "#a5c2b1", "#c78a8c"].map(color => (
              <button
                key={color}
                type="button"
                className={`whiteboard-swatch ${strokeColor === color ? "active" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => setStrokeColor(color)}
              />
            ))}
            {canEditWhiteboard && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={undoWhiteboardStroke}
              >
                Undo
              </button>
            )}
            {canClearWhiteboard && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={clearWhiteboard}
              >
                Clear Board
              </button>
            )}
          </div>
          <canvas
            ref={canvasRef}
            width={620}
            height={260}
            className={`whiteboard-canvas ${canEditWhiteboard ? "editable" : ""}`}
            onMouseDown={startStroke}
            onMouseMove={moveStroke}
            onMouseUp={finishStroke}
            onMouseLeave={finishStroke}
          />
          {!canEditWhiteboard && (
            <p className="muted">
              In teaching mode, the teacher and approved unmuted speakers can
              use the board. Discussion mode opens it to everyone.
            </p>
          )}
        </details>
      )}

      {currentSession?.status === "active" &&
        currentSession?.currentPhase === "break" && (
          <div
            className={`quiz-panel break-lounge-shell break-theme-${breakMedia?.theme || "lofi-focus"}`}
            style={{
              "--break-accent": breakTheme.accent,
              "--break-glow": breakTheme.glow,
            }}
          >
            <div className="break-floating-reactions" aria-hidden="true">
              {floatingReactions.map(reaction => (
                <span
                  key={reaction.id}
                  className="break-floating-reaction"
                  style={{
                    left: `${reaction.left}%`,
                    animationDuration: `${reaction.duration}ms`,
                    animationDelay: `${reaction.delay}ms`,
                    "--reaction-drift": `${reaction.drift}px`,
                    "--reaction-size": reaction.size,
                  }}
                >
                  {reaction.emoji}
                </span>
              ))}
            </div>
            <div className="card-header">
              <div>
                <h4>Break Lounge</h4>
                <p className="muted">{breakTheme.description}</p>
              </div>
              <div className="stack-list compact">
                <span className="badge">Room vibe: {breakTheme.label}</span>
                <span className="badge">Break ends in {breakCountdown}</span>
                {breakMedia?.currentTrack && (
                  <span className="badge">
                    {breakMedia.isPlaying ? "Playing" : "Paused"}:{" "}
                    {breakMedia.currentTrack.title}
                  </span>
                )}
              </div>
            </div>
            <div className="break-ambient-stage">
              <div className="break-ambient-glow" />
              <div>
                <div className="break-ambient-kicker">Shared ambient room</div>
                <h5>{breakTheme.label}</h5>
                <p className="muted">
                  The room stays socially alive while music, presence, and
                  gentle reactions keep the break from feeling empty.
                </p>
                <div className="break-stat-row">
                  <span className="break-stat">
                    {currentSession?.participants?.filter(
                      participant => participant.isOnline,
                    ).length || 0}{" "}
                    online
                  </span>
                  <span className="break-stat">{remotePeers.length} in voice</span>
                  <span className="break-stat">Energy {Math.round(breakEnergy * 100)}%</span>
                </div>
              </div>
              <div
                className={`break-wave ${breakEnergy > 0.3 ? "active" : ""}`}
              >
                {[0.45, 0.7, 1, 0.82, 0.58, 0.36].map((multiplier, index) => (
                  <span
                    key={`break-wave-${index}`}
                    style={{
                      height: `${Math.max(
                        18,
                        Math.round(18 + breakEnergy * 40 * multiplier),
                      )}px`,
                    }}
                  />
                ))}
              </div>
            </div>
            <audio
              ref={roomMusicRef}
              preload="auto"
              crossOrigin="anonymous"
              aria-hidden="true"
              tabIndex={-1}
              style={{ display: "none" }}
            />
            <div className="break-theme-grid">
              {(breakMedia?.availableThemes || []).map(theme => (
                <button
                  key={theme.key}
                  type="button"
                  className={`break-theme-card ${
                    breakMedia?.theme === theme.key ? "active" : ""
                  }`}
                  disabled={actionLoading || !isTeacher}
                  onClick={() => chooseBreakTheme(theme.key)}
                >
                  <strong>{theme.label}</strong>
                  <span>{theme.description}</span>
                </button>
              ))}
            </div>
            <div className="break-reaction-bar">
              {["🔥", "👏", "💭", "☕", "✨", "🎧"].map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  className="break-reaction-chip"
                  disabled={!joinedBreakAudio}
                  onClick={() => sendBreakReaction(emoji)}
                >
                  <span>{emoji}</span>
                </button>
              ))}
            </div>
            {isTeacher && (
              <div className="break-music-card">
                <div className="card-header">
                  <div>
                    <h5>Room Music</h5>
                    <p className="muted">
                      Drop files into <code>frontend/public/music</code> or
                      paste a direct audio file URL.
                    </p>
                  </div>
                  <span className="badge">Teacher only</span>
                </div>
                <form className="break-track-form" onSubmit={submitTrack}>
                  <div className="break-track-grid">
                    <input
                      value={trackDraft.title}
                      onChange={e =>
                        setTrackDraft(prev => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder="Track title"
                    />
                    <input
                      value={trackDraft.url}
                      onChange={e =>
                        setTrackDraft(prev => ({
                          ...prev,
                          url: e.target.value,
                        }))
                      }
                      placeholder="/music/lofi-01.mp3 or https://..."
                    />
                  </div>
                  <div className="break-track-suggestions">
                    {BREAK_TRACK_SUGGESTIONS.map(track => (
                      <button
                        key={track.url}
                        type="button"
                        className="track-suggestion-chip"
                        onClick={() =>
                          setTrackDraft({
                            title: track.title,
                            url: track.url,
                          })
                        }
                      >
                        <strong>{track.title}</strong>
                        <span>{track.url}</span>
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-primary" disabled={actionLoading}>
                    Add Track
                  </button>
                </form>
              </div>
            )}
            <div className="break-room-layout">
              <div className="break-audio-panel">
                <p className="muted">
                  {joinedBreakAudio
                    ? `${remotePeers.length} peer(s) connected in the room while break is live.`
                    : "Use the Session Audio panel above to join the room voice during break."}
                </p>
                <div className="break-mini-summary">
                  <span className="badge">Listeners: {currentSession?.participants?.filter(participant => participant.isOnline).length || 0}</span>
                  <span className="badge">Theme: {breakTheme.label}</span>
                  <span className="badge">Ends {breakCountdown}</span>
                </div>
                {remotePeers.length > 0 && (
                  <div className="stack-list compact">
                    {remotePeers.map(peer => (
                      <div key={peer.socketId} className="stack-item row">
                        <span>
                          {peer.user?.name || peer.user?.email || "Peer"}
                        </span>
                        <span className="muted">Connected</span>
                        <audio
                          autoPlay
                          playsInline
                          ref={element => {
                            if (
                              element &&
                              peer.stream &&
                              element.srcObject !== peer.stream
                            ) {
                              element.srcObject = peer.stream;
                              element.play().catch(() => {});
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="break-activity-feed">
                <div className="card-header">
                  <h5>Room activity</h5>
                  <span className="badge">{breakActivityFeed.length}</span>
                </div>
                {breakActivityFeed.length > 0 ? (
                  <div className="stack-list compact">
                    {breakActivityFeed.map(activity => (
                      <div
                        key={`${activity.createdAt}-${activity.label}`}
                        className="break-activity-card"
                      >
                        <strong>{activity.label}</strong>
                        {activity.detail && (
                          <span className="muted">{activity.detail}</span>
                        )}
                        <span className="muted">
                          {activity.createdBy?.name ||
                            activity.createdBy?.email ||
                            "System"}{" "}
                          - {new Date(activity.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    No room events yet. Start the break by adding a track,
                    changing the vibe, or dropping a quick reaction.
                  </p>
                )}
              </div>
            </div>
            {breakMedia?.queue?.length > 0 && (
              <>
                <div className="actions">
                  <button
                    className="btn btn-ghost"
                    disabled={actionLoading || !isTeacher}
                    onClick={() => controlBreakMedia(groupId, "previous")}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={actionLoading || !isTeacher}
                    onClick={() =>
                      controlBreakMedia(
                        groupId,
                        breakMedia.isPlaying ? "pause" : "play",
                      )
                    }
                  >
                    {breakMedia.isPlaying ? "Pause" : "Play"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={actionLoading || !isTeacher}
                    onClick={() => controlBreakMedia(groupId, "next")}
                  >
                    Next
                  </button>
                </div>
                <div className="stack-list compact">
                  {breakMedia.queue.map((track, index) => (
                    <div
                      key={`${track.title}-${index}`}
                      className="stack-item row"
                    >
                      <span>
                        {index === breakMedia.currentTrackIndex
                          ? "Now up: "
                          : ""}
                        {track.title}
                      </span>
                      <span className="muted">
                        {track.addedBy?.name ||
                          track.addedBy?.email ||
                          "Member"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      {currentSession?.currentPhase === "quiz" &&
        currentSession.quiz?.questions?.length > 0 && (
          <div className="quiz-panel">
            <div className="card-header">
              <div>
                <h4>Quiz Round</h4>
                <p className="muted">
                  Topic: {currentSession.quiz.topic || "general study"}
                </p>
              </div>
              <span className="badge">
                {currentSession.quiz.source === "ai-session-material"
                  ? "AI from session material"
                  : currentSession.quiz.source === "session-material"
                    ? "From session material"
                    : "Fallback quiz"}
              </span>
            </div>
            {!currentSubmission ? (
              <form className="quiz-form" onSubmit={submitQuiz}>
                {currentSession.quiz.questions.map((question, index) => (
                  <div key={question.id} className="quiz-question">
                    <strong>
                      {index + 1}. {question.prompt}
                    </strong>
                    <div className="quiz-options">
                      {question.options.map((option, optionIndex) => (
                        <label key={option} className="quiz-option">
                          <input
                            type="radio"
                            name={`quiz-${index}`}
                            checked={Number(quizAnswers[index]) === optionIndex}
                            onChange={() =>
                              setQuizAnswers(prev => ({
                                ...prev,
                                [index]: optionIndex,
                              }))
                            }
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button className="btn btn-primary" disabled={quizSubmitting}>
                  {quizSubmitting ? "Submitting..." : "Submit Quiz"}
                </button>
              </form>
            ) : (
              <p className="muted">
                Quiz submitted. Check the leaderboard below.
              </p>
            )}
          </div>
        )}

      {currentSession?.quiz?.releasedAt &&
        (currentSession?.quiz?.submissions?.length > 0 ||
          currentSession?.currentPhase === "reveal") && (
          <div className="quiz-panel">
            <div className="card-header">
              <h4>Quiz Leaderboard</h4>
            </div>
            <div className="leaderboard-podium">
              {currentSession.quiz.leaderboard.slice(0, 3).map(entry => (
                <div
                  key={entry.user?._id || entry.user}
                  className={`leaderboard-card rank-${entry.rank}`}
                >
                  <strong>
                    {entry.rank === 1
                      ? "1st"
                      : entry.rank === 2
                        ? "2nd"
                        : "3rd"}
                  </strong>
                  <span>
                    {entry.user?.name || entry.user?.email || "Member"}
                  </span>
                  <span className="muted">Score {entry.quizScoreTotal}</span>
                </div>
              ))}
            </div>
            {currentSession.quiz.leaderboard.length > 3 && (
              <div className="stack-list compact">
                {currentSession.quiz.leaderboard.slice(3).map(entry => (
                  <div
                    key={entry.user?._id || entry.user}
                    className="stack-item row"
                  >
                    <span>
                      #{entry.rank}{" "}
                      {entry.user?.name || entry.user?.email || "Member"}
                    </span>
                    <span className="muted">Score {entry.quizScoreTotal}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      {sessionHistory?.length > 0 && (
        <div className="quiz-panel">
          <div className="card-header">
            <h4>Recent Session History</h4>
          </div>
          <div className="stack-list compact">
            {sessionHistory.map(history => (
              <div key={history._id} className="summary-card">
                <strong>{history.participantCount} participants</strong>
                <span className="muted">
                  Teacher:{" "}
                  {history.teacherUser?.name ||
                    history.teacherUser?.email ||
                    "Unknown"}
                </span>
                <span className="muted">
                  Ended {new Date(history.endedAt).toLocaleString()}
                </span>
                {history.topSummary && (
                  <>
                    <span className="muted">
                      Top performer: {history.topSummary.topPerformerLabel}
                    </span>
                    <span className="muted">
                      {history.topSummary.participationNote}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="muted">Loading session...</p>}
    </div>
  );
}

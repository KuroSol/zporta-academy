import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getDatabase,
  ref,
  onValue,
  set,
  push,
  remove,
  onDisconnect
} from 'firebase/database';

// WebRTC STUN servers for NAT traversal. Using public Google servers.
const servers = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
  ],
  iceCandidatePoolSize: 10,
};

/**
 * A React hook for real-time collaboration:
 * - screen share (WebRTC)
 * - cursor tracking
 * - drawing
 * - now: remote scroll sync
 */
export const useCollaboration = (roomId, userId, userName) => {
  const db = getDatabase();
  // ← NEW: scroll channel
  const scrollRef = ref(db, `sessions/${roomId}/scroll`);

  const peerConnection = useRef(null);
  const localStream    = useRef(null);
  const remoteStream   = useRef(new MediaStream());
  const drawingCanvasRef = useRef(null);

  const [isSessionCreator, setIsSessionCreator] = useState(false);
  const [remoteUser, setRemoteUser]           = useState(null);
  const [peerCursors, setPeerCursors]         = useState({});
  const [isSharing, setIsSharing]             = useState(false);

  const sessionRef      = ref(db, `sessions/${roomId}`);
  const participantsRef = ref(db, `sessions/${roomId}/participants`);
  const offerRef        = ref(db, `sessions/${roomId}/offer`);
  const answerRef       = ref(db, `sessions/${roomId}/answer`);
  const cursorsRef      = ref(db, `sessions/${roomId}/cursors`);
  const drawingsRef     = ref(db, `sessions/${roomId}/drawings`);
  const iceCandidatesRef = peerId => ref(db, `sessions/${roomId}/iceCandidates/${peerId}`);

  // ─── 1) Main setup & teardown ───────────────────────────────────────
  useEffect(() => {
    if (!roomId || !userId) return;

    const setup = async () => {
      // A) WebRTC peer
      peerConnection.current = new RTCPeerConnection(servers);

      // B) announce ourselves in `participants`
      const meRef = ref(db, `sessions/${roomId}/participants/${userId}`);
      await set(meRef, true);
      onDisconnect(meRef).remove();

      // C) detect caller vs callee
      onValue(participantsRef, snap => {
        const parts = snap.val() || {};
        const others = Object.keys(parts).filter(id => id !== userId);
        setRemoteUser(others[0] || null);
        if (others.length === 0) setIsSessionCreator(true);
      }, { onlyOnce: true });

      // D) WebRTC track handler
      peerConnection.current.ontrack = e => {
        e.streams[0].getTracks().forEach(t => remoteStream.current.addTrack(t));
      };

      // E) cursors & drawings listeners
      const unsub = [
        // cursors → peerCursors
        onValue(cursorsRef, snap => {
          const all = snap.val() || {};
          const others = Object.entries(all)
            .filter(([id]) => id !== userId)
            .reduce((acc, [id, d]) => ({ ...acc, [id]: d }), {});
          setPeerCursors(others);
        }),
        // drawings → replayStroke
        onValue(drawingsRef, snap => {
          const all = snap.val() || {};
          if (drawingCanvasRef.current) {
            const ctx = drawingCanvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
            Object.values(all).forEach(replayStroke);
          }
        })
      ];

      return () => {
        unsub.forEach(u => u());
        hangUp();
        remove(ref(db, `sessions/${roomId}/participants/${userId}`));
        if (isSessionCreator) remove(sessionRef);
      };
    };

    const cleanupPromise = setup();
    return () => cleanupPromise.then(cb => cb && cb());
  }, [roomId, userId]);

  // ─── 2) Signaling (offer/answer & ICE) ──────────────────────────────
  useEffect(() => {
    const pc = peerConnection.current;
    if (!pc || remoteUser === null) return;

    if (isSessionCreator) {
      // A) listen for answer
      onValue(answerRef, snap => {
        const ans = snap.val();
        if (ans && !pc.currentRemoteDescription) {
          pc.setRemoteDescription(new RTCSessionDescription(ans));
        }
      });
      // B) listen for callee ICE
      onValue(iceCandidatesRef('callee'), snap =>
        snap.forEach(cS => pc.addIceCandidate(new RTCIceCandidate(cS.val())))
      );
    } else {
      // A) listen for offer → create answer
      onValue(offerRef, async snap => {
        const off = snap.val();
        if (off && !pc.remoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(off));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await set(answerRef, answer);
        }
      });
      // B) listen for caller ICE
      onValue(iceCandidatesRef('caller'), snap =>
        snap.forEach(cS => pc.addIceCandidate(new RTCIceCandidate(cS.val())))
      );
    }
  }, [isSessionCreator, remoteUser]);

  // ─── 3) Remote SCREEN‐SHARE starter & hangup ─────────────────────────
  const startScreenShare = useCallback(async () => {
    if (!peerConnection.current || !isSessionCreator) return;
    localStream.current = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    localStream.current.getTracks().forEach(t => peerConnection.current.addTrack(t, localStream.current));
    setIsSharing(true);
    peerConnection.current.onicecandidate = e => {
      if (e.candidate) push(iceCandidatesRef('caller'), e.candidate.toJSON());
    };
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    await set(offerRef, offer);
  }, [isSessionCreator]);

  const hangUp = useCallback(() => {
    localStream.current?.getTracks().forEach(t => t.stop());
    peerConnection.current?.close();
    setIsSharing(false);
    if (isSessionCreator) remove(sessionRef);
  }, [isSessionCreator]);

  // ─── 4) Cursor broadcasting ─────────────────────────────────────────
  const updateCursor = useCallback((x, y) => {
    if (!roomId || !userId) return;
    set(ref(db, `sessions/${roomId}/cursors/${userId}`), { x, y, name: userName });
  }, [roomId, userId, userName]);

  // ─── 5) Drawing strokes ─────────────────────────────────────────────
  const addDrawingStroke = useCallback(stroke => {
    if (!roomId) return;
    push(drawingsRef, { ...stroke, userId });
  }, [roomId, userId]);

  const setDrawingCanvas = useCallback(c => {
    drawingCanvasRef.current = c;
  }, []);

  const replayStroke = stroke => {
    if (!drawingCanvasRef.current || !stroke.points?.length) return;
    const ctx = drawingCanvasRef.current.getContext('2d');
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth   = stroke.lineWidth;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  };

  // ─── 6) Remote‐scroll listener (incoming) ───────────────────────────
  useEffect(() => {
    if (!roomId) return;
    const unsub = onValue(scrollRef, snap => {
      const d = snap.val();
      if (d && typeof d.x === 'number' && typeof d.y === 'number') {
        window.scrollTo(d.x, d.y);
      }
    });
    return () => unsub();
  }, [roomId]);

  // ─── 7) Broadcast our scroll (guests only) ──────────────────────────
  const updateScroll = useCallback((x, y) => {
    if (!roomId) return;
    set(scrollRef, { x, y });
  }, [roomId]);

  return {
    // state
    remoteStream   : remoteStream.current,
    peerCursors,
    isSharing,
    isSessionCreator,
    remoteUser,
    // methods
    startScreenShare,
    hangUp,
    updateCursor,
    addDrawingStroke,
    setDrawingCanvas,
    updateScroll,   // ← NEW
  };
};

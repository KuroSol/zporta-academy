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

// STUN servers for WebRTC
const servers = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302'
      ]
    }
  ],
  iceCandidatePoolSize: 10
};

export const useCollaboration = (roomId, userId, userName) => {
  const db = getDatabase();

  // Firebase refs
  const sessionRef      = ref(db, `sessions/${roomId}`);
  const participantsRef = ref(db, `sessions/${roomId}/participants`);
  const offerRef        = ref(db, `sessions/${roomId}/offer`);
  const answerRef       = ref(db, `sessions/${roomId}/answer`);
  const cursorsRef      = ref(db, `sessions/${roomId}/cursors`);
  const drawingsRef     = ref(db, `sessions/${roomId}/drawings`);
  const highlightsRef   = ref(db, `sessions/${roomId}/highlights`); // Ref for highlights
  const scrollRef       = ref(db, `sessions/${roomId}/scroll`);
  const controlOwnerRef = ref(db, `sessions/${roomId}/controlOwner`);
  const iceCandidatesRef = peer => ref(db, `sessions/${roomId}/iceCandidates/${peer}`);

  // Refs
  const pcRef       = useRef(null);
  const localStream = useRef(null);
  const remoteStream= useRef(new MediaStream());
  const canvasRef   = useRef(null);

  // State
  const [isCreator,    setIsCreator]    = useState(false);
  const [remoteUser,   setRemoteUser]   = useState(null);
  const [peerCursors,  setPeerCursors]  = useState({});
  const [isSharing,    setIsSharing]    = useState(false);
  const [controlOwner, setControlOwner] = useState(null);
  
  //── 1) JOIN / ANNOUNCE / CLEANUP ──────────────────────────────────────
  useEffect(() => {
    if (!roomId || !userId) return;
    const setup = async () => {
      pcRef.current = new RTCPeerConnection(servers);

      const me = ref(db, `sessions/${roomId}/participants/${userId}`);
      await set(me, { name: userName });
      onDisconnect(me).remove();

      onValue(participantsRef, snap => {
        const parts = snap.val() || {};
        const others= Object.keys(parts).filter(id => id !== userId);
        setRemoteUser(others[0] || null);
        if (others.length === 0) {
            setIsCreator(true);
        }
      }, { once: true });

      pcRef.current.ontrack = e => {
        e.streams[0].getTracks().forEach(t => remoteStream.current.addTrack(t));
      };

      const unsub = [
        onValue(cursorsRef, snap => {
          const all = snap.val() || {};
          const others = Object.entries(all)
            .filter(([id]) => id !== userId)
            .reduce((a,[id,d]) => (a[id]=d, a), {});
          setPeerCursors(others);
        }),
        onValue(drawingsRef, snap => {
          const all = snap.val() || {};
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0,0,canvasRef.current.width,canvasRef.current.height);
            Object.values(all).forEach(replayStroke);
          }
        })
      ];

      return () => {
        unsub.forEach(u => u());
        hangUp();
        remove(ref(db, `sessions/${roomId}/participants/${userId}`));
        if (isCreator) remove(sessionRef);
      };
    };

    const cleanupP = setup();
    return () => cleanupP.then(cb => cb && cb());
  }, [roomId, userId, userName]);

  //── 2) SIGNALING ─────────────────────────────────────────────────────
  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || remoteUser===null) return;

    if (isCreator) {
      onValue(answerRef, snap => {
        const ans = snap.val();
        if (ans && !pc.currentRemoteDescription) {
          pc.setRemoteDescription(new RTCSessionDescription(ans));
        }
      });
      onValue(iceCandidatesRef('callee'), snap =>
        snap.forEach(c=> pc.addIceCandidate(new RTCIceCandidate(c.val())))
      );
    } else {
      onValue(offerRef, async snap => {
        const off = snap.val();
        if (off && !pc.remoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(off));
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          await set(answerRef, ans);
        }
      });
      onValue(iceCandidatesRef('caller'), snap =>
        snap.forEach(c=> pc.addIceCandidate(new RTCIceCandidate(c.val())))
      );
    }
  }, [isCreator, remoteUser]);

  //── 3) SCREEN SHARE HANDLERS ─────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    if (!pcRef.current || !isCreator) return;
    localStream.current = await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
    localStream.current.getTracks()
      .forEach(t=> pcRef.current.addTrack(t, localStream.current));
    setIsSharing(true);
    pcRef.current.onicecandidate = e => {
      if (e.candidate) push(iceCandidatesRef('caller'), e.candidate.toJSON());
    };
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    await set(offerRef, offer);
  }, [isCreator]);

  const hangUp = useCallback(() => {
    localStream.current?.getTracks().forEach(t=>t.stop());
    pcRef.current?.close();
    setIsSharing(false);
    if (isCreator) remove(sessionRef);
  }, [isCreator, sessionRef]);

  //── 4) CURSOR BROADCAST ──────────────────────────────────────────────
  const updateCursor = useCallback((x,y) => {
    if (!roomId||!userId) return;
    set(ref(db,`sessions/${roomId}/cursors/${userId}`),{x,y,name:userName});
  },[db, roomId,userId,userName]);

  //── 5) DRAWING & HIGHLIGHTING ────────────────────────────────────────
  const addDrawingStroke = useCallback(stroke => {
    if (!roomId) return;
    push(drawingsRef, {...stroke,userId});
  },[drawingsRef,roomId,userId]);

  const addTextHighlight = useCallback(highlightData => {
    if (!roomId) return;
    push(highlightsRef, { ...highlightData, userId });
  }, [highlightsRef, roomId, userId]);

  const setDrawingCanvas = useCallback(c=>{ canvasRef.current=c },[]);
  const replayStroke = s => {
    if (!canvasRef.current||!s.points?.length) return;
    const ctx=canvasRef.current.getContext('2d');
    ctx.strokeStyle=s.color; ctx.lineWidth=s.lineWidth; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(s.points[0].x,s.points[0].y);
    for(let i=1;i<s.points.length;i++) ctx.lineTo(s.points[i].x,s.points[i].y);
    ctx.stroke();
  };

  //── 6) SCROLL SYNC (incoming) ────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    const unsub = onValue(scrollRef, snap => {
      const d = snap.val();
      if (d && controlOwner && controlOwner !== userId && typeof d.y === 'number') {
        window.scrollTo({
          top: d.y,
          behavior: 'smooth'
        });
      }
    });
    return () => unsub();
  }, [roomId, controlOwner, userId, scrollRef]);

  //── 7) SCROLL BROADCAST (only owner) ─────────────────────────────────
  const updateScroll = useCallback(() => {
    if (!roomId || controlOwner !== userId) return;
    set(scrollRef,{ y: window.scrollY });
  },[roomId, controlOwner, userId, scrollRef]);

  //── 8) CONTROL OWNER HAND‐OFF ───────────────────────────────────────
  const setControlOwnerId = useCallback(id => {
      if(roomId) set(controlOwnerRef, id);
  }, [roomId, controlOwnerRef]);
  
  useEffect(() => {
    if (!roomId) return;
    const unsub = onValue(controlOwnerRef, snap => {
      setControlOwner(snap.val());
    });
    return () => unsub();
  }, [roomId, controlOwnerRef]);

  useEffect(() => {
    if (isCreator && userId) {
        setControlOwnerId(userId);
    }
  }, [isCreator, userId, setControlOwnerId]);

  useEffect(() => {
      if (controlOwner === userId) {
          window.addEventListener('scroll', updateScroll);
          return () => window.removeEventListener('scroll', updateScroll);
      }
  }, [controlOwner, userId, updateScroll]);


  //── EXPORT everything you need ────────────────────────────────────────
  return {
    remoteStream:   remoteStream.current,
    peerCursors,
    isSharing,
    isCreator,
    remoteUser,
    startScreenShare,
    hangUp,
    updateCursor,
    addDrawingStroke,
    addTextHighlight,
    setDrawingCanvas,
    controlOwner,
    setControlOwner: setControlOwnerId,
    updateScroll
  };
};

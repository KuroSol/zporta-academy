import { useState, useEffect, useRef, useCallback } from 'react';
import { getDatabase, ref, onValue, set, push, remove, onDisconnect } from 'firebase/database';

// WebRTC STUN servers for NAT traversal. Using public Google servers.
const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * A comprehensive React hook to manage a real-time collaboration session.
 * This hook handles WebRTC screen sharing, cursor tracking, and drawing, all
 * synchronized via Firebase Realtime Database.
 *
 * @param {string} roomId The unique ID for the collaboration session.
 * @param {string} userId The ID of the current user.
 * @param {string} userName The display name of the current user.
 * @returns {object} The state and methods for the collaboration session.
 */
export const useCollaboration = (roomId, userId, userName) => {
  //alert(`[useCollaboration HOOK] called with roomId=${roomId} userId=${userId}`);
  const db = getDatabase();
  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(new MediaStream());
  const drawingCanvasRef = useRef(null);

  const [isSessionCreator, setIsSessionCreator] = useState(false);
  const [remoteUser, setRemoteUser] = useState(null);
  const [peerCursors, setPeerCursors] = useState({});
  const [isSharing, setIsSharing] = useState(false);

  const sessionRef = ref(db, `sessions/${roomId}`);
  const participantsRef = ref(db, `sessions/${roomId}/participants`);
  const offerRef = ref(db, `sessions/${roomId}/offer`);
  const answerRef = ref(db, `sessions/${roomId}/answer`);
  const cursorsRef = ref(db, `sessions/${roomId}/cursors`);
  const drawingsRef = ref(db, `sessions/${roomId}/drawings`);
  const iceCandidatesRef = (peerId) => ref(db, `sessions/${roomId}/iceCandidates/${peerId}`);

  // ====================================================================
  // == Main Setup and Teardown Effect
  // ====================================================================
  useEffect(() => {
    if (!roomId || !userId) return;

    const setupSession = async () => {
      // 1. Initialize Peer Connection
      peerConnection.current = new RTCPeerConnection(servers);

      // 2. Register Presence
      //alert(`[useCollaboration] PARTICIPANT REGISTER → sessions/${roomId}/participants/${userId}`);
  
      const currentUserRef = ref(db, `sessions/${roomId}/participants/${userId}`);
      await set(currentUserRef, true);
      onDisconnect(currentUserRef).remove();

      // 3. Determine Role (Caller or Callee)
      onValue(participantsRef, (snapshot) => {
        const participants = snapshot.val() || {};
        const otherUsers = Object.keys(participants).filter(id => id !== userId);
        setRemoteUser(otherUsers.length > 0 ? otherUsers[0] : null);

        // If you are the only one, you are the creator/caller
        if (otherUsers.length === 0) {
          setIsSessionCreator(true);
        }
      }, { onlyOnce: true });

      // 4. Set up WebRTC event handlers
      peerConnection.current.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.current.addTrack(track);
        });
      };

      // 5. Set up Firebase Listeners
      const unsubscribes = [
        // Listen for Cursors
        onValue(cursorsRef, (snapshot) => {
            const allCursors = snapshot.val() || {};
            // Filter out the current user's cursor
            const otherCursors = Object.entries(allCursors)
                .filter(([id]) => id !== userId)
                .reduce((acc, [id, data]) => ({ ...acc, [id]: data }), {});
            setPeerCursors(otherCursors);
        }),
        // Listen for Drawing
        onValue(drawingsRef, (snapshot) => {
          const allStrokes = snapshot.val();
          if (allStrokes && drawingCanvasRef.current) {
             const ctx = drawingCanvasRef.current.getContext('2d');
             ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
             Object.values(allStrokes).forEach(replayStroke);
          }
        }),
      ];

      return () => {
        // Cleanup on unmount
        unsubscribes.forEach(unsub => unsub());
        hangUp();
        remove(ref(db, `sessions/${roomId}/participants/${userId}`));
        if (isSessionCreator) {
            // If the session creator leaves, clear the entire session
            remove(sessionRef);
        }
      };
    };

    const cleanupPromise = setupSession();
    return () => {
        cleanupPromise.then(cleanup => cleanup && cleanup());
    };

  }, [roomId, userId]);

  // ====================================================================
  // == WebRTC Signaling Logic
  // ====================================================================
  useEffect(() => {
    if (!peerConnection.current || !remoteUser) return;

    if (isSessionCreator) {
        // CALLER: Listen for an answer
        onValue(answerRef, (snapshot) => {
            const answer = snapshot.val();
            if (answer && !peerConnection.current.currentRemoteDescription) {
                const answerDescription = new RTCSessionDescription(answer);
                peerConnection.current.setRemoteDescription(answerDescription);
            }
        });
        // Listen for Callee's ICE candidates
        onValue(iceCandidatesRef('callee'), (snapshot) => {
            snapshot.forEach((childSnapshot) => {
                const candidate = childSnapshot.val();
                if (candidate) {
                    peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
            });
        });
    } else {
        // CALLEE: Listen for an offer
        onValue(offerRef, async (snapshot) => {
            const offer = snapshot.val();
            if (offer && !peerConnection.current.remoteDescription) {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.current.createAnswer();
                await peerConnection.current.setLocalDescription(answer);
                await set(answerRef, { type: answer.type, sdp: answer.sdp });
            }
        });
         // Listen for Caller's ICE candidates
        onValue(iceCandidatesRef('caller'), (snapshot) => {
             snapshot.forEach((childSnapshot) => {
                const candidate = childSnapshot.val();
                if (candidate) {
                    peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
            });
        });
    }

  }, [isSessionCreator, remoteUser]);


  // ====================================================================
  // == Core Functions
  // ====================================================================

  /**
   * Starts sharing the user's screen.
   */
  const startScreenShare = useCallback(async () => {
    if (!peerConnection.current || !isSessionCreator) return;

    localStream.current = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    localStream.current.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, localStream.current);
    });
    setIsSharing(true);

    // Set up ICE candidate listener
    peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
            push(iceCandidatesRef('caller'), event.candidate.toJSON());
        }
    };

    // Create and set offer
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    await set(offerRef, { type: offer.type, sdp: offer.sdp });

  }, [isSessionCreator]);

  /**
   * Stops the screen sharing session.
   */
  const hangUp = useCallback(() => {
    localStream.current?.getTracks().forEach((track) => track.stop());
    peerConnection.current?.close();
    setIsSharing(false);
    // Clean up Firebase session data
    if (isSessionCreator) {
        remove(sessionRef);
    }
  }, [isSessionCreator]);

  /**
   * Broadcasts the current user's cursor position.
   */
  const updateCursor = useCallback((x, y) => {
    if (!roomId || !userId) return;
    const cursorData = { x, y, name: userName };
    set(ref(db, `sessions/${roomId}/cursors/${userId}`), cursorData);
  }, [roomId, userId, userName]);

  /**
   * Broadcasts a completed drawing stroke.
   */
  const addDrawingStroke = useCallback((stroke) => {
      if(!roomId) return;
      //alert(`[useCollaboration] DRAWING PUSH → sessions/${roomId}/drawings by ${userId}`);
      push(drawingsRef, { ...stroke, userId });
  }, [roomId, userId]);

  /**
   * Sets the reference to the drawing canvas element.
   */
  const setDrawingCanvas = useCallback((canvas) => {
      drawingCanvasRef.current = canvas;
  }, []);

  /**
   * Replays a single stroke on the canvas.
   */
  const replayStroke = (stroke) => {
      if (!drawingCanvasRef.current || !stroke || !stroke.points || stroke.points.length < 2) return;
      const ctx = drawingCanvasRef.current.getContext('2d');
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
  };

  return {
    // State
    remoteStream: remoteStream.current,
    peerCursors,
    isSharing,
    isSessionCreator,
    remoteUser,
    // Methods
    startScreenShare,
    hangUp,
    updateCursor,
    addDrawingStroke,
    setDrawingCanvas,
  };
};

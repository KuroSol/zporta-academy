// src/hooks/useCollabCursor.js
import { useEffect, useRef, useState } from "react";
import { writeTo, subscribeTo } from "../firebase";

// Throttle helper: only call fn once per ms milliseconds
function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last < ms) return;
    last = now;
    fn(...args);
  };
}

/**
 * roomId: string             // e.g. "enrollment-<STUDENT_UID>-<TEACHER_UID>"
 * myId:   string             // e.g. "student-<STUDENT_UID>" or "teacher-<TEACHER_UID>"
 * otherId:string             // the opposite party’s ID
 * allowRemoteScroll: boolean // if true, forcibly scroll to other’s scrollY
 */
export function useCollabCursor(roomId, myId, otherId, allowRemoteScroll) {
  const cursorElRef = useRef(null);
  const [remotePos, setRemotePos] = useState({ x: 0, y: 0, scrollY: 0 });

  // 1) On mount: create a little <div> for the other user’s cursor
  useEffect(() => {
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.pointerEvents = "none";
    div.style.width = "12px";
    div.style.height = "12px";
    div.style.background = "red";
    div.style.borderRadius = "50%";
    div.style.zIndex = 9999;
    document.body.appendChild(div);
    cursorElRef.current = div;
    return () => document.body.removeChild(div);
  }, []);

  // 2) Broadcast our own mousemove + scroll (throttled)
  useEffect(() => {
    if (!roomId || !myId) return;
    const sendPosition = (e) => {
      const normX = e.clientX / window.innerWidth;
      const normY = e.clientY / window.innerHeight;
      writeTo(`collabRooms/${roomId}/cursors/${myId}`, {
        x: normX,
        y: normY,
        scrollY: window.scrollY,
      });
    };
    const throttled = throttle(sendPosition, 50);

    const onScroll = () => {
      writeTo(`collabRooms/${roomId}/cursors/${myId}`, {
        x: null,
        y: null,
        scrollY: window.scrollY,
      });
    };

    window.addEventListener("mousemove", throttled);
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("mousemove", throttled);
      window.removeEventListener("scroll", onScroll);
    };
  }, [roomId, myId]);

  // 3) Listen to the other user’s cursor updates
  useEffect(() => {
    if (!roomId || !otherId) return;
    const path = `collabRooms/${roomId}/cursors/${otherId}`;
    const unsub = subscribeTo(path, (data) => {
      if (!data) return;
      const { x, y, scrollY } = data;
      if (x !== null && y !== null) {
        setRemotePos({ x: x * window.innerWidth, y: y * window.innerHeight, scrollY });
      } else {
        setRemotePos((prev) => ({ ...prev, scrollY }));
      }
    });
    return () => unsub();
  }, [roomId, otherId]);

  // 4) Move the <div> and, if allowed, scroll to the remote scrollY
  useEffect(() => {
    const div = cursorElRef.current;
    if (div) {
      div.style.left = `${remotePos.x}px`;
      div.style.top  = `${remotePos.y}px`;
    }
    if (allowRemoteScroll) {
      window.scrollTo(0, remotePos.scrollY);
    }
  }, [remotePos, allowRemoteScroll]);
}

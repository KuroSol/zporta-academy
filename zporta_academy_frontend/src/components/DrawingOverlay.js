// src/components/DrawingOverlay.jsx
import React, { useEffect, useRef } from "react";
import { pushTo, subscribeChildAdded } from "../firebase";

export default function DrawingOverlay({ roomId, userId, isDrawingMode }) {
  const canvasRef = useRef(null);
  const ctxRef    = useRef(null);
  const drawing   = useRef(false);
  const pathPts   = useRef([]);

  // 1) Initialize the canvas size & drawing context
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    ctx.lineCap     = "round";
    ctx.strokeStyle = "blue"; // default stroke color
    ctx.lineWidth   = 2;
    ctxRef.current  = ctx;

    // Resize handler
    const handleResize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 2) On mouseup: send the completed stroke to Firebase
  function endStroke() {
    drawing.current = false;
    if (pathPts.current.length > 1) {
      pushTo(`collabRooms/${roomId}/drawPaths`, {
        user: userId,
        points: [...pathPts.current],
        color: ctxRef.current.strokeStyle,
        thickness: ctxRef.current.lineWidth,
      });
    }
    pathPts.current = [];
  }

  // 3) On mousedown & mousemove: collect points & draw locally
  function startStroke(e) {
    drawing.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    pathPts.current = [{ x, y }];
  }
function drawStroke(e) {
  if (!drawing.current) return;
  const ctx = ctxRef.current;  // FIRST declare ctx here
  if (!ctx) return;            // Safety check to ensure ctx is initialized
  
  const canvas = canvasRef.current;
  ctx.clearRect(0, 0, canvas.width, canvas.height);  // now safe to use ctx

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  pathPts.current.push({ x, y });

  const pts = pathPts.current;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();
}


  // 4) Listen for new strokes from other users and replay them
  useEffect(() => {
    const callback = (_key, stroke) => {
      const { points, color, thickness } = stroke;
      const ctx = ctxRef.current;
      ctx.strokeStyle = color;
      ctx.lineWidth   = thickness;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      // reset to default
      ctx.strokeStyle = "blue";
      ctx.lineWidth   = 2;
    };
    const unsub = subscribeChildAdded(`collabRooms/${roomId}/drawPaths`, callback);
    return () => unsub();
  }, [roomId]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9998,
        pointerEvents: isDrawingMode ? "auto" : "none",
      }}
      onMouseDown={isDrawingMode ? startStroke : null}
      onMouseMove={isDrawingMode ? drawStroke  : null}
      onMouseUp={isDrawingMode ? endStroke   : null}
      onMouseLeave={isDrawingMode ? endStroke   : null}
    />
  );
}

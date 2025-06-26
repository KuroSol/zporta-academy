import React, { useEffect, useRef, useCallback, useState } from 'react';
import styles from './DrawingOverlay.module.css';
import { Pencil, Eraser, Undo2, Trash2, Palette, Minus, Plus, Highlighter, Type } from 'lucide-react';

// --- Toolbar UI Component ---
const DrawingToolbar = ({
  tool, setTool,
  color, setColor,
  lineWidth, setLineWidth,
  onDeleteLast, onClearAll,
  onHighlightText, // Callback for text highlighting
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colors = ['#FFC107', '#FF3B30', '#4CD964', '#007AFF', '#AF52DE', '#FFFFFF'];

  const handleWidthChange = (delta) => {
    setLineWidth(prev => Math.max(1, Math.min(50, prev + delta)));
  };

  const selectTool = (newTool) => {
    setTool(newTool);
    if (newTool === 'highlighter') {
        setLineWidth(20);
    } else if (newTool === 'pen') {
        setLineWidth(4);
    }
  };

  // This logic is updated with a safety check to prevent crashing.
  const handleTextToolClick = () => {
    // If we are already in text mode, execute the highlight
    if (tool === 'text') {
        // SAFETY CHECK: Only call onHighlightText if it's a valid function.
        if (typeof onHighlightText === 'function') {
            onHighlightText();
        } else {
            console.error("onHighlightText prop is not a function. Please pass it from the parent component.");
        }
        setTool('pen'); // Switch back to pen tool after highlighting
    } else {
        // Otherwise, enter text selection mode
        setTool('text');
    }
  };

  return (
    <div className={styles.drawingToolbar}>
      {/* This button now toggles the text highlight mode */}
      <button
        onClick={handleTextToolClick}
        className={`${styles.toolButton} ${tool === 'text' ? styles.active : ''}`}
        title="Highlight Selected Text"
      >
        <Type size={24} />
      </button>

      <div className={styles.separator} />

      {/* The rest of the drawing tools */}
      <button
        onClick={() => selectTool('highlighter')}
        className={`${styles.toolButton} ${tool === 'highlighter' ? styles.active : ''}`}
        title="Highlighter Brush"
      >
        <Highlighter size={24} />
      </button>
      <button
        onClick={() => selectTool('pen')}
        className={`${styles.toolButton} ${tool === 'pen' ? styles.active : ''}`}
        title="Pen"
      >
        <Pencil size={24} />
      </button>
      <button
        onClick={() => selectTool('eraser')}
        className={`${styles.toolButton} ${tool === 'eraser' ? styles.active : ''}`}
        title="Eraser"
      >
        <Eraser size={24} />
      </button>

      <div className={styles.separator} />

      <div className={styles.colorPickerContainer}>
        <button
          onClick={() => setShowColorPicker(prev => !prev)}
          className={styles.toolButton}
          title="Change Color"
        >
          <Palette size={24} style={{ color }} />
        </button>
        {showColorPicker && (
          <div className={styles.colorPalette}>
            {colors.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setShowColorPicker(false); }}
                className={`${styles.colorSwatch} ${color === c ? styles.active : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>

      <div className={styles.lineWidthContainer}>
        <div className={styles.lineWidthPreview}>
           <div className={styles.lineWidthDot} style={{ width: `${lineWidth}px`, height: `${lineWidth}px`, backgroundColor: color, opacity: tool === 'highlighter' ? 0.4 : 1.0 }}></div>
        </div>
        <span>{lineWidth}px</span>
        <div className={styles.lineWidthControls}>
          <button onClick={() => handleWidthChange(-1)} className={styles.toolButton} style={{width: 24, height: 24}}><Minus size={14} /></button>
          <button onClick={() => handleWidthChange(1)} className={styles.toolButton} style={{width: 24, height: 24}}><Plus size={14} /></button>
        </div>
      </div>


      <div className={styles.separator} />

      <button onClick={onDeleteLast} className={styles.toolButton} title="Undo Last Stroke">
        <Undo2 size={24} />
      </button>
      <button onClick={onClearAll} className={styles.toolButton} title="Clear All Drawings">
         <Trash2 size={24} />
      </button>
    </div>
  );
};


// --- Main Canvas Logic Component ---
export default function DrawingOverlay({
  isDrawingMode,
  onStroke,
  setCanvasRef,
  strokes,
  userColors,
  onDeleteLast,
  onClearAll,
  onHighlightText,
  tool,
  color,
  lineWidth,
  setTool,
  setColor,
  setLineWidth,
}) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentPath = useRef([]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (strokes && strokes.length > 0) {
        strokes.forEach(stroke => {
            if (!stroke.points || stroke.points.length === 0) return;
            const strokeColor = userColors[stroke.userId] || stroke.color || 'black';
            if (stroke.tool === 'highlighter') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 0.4;
                ctx.lineCap = 'butt';
            } else if (stroke.tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.globalAlpha = 1.0;
                ctx.lineCap = 'round';
            } else { // Pen
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1.0;
                ctx.lineCap = 'round';
            }
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = stroke.lineWidth;
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            stroke.points.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y));
            ctx.stroke();
        });
    }
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
  }, [strokes, userColors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCanvasRef?.(canvas);
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redrawCanvas();
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [setCanvasRef, redrawCanvas]);
  
  useEffect(() => {
      redrawCanvas();
  }, [strokes, redrawCanvas]);

  const getEventCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startStroke = useCallback(e => {
    if (!isDrawingMode || tool === 'text') return; 
    isDrawing.current = true;
    currentPath.current = [getEventCoords(e)];
  }, [isDrawingMode, tool]);

  const drawStroke = useCallback((e) => {
    if (!isDrawing.current || !isDrawingMode || tool === 'text') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    redrawCanvas();
    const newPoint = getEventCoords(e);
    currentPath.current.push(newPoint);
    if (tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.4;
        ctx.lineCap = 'butt';
    } else if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1.0;
        ctx.lineCap = 'round';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.lineCap = 'round';
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    if(currentPath.current.length > 0) {
        ctx.moveTo(currentPath.current[0].x, currentPath.current[0].y);
        for (let i = 1; i < currentPath.current.length; i++) {
            ctx.lineTo(currentPath.current[i].x, currentPath.current[i].y);
        }
        ctx.stroke();
    }
  }, [isDrawingMode, tool, color, lineWidth, redrawCanvas]);

  const endStroke = useCallback(() => {
    if (!isDrawing.current || !isDrawingMode || tool === 'text') return;
    isDrawing.current = false;
    if (currentPath.current.length > 1 && onStroke) {
      onStroke({
        tool: tool,
        color: color,
        lineWidth: lineWidth,
        points: [...currentPath.current],
      });
    }
    currentPath.current = [];
  }, [isDrawingMode, onStroke, tool, color, lineWidth]);


  return (
    <>
      {isDrawingMode && (
         <DrawingToolbar
            tool={tool} setTool={setTool}
            color={color} setColor={setColor}
            lineWidth={lineWidth} setLineWidth={setLineWidth}
            onDeleteLast={onDeleteLast}
            onClearAll={onClearAll}
            onHighlightText={onHighlightText}
          />
      )}
     
      <canvas
        ref={canvasRef}
        className={styles.canvasOverlay}
        style={{ pointerEvents: (isDrawingMode && tool !== 'text') ? 'auto' : 'none' }}
        onMouseDown={startStroke}
        onMouseMove={drawStroke}
        onMouseUp={endStroke}
        onMouseLeave={endStroke}
        onTouchStart={startStroke}
        onTouchMove={drawStroke}
        onTouchEnd={endStroke}
      />
    </>
  );
}

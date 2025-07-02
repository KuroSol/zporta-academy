import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './DrawingOverlay.module.css';
import { Pencil, Eraser, Undo2, Trash2, Highlighter, ZoomIn, ZoomOut, X, Type } from 'lucide-react';

// The DrawingToolbar component itself doesn't need changes to its logic.
const DrawingToolbar = ({
  tool, setTool,
  color, setColor,
  lineWidth, setLineWidth,
  onDeleteLast, onClearAll,
  onHighlightText,
  onStopDrawing,
  zoom, setZoom,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colors = ['#FFC107', '#FF3B30', '#4CD964', '#007AFF', '#AF52DE', '#FFFFFF', '#000000'];

  const handleZoom = (direction) => {
    const zoomStep = 0.1;
    const minZoom = 0.5;
    const maxZoom = 2.0;
    setZoom(prevZoom => {
        const newZoom = prevZoom + direction * zoomStep;
        return Math.max(minZoom, Math.min(maxZoom, newZoom));
    });
  };

  const selectToolAndClosePicker = (newTool) => {
      setTool(newTool);
      setShowColorPicker(false);
  };
  
  const handleHighlightClick = () => {
    if (onHighlightText) onHighlightText();
    setShowColorPicker(false);
  };

  return (
      <div className={styles.drawingToolbar}>
          <div className={styles.toolGroup}>
              <button onClick={() => selectToolAndClosePicker('pen')} className={`${styles.toolButton} ${tool === 'pen' ? styles.active : ''}`} title="Pen"><Pencil size={20} /></button>
              <button onClick={() => selectToolAndClosePicker('highlighter')} className={`${styles.toolButton} ${tool === 'highlighter' ? styles.active : ''}`} title="Highlighter"><Highlighter size={20} /></button>
              <button onClick={handleHighlightClick} className={styles.toolButton} title="Highlight Selected Text"><Type size={20} /></button>
              <button onClick={() => selectToolAndClosePicker('eraser')} className={`${styles.toolButton} ${tool === 'eraser' ? styles.active : ''}`} title="Eraser"><Eraser size={20} /></button>
          </div>
          <div className={styles.separator} />
          <div className={styles.toolGroup}>
              <div className="relative">
                  <button onClick={() => setShowColorPicker(p => !p)} className={styles.colorSwatchButton} style={{ backgroundColor: color }} title="Change Color" />
                  {showColorPicker && (
                      <div className={styles.colorPalette}>
                          {colors.map(c => ( <button key={c} onClick={() => { setColor(c); setShowColorPicker(false); }} className={styles.colorPaletteSwatch} style={{ backgroundColor: c, outlineColor: color === c ? 'white' : 'transparent' }} /> ))}
                      </div>
                  )}
              </div>
              <input type="range" min="1" max="50" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} className={styles.lineWidthSlider} title={`Line Width: ${lineWidth}px`} />
          </div>
          <div className={styles.separator} />
          <div className={styles.toolGroup}>
              <button onClick={onDeleteLast} className={styles.toolButton} title="Undo Last Stroke"><Undo2 size={20} /></button>
              <button onClick={onClearAll} className={`${styles.toolButton} ${styles.dangerButton}`} title="Clear All Drawings"><Trash2 size={20} /></button>
          </div>
          <div className={styles.separator} />
          <div className={styles.toolGroup}>
              <button onClick={() => handleZoom(-1)} disabled={zoom <= 0.5} className={styles.toolButton} title="Zoom Out"><ZoomOut size={20} /></button>
              <span className={styles.zoomText} title="Current Zoom Level">{(zoom * 100).toFixed(0)}%</span>
              <button onClick={() => handleZoom(1)} disabled={zoom >= 2.0} className={styles.toolButton} title="Zoom In"><ZoomIn size={20} /></button>
          </div>
          <button onClick={onStopDrawing} className={`${styles.toolButton} ${styles.closeButton}`} title="Stop Drawing"><X size={20} /></button>
      </div>
  );
};


// Main Component Logic
export default function DrawingOverlay({
  contentRef,
  isDrawingMode,
  onStroke,
  setCanvasRef,
  strokes,
  userColors,
  onDeleteLast,
  onClearAll,
  onHighlightText,
  tool, setTool,
  color, setColor,
  lineWidth, setLineWidth,
  onStopDrawing,
  zoom, 
  setZoom,
}) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentPath = useRef([]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !strokes) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    strokes.forEach(stroke => {
        if (!stroke.points || stroke.points.length === 0) return;
        const strokeColor = userColors[stroke.userId] || stroke.color || 'black';
        
        if (stroke.tool === 'highlighter') {
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = 0.5;
            ctx.lineCap = 'butt';
        } else if (stroke.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1.0;
            ctx.lineCap = 'round';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
            ctx.lineCap = 'round';
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = stroke.lineWidth;
        
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length - 2; i++) {
            const p1 = stroke.points[i];
            const p2 = stroke.points[i+1];
            const xc = (p1.x + p2.x) / 2;
            const yc = (p1.y + p2.y) / 2;
            ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
        }
        if (stroke.points.length > 1) {
            const lastPoint = stroke.points[stroke.points.length - 1];
            ctx.lineTo(lastPoint.x, lastPoint.y);
        }
        ctx.stroke();
    });

    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
  }, [strokes, userColors]);

  // This useEffect handles resizing the canvas to match the content area.
  useEffect(() => {
    const canvas = canvasRef.current;
    const contentContainer = contentRef.current;
    if (!canvas || !contentContainer) return;
    if (setCanvasRef) setCanvasRef(canvas);
    
    // This function resizes the canvas and redraws content.
    // It's wrapped in requestAnimationFrame to prevent observer loops.
    const handleResize = () => {
        window.requestAnimationFrame(() => {
            if (!contentContainer || !canvas) return;
            const newWidth = contentContainer.scrollWidth;
            const newHeight = contentContainer.scrollHeight;
            
            if (canvas.width !== newWidth || canvas.height !== newHeight) {
                canvas.width = newWidth;
                canvas.height = newHeight;
                redrawCanvas();
            }
        });
    };
    
    const observer = new ResizeObserver(handleResize);
    observer.observe(contentContainer);
    
    handleResize(); // Initial setup

    return () => {
        observer.disconnect();
    };
  }, [contentRef, setCanvasRef, redrawCanvas]);

  // Redraw whenever the strokes data changes
  useEffect(() => { redrawCanvas(); }, [strokes, redrawCanvas]);

  // This function calculates the correct coordinates for a mouse or touch event.
  // It now correctly accounts for the parent's zoom.
  const getEventCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // FIX: We divide by the zoom factor to translate the viewport coordinates
    // (which are scaled) back to the canvas's un-scaled coordinate system.
    return { 
      x: (clientX - rect.left) / zoom, 
      y: (clientY - rect.top) / zoom 
    };
  };

  const startStroke = useCallback(e => {
    if (!isDrawingMode) return; 
    e.preventDefault();
    isDrawing.current = true;
    currentPath.current = [getEventCoords(e)];
  }, [isDrawingMode, zoom]);
  
  const drawStroke = useCallback((e) => {
    if (!isDrawing.current || !isDrawingMode) return;
    e.preventDefault();
    const newPoint = getEventCoords(e);
    currentPath.current.push(newPoint);

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    if (currentPath.current.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = tool === 'highlighter' ? 'butt' : 'round';
        ctx.globalAlpha = tool === 'highlighter' ? 0.5 : 1.0;
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : (tool === 'highlighter' ? 'multiply' : 'source-over');
        
        const prevPoint = currentPath.current[currentPath.current.length - 2];
        
        ctx.beginPath();
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(newPoint.x, newPoint.y);
        ctx.stroke();
    }
  }, [isDrawingMode, tool, color, lineWidth, zoom]);

  const endStroke = useCallback(() => {
    if (!isDrawing.current || !isDrawingMode) return;
    isDrawing.current = false;
    redrawCanvas(); 
    const canvas = canvasRef.current;
    if (currentPath.current.length > 1 && onStroke && canvas) {
      onStroke({ tool, color, lineWidth, points: currentPath.current });
    }
    currentPath.current = [];
  }, [isDrawingMode, onStroke, tool, color, lineWidth, redrawCanvas]);

  return (
    <>
      {isDrawingMode && createPortal(
         <DrawingToolbar
            tool={tool} setTool={setTool}
            color={color} setColor={setColor}
            lineWidth={lineWidth} setLineWidth={setLineWidth}
            onDeleteLast={onDeleteLast}
            onClearAll={onClearAll}
            onHighlightText={onHighlightText}
            onStopDrawing={onStopDrawing}
            zoom={zoom} setZoom={setZoom}
          />,
          document.body
      )}
     
      <canvas
        ref={canvasRef}
        className={styles.canvasOverlay}
        style={{ 
          // FIX: The canvas itself is no longer transformed. The parent handles scaling.
          pointerEvents: isDrawingMode ? 'auto' : 'none',
          touchAction: 'none' 
        }}
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

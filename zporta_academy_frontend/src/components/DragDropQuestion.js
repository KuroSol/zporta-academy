import React, { useState, useEffect, useCallback } from 'react';
// Make sure this path is correct for your project structure
import styles from './QuizPage.module.css';

export default function DragDropQuestion({ question, submitted, onSubmit }) {
  const { items, dropZones: zones } = question.question_data;

  // State to hold the mapping of drop zones to item IDs
  const [mapping, setMapping] = useState({});

  // State to manage all aspects of the drag operation (for both touch and mouse)
  const [dragState, setDragState] = useState({
    isDragging: false, // Is an item currently being dragged?
    itemId: null,      // The ID of the item being dragged
    itemText: '',      // The text of the item for the visual "ghost"
    // We use clientX/Y for touch and mouse position across the viewport
    currentPosition: { x: 0, y: 0 },
    // A reference to the original DOM element being dragged (for styling)
    sourceElement: null,
  });

  // --- MOUSE-BASED DRAG AND DROP HANDLERS (Desktop) ---

  const onDragStart = (e, item) => {
    // Set data for the browser's drag-and-drop API
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';

    // Update our component's state to reflect the drag
    setDragState(prev => ({
      ...prev,
      isDragging: true,
      itemId: item.id,
    }));
  };

  const onDragOver = (e) => {
    // This is necessary to allow a drop
    e.preventDefault();
  };

  const onDrop = (e, zoneId) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');

    // Update the mapping with the new placement
    setMapping(m => ({ ...m, [zoneId]: id }));
    // Reset the drag state
    setDragState(prev => ({ ...prev, isDragging: false, itemId: null }));
  };

  // --- TOUCH-BASED DRAG AND DROP HANDLERS (Mobile) ---

  const handleTouchStart = (e, item) => {
    // Prevent the default touch behavior, like scrolling
    e.preventDefault();
    const touch = e.touches[0];
    const sourceElement = e.currentTarget;

    // Visually indicate the item is being "lifted"
    sourceElement.style.opacity = '0.4';

    // Set the state to start the drag operation
    setDragState({
      isDragging: true,
      itemId: item.id,
      itemText: item.text,
      currentPosition: { x: touch.clientX, y: touch.clientY },
      sourceElement: sourceElement,
    });
  };

  // Memoize the move handler to avoid re-creating it on every render
  const handleTouchMove = useCallback((e) => {
    // We only care about movement if a drag is in progress
    if (!dragState.isDragging) return;
    // This is CRITICAL: it prevents the page from scrolling while dragging
    e.preventDefault();

    const touch = e.touches[0];
    setDragState(prev => ({
      ...prev,
      currentPosition: { x: touch.clientX, y: touch.clientY },
    }));
  }, [dragState.isDragging]); // Dependency array ensures the function is stable

  // Memoize the end handler
  const handleTouchEnd = useCallback(() => {
    if (!dragState.isDragging) return;

    // Restore the original item's appearance
    if (dragState.sourceElement) {
      dragState.sourceElement.style.opacity = '1';
    }

    // Find the element directly under the user's finger
    const dropElement = document.elementFromPoint(
      dragState.currentPosition.x,
      dragState.currentPosition.y
    );

    // Check if it's a valid drop zone using the data attribute
    if (dropElement && dropElement.dataset.zoneid) {
      const zoneId = dropElement.dataset.zoneid;
      setMapping(m => ({ ...m, [zoneId]: dragState.itemId }));
    }

    // Reset the drag state completely
    setDragState({
      isDragging: false,
      itemId: null,
      itemText: '',
      currentPosition: { x: 0, y: 0 },
      sourceElement: null,
    });
  }, [dragState]); // Dependency array ensures the function is stable

  // EFFECT to add and remove global event listeners for touch events
  // This allows the drag to continue even if the finger leaves the original item
  useEffect(() => {
    if (dragState.isDragging) {
      // Listen for move and end events on the whole window
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('touchcancel', handleTouchEnd);
    }

    // Cleanup function to remove listeners when the drag ends or component unmounts
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [dragState.isDragging, handleTouchMove, handleTouchEnd]);

  // Filter out items that have already been placed in a drop zone
  const availableItems = items.filter(it => !Object.values(mapping).includes(it.id));

  return (
    <div className={styles.dragDropArea}>
      {/* This is the "ghost" element that follows the user's finger/mouse on touch devices */}
      {dragState.isDragging && dragState.itemText && (
        <div
          style={{
            position: 'fixed',
            top: dragState.currentPosition.y,
            left: dragState.currentPosition.x,
            transform: 'translate(-50%, -50%)', // Center the ghost on the finger
            pointerEvents: 'none', // Allow touch events to pass through to elements underneath
            zIndex: 1000,
            // Apply your item's styles here for a consistent look
            padding: '12px 24px',
            backgroundColor: 'rgba(70, 130, 255, 0.9)',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
        >
          {dragState.itemText}
        </div>
      )}

      {/* Container for draggable items */}
      <div className={styles.itemsContainer}>
        <h3>Available Items</h3>
        {availableItems.map(it => (
          <div
            key={it.id}
            className={styles.draggableItem}
            // --- Desktop Handlers ---
            draggable
            onDragStart={e => onDragStart(e, it)}
            // --- Mobile Handlers ---
            onTouchStart={e => handleTouchStart(e, it)}
            // Hide the item if it's the one being dragged (its ghost is visible instead)
            style={{
              opacity: dragState.itemId === it.id ? 0.4 : 1,
              cursor: 'grab',
            }}
          >
            {it.text}
          </div>
        ))}
        {availableItems.length === 0 && <p className={styles.placeholderText}>All items placed!</p>}
      </div>

      {/* Container for drop zones */}
      <div className={styles.zonesContainer}>
        {zones.map(z => (
          <div
            key={z.id}
            data-zoneid={z.id} // This is crucial for touch drop detection
            className={styles.dropZone}
            onDragOver={onDragOver}
            onDrop={e => onDrop(e, z.id)}
          >
            <div className={styles.zoneLabel}>{z.label}</div>
            <div className={styles.zoneItem}>
              {mapping[z.id]
                ? items.find(it => it.id === mapping[z.id]).text
                : '—'}
            </div>
          </div>
        ))}
      </div>

      {!submitted && (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSubmitAnswer}`}
          onClick={() => onSubmit(mapping)}
        >
          Submit Placement
        </button>
      )}
    </div>
  );
}

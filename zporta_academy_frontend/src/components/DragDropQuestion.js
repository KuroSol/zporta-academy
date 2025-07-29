import React, { useState, useRef } from 'react';
import styles from './QuizPage.module.css';

export default function DragDropQuestion({ question, submitted, onSubmit }) {
  const items = question.question_data.items;
  const zones = question.question_data.dropZones;

  // Mappings and drag state
  const [mapping, setMapping] = useState({});
  const [draggedItem, setDraggedItem] = useState(null);
  const [touchPosition, setTouchPosition] = useState(null);

  // Desktop drag-and-drop handlers
  const onDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedItem(id);
  };

  const onDrop = (e, zoneId) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setMapping(m => ({ ...m, [zoneId]: id }));
    setDraggedItem(null);
  };

  // Mobile touch handlers
  const handleTouchStart = (e, id) => {
    e.stopPropagation();
    setDraggedItem(id);
    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e) => {
    e.preventDefault(); // prevent page scroll while dragging
    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    if (!draggedItem || !touchPosition) {
      setDraggedItem(null);
      return;
    }

    // Detect drop zone under finger
    const el = document.elementFromPoint(touchPosition.x, touchPosition.y);
    if (el && el.dataset && el.dataset.zoneid) {
      const zoneId = el.dataset.zoneid;
      setMapping(m => ({ ...m, [zoneId]: draggedItem }));
    }

    // Reset drag state
    setDraggedItem(null);
    setTouchPosition(null);
  };

  return (
    <div className={styles.dragDropArea}>
      <div className={styles.itemsContainer}>
        {items.map(it => (
          <div
            key={it.id}
            draggable
            onDragStart={e => onDragStart(e, it.id)}
            onTouchStart={e => handleTouchStart(e, it.id)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={styles.draggableItem}
          >
            {it.text}
          </div>
        ))}
      </div>

      <div className={styles.zonesContainer}>
        {zones.map(z => (
          <div
            key={z.id}
            data-zoneid={z.id}
            onDragOver={e => e.preventDefault()}
            onDrop={e => onDrop(e, z.id)}
            className={styles.dropZone}
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

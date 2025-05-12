import React, { useState } from 'react';
import styles from './DragDropSimple.module.css';

export default function DragDropSimple({ items: initialItems, zones: zoneLabels, onSubmit, submitted }) {
  const [itemsLeft, setItemsLeft] = useState(initialItems);
  const [mapping, setMapping] = useState(Array(zoneLabels.length).fill(''));

  const handleDragStart = (e, word) => {
    e.dataTransfer.setData('text/plain', word);
  };

  const handleDrop = (e, zi) => {
    e.preventDefault();
    const word = e.dataTransfer.getData('text/plain');
    if (!word) return;
    setMapping(m => {
      const next = [...m];
      next[zi] = word;
      return next;
    });
    setItemsLeft(left => left.filter(w => w !== word));
  };

  return (
    <div className={styles.container}>
      <ul className={styles.itemsList}>
        {itemsLeft.map((w, i) => (
          <li
            key={i}
            draggable
            onDragStart={e => handleDragStart(e, w)}
            className={styles.item}
          >
            {w}
          </li>
        ))}
      </ul>
      <div className={styles.zonesContainer}>
        {zoneLabels.map((label, zi) => (
          <div
            key={zi}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, zi)}
            className={styles.zone}
          >
            <div className={styles.zoneLabel}>{label}</div>
            <div className={styles.zoneSlot}>
              {mapping[zi] || '—'}
            </div>
          </div>
        ))}
      </div>
      {!submitted && (
        <button
          className={styles.submitButton}
          onClick={() => onSubmit(mapping)}
        >
          Submit Placement
        </button>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import styles from './QuizPage.module.css';

export default function DragDropQuestion({ question, submitted, onSubmit }) {
  const items = question.question_data.items;
  const zones = question.question_data.dropZones;
  const [mapping, setMapping] = useState({});

  const onDragStart = (e, id) =>
    e.dataTransfer.setData('text/plain', id);

  const onDrop = (e, zoneId) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setMapping(m => ({ ...m, [zoneId]: id }));
  };

  return (
    <div className={styles.dragDropArea}>
      <div className={styles.itemsContainer}>
        {items.map(it => (
          <div
            key={it.id}
            draggable
            onDragStart={e=>onDragStart(e,it.id)}
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
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>onDrop(e,z.id)}
            className={styles.dropZone}
          >
            <div className={styles.zoneLabel}>{z.label}</div>
            <div className={styles.zoneItem}>
              {mapping[z.id]
                ? items.find(it=>it.id===mapping[z.id]).text
                : '—'}
            </div>
          </div>
        ))}
      </div>
      {!submitted && (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSubmitAnswer}`}
          onClick={()=>onSubmit(mapping)}
        >
          Submit Placement
        </button>
      )}
    </div>
  );
}

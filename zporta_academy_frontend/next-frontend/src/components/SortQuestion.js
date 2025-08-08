import React, { useState } from 'react';
import styles from '../styles/QuizPage.module.css';

export default function SortQuestion({ question, submitted, onSubmit }) {
  const [order, setOrder] = useState(
    question.question_data.items.map(it => it.text)
  );

  const move = (from, to) => {
    const a = [...order];
    const [x] = a.splice(from, 1);
    a.splice(to, 0, x);
    setOrder(a);
  };

  return (
    <div className={styles.sortArea}>
      {order.map((w, i) => (
        <div key={i} className={styles.sortItem}>
          <button
            type="button"
            disabled={i===0}
            onClick={()=>move(i,i-1)}
            className={styles.navButton}
          >↑</button>
          <button
            type="button"
            disabled={i===order.length-1}
            onClick={()=>move(i,i+1)}
            className={styles.navButton}
          >↓</button>
          <span className={styles.optionText}>{w}</span>
        </div>
      ))}
      {!submitted && (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSubmitAnswer}`}
          onClick={()=>onSubmit(order)}
        >
          Submit Order
        </button>
      )}
    </div>
  );
}

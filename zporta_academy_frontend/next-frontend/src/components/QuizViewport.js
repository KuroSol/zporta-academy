// src/components/QuizViewport.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/styles/QuizFeed.module.css";
import QuizCard from "@/components/QuizCard";

export default function QuizViewport({ items = [] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const settlingRef = useRef(false);
  const snapTimerRef = useRef(null);

  const total = items.length;
  const hasItems = total > 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [total]);

  const windowed = useMemo(() => {
    if (!hasItems) return [];
    const prev = Math.max(0, activeIndex - 1);
    const curr = activeIndex;
    const next = Math.min(total - 1, activeIndex + 1);
    const ids = Array.from(new Set([prev, curr, next]));
    return ids.map((i) => ({ index: i, data: items[i] }));
  }, [hasItems, activeIndex, total, items]);

  const topSpacerVh = Math.max(0, activeIndex - 1);
  const bottomSpacerVh = Math.max(0, total - (activeIndex + 2));

  const onScroll = () => {
    if (!containerRef.current || settlingRef.current) return;
    const el = containerRef.current;
    const vh = el.clientHeight || window.innerHeight || 1;

    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      const raw = el.scrollTop / vh;
      const nextIndex = Math.round(raw);
      const clamped = Math.max(0, Math.min(total - 1, nextIndex));
      if (clamped !== activeIndex) setActiveIndex(clamped);
      requestAnimationFrame(() => {
        settlingRef.current = true;
        const newTop = (clamped - 1) * vh;
        el.scrollTo({ top: newTop, behavior: "instant" in el ? "instant" : "auto" });
        setTimeout(() => { settlingRef.current = false; }, 0);
      });
    }, 80);
  };

  return (
    <div className={styles.viewportFixed}>
      <div
        className={styles.verticalSnapContainer}
        ref={containerRef}
        onScroll={onScroll}
      >
        {topSpacerVh > 0 && (
          <div className={styles.spacer} style={{ height: `calc(${topSpacerVh} * 100%)` }} />
        )}

        {windowed.map(({ index, data }) => (
          <section key={index} className={styles.snapItem}>
            {data ? (
              <QuizCard quiz={data} isFeedView={true} itemType="explore" />
            ) : (
              <div className={styles.skeleton}>Loading…</div>
            )}
          </section>
        ))}

        {bottomSpacerVh > 0 && (
          <div className={styles.spacer} style={{ height: `calc(${bottomSpacerVh} * 100%)` }} />
        )}
      </div>
    </div>
  );
}

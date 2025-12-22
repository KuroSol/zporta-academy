// src/components/QuestionPager.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import deckStyles from "@/styles/DeckPager.module.css";
import QuizCard from "@/components/QuizCard";

export default function QuestionPager({ quiz, initialIndex = 0, onIndexChange }) {
  const [index, setIndex] = useState(initialIndex);
  const groupRef = useRef(null);

  // Pointer gesture state
  const startX = useRef(0);
  const startY = useRef(0);
  const dx = useRef(0);
  const dy = useRef(0);
  const locked = useRef(null); // 'x' | 'y' | null
  const dragging = useRef(false);

  const total = (quiz?.questions || []).length;
  const current = Math.max(0, Math.min(total - 1, index));
  const prev = Math.max(0, current - 1);
  const next = Math.min(total - 1, current + 1);

  const slides = useMemo(() => {
    const qs = quiz?.questions || [];
    return {
      prev: qs[prev] || null,
      current: qs[current] || null,
      next: qs[next] || null,
    };
  }, [quiz?.questions, prev, current, next]);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, quiz?.id]);

  const commit = useCallback(
    (dir) => {
      let newIdx = current;
      if (dir === "left") newIdx = Math.min(total - 1, current + 1);
      else if (dir === "right") newIdx = Math.max(0, current - 1);
      setIndex(newIdx);
      onIndexChange?.(newIdx);
      // reset transform
      const el = groupRef.current;
      if (el) el.style.transform = `translateX(0px)`;
    },
    [current, total, onIndexChange]
  );

  const onPointerDown = (e) => {
    const p = e.touches ? e.touches[0] : e;
    startX.current = p.clientX;
    startY.current = p.clientY;
    dx.current = 0;
    dy.current = 0;
    locked.current = null;
    dragging.current = true;
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const p = e.touches ? e.touches[0] : e;
    dx.current = p.clientX - startX.current;
    dy.current = p.clientY - startY.current;
    if (!locked.current) {
      if (Math.abs(dx.current) > Math.abs(dy.current) * 1.2) locked.current = "x";
      else locked.current = "y";
    }
    if (locked.current === "x") {
      e.preventDefault();
      const el = groupRef.current;
      if (el) el.style.transform = `translateX(${dx.current}px)`;
    }
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (locked.current === "x") {
      const threshold = 60;
      if (dx.current <= -threshold) commit("left");
      else if (dx.current >= threshold) commit("right");
      else {
        const el = groupRef.current;
        if (el) el.style.transform = `translateX(0px)`;
      }
    }
    locked.current = null;
  };

  return (
    <div
      className={deckStyles.qpager}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={onPointerUp}
    >
      {/* Slides group */}
      <div
        ref={groupRef}
        style={{ width: "100%", height: "100%", position: "relative" }}
      >
        {/* Left/Prev */}
        <div className={deckStyles.qslide} style={{ transform: "translateX(-100%)" }}>
          {slides.prev && (
            <div style={{ width: "100%", height: "100%" }} />
          )}
        </div>
        {/* Center/Current: render full question UI via QuizCard feed-mode */}
        <div className={deckStyles.qslide} style={{ transform: "translateX(0%)" }}>
          <QuizCard
            quiz={quiz}
            isFeedView={true}
            externalQuestionIndex={current}
          />
        </div>
        {/* Right/Next */}
        <div className={deckStyles.qslide} style={{ transform: "translateX(100%)" }}>
          {slides.next && (
            <div style={{ width: "100%", height: "100%" }} />
          )}
        </div>
      </div>

      {/* Dots indicator */}
      {total > 1 && (
        <div className={deckStyles.qdots}>
          {(quiz?.questions || []).map((_, i) => (
            <span
              key={`qdot-${i}`}
              className={`${deckStyles.qdot} ${i === current ? deckStyles.qdotActive : ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

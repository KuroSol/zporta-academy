// src/components/QuizDeckPager.js
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import deckStyles from "@/styles/DeckPager.module.css";
import { useQuizFeedStore } from "@/hooks/useQuizFeedStore";
import QuestionPager from "@/components/QuestionPager";

export default function QuizDeckPager({ source = "feed", items: propItems }) {
  const feed = useQuizFeedStore();
  // Only subscribe to the feed store when using source="feed" to avoid unnecessary rerenders
  const feedState = source === "feed" ? feed.useStore?.(useSyncExternalStore) : null;

  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  const containerRef = useRef(null);
  const groupRef = useRef(null);

  // Gesture state
  const startX = useRef(0);
  const startY = useRef(0);
  const dx = useRef(0);
  const dy = useRef(0);
  const locked = useRef(null); // 'x'|'y'|null
  const dragging = useRef(false);

  // Wheel cooldown
  const wheelCooldown = useRef(false);

  // Items source
  const items = useMemo(() => {
    if (source === "feed") return feedState?.feedItems || [];
    return propItems || [];
  }, [source, feedState?.feedItems, propItems]);

  const total = items.length;
  const curr = Math.max(0, Math.min(total - 1, activeQuizIndex));
  const prev = Math.max(0, curr - 1);
  const next = Math.min(total - 1, curr + 1);

  const windowed = useMemo(() => {
    return {
      prev: items[prev] || null,
      current: items[curr] || null,
      next: items[next] || null,
    };
  }, [items, prev, curr, next]);

  // Feed: initial fetch + prefetch + near-end batching
  useEffect(() => {
    // Lock body scroll when component mounts to prevent background scrolling
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (source !== "feed") return;
    (async () => {
      await feed.fetchInitialBatch();
      feed.ensureAdjacentPrefetch(0);
    })();
  }, [source, feed]);

  useEffect(() => {
    if (source !== "feed") return;
    feed.fetchNextBatchIfNeeded(curr, 3);
    feed.ensureAdjacentPrefetch(curr);
  }, [source, curr, feed]);

  const commit = useCallback(
    (dir) => {
      let newIdx = curr;
      if (dir === "up") newIdx = Math.min(total - 1, curr + 1);
      else if (dir === "down") newIdx = Math.max(0, curr - 1);
      setActiveQuizIndex(newIdx);
      // reset vertical transform
      const el = groupRef.current;
      if (el) el.style.transform = `translateY(0px)`;
    },
    [curr, total]
  );

  // Pointer gestures on viewport
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
    if (locked.current === "y") {
      e.preventDefault();
      const el = groupRef.current;
      if (el) el.style.transform = `translateY(${dy.current}px)`;
    }
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (locked.current === "y") {
      const threshold = 80;
      if (dy.current <= -threshold) commit("up");
      else if (dy.current >= threshold) commit("down");
      else {
        const el = groupRef.current;
        if (el) el.style.transform = `translateY(0px)`;
      }
    }
    locked.current = null;
  };

  // Wheel handling for desktop
  const onWheel = (e) => {
    const y = e.deltaY || 0;
    // Lower threshold to make it more sensitive (was 60)
    if (Math.abs(y) < 15) return;
    
    if (wheelCooldown.current) return;
    wheelCooldown.current = true;
    
    if (y > 0) commit("up");
    else commit("down");
    
    // Cooldown to prevent rapid skipping during momentum scroll
    setTimeout(() => {
      wheelCooldown.current = false;
    }, 600);
  };

  // Keyboard arrows optional
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowDown") commit("up");
      else if (e.key === "ArrowUp") commit("down");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commit]);

  // Render
  return (
    <div
      className={deckStyles.viewport}
      ref={containerRef}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={onPointerUp}
      onWheel={onWheel}
    >
      {/* quiz position indicator */}
      {/* Vertical deck group */}
      <div ref={groupRef} className={deckStyles.deck}>
        {/* Prev */}
        <div className={deckStyles.panel} style={{ transform: "translateY(-100%)" }}>
          {windowed.prev ? (
            <QuestionPager quiz={windowed.prev} initialIndex={0} />
          ) : null}
        </div>
        {/* Current */}
        <div className={deckStyles.panel} style={{ transform: "translateY(0%)" }}>
          {windowed.current ? (
            <QuestionPager quiz={windowed.current} initialIndex={0} />
          ) : (
            <div style={{ color: "#aaa" }}>Loading…</div>
          )}
        </div>
        {/* Next */}
        <div className={deckStyles.panel} style={{ transform: "translateY(100%)" }}>
          {windowed.next ? (
            <QuestionPager quiz={windowed.next} initialIndex={0} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

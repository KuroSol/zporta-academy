// src/hooks/useQuizFeedStore.js
// High-performance feed store: batched fetching, caching, prefetch, dedupe, and abortable requests.

import apiClient from "@/api";

// Module-level singletons for session-scoped cache/state
let _feedItems = []; // minimal quiz list items from feed
let _hasMore = true;
let _isFetching = false;
let _nextCursor = null; // optional if backend supports cursor
let _excludeIds = new Set();

// Cache full quiz details (including questions) by id
const quizCache = new Map(); // quizId -> quizDetail

// In-flight requests dedupe: key -> { promise, controller }
const inflight = new Map();

// Simple pub/sub for useSyncExternalStore
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

// Helpers
const getViewportLimit = () => 20; // initial batch size

const keyForQuiz = (quizId) => `quiz:${quizId}`;
const keyForFeed = (cursor, excludeSize) => `feed:${cursor || "start"}:${excludeSize}`;

function startRequest(key) {
  // If axios supports AbortController, attach signal
  const controller = new AbortController();
  const entry = { controller };
  inflight.set(key, entry);
  return controller;
}

function setRequestPromise(key, promise) {
  const entry = inflight.get(key);
  if (!entry) return;
  entry.promise = promise.finally(() => {
    // Only clear if this exact promise is still current
    const current = inflight.get(key);
    if (current && current.promise === promise) inflight.delete(key);
  });
}

function cancelStaleRequests(keepPredicate) {
  for (const [key, entry] of Array.from(inflight.entries())) {
    if (!keepPredicate(key)) {
      try {
        entry.controller?.abort?.();
      } catch {}
      inflight.delete(key);
      // eslint-disable-next-line no-console
      console.log("[FeedStore] Aborted stale request:", key);
    }
  }
}

// Fetch a batch of feed quizzes
async function fetchFeedBatch({ limit, cursor = _nextCursor } = {}) {
  if (_isFetching || !_hasMore) return { items: [], hasMore: _hasMore };
  _isFetching = true;
  emit();

  const exclude = Array.from(_excludeIds).join(",");
  const query = new URLSearchParams();
  query.set("limit", String(limit || getViewportLimit()));
  if (exclude) query.set("exclude", exclude);
  if (cursor) query.set("cursor", cursor);

  const key = keyForFeed(cursor, _excludeIds.size);
  if (inflight.has(key)) {
    // eslint-disable-next-line no-console
    console.log("[FeedStore] Reusing in-flight feed batch:", key);
    try {
      const resp = await inflight.get(key).promise;
      return resp;
    } finally {
      _isFetching = false;
      emit();
    }
  }

  // eslint-disable-next-line no-console
  console.log("[FeedStore] Fetching feed batch", Object.fromEntries(query));
  const controller = startRequest(key);

  const promise = apiClient
    .get(`/feed/next?${query.toString()}`, { signal: controller.signal })
    .then((r) => {
      const data = Array.isArray(r.data) ? r.data : r.data?.results || [];
      const next = r.data?.next_cursor ?? null;
      const items = Array.isArray(data) ? data : [];

      for (const it of items) {
        if (it?.id != null) _excludeIds.add(it.id);
      }

      _feedItems = [..._feedItems, ...items];
      _nextCursor = next;
      _hasMore = Boolean(next) || items.length > 0; // tolerate no-cursor backends
      emit();
      return { items, hasMore: _hasMore };
    })
    .catch((err) => {
      if (err?.message === "canceled" || err?.name === "CanceledError") {
        // canceled
        return { items: [], hasMore: _hasMore };
      }
      // eslint-disable-next-line no-console
      console.warn("[FeedStore] Feed batch error:", err);
      return { items: [], hasMore: _hasMore };
    })
    .finally(() => {
      _isFetching = false;
      emit();
    });

  setRequestPromise(key, promise);
  return promise;
}

// Preload full quiz detail (with questions) by id+permalink
async function preloadQuizDetail(quiz) {
  if (!quiz || !quiz.id) return null;
  const cached = quizCache.get(quiz.id);
  if (cached) {
    // eslint-disable-next-line no-console
    console.log("[FeedStore] Using cached quiz", quiz.id);
    return cached;
  }

  const key = keyForQuiz(quiz.id);
  if (inflight.has(key)) {
    // eslint-disable-next-line no-console
    console.log("[FeedStore] Reusing in-flight quiz", quiz.id);
    return inflight.get(key).promise;
  }

  // Prefer permalink endpoint if present
  const permalink = quiz.permalink;
  const url = permalink ? `/quizzes/q/${encodeURIComponent(permalink)}/` : `/quizzes/${quiz.id}/`;

  // eslint-disable-next-line no-console
  console.log("[FeedStore] Preloading quiz detail:", quiz.id, url);
  const controller = startRequest(key);

  const promise = apiClient
    .get(url, { signal: controller.signal })
    .then((r) => {
      const full = r.data?.quiz || r.data || r.data?.data || r.data?.result || r.data; // be liberal
      if (full && full.id != null) {
        quizCache.set(full.id, full);
        // Ensure exclude set contains this id to avoid reappearing in feed
        _excludeIds.add(full.id);
        emit();
      }
      return full;
    })
    .catch((err) => {
      if (err?.message === "canceled" || err?.name === "CanceledError") return null;
      // eslint-disable-next-line no-console
      console.warn("[FeedStore] Preload quiz error", quiz.id, err);
      return null;
    });

  setRequestPromise(key, promise);
  return promise;
}

function getState() {
  return {
    feedItems: _feedItems,
    hasMore: _hasMore,
    isFetching: _isFetching,
    nextCursor: _nextCursor,
    cacheSize: quizCache.size,
  };
}

export function useQuizFeedStore() {
  // React 18 compatible external store
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const getSnapshot = () => getState();

  return {
    // state accessors
    useStore: (useSyncExternalStore) => useSyncExternalStore(subscribe, getSnapshot, getSnapshot),

    // imperative methods
    async fetchInitialBatch(limit = getViewportLimit()) {
      if (_feedItems.length > 0) return { items: [], hasMore: _hasMore };
      return fetchFeedBatch({ limit });
    },

    async fetchNextBatchIfNeeded(activeIndex, thresholdFromEnd = 3) {
      if (_feedItems.length === 0) return { items: [], hasMore: _hasMore };
      const nearEnd = activeIndex >= _feedItems.length - thresholdFromEnd;
      if (nearEnd && !_isFetching && _hasMore) {
        return fetchFeedBatch({ limit: getViewportLimit() });
      }
      return { items: [], hasMore: _hasMore };
    },

    getQuizAt(index) {
      if (index < 0 || index >= _feedItems.length) return null;
      const q = _feedItems[index];
      return quizCache.get(q.id) || q;
    },

    getFeedLength() {
      return _feedItems.length;
    },

    getCachedQuiz(id) {
      return id != null ? quizCache.get(id) : null;
    },

    async ensureAdjacentPrefetch(activeIndex) {
      // Ensure i-1, i, i+1 loaded; prefetch i+2 in background
      const ids = [activeIndex - 1, activeIndex, activeIndex + 1].filter(
        (i) => i >= 0 && i < _feedItems.length
      );
      await Promise.all(
        ids.map((i) => {
          const q = _feedItems[i];
          if (!q) return null;
          return preloadQuizDetail(q);
        })
      );
      // Opportunistic prefetch i+2, cancel others
      const ahead = activeIndex + 2;
      if (ahead >= 0 && ahead < _feedItems.length) {
        const qa = _feedItems[ahead];
        preloadQuizDetail(qa);
      }
      // Abort any unrelated in-flight quiz requests far away (>4 away)
      cancelStaleRequests((key) => {
        if (!key.startsWith("quiz:")) return true; // keep non-quiz
        const id = Number(key.split(":")[1]);
        // find index of this id in current feed
        const idx = _feedItems.findIndex((q) => q?.id === id);
        if (idx === -1) return false;
        return Math.abs(idx - activeIndex) <= 4; // keep nearby
      });
    },
  };
}

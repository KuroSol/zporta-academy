// src/pages/feed/index.js
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Head from "next/head";
import QuizDeckPager from "@/components/QuizDeckPager";

export default function QuizFeedPage() {
  return (
    <>
      <Head>
        <title>Quiz Feed</title>
      </Head>
      <QuizDeckPager source="feed" />
    </>
  );
}

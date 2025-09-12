import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import apiClient from '@/api';
import { quizPermalinkToUrl } from '@/utils/urls';
import styles from '@/styles/DiaryRecommendations.module.css';
import Link from 'next/link';

export default function DiaryRecommendations({ limit = 10, title = "Recommended for you" }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr('');
      try {
        const { data } = await apiClient.get(`/feed/dashboard/?limit=${limit}`);
        if (alive) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setErr('Could not load recommendations.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [limit]);

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (err)     return <div className={styles.error}>{err}</div>;
  if (items.length === 0) return null;

  return (
    <section className={styles.recStrip}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.row} role="list">
        {items.map(q => (
          <article key={q.id} className={styles.card} role="listitem">
            <header className={styles.cardHead}>
              <span className={styles.chip}>Quiz</span>
            </header>
            <h4 className={styles.cardTitle} title={q.title}>{q.title}</h4>
            <p className={styles.cardSub}>{(q.questions?.length || 0)} questions</p>
            <Link className={styles.cta} href={quizPermalinkToUrl(q.permalink)}>
              Take Quiz <ArrowRight size={16}/>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

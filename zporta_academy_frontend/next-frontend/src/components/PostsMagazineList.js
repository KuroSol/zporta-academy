"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/api';
import styles from '@/styles/posts/PostsMagazineList.module.css';

export default function PostsMagazineList(){
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[err,setErr]=useState('');
  useEffect(()=>{(async()=>{
    try{
      const r = await apiClient.get('/posts/?ordering=-created_at');
      const d = Array.isArray(r.data) ? r.data : (r.data?.results||[]);
      setItems(d);
    }catch(e){ setErr('Failed to load posts.'); }
    finally{ setLoading(false); }
  })();},[]);
  if(loading) return <div className={styles.loading}>Loading…</div>;
  if(err) return <div className={styles.error}>{err}</div>;
  if(!items.length) return <div className={styles.empty}>No posts yet.</div>;

  return (
    <section className={styles.wrap}>
      <h1 className={styles.h}>Zporta Magazine</h1>
      <div className={styles.grid}>
        {items.map(p=>(
          <Link key={p.id} href={p.permalink ? `/posts/${p.permalink}` : '#'} className={styles.card}>
            <div className={styles.media}>
              {p.og_image_url ? <img src={p.og_image_url} alt={p.og_title||p.title}/> : <div className={styles.placeholder}>Z</div>}
            </div>
            <div className={styles.body}>
              <h3 className={styles.title}>{p.title||'Untitled'}</h3>
              <p className={styles.meta}>{p.created_by} • {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

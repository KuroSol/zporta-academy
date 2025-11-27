"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/api'; 
import styles from '@/styles/posts/PostsMagazineList.module.css';

export default function PostsMagazineList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await apiClient.get('/posts/?ordering=-created_at');
        const d = Array.isArray(r.data) ? r.data : (r.data?.results || []);
        setItems(d);
      } catch (e) {
        console.error(e);
        setErr('Failed to load posts. Please try again later.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className={styles.statusContainer}>
        <div className={styles.loader}></div>
        <p>Loading Stories...</p>
    </div>
  );
  
  if (err) return <div className={styles.statusContainer}><p className={styles.error}>{err}</p></div>;
  if (!items.length) return <div className={styles.statusContainer}><p>No posts found.</p></div>;

  const featuredPost = items[0];
  const regularPosts = items.slice(1);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className={styles.pageWrapper}>
      <main className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.mainHeading}>The Zporta Chronicle</h1>
          <p className={styles.subheading}>Your Daily Briefing on Things That Matter</p>
        </header>

        {/* Featured Post Section */}
        <section className={styles.featuredSection}>
          <Link href={featuredPost.permalink ? `/posts/${featuredPost.permalink}` : '#'} className={styles.featuredCard}>
            <div className={styles.featuredMedia}>
              <img src={featuredPost.og_image_url} alt={featuredPost.og_title || featuredPost.title} onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/1200x800/2d3748/ffffff?text=Image+Not+Found'; }} />
            </div>
            <div className={styles.featuredBody}>
              <span className={styles.categoryTag}>{featuredPost.category || 'News'}</span>
              <h2 className={styles.featuredTitle}>{featuredPost.title || 'Untitled'}</h2>
              <p className={styles.featuredExcerpt}>{featuredPost.excerpt || 'Click to read the full story and discover more details about this breaking topic.'}</p>
              {featuredPost.tags && featuredPost.tags.length > 0 && (
                <div className={styles.tagsContainer}>
                  {featuredPost.tags.map((tag) => (
                    <Link key={tag.id} href={`/tags/${tag.slug}`} className={styles.tagLink} onClick={(e) => e.stopPropagation()}>
                      #{tag.name}
                    </Link>
                  ))}
                </div>
              )}
              <div className={styles.meta}>
                <span className={styles.author}>{featuredPost.created_by || 'Anonymous'}</span>
                <span className={styles.dot}>•</span>
                <time className={styles.date}>{formatDate(featuredPost.created_at)}</time>
              </div>
            </div>
          </Link>
        </section>

        <hr className={styles.divider} />
        
        {/* Regular Posts Grid */}
        <section className={styles.grid}>
          {regularPosts.map(p => (
            <Link key={p.id} href={p.permalink ? `/posts/${p.permalink}` : '#'} className={styles.card}>
              <div className={styles.media}>
                {p.og_image_url 
                  ? <img src={p.og_image_url} alt={p.og_title || p.title} onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/800x600/4a5568/ffffff?text=Image'; }}/> 
                  : <div className={styles.placeholder}>Z</div>
                }
              </div>
              <div className={styles.body}>
                <span className={styles.categoryTag}>{p.category || 'General'}</span>
                <h3 className={styles.title}>{p.title || 'Untitled'}</h3>
                {p.tags && p.tags.length > 0 && (
                  <div className={styles.tagsContainer}>
                    {p.tags.map((tag) => (
                      <Link key={tag.id} href={`/tags/${tag.slug}`} className={styles.tagLink} onClick={(e) => e.stopPropagation()}>
                        #{tag.name}
                      </Link>
                    ))}
                  </div>
                )}
                 <div className={styles.meta}>
                    <span className={styles.author}>{p.created_by}</span>
                    <span className={styles.dot}>•</span>
                    <time className={styles.date}>{formatDate(p.created_at)}</time>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}


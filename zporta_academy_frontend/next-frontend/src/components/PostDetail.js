"use client";
import Link from 'next/link';
import styles from '@/styles/posts/PostDetail.module.css';

// Helper function to format dates, consistent with the list view
const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// SVG Icon for the arrow
const ArrowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
);


export default function PostDetail({ post, previousPost, nextPost }) {
  if (!post) return <div className={styles.notFound}>Post not found.</div>;

  return (
    <div className={styles.pageWrapper}>
      <article className={styles.articleContainer}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <span className={styles.categoryTag}>{post.category || 'General'}</span>
            <h1 className={styles.title}>{post.title}</h1>
            <div className={styles.meta}>
              <span className={styles.author}>By {post.created_by || 'Anonymous'}</span>
              <span className={styles.dot}>•</span>
              <time className={styles.date}>{formatDate(post.created_at)}</time>
            </div>
          </div>
        </header>

        {post.og_image_url && (
          <figure className={styles.heroImageContainer}>
            <img 
              src={post.og_image_url} 
              alt={post.title || 'Post hero image'} 
              className={styles.heroImage}
              onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/1200x600/2d3748/ffffff?text=Image+Unavailable'; }}
            />
            {post.og_title && <figcaption className={styles.figcaption}>{post.og_title}</figcaption>}
          </figure>
        )}

        <div className={styles.content} dangerouslySetInnerHTML={{ __html: post.content }} />
      
      </article>

      {/* Next/Previous Post Navigation */}
      {(nextPost || previousPost) && (
        <nav className={styles.postNavigation}>
          <div className={styles.navGrid}>
            <div className={styles.navItem}>
              {previousPost ? (
                <Link href={previousPost.permalink ? `/posts/${previousPost.permalink}` : '#'} className={styles.navLink}>
                  <span className={styles.navLabel}>Previous Post</span>
                  <span className={styles.navTitle}>{previousPost.title}</span>
                </Link>
              ) : (
                <div className={`${styles.navLink} ${styles.disabled}`}></div>
              )}
            </div>
            
            <div className={`${styles.navItem} ${styles.nextItem}`}>
              {nextPost ? (
                <Link href={nextPost.permalink ? `/posts/${nextPost.permalink}` : '#'} className={styles.navLink}>
                   <span className={styles.navLabel}>Next Post</span>
                  <span className={styles.navTitle}>{nextPost.title}</span>
                </Link>
              ) : (
                 <div className={`${styles.navLink} ${styles.disabled}`}></div>
              )}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}

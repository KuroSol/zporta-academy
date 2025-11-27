"use client";
import Link from 'next/link';
import styles from '@/styles/posts/PostDetail.module.css';

// Helper function to format dates, consistent with the list view
const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);

  // An invalid date's getTime() returns NaN. This check prevents the app from crashing.
  if (isNaN(date.getTime())) {
    // If the date format from the API is unrecognized, return the original string.
    return dateString;
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export default function PostDetail({ post, previousPost, nextPost }) {
  // This component now ONLY receives props. It doesn't know about `params`.
  if (!post) {
    // A simple loading or not-found state can be handled here if needed,
    // but the main not-found logic is on the page.
    return <div className={styles.notFound}>Post not found.</div>;
  }

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
            {post.tags && post.tags.length > 0 && (
              <div className={styles.tagsContainer}>
                {post.tags.map((tag) => (
                  <Link key={tag.id} href={`/tags/${tag.slug}`} className={styles.tagLink}>
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}
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


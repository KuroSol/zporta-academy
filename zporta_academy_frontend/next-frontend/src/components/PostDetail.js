"use client";
import styles from '@/styles/posts/PostDetail.module.css';

export default function PostDetail({ post }) {
  if (!post) return null;
  return (
    <article className={styles.wrap}>
      {post.og_image_url && <img src={post.og_image_url} alt="" className={styles.hero}/>}
      <h1 className={styles.title}>{post.title}</h1>
      <p className={styles.meta}>
        {post.created_by} • {post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}
      </p>
      <div className={styles.content} dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}

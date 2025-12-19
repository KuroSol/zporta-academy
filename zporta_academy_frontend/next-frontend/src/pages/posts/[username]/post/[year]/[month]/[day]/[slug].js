import Head from 'next/head';
import apiClient from '@/api';
import PostDetail from '@/components/PostDetail';

export async function getServerSideProps({ params, req }){
  const permalink = `${params.username}/post/${params.year}/${params.month}/${params.day}/${params.slug}`;
  try {
    // fetch full list (newest first)
    const listRes = await apiClient.get('/posts/?ordering=-created_at&page_size=1000', {
      headers:{ cookie:req?.headers?.cookie||'' }
    });
    const items = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.results || []);
    const idx = items.findIndex(p => p.permalink === permalink);
    if (idx < 0) return { notFound: true };
    const post = items[idx];
    const previousPost = idx > 0 ? items[idx - 1] : null; // older
    const nextPost = idx < items.length - 1 ? items[idx + 1] : null; // newer
    return { props:{ post, previousPost, nextPost } };
  } catch (error) {
    console.error('SSR post fetch error:', error.message);
    return { notFound: true };
  }
}

export default function Page({ post, previousPost, nextPost }){
  const site  = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zportaacademy.com').replace(/\/$/, '').replace('www.', '');
  const url   = `${site}/posts/${post.permalink}`;
  const title = post.seo_title || post.title;
  const desc  = post.seo_description || (post.content ? post.content.replace(/<[^>]+>/g,'').slice(0,160) : '');
  const img   = post.og_image_url || post.og_image || `${site}/images/default-og.png`;
  const author= post.created_by || 'Zporta Academy';

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc}/>
        <link rel="canonical" href={url}/>
        <meta name="robots" content="index,follow"/>
        <meta property="og:url" content={url}/>
        <meta property="og:type" content="article"/>
        <meta property="og:title" content={post.og_title || title}/>
        <meta property="og:description" content={post.og_description || desc}/>
        <meta property="og:image" content={img}/>
        <meta name="twitter:card" content="summary_large_image"/>
        <meta name="twitter:title" content={post.og_title || title}/>
        <meta name="twitter:description" content={post.og_description || desc}/>
        <meta name="twitter:image" content={img}/>
        <meta property="article:author" content={author}/>
        {post.created_at && <meta property="article:published_time" content={post.created_at}/>}
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{__html: JSON.stringify({
            "@context":"https://schema.org",
            "@type":"Article",
            headline:title, description:desc,
            author:[{ "@type":"Person", name:author }],
            datePublished: post.created_at, image:[img], mainEntityOfPage:url
          })}} />
      </Head>
      <PostDetail post={post} previousPost={previousPost} nextPost={nextPost}/>
    </>
  );
}

import PostDetail from '@/components/PostDetail';
import apiClient from '@/api';

export default function Page(props){ return <PostDetail {...props} />; }

export async function getServerSideProps({ params }) {
  const { permalink } = params;

  // 1) fetch all posts ordered by newest first
  const listRes = await apiClient.get('/posts/?ordering=-created_at&page_size=1000');
  const items = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.results || []);

  // 2) find current post
  const idx = items.findIndex(p => p.permalink === permalink);
  const post = idx >= 0 ? items[idx] : null;

  // 3) neighbors in the ordered array
  const previousPost = idx > 0 ? items[idx - 1] : null;        // older in time
  const nextPost = idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null; // newer in time

  // If not found, 404
  if (!post) return { notFound: true };

  return { props: { post, previousPost, nextPost } };
}

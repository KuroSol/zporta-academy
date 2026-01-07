import Head from "next/head";
import apiClient from "@/api";
import PostEditor from "@/components/posts/PostEditor";

export async function getServerSideProps({ params, req }) {
  const permalink = `${params.username}/post/${params.year}/${params.month}/${params.day}/${params.slug}`;
  try {
    const res = await apiClient.get(`/posts/${permalink}/`, {
      headers: { cookie: req?.headers?.cookie || "" },
    });
    const post = Array.isArray(res.data)
      ? res.data[0]
      : res.data?.results?.[0] || res.data;
    if (!post?.permalink) {
      return { notFound: true };
    }
    return { props: { post } };
  } catch (error) {
    console.error("SSR edit post fetch error", error);
    return { notFound: true };
  }
}

export default function EditPostPage({ post }) {
  return (
    <>
      <Head>
        <title>Edit: {post?.title || "Post"}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <PostEditor mode="edit" initialPost={post} />
    </>
  );
}

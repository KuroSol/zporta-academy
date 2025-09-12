// src/pages/admin/posts/create.js
import dynamic from 'next/dynamic';
const CreatePost = dynamic(() => import('@/components/admin/CreatePost'), { ssr:false });
export default function Page(){ return <CreatePost/>; }

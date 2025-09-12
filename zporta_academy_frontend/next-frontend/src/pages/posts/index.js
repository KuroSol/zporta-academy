import dynamic from 'next/dynamic';
const PostsMagazineList = dynamic(() => import('@/components/PostsMagazineList'), { ssr:false });
export default function Page(){ return <PostsMagazineList/>; }

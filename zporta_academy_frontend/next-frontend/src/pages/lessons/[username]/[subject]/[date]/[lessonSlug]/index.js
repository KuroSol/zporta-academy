import dynamic from 'next/dynamic';

// Import the Next-adapted component (you will update it in step 2)
const LessonDetail = dynamic(() => import('@/components/LessonDetail'), { ssr: false });

export default function LessonDetailPage() {
  return <LessonDetail />;
}

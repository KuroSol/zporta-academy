// src/pages/courses/enrolled/[enrollmentId].js
import dynamic from 'next/dynamic';

const EnrolledCourseDetail = dynamic(
  () => import('@/components/EnrolledCourseDetail').then(m => m.default || m),
  { ssr: false }
);

export default function EnrolledCourseDetailPage() {
  return <EnrolledCourseDetail />;
}

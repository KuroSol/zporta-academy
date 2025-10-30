// pages/admin/lessons/[permalink]/edit.js
import React from 'react';
import dynamic from 'next/dynamic';

const EditLesson = dynamic(() => import('@/components/admin/EditLesson'), { ssr: false });

export default function EditLessonPage() {
  return <EditLesson />;
}

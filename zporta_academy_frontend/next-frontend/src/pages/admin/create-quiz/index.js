import dynamic from 'next/dynamic';
const CreateQuiz = dynamic(() => import('@/components/admin/CreateQuiz'), { ssr: false });
export default function CreateQuizPage() { return <CreateQuiz />; }

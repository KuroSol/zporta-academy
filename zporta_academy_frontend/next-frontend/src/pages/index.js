import dynamic from "next/dynamic";

const HomePage = dynamic(() => import("@/components/HomePage").then(m => m.default || m), { ssr:false });

export default function Page(){ return <HomePage/>; }

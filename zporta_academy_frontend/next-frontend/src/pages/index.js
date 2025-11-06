import dynamic from "next/dynamic";

const HomePage = dynamic(
	() => import("@/components/HomePage").then((m) => m.default || m),
	{
		ssr: false,
		loading: () => (
			<div style={{ padding: 20, textAlign: "center" }}>Loading…</div>
		),
	}
);

export default function Page() {
	return <HomePage />;
}

import dynamic from "next/dynamic";
import { FaSpinner } from "react-icons/fa";

// Add a proper loading component
const LoadingProfile = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      fontSize: "1.1rem",
      color: "#6c757d",
    }}
  >
    <FaSpinner
      style={{
        animation: "spin 1s linear infinite",
        marginRight: "0.75rem",
      }}
      size={30}
    />
    Loading Profile...
    <style jsx>{`
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `}</style>
  </div>
);

const Profile = dynamic(
  () => import("@/components/Profile").then((m) => m.default || m),
  {
    ssr: true, // Enable SSR to prevent flash
    loading: () => <LoadingProfile />,
  }
);

export default function ProfilePage() {
  return <Profile />;
}

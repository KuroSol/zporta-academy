import React, { useState, useContext } from "react";
import {
  FaPlus,
  FaTimes,
  FaBook,
  FaChalkboardTeacher,
  FaQuestion,
  FaBookOpen,
  FaPencilAlt,
} from "react-icons/fa";
import { useRouter } from "next/router";
import styles from "@/styles/BottomMenu.module.css";
import { AuthContext } from "@/context/AuthContext";

// Honor `position`: 'rightEdge' | 'leftDock'
export default function BottomMenu({
  position = "rightEdge",
  sidebarWidth = 64,
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { user, token } = useContext(AuthContext);

  // Only show for active guides
  if (
    !user ||
    (user.role !== "guide" && user.role !== "both") ||
    !user.active_guide
  ) {
    return null;
  }

  const handleAction = (action) => {
    setOpen(false);
    if (!token) {
      router.push("/login");
      return;
    }
    const routes = {
      course: "/admin/courses/create",
      lesson: "/admin/lessons/create",
      quiz: "/admin/create-quiz",
      diary: "/diary",
      post: "/admin/posts/create",
    };
    const href = routes[action];
    if (href) router.push(href);
  };

  // Choose anchor class. Only apply --sidebar-width when docking left.
  const anchorClass =
    position === "rightEdge" ? styles.rightEdge : styles.leftDock;
  const anchorStyle =
    position === "leftDock"
      ? { ["--sidebar-width"]: `${sidebarWidth}px` }
      : undefined;

  return (
    <div className={`${styles.container} ${anchorClass}`} style={anchorStyle}>
      <div
        className={`${styles.menu} ${styles.expandLeft} ${
          open ? styles.open : ""
        }`}
      >
        <button
          className={`${styles.button} ${styles.mainButton}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close quick actions" : "Open quick actions"}
        >
          {open ? <FaTimes size={22} /> : <FaPlus size={22} />}
        </button>

        <button
          className={`${styles.button} ${styles.item} ${styles.item1}`}
          onClick={() => handleAction("course")}
          aria-label="Create course"
        >
          <FaBook size={18} />
        </button>
        <button
          className={`${styles.button} ${styles.item} ${styles.item2}`}
          onClick={() => handleAction("lesson")}
          aria-label="Create lesson"
        >
          <FaChalkboardTeacher size={18} />
        </button>
        <button
          className={`${styles.button} ${styles.item} ${styles.item3}`}
          onClick={() => handleAction("quiz")}
          aria-label="Create quiz"
        >
          <FaQuestion size={18} />
        </button>
        <button
          className={`${styles.button} ${styles.item} ${styles.item4}`}
          onClick={() => handleAction("diary")}
          aria-label="Diary"
        >
          <FaBookOpen size={18} />
        </button>
        {/* Uncomment if you want the 5th action */}
        {
          <button
            className={`${styles.button} ${styles.item} ${styles.item5}`}
            onClick={() => handleAction("post")}
            aria-label="Create post"
          >
            <FaPencilAlt size={18} />
          </button>
        }
      </div>
    </div>
  );
}

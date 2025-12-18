import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "../../styles/admin.module.css";

export default function AdminQuizzesPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  // Get auth token
  const getToken = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("authToken");
    }
    return null;
  };

  const getCsrfToken = () => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  // Fetch quizzes
  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const token = getToken();

      const headers = {};
      if (token) headers["Authorization"] = `Token ${token}`;

      const response = await fetch("/api/quizzes/my/", {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch quizzes");
      }

      const data = await response.json();
      setQuizzes(Array.isArray(data) ? data : data.results || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  // Delete quiz
  const handleDelete = async (quizId) => {
    if (!confirm("Delete this quiz? This cannot be undone.")) return;

    try {
      const token = getToken();
      const csrf = getCsrfToken();
      const headers = {};
      if (token) headers["Authorization"] = `Token ${token}`;
      if (!token && csrf) headers["X-CSRFToken"] = csrf;

      const response = await fetch(`/api/quizzes/${quizId}/`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      if (!response.ok) throw new Error("Delete failed");

      // Refresh list
      fetchQuizzes();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // View quiz
  const viewQuiz = (permalink) => {
    router.push(`/quizzes/${permalink}`);
  };

  // Edit quiz
  const editQuiz = (quizId) => {
    router.push(`/admin/create-quiz/${quizId}`);
  };

  return (
    <div className={styles.container}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h1>My Quizzes</h1>
        <Link href="/admin/create-quiz" className={styles.primaryBtn}>
          + Create New Quiz
        </Link>
      </div>

      {loading && <p>Loading quizzes...</p>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && quizzes.length === 0 && (
        <div className={styles.section}>
          <p>No quizzes found. Create your first quiz to get started!</p>
        </div>
      )}

      {!loading && quizzes.length > 0 && (
        <div className={styles.section}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Status</th>
                <th>Questions</th>
                <th>Attempts</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((quiz) => (
                <tr key={quiz.id}>
                  <td>
                    <strong>{quiz.title}</strong>
                    {quiz.content && (
                      <div
                        style={{
                          fontSize: "0.875rem",
                          color: "#666",
                          marginTop: "0.25rem",
                        }}
                      >
                        {quiz.content.substring(0, 100)}
                        {quiz.content.length > 100 && "..."}
                      </div>
                    )}
                  </td>
                  <td>{quiz.subject || "-"}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        styles[quiz.quiz_type || "free"]
                      }`}
                    >
                      {quiz.quiz_type || "free"}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles[quiz.status]}`}>
                      {quiz.status}
                    </span>
                  </td>
                  <td>{quiz.questions?.length || 0}</td>
                  <td>{quiz.attempt_count || 0}</td>
                  <td>{new Date(quiz.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => viewQuiz(quiz.permalink)}
                      className={styles.viewBtn}
                      title="View Quiz"
                    >
                      View
                    </button>
                    <button
                      onClick={() => editQuiz(quiz.id)}
                      className={styles.selectBtn}
                      title="Edit Quiz"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(quiz.id)}
                      className={styles.deleteBtn}
                      title="Delete Quiz"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              marginTop: "2rem",
              padding: "1rem",
              backgroundColor: "#f0f9ff",
              borderRadius: "8px",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
              Quick Tips:
            </h3>
            <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
              <li>
                Click &quot;View&quot; to see the quiz as students will see it
              </li>
              <li>
                Click &quot;Edit&quot; to modify the quiz content and questions
              </li>
              <li>Published quizzes are visible to all users</li>
              <li>Draft quizzes are only visible to you</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

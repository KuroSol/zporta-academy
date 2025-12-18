import { useState } from "react";
import { useRouter } from "next/router";
import styles from "../../styles/admin.module.css";

export default function BulkImportPage() {
  const [jsonFile, setJsonFile] = useState(null);
  const [jsonData, setJsonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [step, setStep] = useState(1); // 1: Upload, 2: Review, 3: Done
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

  // Base API helper (supports NEXT_PUBLIC_API_BASE to avoid Next.js 404 proxy issues)
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
  const apiUrl = (path) => `${apiBase}${path}`;

  // Handle JSON file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJsonFile(file);
    setError(null);

    // Parse and preview JSON
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);

        // Validate structure
        if (!data.quizzes || !Array.isArray(data.quizzes)) {
          throw new Error('Invalid JSON: Must have "quizzes" array');
        }

        // Initialize media fields for each question
        data.quizzes.forEach((quiz) => {
          quiz.questions = quiz.questions || [];
          quiz.questions.forEach((q) => {
            q._imageFile = null;
            q._audioFile = null;
          });
        });

        setJsonData(data);
        setStep(2);
      } catch (err) {
        setError(`JSON Parse Error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Handle media upload for specific question
  const handleQuestionMedia = (quizIdx, questionIdx, type, file) => {
    const newData = { ...jsonData };
    newData.quizzes[quizIdx].questions[questionIdx][`_${type}File`] = file;
    setJsonData(newData);
  };

  // Upload everything to backend
  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getToken();
      const csrf = getCsrfToken();

      // First, upload any media files to assets
      for (let qIdx = 0; qIdx < jsonData.quizzes.length; qIdx++) {
        const quiz = jsonData.quizzes[qIdx];

        for (let idx = 0; idx < quiz.questions.length; idx++) {
          const q = quiz.questions[idx];

          // Upload image if provided
          if (q._imageFile) {
            const formData = new FormData();
            formData.append("file", q._imageFile);
            formData.append("kind", "image");
            formData.append("provider", "Bulk Import");

            const headers = {};
            if (token) headers["Authorization"] = `Token ${token}`;
            if (!token && csrf) headers["X-CSRFToken"] = csrf;

            const response = await fetch(apiUrl("/api/assets/"), {
              method: "POST",
              headers,
              body: formData,
              credentials: "include",
            });

            if (response.ok) {
              const asset = await response.json();
              q.question_image = asset.url;
            }
          }

          // Upload audio if provided
          if (q._audioFile) {
            const formData = new FormData();
            formData.append("file", q._audioFile);
            formData.append("kind", "audio");
            formData.append("provider", "Bulk Import");

            const headers = {};
            if (token) headers["Authorization"] = `Token ${token}`;
            if (!token && csrf) headers["X-CSRFToken"] = csrf;

            const response = await fetch(apiUrl("/api/assets/"), {
              method: "POST",
              headers,
              body: formData,
              credentials: "include",
            });

            if (response.ok) {
              const asset = await response.json();
              q.question_audio = asset.url;
            }
          }

          // Clean up temporary fields
          delete q._imageFile;
          delete q._audioFile;
        }
      }

      // Now upload the complete JSON with media URLs
      const formData = new FormData();
      const jsonBlob = new Blob([JSON.stringify(jsonData)], {
        type: "application/json",
      });
      formData.append("file", jsonBlob, "import.json");

      const headers = {};
      if (token) headers["Authorization"] = `Token ${token}`;
      if (!token && csrf) headers["X-CSRFToken"] = csrf;

      const response = await fetch(apiUrl("/api/bulk_import/upload-quizzes/"), {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
      });

      // Be defensive: backend might return HTML on auth/proxy errors, so prefer text first
      const rawText = await response.text();
      let parsed = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch (_) {
        // Not JSON; surface the HTML/text so the user sees the real backend error
        throw new Error(
          `Upload failed (${response.status}): ${
            rawText.slice(0, 200) || "No response body"
          }`
        );
      }

      if (!response.ok) {
        throw new Error(
          parsed?.error ||
            parsed?.errors?.[0] ||
            `Upload failed (${response.status})`
        );
      }

      const result = parsed;

      setSuccess(
        `✅ Successfully created ${result.created_quizzes} quizzes with ${result.created_questions} questions!`
      );
      setStep(3);

      // Redirect to quizzes list after 3 seconds
      setTimeout(() => {
        router.push("/admin/quizzes");
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setJsonFile(null);
    setJsonData(null);
    setStep(1);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className={styles.container}>
      <h1>📦 Bulk Import Quizzes</h1>

      {/* Step 1: Upload JSON */}
      {step === 1 && (
        <div className={styles.section}>
          <h2>Step 1: Upload JSON File</h2>

          <div className={styles.uploadControls}>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className={styles.input}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.help}>
            <h3>📄 JSON Format:</h3>
            <pre className={styles.codeBlock}>{`{
  "quizzes": [
    {
      "title": "Quiz Title",
      "content": "Quiz description",
      "subject_name": "English",
      "difficulty_level": "easy",
      "tag_names": ["TOEIC", "Grammar"],
      "questions": [
        {
          "question_text": "Question?",
          "question_type": "mcq",
          "option1": "A",
          "option2": "B",
          "correct_option": 2
        }
      ]
    }
  ]
}`}</pre>
            <p>
              <a
                href="/api/bulk_import/quiz-example/"
                target="_blank"
                style={{ color: "#3498db", textDecoration: "underline" }}
              >
                Download Example Template
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Review & Add Media */}
      {step === 2 && jsonData && (
        <div className={styles.section}>
          <h2>Step 2: Review & Add Media</h2>

          <div
            style={{
              marginBottom: "1rem",
              padding: "1rem",
              backgroundColor: "#e8f5e9",
              borderRadius: "8px",
            }}
          >
            <strong>✅ Found:</strong> {jsonData.quizzes.length} quiz(es) with{" "}
            {jsonData.quizzes.reduce(
              (sum, q) => sum + (q.questions?.length || 0),
              0
            )}{" "}
            question(s)
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {jsonData.quizzes.map((quiz, qIdx) => (
            <div
              key={qIdx}
              style={{
                marginBottom: "2rem",
                padding: "1.5rem",
                backgroundColor: "#f5f5f5",
                borderRadius: "8px",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                📝 Quiz {qIdx + 1}: {quiz.title}
              </h3>
              <p style={{ color: "#666", marginBottom: "1rem" }}>
                {quiz.content || "No description"}
              </p>
              <p style={{ fontSize: "0.875rem", color: "#888" }}>
                Subject: {quiz.subject_name || "Not specified"} | Difficulty:{" "}
                {quiz.difficulty_level || "medium"} | Questions:{" "}
                {quiz.questions?.length || 0}
              </p>

              {quiz.questions &&
                quiz.questions.map((q, idx) => (
                  <div
                    key={idx}
                    style={{
                      marginTop: "1rem",
                      padding: "1rem",
                      backgroundColor: "white",
                      borderRadius: "8px",
                      border: "1px solid #ddd",
                    }}
                  >
                    <h4 style={{ marginTop: 0, fontSize: "1rem" }}>
                      Q{idx + 1}: {q.question_text}
                    </h4>

                    {q.question_type === "mcq" && (
                      <div
                        style={{
                          fontSize: "0.875rem",
                          color: "#666",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <div>A) {q.option1}</div>
                        <div>B) {q.option2}</div>
                        {q.option3 && <div>C) {q.option3}</div>}
                        {q.option4 && <div>D) {q.option4}</div>}
                        <div
                          style={{
                            color: "#27ae60",
                            fontWeight: "bold",
                            marginTop: "0.25rem",
                          }}
                        >
                          ✓ Correct: Option {q.correct_option}
                        </div>
                      </div>
                    )}

                    {q.question_type === "short" && (
                      <div
                        style={{
                          fontSize: "0.875rem",
                          color: "#666",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <strong>Correct Answer:</strong> {q.correct_answer}
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: "1rem",
                        marginTop: "0.75rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: "1", minWidth: "250px" }}>
                        <label
                          style={{
                            fontSize: "0.875rem",
                            display: "block",
                            marginBottom: "0.25rem",
                          }}
                        >
                          🖼️ Question Image (optional):
                        </label>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleQuestionMedia(
                                qIdx,
                                idx,
                                "image",
                                e.target.files[0]
                              )
                            }
                            style={{ fontSize: "0.875rem", flex: 1 }}
                            key={
                              q._imageFile ? "image-uploaded" : "image-empty"
                            }
                          />
                          {q._imageFile && (
                            <button
                              onClick={() =>
                                handleQuestionMedia(qIdx, idx, "image", null)
                              }
                              style={{
                                padding: "0.25rem 0.5rem",
                                backgroundColor: "#e74c3c",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                              }}
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>
                        {q._imageFile && (
                          <div
                            style={{
                              color: "#27ae60",
                              fontSize: "0.75rem",
                              marginTop: "0.25rem",
                            }}
                          >
                            ✓ {q._imageFile.name}
                          </div>
                        )}
                      </div>

                      <div style={{ flex: "1", minWidth: "250px" }}>
                        <label
                          style={{
                            fontSize: "0.875rem",
                            display: "block",
                            marginBottom: "0.25rem",
                          }}
                        >
                          🔊 Question Audio (optional):
                        </label>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) =>
                              handleQuestionMedia(
                                qIdx,
                                idx,
                                "audio",
                                e.target.files[0]
                              )
                            }
                            style={{ fontSize: "0.875rem", flex: 1 }}
                            key={
                              q._audioFile ? "audio-uploaded" : "audio-empty"
                            }
                          />
                          {q._audioFile && (
                            <button
                              onClick={() =>
                                handleQuestionMedia(qIdx, idx, "audio", null)
                              }
                              style={{
                                padding: "0.25rem 0.5rem",
                                backgroundColor: "#e74c3c",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                              }}
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>
                        {q._audioFile && (
                          <div
                            style={{
                              color: "#27ae60",
                              fontSize: "0.75rem",
                              marginTop: "0.25rem",
                            }}
                          >
                            ✓ {q._audioFile.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ))}

          <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
            <button
              onClick={handleReset}
              className={styles.btn}
              disabled={loading}
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              className={styles.primaryBtn}
              disabled={loading}
            >
              {loading ? "Uploading..." : "✓ Create All Quizzes"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 3 && (
        <div className={styles.section}>
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              backgroundColor: "#e8f5e9",
              borderRadius: "8px",
            }}
          >
            <h2 style={{ color: "#27ae60", marginTop: 0 }}>🎉 Success!</h2>
            <p style={{ fontSize: "1.125rem" }}>{success}</p>
            <p style={{ color: "#666", marginTop: "1rem" }}>
              Redirecting to quiz list...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

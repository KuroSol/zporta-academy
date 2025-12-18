import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
} from "react";
import { useRouter } from "next/router";
import CustomEditor from "@/components/Editor/CustomEditor";
import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import styles from "@/styles/admin/CreateCourse.module.css";
import Modal from "@/components/Modal/Modal";
import CreateLesson from "@/components/admin/CreateLesson";
import CreateQuiz from "@/components/admin/CreateQuiz";

// --- Helper Components ---
const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const CoursePreview = ({ courseData, coverImagePreview, t }) => (
  <div className={styles.previewContainer}>
    <h3 className={styles.previewTitle}>{t("admin.livePreview")}</h3>
    <div className={styles.previewCard}>
      <div className={styles.previewImageContainer}>
        {coverImagePreview ? (
          <img
            src={coverImagePreview}
            alt="Course Preview"
            className={styles.previewImage}
          />
        ) : (
          <div className={styles.previewImagePlaceholder}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>{t("admin.coverImage")}</span>
          </div>
        )}
      </div>
      <div className={styles.previewContent}>
        <h4 className={styles.previewCourseTitle}>
          {courseData.title || t("admin.yourCourseTitle")}
        </h4>
        <p className={styles.previewCourseSubject}>
          {courseData.subjectName || t("admin.subject")}
        </p>
        <div
          className={styles.previewPriceBadge}
          data-type={courseData.courseType || "free"}
        >
          {courseData.courseType === "premium"
            ? `$${parseFloat(courseData.price || 0).toFixed(2)}`
            : t("analytics.free")}
        </div>
        <div
          className={styles.previewDescription}
          dangerouslySetInnerHTML={{
            __html:
              courseData.description ||
              `<p>${t("admin.descriptionPlaceholder")}</p>`,
          }}
        />
        {Array.isArray(courseData.sellingPoints) &&
          courseData.sellingPoints.filter((p) => p && p.trim()).length > 0 && (
            <div className={styles.previewSellingPointsCard}>
              <div className={styles.previewSellingPointsHeader}>
                {t("admin.whatYoullGet")}
              </div>
              <ul className={styles.previewSellingPointsList}>
                {courseData.sellingPoints
                  .filter((p) => p && p.trim())
                  .slice(0, 3)
                  .map((pt, idx) => (
                    <li key={idx} className={styles.previewSellingPointItem}>
                      <span className={styles.previewSellingPointIcon}>★</span>
                      <span className={styles.previewSellingPointText}>
                        {pt.trim()}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
      </div>
    </div>
  </div>
);

const CreateCourse = () => {
  // --- State Management ---
  const [currentStep, setCurrentStep] = useState(1);
  const [savedSteps, setSavedSteps] = useState([]);

  // Course Data - ALL held in state until the final save
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [selectedLessons, setSelectedLessons] = useState([]);
  const [coverImage, setCoverImage] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState(null);
  const [courseType, setCourseType] = useState("free");
  const [price, setPrice] = useState("0.00");
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizzes, setSelectedQuizzes] = useState([]);
  const [isDraft, setIsDraft] = useState(true);
  const [testers, setTesters] = useState("");
  const [tags, setTags] = useState("");
  // Selling points (up to 3 short benefit bullets)
  const [sellingPoints, setSellingPoints] = useState(["", "", ""]);

  // UI State
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // --- Hooks and Refs ---
  const router = useRouter();
  const editorRef = useRef(null);
  const { logout } = useContext(AuthContext);
  const fileInputRef = useRef(null);

  const t = useT();

  const STEPS = [
    { id: 1, title: t("admin.courseDetails") },
    { id: 2, title: t("admin.description") },
    { id: 3, title: t("admin.addLessons") },
    { id: 4, title: t("admin.addQuizzes") },
    { id: 5, title: t("admin.publish") },
  ];

  // --- Helpers & Validation (moved before data fetching) ---
  const extractErrorMessage = (error) => {
    if (!error.response?.data) return error.message;
    const data = error.response.data;
    if (typeof data === "string") return data;
    if (typeof data === "object") {
      return Object.entries(data)
        .map(
          ([field, messages]) =>
            `${field}: ${
              Array.isArray(messages) ? messages.join(" ") : messages
            }`
        )
        .join(" | ");
    }
    return "An unknown error occurred.";
  };

  const handleApiError = useCallback(
    (error, defaultMessage) => {
      console.error("API Error:", error.response?.data || error.message);
      const errorMsg = extractErrorMessage(error);
      showFeedback(errorMsg || defaultMessage, "error");
      if (error.response?.status === 401 || error.response?.status === 403)
        logout();
    },
    [logout]
  );

  const showFeedback = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    if (type !== "error") {
      setTimeout(() => setMessage(""), 4000);
    }
  };

  // --- Data Fetching ---
  const fetchInitialData = useCallback(async () => {
    setLoadingInitial(true);
    setMessage("");
    try {
      const [subjectsRes, lessonsRes, quizzesRes] = await Promise.all([
        apiClient.get("/subjects/"),
        apiClient.get("/lessons/my/"),
        apiClient.get("/quizzes/my/"),
      ]);
      setSubjects(Array.isArray(subjectsRes.data) ? subjectsRes.data : []);
      setLessons(Array.isArray(lessonsRes.data) ? lessonsRes.data : []);
      setQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : []);
    } catch (error) {
      handleApiError(
        error,
        "Failed to load required data. Please try refreshing."
      );
    } finally {
      setLoadingInitial(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    if (localStorage.getItem("token")) {
      fetchInitialData();
    } else {
      router.push("/login");
    }
  }, [fetchInitialData, router]);

  const refreshContentLists = useCallback(async () => {
    try {
      const [lessonsRes, quizzesRes] = await Promise.all([
        apiClient.get("/lessons/my/"),
        apiClient.get("/quizzes/my/"),
      ]);
      setLessons(Array.isArray(lessonsRes.data) ? lessonsRes.data : []);
      setQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : []);
    } catch (error) {
      handleApiError(error, "Failed to refresh lesson/quiz lists.");
    }
  }, [handleApiError]);

  // --- Event Handlers ---
  const handleInputChange = (setter) => (e) => {
    setter(e.target.value);
    setUnsavedChanges(true);
  };

  const handleCoverImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showFeedback("Cover image cannot exceed 5MB.", "error");
      return;
    }
    setCoverImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setCoverImagePreview(reader.result);
    reader.readAsDataURL(file);
    setUnsavedChanges(true);
  };

  const clearCoverImage = () => {
    setCoverImage(null);
    setCoverImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = null;
    setUnsavedChanges(true);
  };

  const handleContentToggle = (id, selectedItems, setSelectedItems) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
    setUnsavedChanges(true);
  };

  const handleLessonCreated = (newLesson) => {
    setIsLessonModalOpen(false);
    showFeedback(
      `Lesson "${
        newLesson?.title || "New Lesson"
      }" created! You can now select it.`,
      "success"
    );
    refreshContentLists();
  };

  const handleQuizCreated = (newQuiz) => {
    setIsQuizModalOpen(false);
    showFeedback(
      t("admin.quizCreated", { title: newQuiz?.title || t("admin.newQuiz") }),
      "success"
    );
    refreshContentLists();
  };

  // --- Navigation and Saving Logic ---
  const handleStepContinue = () => {
    // Always validate the current step to save its state before proceeding.
    // This is crucial for the editor, which doesn't use the 'unsavedChanges' flag.
    if (!validateCurrentStep()) return;

    markStepAsSaved(currentStep);
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleFinalSave = () => {
    // Validate all previous steps before final submission
    for (let i = 1; i <= STEPS.length; i++) {
      if (!validateCurrentStep(i)) {
        setCurrentStep(i); // Switch to the step with the error
        return;
      }
    }
    createCourseInBackend();
  };

  // The ONLY function that interacts with the backend to CREATE the course
  const createCourseInBackend = async () => {
    setSubmitting(true);
    showFeedback(t("admin.savingCourse"), "info");

    const formData = createCourseFormData();

    if (!isDraft) {
      formData.append("publish", "true");
      const testerList = testers
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      testerList.forEach((t) => formData.append("allowed_testers", t));
    }

    try {
      const response = await apiClient.post("/courses/", formData);
      const coursePermalink = response.data.permalink;

      if (!coursePermalink) {
        throw new Error("Failed to get course identifier after creation.");
      }

      showFeedback(t("admin.courseCreated"), "info");

      const attachmentPromises = [
        ...selectedLessons.map((id) =>
          apiClient
            .post(`/courses/${coursePermalink}/add-lesson/`, { lesson_id: id })
            .catch((e) => ({ type: "Lesson", id, error: e }))
        ),
        ...selectedQuizzes.map((id) =>
          apiClient
            .post(`/courses/${coursePermalink}/add-quiz/`, { quiz_id: id })
            .catch((e) => ({ type: "Quiz", id, error: e }))
        ),
      ];

      let attachmentErrors = [];
      if (attachmentPromises.length > 0) {
        const results = await Promise.allSettled(attachmentPromises);
        results.forEach((result) => {
          if (result.status === "rejected" || result.value?.error) {
            const failedItem =
              result.status === "rejected" ? result.reason : result.value;
            attachmentErrors.push(`${failedItem.type} (${failedItem.id})`);
          }
        });
      }

      if (attachmentErrors.length > 0) {
        setMessage(
          `Course ${
            isDraft ? "saved as draft" : "published"
          }, but failed to attach: ${attachmentErrors.join(
            ", "
          )}. Please edit the course to try again.`
        );
        setMessageType("warning");
        setTimeout(() => router.push(`/courses/${coursePermalink}`), 4000);
      } else {
        setMessage(
          `Course ${isDraft ? "saved as draft" : "published"} successfully!`
        );
        setMessageType("success");
        setTimeout(() => {
          router.push(`/courses/${coursePermalink}`);
        }, 2000);
      }
    } catch (error) {
      handleApiError(
        error,
        "An unexpected error occurred while creating the course."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      setUnsavedChanges(false);
    }
  };

  const navigateToStep = (stepId) => {
    if (stepId < currentStep && savedSteps.includes(stepId)) {
      if (unsavedChanges) {
        showFeedback(
          "Please save your changes by continuing before navigating back.",
          "warning"
        );
        return;
      }
      setCurrentStep(stepId);
    }
  };

  const markStepAsSaved = (stepId) => {
    if (!savedSteps.includes(stepId)) {
      setSavedSteps((prev) => [...prev, stepId]);
    }
    setUnsavedChanges(false);
  };

  // Treat "<p><br></p>" and "&nbsp;" as empty
  const isEmptyHtml = (html) => {
    if (!html) return true;
    const text = html
      .replace(/<br\s*\/?>/gi, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/<[^>]*>/g, "")
      .trim();
    return text.length === 0;
  };

  const readEditorHtml = () => {
    // Prefer state. Fall back to ref if state is empty and ref has content.
    const viaState = description ?? "";
    if (!isEmptyHtml(viaState)) return viaState;
    const viaRef = editorRef.current?.getContent?.() ?? "";
    return viaRef;
  };

  const createCourseFormData = () => {
    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("subject", subject);
    // Send tags as array
    if (tags && tags.trim()) {
      const tagArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      tagArray.forEach((tag) => formData.append("tag_names", tag));
    }
    if (coverImage) formData.append("cover_image", coverImage);
    formData.append("course_type", courseType);
    formData.append(
      "price",
      courseType === "premium" ? parseFloat(price).toFixed(2) : "0.00"
    );

    const finalDescription = readEditorHtml();
    formData.append("description", finalDescription);
    // Selling points: keep up to 3 non-empty points, trimmed
    try {
      const cleaned = (sellingPoints || [])
        .map((p) => (p || "").trim())
        .filter(Boolean)
        .slice(0, 3);
      formData.append("selling_points", JSON.stringify(cleaned));
    } catch (_) {
      // ignore if serialization fails; backend will default
    }
    return formData;
  };

  const validateCurrentStep = (stepToValidate = currentStep) => {
    let isValid = true;
    let errorMsg = "";
    switch (stepToValidate) {
      case 1:
        if (!title.trim()) errorMsg = t("admin.titleRequired");
        else if (!subject) errorMsg = t("admin.selectSubject");
        else if (courseType === "premium" && (!price || parseFloat(price) <= 0))
          errorMsg = t("admin.priceRequired");
        break;
      case 2:
        // Use state first, then ref as fallback
        const html = readEditorHtml();
        if (isEmptyHtml(html)) {
          errorMsg = t("admin.descriptionRequired");
        } else {
          // ensure state is synced for preview and final submit
          if (html !== description) setDescription(html);
        }
        break;
      case 5:
        const testerList = testers
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (!isDraft && testerList.length > 3) errorMsg = t("admin.maxTesters");
        break;
      default:
        break;
    }

    if (errorMsg) {
      showFeedback(errorMsg, "error");
      isValid = false;
    }
    return isValid;
  };

  // --- Render Logic ---
  if (loadingInitial) {
    return <div className={styles.loading}>{t("admin.loading")}</div>;
  }

  const subjectName = subjects.find((s) => s.id == subject)?.name;
  const previewData = {
    title,
    subjectName,
    courseType,
    price,
    description,
    sellingPoints,
  };

  return (
    <div className={styles.createCoursePage}>
      <div className={styles.mainContent}>
        <div className={styles.header}>
          <h2>{t("admin.createNewCourse")}</h2>
          <div className={styles.headerActions}>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}
            >
              {t("common.exit")}
            </button>
          </div>
        </div>

        <div className={styles.stepper}>
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <div
                className={`${styles.stepItem} ${
                  currentStep === step.id ? styles.active : ""
                } ${savedSteps.includes(step.id) ? styles.completed : ""}`}
                onClick={() => navigateToStep(step.id)}
              >
                <div className={styles.stepCounter}>
                  {savedSteps.includes(step.id) ? <CheckIcon /> : step.id}
                </div>
                <div className={styles.stepTitle}>{step.title}</div>
              </div>
              {index < STEPS.length - 1 && (
                <div className={styles.stepConnector}></div>
              )}
            </React.Fragment>
          ))}
        </div>

        {message && (
          <p className={`${styles.message} ${styles[messageType]}`}>
            {message}
          </p>
        )}

        <div className={styles.stepContent}>
          {/* Step 1: Course Details */}
          {currentStep === 1 && (
            <div className={styles.formSection}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="courseTitle">
                    Title <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="courseTitle"
                    type="text"
                    value={title}
                    onChange={handleInputChange(setTitle)}
                    placeholder="e.g., Introduction to Web Development"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="courseSubject">
                    {t("admin.subject")}{" "}
                    <span className={styles.required}>*</span>
                  </label>
                  <select
                    id="courseSubject"
                    value={subject}
                    onChange={handleInputChange(setSubject)}
                  >
                    <option value="">{t("admin.selectSubjectPrompt")}</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="courseTags">{t("admin.tags")}</label>
                  <input
                    id="courseTags"
                    type="text"
                    value={tags}
                    onChange={handleInputChange(setTags)}
                    placeholder={t("admin.tagsPlaceholder")}
                  />
                  <small className={styles.fieldNote}>
                    {t("admin.tagsHelp")}
                  </small>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="courseType">
                    {t("admin.type")} <span className={styles.required}>*</span>
                  </label>
                  <select
                    id="courseType"
                    value={courseType}
                    onChange={handleInputChange(setCourseType)}
                  >
                    <option value="free">{t("analytics.free")}</option>
                    <option value="premium">{t("analytics.premium")}</option>
                  </select>
                </div>
                {courseType === "premium" && (
                  <div className={styles.formGroup}>
                    <label htmlFor="coursePrice">
                      {t("admin.price")}{" "}
                      <span className={styles.required}>*</span>
                    </label>
                    <input
                      id="coursePrice"
                      type="number"
                      value={price}
                      onChange={handleInputChange(setPrice)}
                      step="0.01"
                      min="0.01"
                      placeholder={t("admin.pricePlaceholder")}
                    />
                  </div>
                )}
              </div>
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label htmlFor="coverImage">{t("admin.coverImageLabel")}</label>
                <input
                  id="coverImage"
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg, image/png, image/webp"
                  onChange={handleCoverImageChange}
                  style={{ display: "none" }}
                />
                <div className={styles.fileInputArea}>
                  <button
                    type="button"
                    className={styles.fileInputButton}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    {t("admin.uploadImage")}
                  </button>
                  {coverImagePreview && (
                    <div className={styles.imagePreviewContainer}>
                      <img
                        src={coverImagePreview}
                        alt="Cover preview"
                        className={styles.imagePreview}
                      />
                      <span className={styles.fileName}>
                        {coverImage?.name}
                      </span>
                      <button
                        type="button"
                        onClick={clearCoverImage}
                        className={styles.clearImageButton}
                        title="Remove image"
                      >
                        &times;
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label>{t("admin.sellingPoints")}</label>
                <div className={styles.sellingPointsInputs}>
                  {sellingPoints.map((pt, idx) => (
                    <input
                      key={idx}
                      type="text"
                      maxLength={120}
                      placeholder={t("admin.benefitPlaceholder", {
                        number: idx + 1,
                      })}
                      value={pt}
                      onChange={(e) => {
                        const next = [...sellingPoints];
                        next[idx] = e.target.value;
                        setSellingPoints(next);
                        setUnsavedChanges(true);
                      }}
                    />
                  ))}
                  <small className={styles.fieldNote}>
                    {t("admin.sellingPointsHelp")}
                  </small>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Description */}
          {currentStep === 2 && (
            <div className={styles.formSection}>
              <label>
                {t("admin.courseDescription")}{" "}
                <span className={styles.required}>*</span>
              </label>
              <div className={styles.editorContainer}>
                <CustomEditor
                  ref={editorRef}
                  mediaCategory="course"
                  /* Keep editor and preview in sync */
                  onChange={(html) => {
                    setDescription(html ?? "");
                    setUnsavedChanges(true);
                  }}
                  /* Remove if your CustomEditor doesn't support value */
                  value={description}
                />
              </div>
            </div>
          )}

          {/* Step 3: Add Lessons */}
          {currentStep === 3 && (
            <div className={styles.formSection}>
              <div className={styles.contentSectionHeader}>
                <h3>{t("admin.availableLessons")}</h3>
                <button
                  type="button"
                  onClick={() => setIsLessonModalOpen(true)}
                  className={styles.createContentBtn}
                >
                  {t("admin.createNewLessonBtn")}
                </button>
              </div>
              <div className={styles.contentListArea}>
                {lessons.length > 0 ? (
                  <div className={styles.scrollableBox}>
                    {lessons.map((lesson) => (
                      <div key={lesson.id} className={styles.contentItem}>
                        <input
                          type="checkbox"
                          id={`lesson-${lesson.id}`}
                          checked={selectedLessons.includes(lesson.id)}
                          onChange={() =>
                            handleContentToggle(
                              lesson.id,
                              selectedLessons,
                              setSelectedLessons
                            )
                          }
                          disabled={!!lesson.course}
                        />
                        <label htmlFor={`lesson-${lesson.id}`}>
                          {lesson.title}
                          {lesson.course ? (
                            <span className={styles.alreadyAttached}>
                              {" "}
                              (In another course)
                            </span>
                          ) : (
                            ""
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.noContentMessage}>
                    {t("admin.noLessons")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Add Quizzes */}
          {currentStep === 4 && (
            <div className={styles.formSection}>
              <div className={styles.contentSectionHeader}>
                <h3>{t("admin.availableQuizzes")}</h3>
                <button
                  type="button"
                  onClick={() => setIsQuizModalOpen(true)}
                  className={styles.createContentBtn}
                >
                  {t("admin.createNewQuizBtn")}
                </button>
              </div>
              <div className={styles.contentListArea}>
                {quizzes.length > 0 ? (
                  <div className={styles.scrollableBox}>
                    {quizzes.map((quiz) => (
                      <div key={quiz.id} className={styles.contentItem}>
                        <input
                          type="checkbox"
                          id={`quiz-${quiz.id}`}
                          checked={selectedQuizzes.includes(quiz.id)}
                          onChange={() =>
                            handleContentToggle(
                              quiz.id,
                              selectedQuizzes,
                              setSelectedQuizzes
                            )
                          }
                          disabled={!!quiz.course || !!quiz.lesson}
                        />
                        <label htmlFor={`quiz-${quiz.id}`}>
                          {quiz.title}
                          {quiz.course || quiz.lesson ? (
                            <span className={styles.alreadyAttached}>
                              {" "}
                              {t("admin.inUse")}
                            </span>
                          ) : (
                            ""
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.noContentMessage}>
                    {t("admin.noQuizzes")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Publish */}
          {currentStep === 5 && (
            <div className={styles.formSection}>
              <div className={styles.formGroup}>
                <label>{t("admin.finalReview")}</label>
                <p className={styles.reviewText}>
                  {t("admin.finalReviewText")}
                </p>
              </div>
              <div className={styles.formGroup}>
                <label>
                  {t("admin.courseStatus")}{" "}
                  <span className={styles.required}>*</span>
                </label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="status"
                      value="draft"
                      checked={isDraft}
                      onChange={() => {
                        setIsDraft(true);
                      }}
                    />
                    {t("admin.saveAsDraft")}
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="status"
                      value="published"
                      checked={!isDraft}
                      onChange={() => {
                        setIsDraft(false);
                      }}
                    />
                    {t("admin.publishCourse")}
                  </label>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="testers">{t("admin.assignTesters")}</label>
                <input
                  id="testers"
                  type="text"
                  placeholder={t("admin.testersPlaceholder")}
                  value={testers}
                  onChange={handleInputChange(setTesters)}
                  disabled={isDraft}
                />
                {isDraft && (
                  <small className={styles.fieldNote}>
                    {t("admin.testersHelp")}
                  </small>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.navigationActions}>
          <button
            onClick={handlePrevStep}
            className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}
            disabled={currentStep === 1 || submitting}
          >
            {t("common.back")}
          </button>
          {currentStep < STEPS.length ? (
            <button
              onClick={handleStepContinue}
              className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`}
              disabled={submitting}
            >
              {unsavedChanges ? t("admin.saveContinue") : t("common.continue")}
            </button>
          ) : (
            <button
              onClick={handleFinalSave}
              className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`}
              disabled={submitting}
            >
              {submitting
                ? t("admin.saving")
                : isDraft
                ? t("admin.saveDraft")
                : t("admin.publishCourseBtn")}
            </button>
          )}
        </div>
      </div>
      <div className={styles.sidebar}>
        <CoursePreview
          courseData={previewData}
          coverImagePreview={coverImagePreview}
          t={t}
        />
      </div>

      {/* --- Modals --- */}
      <Modal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        title={t("admin.createNewLesson")}
      >
        <CreateLesson
          onSuccess={handleLessonCreated}
          onClose={() => setIsLessonModalOpen(false)}
          isModalMode={true}
        />
      </Modal>
      <Modal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        title="Create New Quiz"
      >
        <CreateQuiz
          onSuccess={handleQuizCreated}
          onClose={() => setIsQuizModalOpen(false)}
          isModalMode={true}
        />
      </Modal>
    </div>
  );
};

export default CreateCourse;

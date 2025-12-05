import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/api";
import styles from "@/styles/TeacherMailMagazine.module.css";
import MailMagazineEditor from "./Editor/MailMagazineEditor";
import AutomationManager from "./MailMagazine/AutomationManager";
import RecipientManagementModal from "./MailMagazine/RecipientManagementModal";
import {
  FaPaperPlane,
  FaSyncAlt,
  FaUsers,
  FaEye,
  FaCopy,
  FaEdit,
  FaTrash,
  FaChartLine,
  FaTimes,
  FaUserPlus,
  FaSave,
  FaCalendarAlt,
  FaBolt,
  FaFileAlt,
} from "react-icons/fa";

const FREQUENCY_OPTIONS = [
  { value: "one_time", label: "One time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const hasTeacherAccess = (profile) => {
  if (!profile) return false;
  const role = profile.role || profile.profile?.role;
  return role === "guide" || role === "both" || Boolean(profile.is_staff);
};

const initialForm = {
  title: "",
  subject: "",
  body: "",
  frequency: "one_time",
  send_at: "",
  is_active: true,
};

// Built-in stylish templates available directly in compose view
const BUILT_IN_TEMPLATES = [
  {
    key: "thank_attend",
    name: "Thank You for Attending",
    subject: "Thank you for attending!",
    body: '<h2 style="color:#ffb703;">Thank You for Attending!</h2>\n<p>Hello {{student_name}},</p>\n<p>I appreciate you taking time to visit my guide page. Your curiosity means a lot! Feel free to explore more resources and reach out with any questions.</p>\n<p>Warm regards,<br/>{{teacher_name}}</p>',
  },
  {
    key: "thank_purchase",
    name: "Thank You for Purchase",
    subject: "Thank you for your purchase!",
    body: '<h2 style="color:#ffb703;">Thank You for Your Purchase!</h2>\n<p>Hello {{student_name}},</p>\n<p>Thanks for purchasing <strong>{{course_name}}</strong>. Dive into the first lesson when you are ready and let me know if you need onboarding help.</p>\n<ul style="line-height:1.6;">\n  <li>Start with the introduction module</li>\n  <li>Set your learning goals</li>\n  <li>Join community discussions</li>\n</ul>\n<p>Best,<br/>{{teacher_name}}</p>',
  },
  {
    key: "welcome_enroll",
    name: "Welcome Enrollment",
    subject: "Welcome to {{course_name}}!",
    body: '<h2 style="color:#ffb703;">Welcome to {{course_name}}!</h2>\n<p>Hello {{student_name}},</p>\n<p>Thrilled to have you onboard. Start with the intro module and set your learning goals. I\'m here if you need support.</p>\n<p>To your success,<br/>{{teacher_name}}</p>',
  },
  {
    key: "completion",
    name: "Course Completion Congratulations",
    subject: "Congratulations on completing {{course_name}}!",
    body: '<h2 style="color:#ffb703;">🎉 Congratulations!</h2>\n<p>Hi {{student_name}},</p>\n<p>You just completed <strong>{{course_name}}</strong> — outstanding work! Consider leaving a review and exploring advanced courses.</p>\n<p>Keep growing,<br/>{{teacher_name}}</p>',
  },
  {
    key: "custom_blank",
    name: "Custom Blank",
    subject: "Your custom message",
    body: '<h2 style="color:#ffb703;">Your Custom Message</h2>\n<p>Hello {{student_name}},</p>\n<p>Write your personalized content here...</p>\n<p>Regards,<br/>{{teacher_name}}</p>',
  },
];

const TeacherMailMagazine = () => {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();
  const editorRef = useRef(null);

  const [magazines, setMagazines] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [formState, setFormState] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // New state for modals and features
  const [activeView, setActiveView] = useState("list"); // 'list', 'compose', 'automations'
  const [selectedMagazine, setSelectedMagazine] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [recipientGroups, setRecipientGroups] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");

  // Lock background scroll when any overlay modal is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const body = document.body;
    const modalActive =
      showDetailModal || showRecipientsModal || showAnalyticsModal;
    if (modalActive) {
      html.style.overflowY = "hidden";
      html.style.height = "100%";
      body.style.overflowY = "hidden";
      body.style.height = "100%";
      const scrollBarWidth = window.innerWidth - html.clientWidth;
      if (scrollBarWidth > 0) body.style.paddingRight = scrollBarWidth + "px";
    } else {
      html.style.overflowY = "";
      html.style.height = "";
      body.style.overflowY = "";
      body.style.height = "";
      body.style.paddingRight = "";
    }
    return () => {
      html.style.overflowY = "";
      html.style.height = "";
      body.style.overflowY = "";
      body.style.height = "";
      body.style.paddingRight = "";
    };
  }, [
    showDetailModal,
    showRecipientsModal,
    showAnalyticsModal,
    showPreviewModal,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (showDetailModal) setShowDetailModal(false);
        if (showRecipientsModal) setShowRecipientsModal(false);
        if (showAnalyticsModal) setShowAnalyticsModal(false);
      }
      if (
        e.key === "Tab" &&
        (showDetailModal ||
          showRecipientsModal ||
          showAnalyticsModal ||
          showPreviewModal)
      ) {
        const modal = document.querySelector("." + styles.modalContent);
        if (!modal) return;
        const focusables = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    if (
      showDetailModal ||
      showRecipientsModal ||
      showAnalyticsModal ||
      showPreviewModal
    ) {
      setTimeout(() => {
        const modal = document.querySelector("." + styles.modalContent);
        if (modal) {
          const firstInput = modal.querySelector(
            "input, button, select, textarea"
          );
          if (firstInput) firstInput.focus();
        }
      }, 10);
    }
    return () => document.removeEventListener("keydown", handleKey);
  }, [
    showDetailModal,
    showRecipientsModal,
    showAnalyticsModal,
    showPreviewModal,
  ]);

  const loadMagazines = useCallback(async () => {
    setListLoading(true);
    setFeedback((prev) =>
      prev.type === "error" ? prev : { type: "", message: "" }
    );
    try {
      const { data } = await apiClient.get("/teacher-mail-magazines/");
      const ordered = (data || []).sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setMagazines(ordered);
    } catch (error) {
      const message =
        error.response?.data?.detail || "Unable to load your mail magazines.";
      setFeedback({ type: "error", message });
    } finally {
      setListLoading(false);
    }
  }, []);

  // Build full email preview wrapper
  const buildPreviewHtml = (bodyHtml, subject) => {
    const safeBody = bodyHtml || "<p>(No content yet)</p>";
    const safeSubject = subject || "Untitled Mail Magazine";
    return `
    <table role="presentation" width="100%" style="background:#0b1523;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" style="width:600px;max-width:600px;background:#142233;color:#ffffff;font-family:Segoe UI,Arial,sans-serif;border-radius:8px;overflow:hidden;">
          <tr><td style="padding:24px 32px;background:#0b1523;border-bottom:1px solid #1f2e40;">
            <h1 style="margin:0;font-size:24px;color:#ffb703;">${safeSubject}</h1>
            <p style="margin:8px 0 0;font-size:14px;color:#94a3b8;">Preview of your mail magazine</p>
          </td></tr>
          <tr><td style="padding:32px;line-height:1.6;font-size:16px;">
            ${safeBody}
          </td></tr>
          <tr><td style="padding:24px 32px;background:#0b1523;border-top:1px solid #1f2e40;font-size:12px;color:#94a3b8;">
            <p style="margin:0 0 8px;">You are receiving this because you subscribed to ${
              user?.username || "your guide"
            }'s mail magazine.</p>
            <p style="margin:0;">Manage preferences or unsubscribe: <a href="https://zportaacademy.com/preferences/mail-magazines" style="color:#ffb703;">Click here</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
  };

  const loadTemplates = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/teacher-mail-magazines/");
      const templateList = data.filter(
        (mag) => mag.is_active && mag.frequency !== "one_time"
      );
      setTemplates(templateList);
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  }, []);

  const loadRecipientGroups = useCallback(async () => {
    try {
      // Fetch teacher's courses to get enrolled students
      const coursesResponse = await apiClient.get("/courses/my/");
      const myCourses = coursesResponse.data || [];

      // Collect all unique enrolled students
      let allStudents = [];
      const courseGroups = [];

      for (const course of myCourses) {
        try {
          // Fetch enrollments for this course
          const enrollResponse = await apiClient.get(
            `/enrollment/course/${course.id}/`
          );
          const enrollments = enrollResponse.data || [];
          const courseStudents = enrollments.map((e) => ({
            id: e.user_details?.id || e.user,
            username: e.user_details?.username || `User ${e.user}`,
            display_name:
              e.user_details?.display_name ||
              e.user_details?.username ||
              `Student ID: ${e.user}`,
          }));

          if (courseStudents.length > 0) {
            courseGroups.push({
              id: `course_${course.id}`,
              name: `${course.title}`,
              count: courseStudents.length,
              students: courseStudents,
              type: "course",
            });
            allStudents = [...allStudents, ...courseStudents];
          }
        } catch (err) {
          console.error(
            `Failed to load enrollments for course ${course.id}:`,
            err
          );
        }
      }

      // Remove duplicate students
      const uniqueStudents = Array.from(
        new Map(allStudents.map((s) => [s.id, s])).values()
      );

      setRecipientGroups([
        {
          id: "all",
          name: "All My Students",
          count: uniqueStudents.length,
          students: uniqueStudents,
          type: "all",
        },
        ...courseGroups,
      ]);
    } catch (error) {
      console.error("Failed to load recipient groups:", error);
      setRecipientGroups([
        {
          id: "all",
          name: "All Students",
          count: 0,
          students: [],
          type: "all",
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!hasTeacherAccess(user)) {
      router.replace("/profile");
      return;
    }
    loadMagazines();
    loadTemplates();
    loadRecipientGroups();
  }, [
    loading,
    user,
    router,
    loadMagazines,
    loadTemplates,
    loadRecipientGroups,
  ]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Get content from rich text editor
    const editorContent = editorRef.current?.getContent() || "";

    if (
      !formState.title.trim() ||
      !formState.subject.trim() ||
      !editorContent.trim()
    ) {
      setFeedback({
        type: "error",
        message: "Title, subject, and body are required.",
      });
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const payload = {
        title: formState.title.trim(),
        subject: formState.subject.trim(),
        body: editorContent.trim(),
        frequency: formState.frequency,
        is_active: formState.is_active,
      };
      if (formState.send_at) {
        const date = new Date(formState.send_at);
        if (!Number.isNaN(date.getTime())) payload.send_at = date.toISOString();
      }

      if (editingId) {
        await apiClient.put(`/teacher-mail-magazines/${editingId}/`, payload);
        setFeedback({
          type: "success",
          message: "Mail magazine updated successfully!",
        });
        setEditingId(null);
      } else {
        await apiClient.post("/teacher-mail-magazines/", payload);
        setFeedback({
          type: "success",
          message: "Mail magazine saved successfully!",
        });
      }

      setFormState(initialForm);
      editorRef.current?.clear();
      setActiveView("list");
      await loadMagazines();
      await loadTemplates();
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        "Unable to save mail magazine. Please try again.";
      setFeedback({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (magazine) => {
    setFormState({
      title: magazine.title,
      subject: magazine.subject,
      body: magazine.body,
      frequency: magazine.frequency,
      send_at: magazine.send_at
        ? new Date(magazine.send_at).toISOString().slice(0, 16)
        : "",
      is_active: magazine.is_active,
    });
    // Load content into editor
    setTimeout(() => {
      editorRef.current?.setContent(magazine.body || "");
    }, 100);
    setEditingId(magazine.id);
    setActiveView("compose");
  };

  const handleDelete = async (magazineId) => {
    if (!confirm("Are you sure you want to delete this mail magazine?")) return;
    try {
      await apiClient.delete(`/teacher-mail-magazines/${magazineId}/`);
      setFeedback({
        type: "success",
        message: "Mail magazine deleted successfully.",
      });
      await loadMagazines();
      await loadTemplates();
    } catch (error) {
      setFeedback({
        type: "error",
        message: "Failed to delete mail magazine.",
      });
    }
  };

  const handleUseTemplate = (template) => {
    setFormState({
      title: `${template.title} (Copy)`,
      subject: template.subject,
      body: template.body,
      frequency: template.frequency,
      send_at: "",
      is_active: true,
    });
    // Load template content into editor
    setTimeout(() => {
      editorRef.current?.setContent(template.body || "");
    }, 100);
    setEditingId(null);
    setActiveView("compose");
    setFeedback({
      type: "success",
      message: "Template loaded! Customize and save.",
    });
  };

  const handleViewDetails = (magazine) => {
    setSelectedMagazine(magazine);
    setShowDetailModal(true);
  };

  const handleViewRecipients = async (magazine) => {
    setSelectedMagazine(magazine);
    setShowRecipientsModal(true);
    try {
      const { data } = await apiClient.get(
        `/teacher-mail-magazines/${magazine.id}/`
      );
      const recipients = data.selected_recipients_details || [];
      // Format recipients to match our student format
      const formattedRecipients = recipients.map((r) => ({
        id: r.id,
        username: r.username || "Unknown",
        display_name: r.display_name || r.username || `User ${r.id}`,
      }));
      setSelectedRecipients(formattedRecipients);
    } catch (error) {
      console.error("Failed to load recipients:", error);
      setSelectedRecipients([]);
    }
  };

  const handleSelectGroup = (group) => {
    if (group.students && group.students.length > 0) {
      setSelectedRecipients(group.students);
    }
  };

  const handleRemoveRecipient = (recipientId) => {
    setSelectedRecipients((prev) => prev.filter((r) => r.id !== recipientId));
  };

  const handleSaveRecipients = async () => {
    if (!selectedMagazine) return;
    try {
      const recipientIds = selectedRecipients.map((r) => r.id);
      await apiClient.patch(`/teacher-mail-magazines/${selectedMagazine.id}/`, {
        selected_recipients: recipientIds,
      });
      setFeedback({
        type: "success",
        message: "Recipients updated successfully!",
      });
      closeModals();
      await loadMagazines();
    } catch (error) {
      setFeedback({ type: "error", message: "Failed to update recipients." });
    }
  };

  const handleSendEmail = async (magazineId) => {
    if (
      !window.confirm(
        "Are you sure you want to send this email to all selected recipients?"
      )
    ) {
      return;
    }

    try {
      const { data } = await apiClient.post(
        `/teacher-mail-magazines/${magazineId}/send_email/`
      );
      setFeedback({
        type: "success",
        message:
          data.message ||
          `Email sent successfully to ${data.recipients_count} recipients!`,
      });
      await loadMagazines();
    } catch (error) {
      const errorMsg = error.response?.data?.error || "Failed to send email.";
      setFeedback({ type: "error", message: errorMsg });
    }
  };

  const handleViewAnalytics = async (magazine) => {
    setSelectedMagazine(magazine);
    setShowAnalyticsModal(true);
    setAnalyticsData({
      sent: magazine.times_sent || 0,
      delivered: "N/A",
      opened: "N/A",
      clicked: "N/A",
    });
  };

  const closeModals = () => {
    setShowDetailModal(false);
    setShowRecipientsModal(false);
    setShowAnalyticsModal(false);
    setSelectedMagazine(null);
    setAnalyticsData(null);
  };

  const activeCount = useMemo(
    () => magazines.filter((mag) => mag.is_active).length,
    [magazines]
  );
  const weeklyCount = useMemo(
    () => magazines.filter((mag) => mag.frequency === "weekly").length,
    [magazines]
  );
  const monthlyCount = useMemo(
    () => magazines.filter((mag) => mag.frequency === "monthly").length,
    [magazines]
  );

  if (loading || !user) {
    return (
      <div className={styles.pageShell}>
        <div className={styles.centerState}>Loading your profile…</div>
      </div>
    );
  }

  if (!hasTeacherAccess(user)) {
    return (
      <div className={styles.pageShell}>
        <div className={styles.centerState}>
          This area is only for teachers and admins.
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Mail Magazine Manager | Zporta Academy</title>
      </Head>
      <div className={styles.pageShell}>
        <section className={styles.heroCard}>
          <div>
            <p className={styles.sectionEyebrow}>Professional Mail System</p>
            <h1 className={styles.heading}>Mail Magazine Manager</h1>
            <p className={styles.subheading}>
              Create, manage, and schedule professional newsletters. Use
              templates, manage recipient groups, and track your communication
              with students.
            </p>
          </div>
          <div className={styles.heroStats}>
            <div>
              <span>Total</span>
              <strong>{magazines.length}</strong>
            </div>
            <div>
              <span>Active</span>
              <strong>{activeCount}</strong>
            </div>
            <div>
              <span>Weekly</span>
              <strong>{weeklyCount}</strong>
            </div>
            <div>
              <span>Monthly</span>
              <strong>{monthlyCount}</strong>
            </div>
          </div>
        </section>

        <nav className={styles.tabNav}>
          <button
            className={`${styles.tabButton} ${
              activeView === "list" ? styles.tabActive : ""
            }`}
            onClick={() => {
              setActiveView("list");
              setEditingId(null);
              setFormState(initialForm);
            }}
          >
            <FaPaperPlane /> My Magazines
          </button>
          <button
            className={`${styles.tabButton} ${
              activeView === "compose" ? styles.tabActive : ""
            }`}
            onClick={() => {
              setActiveView("compose");
              setEditingId(null);
              setFormState(initialForm);
            }}
          >
            <FaEdit /> Compose New
          </button>
          <button
            className={`${styles.tabButton} ${
              activeView === "automations" ? styles.tabActive : ""
            }`}
            onClick={() => setActiveView("automations")}
          >
            <FaBolt /> Automations
          </button>
        </nav>

        {feedback.message && (
          <div className={`${styles.feedback} ${styles[feedback.type]}`}>
            {feedback.message}
            <button
              onClick={() => setFeedback({ type: "", message: "" })}
              className={styles.feedbackClose}
            >
              <FaTimes />
            </button>
          </div>
        )}

        {activeView === "list" && (
          <div className={styles.mainContent}>
            <div className={styles.contentHeader}>
              <h2>Your Mail Magazines</h2>
              <button
                className={styles.refreshButton}
                onClick={loadMagazines}
                disabled={listLoading}
              >
                <FaSyncAlt /> Refresh
              </button>
            </div>

            {listLoading ? (
              <p className={styles.centerState}>Loading entries…</p>
            ) : magazines.length === 0 ? (
              <div className={styles.emptyState}>
                <FaPaperPlane size={48} />
                <p>You haven&apos;t created any mail magazines yet.</p>
                <button
                  className={styles.primaryButton}
                  onClick={() => setActiveView("compose")}
                >
                  Create Your First Magazine
                </button>
              </div>
            ) : (
              <div className={styles.magazineGrid}>
                {magazines.map((magazine) => (
                  <div key={magazine.id} className={styles.magazineCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitleSection}>
                        <h3 className={styles.cardTitle}>{magazine.title}</h3>
                        <p className={styles.cardSubject}>{magazine.subject}</p>
                      </div>
                      <span
                        className={`${styles.statusBadge} ${
                          magazine.is_active ? styles.active : styles.inactive
                        }`}
                      >
                        {magazine.is_active ? "Active" : "Paused"}
                      </span>
                    </div>

                    <p className={styles.cardBodyPreview}>
                      {magazine.body
                        ?.replace(/<[^>]*>/g, " ")
                        .replace(/\s+/g, " ")
                        .trim()
                        .slice(0, 120)}
                      {magazine.body?.length > 120 ? "..." : ""}
                    </p>

                    <div className={styles.cardMeta}>
                      <div className={styles.metaItem}>
                        <FaCalendarAlt />
                        <span>
                          {FREQUENCY_OPTIONS.find(
                            (f) => f.value === magazine.frequency
                          )?.label || magazine.frequency}
                        </span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Recipients:</span>
                        <span className={styles.metaValue}>
                          {magazine.selected_recipients?.length || 0}
                        </span>
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <button
                        className={styles.actionButton}
                        onClick={() => handleViewDetails(magazine)}
                        title="View Details"
                      >
                        <FaEye /> View
                      </button>
                      <button
                        className={`${styles.actionButton} ${styles.primaryActionButton}`}
                        onClick={() => handleSendEmail(magazine.id)}
                        title="Send Email Now"
                      >
                        <FaPaperPlane /> Send
                      </button>
                      <button
                        className={styles.actionButton}
                        onClick={() => handleViewRecipients(magazine)}
                        title="Manage Recipients"
                      >
                        <FaUsers /> Recipients
                      </button>
                      <button
                        className={styles.actionButton}
                        onClick={() => handleViewAnalytics(magazine)}
                        title="View Analytics"
                      >
                        <FaChartLine /> Stats
                      </button>
                      <button
                        className={styles.actionButton}
                        onClick={() => handleEdit(magazine)}
                        title="Edit"
                      >
                        <FaEdit /> Edit
                      </button>
                      <button
                        className={`${styles.actionButton} ${styles.dangerButton}`}
                        onClick={() => handleDelete(magazine.id)}
                        title="Delete"
                      >
                        <FaTrash /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === "compose" && (
          <div className={styles.mainContent}>
            <form className={styles.composeForm} onSubmit={handleSubmit}>
              <h2>
                {editingId ? "Edit Mail Magazine" : "Compose New Mail Magazine"}
              </h2>

              <div className={styles.templateGallery}>
                <h3 className={styles.templateGalleryHeading}>
                  Quick Templates
                </h3>
                <p className={styles.subText}>
                  Insert a starting point and customize freely. Variables:
                  student_name, teacher_name, course_name (use double curly
                  braces)
                </p>
                <div className={styles.templateGridInline}>
                  {BUILT_IN_TEMPLATES.map((t) => (
                    <div key={t.key} className={styles.inlineTemplateCard}>
                      <div className={styles.inlineTemplateHeader}>
                        <strong>{t.name}</strong>
                        <span className={styles.inlineTemplateSubject}>
                          {t.subject}
                        </span>
                      </div>
                      <div className={styles.inlineTemplateBodyPreview}>
                        {t.body
                          .replace(/<[^>]*>/g, " ")
                          .replace(/\s+/g, " ")
                          .trim()
                          .slice(0, 90)}
                        ...
                      </div>
                      <button
                        type="button"
                        className={styles.useTemplateInlineButton}
                        onClick={() => {
                          setFormState((prev) => ({
                            ...prev,
                            subject: t.subject,
                            title: t.name + " Email",
                          }));
                          setTimeout(() => {
                            editorRef.current?.setContent(t.body);
                          }, 50);
                          setFeedback({
                            type: "success",
                            message: "Template inserted. Customize and save.",
                          });
                        }}
                      >
                        Use Template
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <label className={styles.formLabel}>
                Title *
                <input
                  name="title"
                  type="text"
                  value={formState.title}
                  onChange={handleChange}
                  placeholder="e.g., Weekly Newsletter, Monthly Update"
                  className={styles.input}
                  required
                />
              </label>

              <label className={styles.formLabel}>
                Email Subject *
                <input
                  name="subject"
                  type="text"
                  value={formState.subject}
                  onChange={handleChange}
                  placeholder="e.g., This Week in Your Course"
                  className={styles.input}
                  required
                />
              </label>

              <div className={styles.formLabel}>
                Message Body *
                <MailMagazineEditor ref={editorRef} />
              </div>

              <div className={styles.inlineFields}>
                <label className={styles.formLabel}>
                  Frequency
                  <select
                    name="frequency"
                    value={formState.frequency}
                    onChange={handleChange}
                    className={styles.select}
                  >
                    {FREQUENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.formLabel}>
                  Scheduled Send Time
                  <input
                    type="datetime-local"
                    name="send_at"
                    value={formState.send_at}
                    onChange={handleChange}
                    className={styles.input}
                  />
                </label>
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formState.is_active}
                  onChange={handleChange}
                />
                <span>Keep this mail magazine active</span>
              </label>

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={submitting}
                >
                  <FaSave />
                  {submitting
                    ? "Saving…"
                    : editingId
                    ? "Update Magazine"
                    : "Save Magazine"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    // Generate preview content from current editor state
                    const currentHtml = editorRef.current?.getContent?.() || "";
                    setPreviewHtml(
                      buildPreviewHtml(currentHtml, formState.subject)
                    );
                    setShowPreviewModal(true);
                  }}
                >
                  <FaEye /> Preview
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setActiveView("list");
                    setEditingId(null);
                    setFormState(initialForm);
                    editorRef.current?.clear();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {activeView === "automations" && <AutomationManager />}

        {showDetailModal && selectedMagazine && (
          <div className={styles.modal} onClick={closeModals}>
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="detail-modal-title"
            >
              <div className={styles.modalHeader}>
                <h2 id="detail-modal-title">Magazine Details</h2>
                <button className={styles.closeButton} onClick={closeModals}>
                  <FaTimes />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.detailRow}>
                  <strong>Title:</strong>
                  <span>{selectedMagazine.title}</span>
                </div>
                <div className={styles.detailRow}>
                  <strong>Subject:</strong>
                  <span>{selectedMagazine.subject}</span>
                </div>
                <div className={styles.detailRow}>
                  <strong>Frequency:</strong>
                  <span>
                    {
                      FREQUENCY_OPTIONS.find(
                        (f) => f.value === selectedMagazine.frequency
                      )?.label
                    }
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <strong>Status:</strong>
                  <span
                    className={
                      selectedMagazine.is_active
                        ? styles.activeText
                        : styles.inactiveText
                    }
                  >
                    {selectedMagazine.is_active ? "Active" : "Paused"}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <strong>Scheduled:</strong>
                  <span>
                    {selectedMagazine.send_at
                      ? new Date(selectedMagazine.send_at).toLocaleString()
                      : "Not scheduled"}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <strong>Last Sent:</strong>
                  <span>
                    {selectedMagazine.last_sent_at
                      ? new Date(selectedMagazine.last_sent_at).toLocaleString()
                      : "Never"}
                  </span>
                </div>
                <div className={styles.detailSection}>
                  <strong>Message Body:</strong>
                  <div
                    className={styles.bodyPreview}
                    dangerouslySetInnerHTML={{ __html: selectedMagazine.body }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {showRecipientsModal && selectedMagazine && (
          <RecipientManagementModal
            magazine={selectedMagazine}
            onClose={closeModals}
            onSave={() => {
              closeModals();
              loadMagazines();
            }}
          />
        )}

        {showAnalyticsModal && selectedMagazine && analyticsData && (
          <div className={styles.modal} onClick={closeModals}>
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="analytics-modal-title"
            >
              <div className={styles.modalHeader}>
                <h2 id="analytics-modal-title">
                  <FaChartLine /> Analytics & Statistics
                </h2>
                <button className={styles.closeButton} onClick={closeModals}>
                  <FaTimes />
                </button>
              </div>
              <div className={styles.modalBody}>
                <p className={styles.modalSubtext}>
                  Performance data for:{" "}
                  <strong>{selectedMagazine.title}</strong>
                </p>

                <div className={styles.analyticsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statValue}>{analyticsData.sent}</div>
                    <div className={styles.statLabel}>Times Sent</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statValue}>
                      {analyticsData.delivered}
                    </div>
                    <div className={styles.statLabel}>Delivered</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statValue}>
                      {analyticsData.opened}
                    </div>
                    <div className={styles.statLabel}>Opened</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statValue}>
                      {analyticsData.clicked}
                    </div>
                    <div className={styles.statLabel}>Clicked</div>
                  </div>
                </div>

                <div className={styles.analyticsNote}>
                  <p>
                    📊 <strong>Email Tracking Information:</strong>
                  </p>
                  <ul
                    style={{
                      marginTop: "0.5rem",
                      paddingLeft: "1.5rem",
                      lineHeight: "1.8",
                    }}
                  >
                    <li>
                      <strong>Times Sent:</strong> Tracked from database
                      (accurate)
                    </li>
                    <li>
                      <strong>Delivered:</strong> Requires ESP webhook
                      integration (SendGrid, Mailgun, etc.)
                    </li>
                    <li>
                      <strong>Opened:</strong> Requires tracking pixel embedded
                      in email HTML
                    </li>
                    <li>
                      <strong>Clicked:</strong> Requires special tracking links
                      in email content
                    </li>
                  </ul>
                  <p
                    style={{
                      marginTop: "1rem",
                      fontSize: "0.9rem",
                      opacity: "0.8",
                    }}
                  >
                    To enable full analytics, integrate an Email Service
                    Provider with webhook support.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPreviewModal && (
          <div
            className={styles.modal}
            onClick={() => setShowPreviewModal(false)}
          >
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="preview-modal-title"
            >
              <div className={styles.modalHeader}>
                <h2 id="preview-modal-title">Email Preview</h2>
                <button
                  className={styles.closeButton}
                  onClick={() => setShowPreviewModal(false)}
                >
                  <FaTimes />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.previewContainer}>
                  <iframe
                    title="email-preview"
                    style={{
                      width: "100%",
                      minHeight: "400px",
                      border: "1px solid #1f2e40",
                      borderRadius: "6px",
                      background: "#ffffff",
                    }}
                    sandbox="allow-same-origin"
                    srcDoc={previewHtml}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setShowPreviewModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TeacherMailMagazine;

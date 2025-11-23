// src/components/LessonDetail.js
import React, { useEffect, useState, useContext, useRef, useMemo } from "react";
import ShadowRootContainer from "@/components/common/ShadowRootContainer";
import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import { FaPlus, FaTimes, FaArrowUp, FaCheck, FaArrowLeft, FaRegClock, FaUser } from "react-icons/fa";
import { Pencil, Trash2, Download, Music } from "lucide-react";
import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";
import QuizCard from "@/components/QuizCard";
import styles from "@/styles/LessonDetail.module.css";
import "@/styles/Editor/ViewerAccordion.module.css";

/* ---- helpers kept (used by accordion + content render) ---- */
function initializeAccordions(containerElement) {
  if (!containerElement) return;
  const accordions = containerElement.querySelectorAll(".accordion-item");
  accordions.forEach((accordion) => {
    const header = accordion.querySelector(".accordion-header");
    const contents = accordion.querySelectorAll(".accordion-content");
    const defaultState = accordion.getAttribute("data-default-state") || "closed";
    if (!header || contents.length === 0 || accordion.dataset.accordionInitialized === "true") return;
    accordion.dataset.accordionInitialized = "true";
    if (defaultState === "open") accordion.classList.add("is-open");
    else accordion.classList.remove("is-open");
    const clickHandler = () => accordion.classList.toggle("is-open");
    if (header.__accordionClickHandler__) header.removeEventListener("click", header.__accordionClickHandler__);
    header.addEventListener("click", clickHandler);
    header.__accordionClickHandler__ = clickHandler;
    contents.forEach((content) => requestAnimationFrame(() => initializeAccordions(content)));
  });
}
const sanitizeContentViewerHTML = (htmlString) => {
  if (!htmlString) return "";
  if (typeof window === "undefined") return htmlString;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    doc.querySelectorAll('[contenteditable="true"]').forEach((el) => el.removeAttribute("contenteditable"));
    return doc.body.innerHTML;
  } catch {
    return htmlString;
  }
};
const sanitizeLessonCss = (css) => {
  if (!css) return "";
  let out = css;
  out = out.replace(/:root\b/g, ":host");
  out = out.replace(/\b(html|body)\b(?![^]*?<\/style>)/g, ".lesson-content");
  return out;
};
const getLessonHTML = (l) => l?.content ?? "";

/* ---- component ---- */
const LessonDetail = ({ initialData = null, initialPermalink = null }) => {
  const router = useRouter();
  const { username: paramUsername, subject, date, lessonSlug } = router.query || {};
  const permalink = useMemo(() => {
    if (!paramUsername || !subject || !date || !lessonSlug) return null;
    return `${paramUsername}/${subject}/${date}/${lessonSlug}`;
  }, [paramUsername, subject, date, lessonSlug]);
  const { user, token, logout } = useContext(AuthContext);

  const [lessonData, setLessonData] = useState(initialData);
  const [isEnrolled, setIsEnrolled] = useState(initialData?.is_enrolled || false);
  const [isCompleted, setIsCompleted] = useState(initialData?.is_completed || false);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadingType, setDownloadingType] = useState(null); // Track which download is in progress
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [gateInfo, setGateInfo] = useState(null);
  const [accentColor, setAccentColor] = useState("#222E3B");
  const [customCSS, setCustomCSS] = useState("");
  const [customJS, setCustomJS] = useState("");
  const [quizzes, setQuizzes] = useState([]);

  const lessonContentDisplayRef = useRef(null);

  const lessonHTML = useMemo(() => getLessonHTML(lessonData?.lesson), [lessonData?.lesson]);

  const stripHTML = (html) => {
    if (!html) return "";
    const noStyle = String(html).replace(/<style[\s\S]*?<\/style>/gi, "");
    const noTags = noStyle.replace(/<[^>]+>/g, " ");
    return noTags.replace(/\s+/g, " ").trim();
  };

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      // If we rendered with initial data for this permalink, skip client fetch
  // BUT: always re-fetch if user is authenticated to check enrollment status
  const shouldSkipFetch = initialData && initialPermalink && initialPermalink === permalink && !token;
  if (shouldSkipFetch) {
        // But still need to process gated status and enrollment flags
        if (initialData?.access === "gated" && !initialData.lesson) {
          setGateInfo({ message: initialData.message, course: initialData.course });
          setLessonData({ lesson: null, seo: initialData.seo || null });
        } else if (initialData.lesson) {
          setLessonData(initialData);
          setAccentColor(initialData.lesson.accent_color || "#222E3B");
          setCustomCSS(initialData.lesson.custom_css || "");
          setCustomJS(initialData.lesson.custom_js || "");
          setQuizzes(initialData.lesson.quizzes || []);
          if (typeof initialData.is_enrolled !== "undefined") {
            setIsEnrolled(!!initialData.is_enrolled);
            setIsCompleted(!!initialData.is_completed);
          }
        }
        setLoading(false);
        return;
      }
      if (!permalink) {
        if (isMounted) {
          setLoading(false);
          setError("Invalid URL.");
        }
        return;
      }
      setLoading(true);
      setError("");
      try {
        const lessonRes = await apiClient.get(`/lessons/${permalink}/`);
        if (!isMounted) return;
        if (lessonRes?.data?.access === "gated" && !lessonRes.data.lesson) {
          setGateInfo({ message: lessonRes.data.message, course: lessonRes.data.course });
          setLessonData({ lesson: null, seo: lessonRes.data.seo || null });
        } else if (lessonRes.data.lesson) {
          setLessonData(lessonRes.data);
          setAccentColor(lessonRes.data.lesson.accent_color || "#222E3B");
          setCustomCSS(lessonRes.data.lesson.custom_css || "");
          setCustomJS(lessonRes.data.lesson.custom_js || "");
          setQuizzes(lessonRes.data.lesson.quizzes || []);
        } else {
          throw new Error("Lesson data not found in response.");
        }
        // Prefer server-computed flags to avoid an extra network trip
        if (lessonRes.data && typeof lessonRes.data.is_enrolled !== "undefined") {
          setIsEnrolled(!!lessonRes.data.is_enrolled);
          setIsCompleted(!!lessonRes.data.is_completed);
        } else if (token && lessonRes.data.lesson) {
          // Fallback only if API didn't include the flags (backward compatibility)
          try {
            const statusRes = await apiClient.get(`/lessons/${permalink}/enrollment-status/`);
            if (!isMounted) return;
            setIsEnrolled(!!statusRes.data.is_enrolled);
            setIsCompleted(!!statusRes.data.is_completed);
          } catch (_) {
            setIsEnrolled(false);
            setIsCompleted(false);
          }
        } else {
          setIsEnrolled(false);
          setIsCompleted(false);
        }
      } catch (err) {
        if (isMounted) {
          if (err.response?.status === 404) setError("Lesson not found.");
          else if (err.response?.status === 401) {
            setError("Unauthorized.");
            logout();
            router.push("/login");
          } else if (err.response?.status === 403) setError(err.response?.data?.detail || "Access forbidden.");
          else setError("An error occurred loading lesson data.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    initialize();
    return () => {
      isMounted = false;
    };
  }, [permalink, token, logout, router, initialData, initialPermalink]);

  /* Accordions on read-only view */
  useEffect(() => {
    let timeoutId = null;
    let raf = null;
    const container = lessonContentDisplayRef.current;
    const init = () => {
      if (lessonHTML && container) initializeAccordions(container);
    };
    if (lessonHTML) {
      raf = requestAnimationFrame(() => {
        timeoutId = setTimeout(init, 50);
      });
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (timeoutId) clearTimeout(timeoutId);
      if (container) {
        const headers = container.querySelectorAll(".accordion-header");
        headers.forEach((header) => {
          if (header.__accordionClickHandler__) {
            header.removeEventListener("click", header.__accordionClickHandler__);
            delete header.__accordionClickHandler__;
          }
        });
        container
          .querySelectorAll(".accordion-item")
          .forEach((item) => delete item.dataset.accordionInitialized);
      }
    };
  }, [lessonHTML]);

  // Intentionally no lazy-audio logic here; keep LessonDetail behavior unchanged

  /* Per-lesson Custom JS in shadow DOM */
  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    const code = (lessonData?.lesson?.custom_js || "").trim();
    if (!code) return;
    const timeoutId = setTimeout(() => {
      const hostEl = document.querySelector(`.${styles.lessonShadowRoot}`);
      const shadowRoot = hostEl?.shadowRoot;
      if (!shadowRoot) return;
      try {
        new Function("document", "root", code)(shadowRoot, hostEl);
      } catch {}
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [loading, lessonData]);

  /* Google Fonts into shadow DOM if present in CSS */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const css = lessonData?.lesson?.custom_css || "";
    const fontMatch = css.match(/@import\s+url\(['"]?([^'")]*googleapis[^'")]+)['"]?\);?/i);
    const fontHref = fontMatch?.[1];
    if (!fontHref) return;
    const hostEl = document.querySelector(`.${styles.lessonShadowRoot}`);
    const shadowRoot = hostEl?.shadowRoot;
    if (!shadowRoot) return;
    if (shadowRoot.querySelector(`link[href="${fontHref}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fontHref;
    shadowRoot.appendChild(link);
    return () => {
      try {
        const existing = shadowRoot.querySelector(`link[href="${fontHref}"]`);
        if (existing) shadowRoot.removeChild(existing);
      } catch {}
    };
  }, [lessonData?.lesson?.custom_css]);

  /* actions */
  const handleCompleteLesson = async () => {
    if (!lessonData?.lesson?.id || !permalink || isCompleted || isSubmitting) return;
    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);
    try {
      const response = await apiClient.post(`/lessons/${permalink}/complete/`, {});
      setSuccessMessage(response.data.message || "Lesson marked complete!");
      setIsCompleted(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to mark lesson complete.");
      if (err.response?.status === 401) logout();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!permalink || lessonData?.lesson?.is_locked || isSubmitting) {
      setError("Cannot delete: Lesson is locked, submitting, or invalid.");
      return;
    }
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setSuccessMessage("Click delete again to confirm.");
      setTimeout(() => {
        setConfirmingDelete(false);
        setSuccessMessage("");
      }, 4000);
      return;
    }
    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);
    try {
      await apiClient.delete(`/lessons/${permalink}/delete/`);
      setSuccessMessage("Lesson deleted. Redirecting...");
      setTimeout(() => router.push("/admin/lessons"), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete lesson.");
      setConfirmingDelete(false);
      if (err.response?.status === 401) logout();
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!lessonData?.lesson?.id || isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    setDownloadingType('pdf');
    try {
      // Call the backend PDF export endpoint
      const response = await apiClient.get(`/lessons/${lessonData.lesson.id}/export-pdf/`, {
        responseType: 'blob', // Important: receive as binary blob
      });
      
      // Create a blob from the PDF data
      const blob = new Blob([response.data], { type: 'application/pdf' });
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `lesson-${lessonData.lesson.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage("PDF downloaded successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to download PDF. Please try again.");
      if (err.response?.status === 401) {
        logout();
      }
    } finally {
      setIsSubmitting(false);
      setDownloadingType(null);
    }
  };

  const handleDownloadAudio = async () => {
    if (!lessonData?.lesson?.id || isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    setDownloadingType('audio');
    try {
      const response = await apiClient.get(`/lessons/${lessonData.lesson.id}/export-audio/`, {
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lesson-${lessonData.lesson.id}-audio.zip`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage("Audio downloaded successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      if (err.response?.status === 404) {
          setError("No audio files found for this lesson.");
      } else {
          setError(err.response?.data?.detail || "Failed to download audio.");
      }
      if (err.response?.status === 401) {
        logout();
      }
    } finally {
      setIsSubmitting(false);
      setDownloadingType(null);
    }
  };

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    let videoId = null;
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname.includes("youtube.com") && parsedUrl.searchParams.has("v")) videoId = parsedUrl.searchParams.get("v");
      else if (parsedUrl.hostname.includes("youtube.com") && parsedUrl.pathname.startsWith("/embed/")) videoId = parsedUrl.pathname.substring("/embed/".length);
      else if (parsedUrl.hostname === "youtu.be") videoId = parsedUrl.pathname.slice(1);
      else if (parsedUrl.hostname.includes("youtube.com") && parsedUrl.pathname.startsWith("/shorts/")) videoId = parsedUrl.pathname.split("/shorts/")[1];
      if (videoId) {
        videoId = videoId.split("&")[0].split("?")[0];
        return `https://www.youtube.com/embed/${videoId}`;
      }
    } catch {}
    return null;
  };

  /* render guards */
  if (loading) return <div style={{ padding: "20px", textAlign: "center" }}>Loading lesson details...</div>;
  if (error && !lessonData && !gateInfo) return <p className={`${styles.message} ${styles.error}`} style={{ padding: "20px", textAlign: "center" }}>{error}</p>;

  if (gateInfo && !lessonData?.lesson) {
    return (
      <div className={styles.lessonDetailContainer}>
        <Head>
          <title>Premium Lesson</title>
          <meta name="robots" content="noindex,nofollow" />
        </Head>
        <h1 className={styles.lessonTitle}>Premium Lesson</h1>
        {error && <p className={`${styles.message} ${styles.error}`}>{error}</p>}
        <p className={`${styles.message} ${styles.warning}`}>{gateInfo.message || "Enrollment required."}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
          {gateInfo.course?.permalink && (
            <Link href={`/courses/${gateInfo.course.permalink}`} className={`${styles.btn} ${styles.btnPrimary}`}>
              Go to Course: {gateInfo.course.title}
            </Link>
          )}
          {!token && (
            <Link href={`/login?redirect=/lessons/${permalink}`} className={`${styles.btn} ${styles.btnSecondary}`}>
              Log in to Enroll
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!lessonData?.lesson) {
    if (error) return <p className={`${styles.message} ${styles.error}`} style={{ padding: "20px", textAlign: "center" }}>{error}</p>;
    return <p style={{ padding: "20px", textAlign: "center" }}>Lesson not found.</p>;
  }

  const { lesson, seo } = lessonData;
  const accent = lesson.accent_color || "#222E3B";
  const isOwner = user && lesson?.created_by?.toLowerCase() === user.username?.toLowerCase();
  const isLocked = lesson.is_locked;
  const isAttachedToCourse = !!lesson.course_data?.permalink;

  return (
    <div className={styles.lessonDetailContainer}>
      <Head>
        <title>{seo?.title || lesson.title || "Lesson Details"}</title>
        <meta name="description" content={seo?.description || stripHTML(lesson.content).substring(0, 160)} />
        <meta
          name="robots"
          content={lesson.status === "draft" || lesson.is_premium || gateInfo ? "noindex,nofollow" : seo?.robots || "index,follow"}
        />
        <style>{`.${styles.lessonDetailContainer}{--accent-color:${accent};}`}</style>
        {(() => {
          const base = typeof window !== "undefined" ? window.location.origin : "";
          let canonical = lesson.canonical_url || "";
          if (!canonical && base && permalink) canonical = `${base}/lessons/${permalink}`;
          return canonical ? <link rel="canonical" href={canonical} /> : null;
        })()}
        <meta property="og:title" content={lesson.og_title || seo?.title || lesson.title} />
        <meta property="og:description" content={lesson.og_description || seo?.description || stripHTML(lesson.content).substring(0, 160)} />
        {lesson.og_image && <meta property="og:image" content={lesson.og_image} />}
      </Head>

      <h1 className={styles.lessonTitle}>
        {lesson.title} {isLocked && isOwner && <span className={styles.lockedIndicator} title="Locked">🔒</span>}
      </h1>

      {/* Course info */}
      {isAttachedToCourse ? (
        <div className={styles.courseInfo}>
          <p>
            Part of course:{" "}
            <Link href={`/courses/${lesson.course_data.permalink}`} className={styles.courseLink}>
              {lesson.course_data.title}
            </Link>
          </p>
        </div>
      ) : (
        <div className={styles.lessonStatusInfo}>
          <p>
            Standalone Lesson{" "}
            {lesson.is_premium ? <span className={styles.badgePremium}>Premium</span> : <span className={styles.badgeFree}>Free</span>}
          </p>
          {lesson.is_premium && !isEnrolled && (
            <p className={styles.enrollPrompt}>{token ? "Enrollment required." : <Link href={`/login?redirect=/lessons/${permalink}`}>Log in</Link>}</p>
          )}
        </div>
      )}

      {/* messages */}
      {error && <p className={`${styles.message} ${styles.error}`}>{error}</p>}
      {successMessage && <p className={`${styles.message} ${styles.success}`}>{successMessage}</p>}

      {/* owner actions: Edit & Download - moved to top */}
      {isOwner && (
        <div className={styles.lessonActionsTop}>
          <Link
            href={`/admin/lessons/${encodeURIComponent(lesson.permalink)}/edit`}
            className={`${styles.btn} ${styles.btnSecondary} ${styles.editBtnTop}`}
            title={isLocked ? "Locked" : "Edit Lesson"}
            aria-disabled={isLocked ? "true" : "false"}
            onClick={(e) => {
              if (isLocked) e.preventDefault();
            }}
          >
            <Pencil size={16} /> Edit
          </Link>
        </div>
      )}

      {/* Download section - moved to top for visibility */}
      {(isEnrolled || !lesson.is_premium) && (
        <div className={styles.downloadSectionTop}>
          <h3 className={styles.downloadTitle}>Download this lesson</h3>
          <div className={styles.downloadButtons}>
            <button
              onClick={handleDownloadPDF}
              className={`${styles.btn} ${styles.btnSecondary} ${styles.downloadBtn}`}
              title="Download as PDF"
              disabled={isSubmitting}
            >
              {downloadingType === 'pdf' ? (
                <>
                  <span className={styles.spinner}></span> Preparing PDF...
                </>
              ) : (
                <>
                  <Download size={16} /> PDF
                </>
              )}
            </button>
            <button
              onClick={handleDownloadAudio}
              className={`${styles.btn} ${styles.btnSecondary} ${styles.downloadBtn}`}
              title="Download Audio (ZIP)"
              disabled={isSubmitting}
            >
              {downloadingType === 'audio' ? (
                <>
                  <span className={styles.spinner}></span> Preparing Audio...
                </>
              ) : (
                <>
                  <Music size={16} /> Audio
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* video */}
      {lesson.video_url &&
        (() => {
          const url = getYoutubeEmbedUrl(lesson.video_url);
          return url ? (
            <div className={styles.lessonVideoEmbed}>
              <iframe
                src={url}
                title={`${lesson.title} Video`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className={styles.lessonVideoLink}>
              <p>
                Video:{" "}
                <a href={lesson.video_url} target="_blank" rel="noopener noreferrer">
                  {lesson.video_url}
                </a>
              </p>
            </div>
          );
        })()}

  {/* content in shadow DOM */}
<ShadowRootContainer as="div" className={styles.lessonShadowRoot} data-lesson-root="true" style={{ "--accent-color": accent }}>
  <style>{`:host { --accent-color: ${accent}; }
${sanitizeLessonCss(customCSS || "")}

/* grid/columns */
.lesson-content .zporta-columns{display:grid;gap:1.5rem;grid-template-columns:var(--cols-base, 1fr);align-items:start;margin-block:1rem;}
.lesson-content .zporta-column{min-width:0;}
.lesson-content .zporta-column > *{word-break:break-word;max-width:100%;margin-bottom:1rem;}
.lesson-content .zporta-column > *:last-child{margin-bottom:0;}
.lesson-content .zporta-column img,.lesson-content .zporta-column video,.lesson-content .zporta-column iframe{max-width:100%;height:auto;display:block;border-radius:0.5rem;}
@media (min-width:640px){.lesson-content .zporta-columns{grid-template-columns:var(--cols-sm, var(--cols-base, 1fr));}}
@media (min-width:768px){.lesson-content .zporta-columns{grid-template-columns:var(--cols-md, var(--cols-sm, var(--cols-base, 1fr)));}}
@media (min-width:1024px){.lesson-content .zporta-columns{grid-template-columns:var(--cols-lg, var(--cols-md, var(--cols-sm, var(--cols-base, 1fr))));}}

/* buttons */
.lesson-content .zporta-button{display:inline-flex;align-items:center;justify-content:center;font-weight:600;text-decoration:none;border:1px solid transparent;padding:.6rem 1.1rem;border-radius:var(--r-md);transition:filter .15s}
.lesson-content .zporta-button:hover{filter:brightness(.95)}
.lesson-content .zporta-btn--block{display:flex;width:100%;text-align:center}
.lesson-content .zporta-btnSize--sm{padding:.4rem .85rem;font-size:.9rem}
.lesson-content .zporta-btnSize--md{padding:.6rem 1.1rem;font-size:1rem}
.lesson-content .zporta-btnSize--lg{padding:.8rem 1.3rem;font-size:1.1rem}
.lesson-content .zporta-btn--primary{background:var(--zporta-dark-blue,#0A2342);color:#fff;border-color:var(--zporta-dark-blue,#0A2342)}
.lesson-content .zporta-btn--secondary{background:#fff;color:var(--zporta-dark-blue,#0A2342);border-color:var(--zporta-dark-blue,#0A2342)}
.lesson-content .zporta-btn--ghost{background:transparent;color:var(--zporta-dark-blue,#0A2342);border-color:var(--zporta-border-color,#e2e8f0)}
.lesson-content .zporta-btn--link{background:transparent;color:var(--zporta-dark-blue,#0A2342);border:0;padding:0;text-decoration:underline}

/* accordion */
.lesson-content .zporta-accordion{width:100%}
.lesson-content .zporta-acc-item{border:1px solid var(--zporta-border-color,#e2e8f0);border-radius:var(--acc-radius,8px);margin:0 0 12px 0;overflow:hidden;background:var(--zporta-background-light,#fff)}
.lesson-content .zporta-acc-title{cursor:pointer;display:block;padding:.75rem 1rem;background:var(--zporta-background-medium,#f8fafc);font-weight:600;position:relative;padding-right:3rem;list-style:none}
.lesson-content .zporta-acc-title::-webkit-details-marker{display:none}
.lesson-content .zporta-acc-title[data-align="center"]{text-align:center}
.lesson-content .zporta-acc-title[data-align="right"]{text-align:right}
.lesson-content .zporta-acc-title[data-size="sm"]{font-size:.9rem}
.lesson-content .zporta-acc-title[data-size="md"]{font-size:1rem}
.lesson-content .zporta-acc-title[data-size="lg"]{font-size:1.1rem}
.lesson-content .zporta-acc-title::after{content:'';position:absolute;right:1rem;top:50%;width:.6em;height:.6em;transform:translateY(-50%) rotate(45deg);border-right:2px solid currentColor;border-bottom:2px solid currentColor;transition:transform .2s ease}
.lesson-content details[open]>.zporta-acc-title::after{transform:translateY(-50%) rotate(225deg)}
.lesson-content .zporta-acc-title[data-icon="plus"]::after{content:'+';border:0;font-weight:700;font-size:1.5em;transform:translateY(-50%);transition:transform .2s ease}
.lesson-content details[open]>.zporta-acc-title[data-icon="plus"]::after{transform:translateY(-50%) rotate(45deg)}
.lesson-content .zporta-acc-title[data-icon="none"]::after{display:none}
.lesson-content .zporta-acc--outline .zporta-acc-item{border-style:dashed}
.lesson-content .zporta-acc--dark .zporta-acc-item{background:#0f172a;border-color:#1f2a44}
.lesson-content .zporta-acc--dark .zporta-acc-title{background:#0b1220;color:#e2e8f0}
.lesson-content .zporta-acc--dark .zporta-acc-panel{background:#0f172a;color:#cbd5e1}
.lesson-content .zporta-acc-panel{padding:1rem;border-top:1px solid var(--zporta-border-color,#e2e8f0)}

/* gated content placeholder (modern card) */
.lesson-content .gated-content{position:relative;border-radius:12px;background:linear-gradient(180deg,#f8fafc,#f1f5f9);border:1px solid var(--zporta-border-color,#e2e8f0);padding:14px;overflow:hidden}
.lesson-content .gated-content::before{content:"";position:absolute;inset:0;background-image:radial-gradient(120px 50px at top left,rgba(10,35,66,.08),transparent),radial-gradient(150px 80px at bottom right,rgba(10,35,66,.06),transparent);pointer-events:none}
.lesson-content .gated-content .gc-card{display:flex;gap:14px;align-items:center}
.lesson-content .gated-content .gc-icon{flex:0 0 40px;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#0A2342;color:#fff;box-shadow:0 6px 14px rgba(10,35,66,.2);filter:saturate(1.1)}
.lesson-content .gated-content .gc-body{display:flex;flex-direction:column;gap:6px;color:#0f172a}
.lesson-content .gated-content .gc-title{font-weight:800;letter-spacing:0.2px}
.lesson-content .gated-content .gc-text{color:#334155}
.lesson-content .gated-content .gc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:.5rem .9rem;border-radius:10px;border:1px solid #0A2342;background:#0A2342;color:#fff;text-decoration:none;font-weight:700;box-shadow:0 6px 14px rgba(10,35,66,.2);transition:transform .12s ease,box-shadow .12s ease}
.lesson-content .gated-content .gc-btn:hover{transform:translateY(-1px);box-shadow:0 10px 20px rgba(10,35,66,.25)}

/* compact variant: blurred line + small link */
.lesson-content .gated-content.gc-compact{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:linear-gradient(180deg,#f8fafc,#f1f5f9);border:1px solid var(--zporta-border-color,#e2e8f0);margin:.5rem 0}
.lesson-content .gated-content.gc-compact::before{display:none}
.lesson-content .gated-content.gc-compact .gc-blur-line{flex:1 1 auto;height:.9em;max-width:220px;border-radius:6px;background:linear-gradient(90deg,#e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);background-size:200px 100%;filter:blur(1.2px);opacity:.7;animation:gc-shimmer 1.6s linear infinite}
@keyframes gc-shimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}
.lesson-content .gated-content.gc-compact .gc-link{flex:0 0 auto;font-weight:700;font-size:.85rem;color:#0A2342;text-decoration:none;padding:4px 10px;border:1px solid #0A2342;border-radius:9999px;background:#fff}
.lesson-content .gated-content.gc-compact .gc-link:hover{background:#0A2342;color:#fff}
`}</style>

  <div
    key={`html-${lesson.id}-${lesson.content?.length}`}
    ref={lessonContentDisplayRef}
    className="lesson-content"
    dangerouslySetInnerHTML={{ __html: sanitizeContentViewerHTML(lesson.content || "") }}
  />
</ShadowRootContainer>


      {/* quizzes display */}
      {quizzes?.length > 0 && (
        <section className={styles.lessonQuizzes}>
          <h2>Associated Quizzes</h2>
          {quizzes.map((q) => (
            <QuizCard key={q.id} quiz={q} />
          ))}
        </section>
      )}

      {/* meta */}
      <div className={styles.metaContainer}>
        <p className={styles.postMeta}>
          <span className={styles.metaItem}>
            <FaUser className={styles.metaIcon} /> {lesson.created_by || "Unknown"}
          </span>
          <span className={styles.metaSeparator}>|</span>
          <span className={styles.metaItem}>
            <FaRegClock className={styles.metaIcon} /> {lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : "Unknown"}
          </span>
        </p>
        {lesson.tags_output?.length > 0 && (
          <div className={styles.lessonTags}>
            <strong>Tags:</strong>
            {lesson.tags_output.map((tag) => (
              <span key={tag} className={styles.tagItem}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Download section - REMOVED from here, now at top */}

      {/* completion */}
      {isEnrolled && !isCompleted && (
        <div className={styles.completionAction}>
          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.completeBtn}`} onClick={handleCompleteLesson} disabled={isSubmitting}>
            Mark Lesson Complete
          </button>
        </div>
      )}
      {isCompleted && <div className={styles.completedIndicator}>✅ Lesson Completed!</div>}

      {/* owner actions: Edit -> route to admin editor; Delete stays */}
      {isOwner && (
        <div className={styles.lessonActions}>
          <button className={styles.deleteBtn} onClick={handleDeleteLesson} disabled={isLocked || isSubmitting} title={isLocked ? "Locked" : "Delete"}>
            <Trash2 size={18} /> <span>{confirmingDelete ? "Confirm!" : "Delete"}</span>
          </button>
        </div>
      )}

      {/* simple FAB */}
      <div className={styles.radialMenuContainer}>
        <div className={styles.radialMenu}>
          <button
            className={`${styles.localFab} ${styles.radialMenuButton} ${styles.mainButton}`}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            title="Scroll to Top"
          >
            <FaPlus size={24} />
          </button>
          {isEnrolled && !isCompleted && (
            <button className={`${styles.radialMenuButton} ${styles.item} ${styles.item2}`} onClick={handleCompleteLesson} title="Mark Complete">
              <FaCheck size={20} />
            </button>
          )}
          <button className={`${styles.radialMenuButton} ${styles.item} ${styles.item3}`} onClick={() => router.back()} title="Go Back">
            <FaArrowLeft size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LessonDetail;

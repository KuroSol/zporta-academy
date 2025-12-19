// src/components/PublicGuideProfile.js
import React, { useEffect, useState, useContext, useCallback } from "react";
import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  FaBookReader,
  FaAward,
  FaGlobe,
  FaLinkedin,
  FaTwitter,
  FaChalkboardTeacher,
} from "react-icons/fa";

import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";
import BioRenderer from "@/components/BioRenderer";
import { quizPermalinkToUrl } from "@/utils/urls";
import styles from "@/styles/PublicGuideProfile.module.css";

// Keep initial display sizes
const INITIAL_DISPLAY_DEFAULT_TAB = 6;
const SUBSEQUENT_LOAD_BATCH_SIZE = {
  courses: 6,
  lessons: 5,
  quizzes: 5,
};

// Simple throttle
const throttle = (func, limit) => {
  let inThrottle;
  return function () {
    if (!inThrottle) {
      func.apply(this, arguments);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export default function PublicGuideProfile() {
  const router = useRouter();
  const { username } = router.query || {};

  const { user: currentUser, token, logout } = useContext(AuthContext);

  const [profile, setProfile] = useState(null);
  const [seoData, setSeoData] = useState(null);
  const [activeTab, setActiveTab] = useState("courses");

  const [courses, setCourses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [mailIssues, setMailIssues] = useState([]);

  const [coursesLoading, setCoursesLoading] = useState(true);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [mailIssuesLoading, setMailIssuesLoading] = useState(true);

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [displayedCoursesCount, setDisplayedCoursesCount] = useState(
    SUBSEQUENT_LOAD_BATCH_SIZE.courses
  );
  const [displayedLessonsCount, setDisplayedLessonsCount] = useState(
    SUBSEQUENT_LOAD_BATCH_SIZE.lessons
  );
  const [displayedQuizzesCount, setDisplayedQuizzesCount] = useState(
    SUBSEQUENT_LOAD_BATCH_SIZE.quizzes
  );
  const [displayedMailIssuesCount, setDisplayedMailIssuesCount] = useState(5);

  const [attendances, setAttendances] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [guideRequest, setGuideRequest] = useState(null);
  const [attendLoading, setAttendLoading] = useState(false);
  const [showBioModal, setShowBioModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const stripHTML = (html) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
  };

  const handleLoadMoreCourses = useCallback(() => {
    if (isLoadingMore || displayedCoursesCount >= courses.length) return;
    setIsLoadingMore(true);
    setDisplayedCoursesCount((c) => c + SUBSEQUENT_LOAD_BATCH_SIZE.courses);
    setTimeout(() => setIsLoadingMore(false), 300);
  }, [isLoadingMore, displayedCoursesCount, courses.length]);

  const handleLoadMoreLessons = useCallback(() => {
    if (isLoadingMore || displayedLessonsCount >= lessons.length) return;
    setIsLoadingMore(true);
    setDisplayedLessonsCount((c) => c + SUBSEQUENT_LOAD_BATCH_SIZE.lessons);
    setTimeout(() => setIsLoadingMore(false), 300);
  }, [isLoadingMore, displayedLessonsCount, lessons.length]);

  const handleLoadMoreQuizzes = useCallback(() => {
    if (isLoadingMore || displayedQuizzesCount >= quizzes.length) return;
    setIsLoadingMore(true);
    setDisplayedQuizzesCount((c) => c + SUBSEQUENT_LOAD_BATCH_SIZE.quizzes);
    setTimeout(() => setIsLoadingMore(false), 300);
  }, [isLoadingMore, displayedQuizzesCount, quizzes.length]);

  const handleLoadMoreMailIssues = useCallback(() => {
    if (isLoadingMore || displayedMailIssuesCount >= mailIssues.length) return;
    setIsLoadingMore(true);
    setDisplayedMailIssuesCount((c) => c + 5);
    setTimeout(() => setIsLoadingMore(false), 300);
  }, [isLoadingMore, displayedMailIssuesCount, mailIssues.length]);

  // Fetch data when username changes
  useEffect(() => {
    if (!username) return;

    const fetchData = async () => {
      setLoading(true);
      setCoursesLoading(true);
      setLessonsLoading(true);
      setQuizzesLoading(true);
      setMailIssuesLoading(true);
      setIsLoadingMore(false);
      setError("");

      setProfile(null);
      setCourses([]);
      setLessons([]);
      setQuizzes([]);
      setMailIssues([]);
      setAttendances(0);
      setGuideRequest(null);

      setActiveTab("courses");
      setDisplayedCoursesCount(INITIAL_DISPLAY_DEFAULT_TAB);
      setDisplayedLessonsCount(SUBSEQUENT_LOAD_BATCH_SIZE.lessons);
      setDisplayedQuizzesCount(SUBSEQUENT_LOAD_BATCH_SIZE.quizzes);
      setDisplayedMailIssuesCount(5);

      try {
        const profileRes = await apiClient.get(`/users/guides/${username}/`);
        const fetchedProfileData = profileRes.data.profile || profileRes.data;
        const fetchedSeoData = profileRes.data.seo || null;

        if (!fetchedProfileData?.id)
          throw new Error("Guide profile not found.");
        setProfile(fetchedProfileData);
        setSeoData(fetchedSeoData);
        const profileUserId = fetchedProfileData.id;

        const promises = [
          apiClient.get(`/courses/?created_by=${username}`),
          apiClient.get(`/lessons/?created_by=${username}`),
          apiClient.get(`/quizzes/?created_by=${username}`),
          token && currentUser
            ? apiClient.get(`/social/guide-requests/`)
            : Promise.resolve({ data: null }),
          token
            ? apiClient.get(`/mailmagazine/issues/by-teacher/${username}/`)
            : Promise.resolve({ data: [] }),
        ];

        const [
          coursesRes,
          lessonsRes,
          quizzesRes,
          guideRequestsRes,
          mailIssuesRes,
        ] = await Promise.all(promises);

        try {
          setCourses(Array.isArray(coursesRes?.data) ? coursesRes.data : []);
        } finally {
          setCoursesLoading(false);
        }

        try {
          setLessons(Array.isArray(lessonsRes?.data) ? lessonsRes.data : []);
        } finally {
          setLessonsLoading(false);
        }

        try {
          setQuizzes(Array.isArray(quizzesRes?.data) ? quizzesRes.data : []);
        } finally {
          setQuizzesLoading(false);
        }

        try {
          setMailIssues(
            Array.isArray(mailIssuesRes?.data) ? mailIssuesRes.data : []
          );
        } finally {
          setMailIssuesLoading(false);
        }

        try {
          const allUserRequests = Array.isArray(guideRequestsRes?.data)
            ? guideRequestsRes.data
            : [];
          const acceptedCount = allUserRequests.filter(
            (req) =>
              String(req.guide) === String(profileUserId) &&
              req.status === "accepted"
          ).length;
          setAttendances(acceptedCount);

          if (currentUser && token && currentUser.user_id !== profileUserId) {
            const specificRequest = allUserRequests.find(
              (req) =>
                String(req.explorer) === String(currentUser.user_id) &&
                String(req.guide) === String(profileUserId)
            );
            setGuideRequest(specificRequest || null);
          } else {
            setGuideRequest(null);
          }
        } catch {
          setAttendances(0);
          setGuideRequest(null);
        }
      } catch (err) {
        const apiErrorMessage =
          err?.response?.data?.detail ||
          err?.response?.data?.error ||
          err?.message;
        const isProfileError = err?.config?.url?.includes(
          `/users/guides/${username}`
        );
        const displayError =
          isProfileError && err?.response?.status === 404
            ? "Guide profile not found."
            : `Failed to load profile data: ${
                apiErrorMessage || "Please try again."
              }`;
        setError(displayError);

        if (err?.response?.status === 401 || err?.response?.status === 403) {
          logout && logout();
        }

        setProfile(null);
        setCourses([]);
        setLessons([]);
        setQuizzes([]);
        setAttendances(0);
        setGuideRequest(null);
        setCoursesLoading(false);
        setLessonsLoading(false);
        setQuizzesLoading(false);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [username, currentUser, token, logout]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
          document.body.offsetHeight - 200 &&
        !isLoadingMore
      ) {
        if (
          activeTab === "courses" &&
          !coursesLoading &&
          displayedCoursesCount < courses.length
        ) {
          handleLoadMoreCourses();
        } else if (
          activeTab === "lessons" &&
          !lessonsLoading &&
          displayedLessonsCount < lessons.length
        ) {
          handleLoadMoreLessons();
        } else if (
          activeTab === "quizzes" &&
          !quizzesLoading &&
          displayedQuizzesCount < quizzes.length
        ) {
          handleLoadMoreQuizzes();
        }
      }
    };
    const throttled = throttle(handleScroll, 200);
    window.addEventListener("scroll", throttled);
    return () => window.removeEventListener("scroll", throttled);
  }, [
    activeTab,
    coursesLoading,
    lessonsLoading,
    quizzesLoading,
    displayedCoursesCount,
    displayedLessonsCount,
    displayedQuizzesCount,
    courses.length,
    lessons.length,
    quizzes.length,
    handleLoadMoreCourses,
    handleLoadMoreLessons,
    handleLoadMoreQuizzes,
    isLoadingMore,
  ]);

  const handleAttend = async () => {
    if (!profile?.id || !token) {
      alert("Cannot send request: Profile ID missing or not logged in.");
      return;
    }
    setAttendLoading(true);
    setError("");
    try {
      const response = await apiClient.post(`/social/guide-requests/`, {
        guide: profile.id,
      });
      if (response.data && response.data.id) {
        setGuideRequest(response.data);
        alert("Attend request sent.");
      } else {
        alert("Request sent, but status update failed. Please refresh.");
      }
    } catch (err) {
      const apiErrorMessage =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message;
      setError(
        `Failed to send request: ${apiErrorMessage || "Please try again."}`
      );
      if (err?.response?.status === 401 || err?.response?.status === 403)
        logout && logout();
    } finally {
      setAttendLoading(false);
    }
  };

  const cancelAttend = async () => {
    if (!guideRequest?.id || !token) {
      alert("Cannot cancel request: Request ID missing or not logged in.");
      return;
    }
    setAttendLoading(true);
    setError("");
    try {
      await apiClient.post(`/social/guide-requests/${guideRequest.id}/cancel/`);
      setGuideRequest(null);
      alert("Request cancelled.");
    } catch (err) {
      const apiErrorMessage =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message;
      setError(
        `Failed to cancel request: ${apiErrorMessage || "Please try again."}`
      );
      if (err?.response?.status === 401 || err?.response?.status === 403)
        logout && logout();
    } finally {
      setAttendLoading(false);
    }
  };

  const itemsToDisplay = {
    courses: courses.slice(0, displayedCoursesCount),
    lessons: lessons.slice(0, displayedLessonsCount),
    quizzes: quizzes.slice(0, displayedQuizzesCount),
    mailIssues: mailIssues.slice(0, displayedMailIssuesCount),
  };

  if ((loading && !profile) || !username)
    return <p className={styles.loading}>Loading profile...</p>;
  if (error) return <p className={styles.error}>{error}</p>;
  if (!profile) return <p className={styles.loading}>No profile found.</p>;

  let attendButton;
  if (guideRequest) {
    if (guideRequest.status === "pending") {
      attendButton = (
        <button
          onClick={cancelAttend}
          disabled={attendLoading}
          className={styles.btnSecondary}
        >
          Pending (Cancel Request)
        </button>
      );
    } else if (guideRequest.status === "accepted") {
      attendButton = (
        <button
          onClick={cancelAttend}
          disabled={attendLoading}
          className={styles.btnSecondary}
        >
          Attended (Unattend)
        </button>
      );
    } else {
      attendButton = (
        <button
          onClick={cancelAttend}
          disabled={attendLoading}
          className={styles.btnSecondary}
        >
          Cancel Request
        </button>
      );
    }
  } else {
    attendButton = (
      <button
        onClick={handleAttend}
        disabled={attendLoading}
        className={styles.btnPrimary}
      >
        Attend Guide
      </button>
    );
  }

  const renderTabContent = () => {
    if (activeTab === "courses") {
      return (
        <div className={styles.tabPanel}>
          <h2>Courses Created</h2>
          {coursesLoading && itemsToDisplay.courses.length === 0 ? (
            <p className={styles.loading}>Loading courses...</p>
          ) : courses.length > 0 ? (
            <>
              <div className={styles.cardsGrid}>
                {itemsToDisplay.courses.map(
                  (course) =>
                    course && (
                      <div key={course.id} className={styles.card}>
                        {course.cover_image ? (
                          <img
                            src={course.cover_image}
                            alt={`${course.title || "Course"} cover`}
                            className={styles.cardImage}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src =
                                "https://placehold.co/600x400/eee/ccc?text=No+Image";
                            }}
                          />
                        ) : (
                          <div className={styles.gridItemPlaceholder}>
                            <p>No Image</p>
                          </div>
                        )}
                        <div className={styles.cardInfo}>
                          <h3>{course.title || "Untitled Course"}</h3>
                          <p>
                            {course.description
                              ? stripHTML(course.description).substring(
                                  0,
                                  100
                                ) + "..."
                              : "No description available."}
                          </p>
                          {course.permalink ? (
                            <Link
                              href={`/courses/${course.permalink}`}
                              className={styles.detailsBtn}
                            >
                              View Details
                            </Link>
                          ) : (
                            <button className={styles.detailsBtn} disabled>
                              View Details
                            </button>
                          )}
                        </div>
                      </div>
                    )
                )}
              </div>
              {isLoadingMore && displayedCoursesCount < courses.length && (
                <p className={styles.loading}>Loading</p>
              )}
            </>
          ) : (
            <p>No courses created by this guide yet.</p>
          )}
        </div>
      );
    } else if (activeTab === "lessons") {
      return (
        <div className={styles.tabPanel}>
          <h2>Lessons Created</h2>
          {lessonsLoading && itemsToDisplay.lessons.length === 0 ? (
            <p className={styles.loading}>Loading lessons...</p>
          ) : lessons.length > 0 ? (
            <>
              <ul className={styles.list}>
                {itemsToDisplay.lessons.map(
                  (lesson) =>
                    lesson && (
                      <li key={lesson.id} className={styles.listItem}>
                        <h3>{lesson.title || "Untitled Lesson"}</h3>
                        <p>
                          {lesson.content
                            ? stripHTML(lesson.content).substring(0, 150) +
                              "..."
                            : "No content preview."}
                        </p>
                        {lesson.permalink ? (
                          <Link
                            href={`/lessons/${lesson.permalink}`}
                            className={styles.detailsBtn}
                          >
                            View Details
                          </Link>
                        ) : (
                          <button className={styles.detailsBtn} disabled>
                            View Details
                          </button>
                        )}
                      </li>
                    )
                )}
              </ul>
              {isLoadingMore && displayedLessonsCount < lessons.length && (
                <p className={styles.loading}>Loading</p>
              )}
            </>
          ) : (
            <p>No lessons created by this guide yet.</p>
          )}
        </div>
      );
    } else if (activeTab === "quizzes") {
      return (
        <div className={styles.tabPanel}>
          <h2>Quizzes Created</h2>
          {quizzesLoading && itemsToDisplay.quizzes.length === 0 ? (
            <p className={styles.loading}>Loading quizzes...</p>
          ) : quizzes.length > 0 ? (
            <>
              <ul className={styles.list}>
                {itemsToDisplay.quizzes.map(
                  (quiz) =>
                    quiz && (
                      <li key={quiz.id} className={styles.listItem}>
                        <h3>{quiz.title || "Untitled Quiz"}</h3>
                        <p>
                          {quiz.question
                            ? stripHTML(quiz.question).substring(0, 150) + "..."
                            : "No question preview."}
                        </p>
                        <Link
                          href={quizPermalinkToUrl(quiz.permalink)}
                          className={styles.detailsBtn}
                        >
                          View Details
                        </Link>
                      </li>
                    )
                )}
              </ul>
              {isLoadingMore && displayedQuizzesCount < quizzes.length && (
                <p className={styles.loading}>Loading</p>
              )}
            </>
          ) : (
            <p>No quizzes created by this guide yet.</p>
          )}
        </div>
      );
    } else if (activeTab === "mailMagazines") {
      return (
        <div className={styles.tabPanel}>
          <h2>Mail Magazine Issues</h2>
          {mailIssuesLoading && itemsToDisplay.mailIssues.length === 0 ? (
            <p className={styles.loading}>Loading mail magazines...</p>
          ) : mailIssues.length > 0 ? (
            <>
              <ul className={styles.list}>
                {itemsToDisplay.mailIssues.map(
                  (issue) =>
                    issue && (
                      <li key={issue.id} className={styles.listItem}>
                        <h3>
                          {issue.title || issue.subject || "Untitled Issue"}
                        </h3>
                        <p className={styles.issueDate}>
                          Sent on{" "}
                          {new Date(issue.sent_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                        <Link
                          href={`/mail-magazines/${issue.id}`}
                          className={styles.detailsBtn}
                        >
                          View Issue
                        </Link>
                      </li>
                    )
                )}
              </ul>
              {isLoadingMore &&
                displayedMailIssuesCount < mailIssues.length && (
                  <p className={styles.loading}>Loading</p>
                )}
            </>
          ) : (
            <p>No mail magazine issues available.</p>
          )}
        </div>
      );
    }
    return null;
  };

  // Determine if user is a teacher/guide
  const isTeacher =
    profile && (profile.role === "guide" || profile.role === "both");

  return (
    <>
      <Head>
        {(() => {
          const siteUrl = (
            process.env.NEXT_PUBLIC_SITE_URL || "https://zportaacademy.com"
          )
            .replace(/\/$/, "")
            .replace("www.", "");
          const canon = seoData?.canonical_url ||
            (username ? `${siteUrl}/guide/${username}` : siteUrl);
          const ogUrl = canon;
          return (
            <>
              <title>
                {seoData?.title ||
                  `${profile?.display_name || profile?.username} - ${
                    profile?.teaching_specialties ||
                    (isTeacher ? "Teacher" : "Student")
                  } | Zporta Academy`}
              </title>
              <meta
                name="description"
                content={
                  seoData?.description ||
                  profile?.teacher_about ||
                  profile?.bio ||
                  `${
                    profile?.display_name || profile?.username
                  }'s profile on Zporta Academy`
                }
              />
              <link rel="canonical" href={canon} />
              {seoData?.robots && (
                <meta name="robots" content={seoData.robots} />
              )}
              <meta
                name="keywords"
                content={`${profile?.display_name || profile?.username}, ${
                  isTeacher
                    ? profile?.teaching_specialties || "teacher"
                    : "student"
                }, online learning, education, Zporta Academy`}
              />
              <meta property="og:type" content="profile" />
              <meta
                property="og:title"
                content={
                  seoData?.og_title ||
                  seoData?.title ||
                  `${profile?.display_name || profile?.username}`
                }
              />
              <meta
                property="og:description"
                content={
                  seoData?.og_description ||
                  seoData?.description ||
                  profile?.teacher_about ||
                  profile?.bio
                }
              />
              <meta property="og:url" content={ogUrl} />
              {(seoData?.og_image || profile?.profile_image_url) && (
                <meta
                  property="og:image"
                  content={seoData?.og_image || profile?.profile_image_url}
                />
              )}
              <meta property="og:site_name" content="Zporta Academy" />
            </>
          );
        })()}

        {!seoData?.json_ld && profile && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Person",
                name: profile.display_name || profile.username,
                url: (function () {
                  const siteUrl = (
                    process.env.NEXT_PUBLIC_SITE_URL || "https://zportaacademy.com"
                  )
                    .replace(/\/$/, "")
                    .replace("www.", "");
                  return seoData?.canonical_url ||
                    (username ? `${siteUrl}/guide/${username}` : siteUrl);
                })(),
                image: profile.profile_image_url,
                description: isTeacher
                  ? profile.teacher_about || ""
                  : profile.bio || "",
                jobTitle: isTeacher
                  ? profile.teaching_specialties || "Teacher"
                  : "Student",
                worksFor: {
                  "@type": "EducationalOrganization",
                  name: "Zporta Academy",
                },
                sameAs: [
                  profile.website_url,
                  profile.linkedin_url,
                  profile.twitter_url,
                ].filter(Boolean),
              }),
            }}
          />
        )}

        {seoData?.json_ld && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(seoData.json_ld),
            }}
          />
        )}
      </Head>

      <div className={styles.publicProfileDashboard}>
        {/* Hero Banner */}
        <div className={styles.heroBanner}>
          <div className={styles.heroContent}>
            <img
              src={
                profile.profile_image_url ||
                "https://placehold.co/180x180/3b82f6/ffffff?text=User"
              }
              alt={profile.display_name || profile.username}
              className={styles.heroAvatar}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src =
                  "https://placehold.co/180x180/3b82f6/ffffff?text=User";
              }}
            />

            <div className={styles.heroInfo}>
              <h1>{profile.display_name || profile.username}</h1>

              <div className={styles.heroRole}>
                {isTeacher ? <FaChalkboardTeacher /> : <FaBookReader />}
                {isTeacher
                  ? profile.teaching_specialties || "Teacher"
                  : "Student"}
              </div>

              {((isTeacher && profile.teacher_about) ||
                (!isTeacher && profile.bio)) && (
                <div className={styles.heroBioSection}>
                  {(() => {
                    const bioText = isTeacher
                      ? profile.teacher_about
                      : profile.bio;
                    const isTruncated = bioText.length > 200;
                    const displayText = isTruncated
                      ? bioText.substring(0, 200) + "..."
                      : bioText;

                    return (
                      <>
                        <BioRenderer
                          bio={displayText}
                          sectionClass={styles.bioRendererSection}
                          contentClass={styles.heroBio}
                        />
                        {isTruncated && (
                          <button
                            onClick={() => setShowBioModal(true)}
                            className={styles.readMoreBtn}
                          >
                            Read Full Bio →
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              <div className={styles.heroStats}>
                <div className={styles.heroStat}>
                  <span className="value">{profile.growth_score || 0}</span>
                  <span className="label">Learning Score</span>
                </div>
                <div className={styles.heroStat}>
                  <span className="value">{profile.impact_score || 0}</span>
                  <span className="label">Impact Score</span>
                </div>
                <div className={styles.heroStat}>
                  <span className="value">{attendances}</span>
                  <span className="label">Attendees</span>
                </div>
              </div>

              {(profile.website_url ||
                profile.linkedin_url ||
                profile.twitter_url) && (
                <div className={styles.socialLinks}>
                  {profile.website_url && (
                    <a
                      href={profile.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.socialLink}
                    >
                      <FaGlobe />
                    </a>
                  )}
                  {profile.linkedin_url && (
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.socialLink}
                    >
                      <FaLinkedin />
                    </a>
                  )}
                  {profile.twitter_url && (
                    <a
                      href={profile.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.socialLink}
                    >
                      <FaTwitter />
                    </a>
                  )}
                </div>
              )}

              {/* TEMPORARY: Hide "Attend as Guide" button when viewing student profiles.
                  In the future, this will be enabled for student-to-student guide relationships.
                  Currently hidden when viewing a profile where profile.role === 'explorer' (pure student).
                  Anyone can follow teachers, but no one can follow students (for now). */}
              {(() => {
                console.log("🔍 Attend Button Debug:", {
                  hasCurrentUser: !!currentUser,
                  currentUsername: currentUser?.username,
                  profileUsername: profile?.username,
                  profileRole: profile?.role,
                  shouldShow:
                    currentUser &&
                    currentUser.username !== profile.username &&
                    profile.role !== "explorer",
                });
                return (
                  currentUser &&
                  currentUser.username !== profile.username &&
                  profile.role !== "explorer" && (
                    <div className={styles.attendSection}>{attendButton}</div>
                  )
                );
              })()}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={styles.mainContent}>
          {/* Showcase Gallery for Teachers */}
          {isTeacher &&
            (profile.showcase_image_1_url ||
              profile.showcase_image_2_url ||
              profile.showcase_image_3_url) && (
              <div className={styles.showcaseSection}>
                <h2 className={styles.showcaseTitle}>
                  <span>🖼️</span> Portfolio Gallery
                </h2>
                <div className={styles.showcaseGrid}>
                  {profile.showcase_image_1_url && (
                    <div className={styles.showcaseItem}>
                      <div
                        className={styles.showcaseHexagon}
                        onClick={() =>
                          setSelectedImage(profile.showcase_image_1_url)
                        }
                      >
                        <div className={styles.hexagonInner}>
                          <img
                            src={profile.showcase_image_1_url}
                            alt="Showcase 1"
                          />
                        </div>
                      </div>
                      {(profile.showcase_image_1_caption ||
                        profile.showcase_image_1_tags_detail?.length > 0) && (
                        <div className={styles.showcaseMeta}>
                          {profile.showcase_image_1_caption && (
                            <p className={styles.showcaseCaption}>
                              {profile.showcase_image_1_caption}
                            </p>
                          )}
                          {profile.showcase_image_1_tags_detail?.length > 0 && (
                            <div className={styles.showcaseTags}>
                              {profile.showcase_image_1_tags_detail.map(
                                (tag) => (
                                  <span
                                    key={tag.id}
                                    className={styles.showcaseTag}
                                  >
                                    #{tag.name}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {profile.showcase_image_2_url && (
                    <div className={styles.showcaseItem}>
                      <div
                        className={styles.showcaseHexagon}
                        onClick={() =>
                          setSelectedImage(profile.showcase_image_2_url)
                        }
                      >
                        <div className={styles.hexagonInner}>
                          <img
                            src={profile.showcase_image_2_url}
                            alt="Showcase 2"
                          />
                        </div>
                      </div>
                      {(profile.showcase_image_2_caption ||
                        profile.showcase_image_2_tags_detail?.length > 0) && (
                        <div className={styles.showcaseMeta}>
                          {profile.showcase_image_2_caption && (
                            <p className={styles.showcaseCaption}>
                              {profile.showcase_image_2_caption}
                            </p>
                          )}
                          {profile.showcase_image_2_tags_detail?.length > 0 && (
                            <div className={styles.showcaseTags}>
                              {profile.showcase_image_2_tags_detail.map(
                                (tag) => (
                                  <span
                                    key={tag.id}
                                    className={styles.showcaseTag}
                                  >
                                    #{tag.name}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {profile.showcase_image_3_url && (
                    <div className={styles.showcaseItem}>
                      <div
                        className={styles.showcaseHexagon}
                        onClick={() =>
                          setSelectedImage(profile.showcase_image_3_url)
                        }
                      >
                        <div className={styles.hexagonInner}>
                          <img
                            src={profile.showcase_image_3_url}
                            alt="Showcase 3"
                          />
                        </div>
                      </div>
                      {(profile.showcase_image_3_caption ||
                        profile.showcase_image_3_tags_detail?.length > 0) && (
                        <div className={styles.showcaseMeta}>
                          {profile.showcase_image_3_caption && (
                            <p className={styles.showcaseCaption}>
                              {profile.showcase_image_3_caption}
                            </p>
                          )}
                          {profile.showcase_image_3_tags_detail?.length > 0 && (
                            <div className={styles.showcaseTags}>
                              {profile.showcase_image_3_tags_detail.map(
                                (tag) => (
                                  <span
                                    key={tag.id}
                                    className={styles.showcaseTag}
                                  >
                                    #{tag.name}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Stats Grid - Clickable Cards */}
          <div className={styles.statsGrid}>
            <div
              className={`${styles.statCard} ${
                activeTab === "courses" ? styles.active : ""
              }`}
              onClick={() => setActiveTab("courses")}
            >
              <div className="icon">📚</div>
              <span className="value">{courses.length}</span>
              <span className="label">Courses</span>
            </div>

            <div
              className={`${styles.statCard} ${
                activeTab === "lessons" ? styles.active : ""
              }`}
              onClick={() => setActiveTab("lessons")}
            >
              <div className="icon">📖</div>
              <span className="value">{lessons.length}</span>
              <span className="label">Lessons</span>
            </div>

            <div
              className={`${styles.statCard} ${
                activeTab === "quizzes" ? styles.active : ""
              }`}
              onClick={() => setActiveTab("quizzes")}
            >
              <div className="icon">❓</div>
              <span className="value">{quizzes.length}</span>
              <span className="label">Quizzes</span>
            </div>

            {isTeacher && (
              <div
                className={`${styles.statCard} ${
                  activeTab === "mailMagazines" ? styles.active : ""
                }`}
                onClick={() => setActiveTab("mailMagazines")}
              >
                <div className="icon">📧</div>
                <span className="value">{mailIssues.length}</span>
                <span className="label">Magazines</span>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className={styles.contentSection}>
            <div className={styles.contentHeader}>
              <h2>
                <span className="icon">
                  {activeTab === "courses" && "📚"}
                  {activeTab === "lessons" && "📖"}
                  {activeTab === "quizzes" && "❓"}
                  {activeTab === "mailMagazines" && "📧"}
                </span>
                {activeTab === "courses" &&
                  `${isTeacher ? "Created" : "Enrolled"} Courses`}
                {activeTab === "lessons" &&
                  `${isTeacher ? "Created" : "Studied"} Lessons`}
                {activeTab === "quizzes" &&
                  `${isTeacher ? "Created" : "Completed"} Quizzes`}
                {activeTab === "mailMagazines" && "Mail Magazine Issues"}
              </h2>
            </div>

            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Bio Modal */}
      {showBioModal && (
        <div className={styles.modal} onClick={() => setShowBioModal(false)}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.modalClose}
              onClick={() => setShowBioModal(false)}
            >
              ✕
            </button>
            <div className={styles.modalHeader}>
              <img
                src={
                  profile.profile_image_url ||
                  "https://placehold.co/100x100/3b82f6/ffffff?text=User"
                }
                alt={profile.display_name || profile.username}
                className={styles.modalAvatar}
              />
              <div>
                <h2>{profile.display_name || profile.username}</h2>
                <p className={styles.modalRole}>
                  {isTeacher ? <FaChalkboardTeacher /> : <FaBookReader />}
                  {isTeacher
                    ? profile.teaching_specialties || "Teacher"
                    : "Student"}
                </p>
              </div>
            </div>
            <div className={styles.modalBody}>
              <h3>About</h3>
              <BioRenderer
                bio={isTeacher ? profile.teacher_about : profile.bio}
                sectionClass={styles.bioModalSection}
                contentClass={styles.bioModalContent}
              />

              {(profile.website_url ||
                profile.linkedin_url ||
                profile.twitter_url) && (
                <>
                  <h3>Connect</h3>
                  <div className={styles.modalSocialLinks}>
                    {profile.website_url && (
                      <a
                        href={profile.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaGlobe /> Website
                      </a>
                    )}
                    {profile.linkedin_url && (
                      <a
                        href={profile.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaLinkedin /> LinkedIn
                      </a>
                    )}
                    {profile.twitter_url && (
                      <a
                        href={profile.twitter_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaTwitter /> Twitter/X
                      </a>
                    )}
                  </div>
                </>
              )}

              <div className={styles.modalStats}>
                <div className={styles.modalStatItem}>
                  <span className="value">{profile.growth_score || 0}</span>
                  <span className="label">Learning Score</span>
                </div>
                <div className={styles.modalStatItem}>
                  <span className="value">{profile.impact_score || 0}</span>
                  <span className="label">Impact Score</span>
                </div>
                <div className={styles.modalStatItem}>
                  <span className="value">{attendances}</span>
                  <span className="label">Attendees</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div className={styles.lightbox} onClick={() => setSelectedImage(null)}>
          <button
            className={styles.lightboxClose}
            onClick={() => setSelectedImage(null)}
          >
            ✕
          </button>
          <img
            src={selectedImage}
            alt="Showcase"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

import React, { useEffect, useState, useContext, useCallback } from "react";
import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";
import { useRouter } from "next/router";
import styles from "@/styles/Analytics.module.css";
import {
  Award,
  Activity,
  Brain,
  HelpCircle,
  BookOpenCheck,
  BarChartHorizontalBig,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  RadialBarChart,
  RadialBar,
} from "recharts";

const AnalyticsAndStatistics = () => {
  const { token, logout, user } = useContext(AuthContext);
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [history, setHistory] = useState({ results: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorHistory, setErrorHistory] = useState("");
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [heartbeatError, setHeartbeatError] = useState(null);

  // Learning score state
  const [learningScore, setLearningScore] = useState(null);
  const [loadingLearningScore, setLoadingLearningScore] = useState(false);
  const [showLearningScoreModal, setShowLearningScoreModal] = useState(false);
  // Pagination for learning score modal sections
  const [quizVisibleCount, setQuizVisibleCount] = useState(5);
  const [lessonVisibleCount, setLessonVisibleCount] = useState(5);
  const [courseVisibleCount, setCourseVisibleCount] = useState(5);

  // Impact score state
  const [impactScore, setImpactScore] = useState(null);
  const [loadingImpactScore, setLoadingImpactScore] = useState(false);
  const [showImpactScoreModal, setShowImpactScoreModal] = useState(false);
  // Pagination for impact score modal sections
  const [enrollmentVisibleCount, setEnrollmentVisibleCount] = useState(5);
  const [quizAttemptVisibleCount, setQuizAttemptVisibleCount] = useState(5);

  // Legacy analytics modal internal tabs (kept for modal only)
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState("learning"); // 'learning' | 'impact'
  // Simplified main page tabs: overview / teaching / learning
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'teaching' | 'learning'
  // Persistent filter bar
  const [filterDateRange, setFilterDateRange] = useState("30d"); // '7d' | '30d' | '90d' | 'all'
  const [filterContentType, setFilterContentType] = useState("all"); // 'all' | 'posts' | 'quizzes' | 'lessons' | 'courses'
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterLanguage, setFilterLanguage] = useState("all");
  const [learningAnalytics, setLearningAnalytics] = useState(null);
  const [impactAnalytics, setImpactAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  // Sorting/Filtering for tables
  const [studentEnrollSort, setStudentEnrollSort] = useState("newest");
  const [studentEnrollFilter, setStudentEnrollFilter] = useState("all"); // all | free | premium
  const [teacherEnrollSort, setTeacherEnrollSort] = useState("newest");
  const [teacherEnrollFilter, setTeacherEnrollFilter] = useState("all"); // all | free | premium

  // Score detail modal state
  const [showScoreDetail, setShowScoreDetail] = useState(false);
  const [scoreDetailRole, setScoreDetailRole] = useState(null); // 'student' or 'teacher'
  const [scoreDetailData, setScoreDetailData] = useState({
    results: [],
    count: 0,
    next: null,
    previous: null,
  });
  const [scoreDetailLoading, setScoreDetailLoading] = useState(false);
  const [scoreDetailError, setScoreDetailError] = useState("");
  const [scoreDetailSearch, setScoreDetailSearch] = useState("");
  const [scoreDetailPage, setScoreDetailPage] = useState(1);
  const [scoreDetailStartDate, setScoreDetailStartDate] = useState("");
  const [scoreDetailEndDate, setScoreDetailEndDate] = useState("");

  useEffect(() => {
    let mounted = true;
    const fetchOverview = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get("/users/progress/overview/", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (mounted) setData(res.data);
      } catch (e) {
        if (mounted) setError(e?.message || "Failed to load activity overview");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await apiClient.get(
          "/users/progress/history/?page_size=10",
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (mounted) setHistory(res.data);
      } catch (e) {
        if (mounted)
          setErrorHistory(e?.message || "Failed to load activity history");
      } finally {
        if (mounted) setLoadingHistory(false);
      }
    };
    const fetchLearningScore = async () => {
      setLoadingLearningScore(true);
      try {
        const res = await apiClient.get("/users/api/learning-score/", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (mounted) setLearningScore(res.data);
      } catch (e) {
        console.error("Failed to load learning score:", e);
      } finally {
        if (mounted) setLoadingLearningScore(false);
      }
    };
    const fetchImpactScore = async () => {
      setLoadingImpactScore(true);
      try {
        const res = await apiClient.get("/users/api/impact-score/", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (mounted) setImpactScore(res.data);
      } catch (e) {
        console.error("Failed to load impact score:", e);
      } finally {
        if (mounted) setLoadingImpactScore(false);
      }
    };
    const fetchAnalytics = async () => {
      setLoadingAnalytics(true);
      try {
        const [learningRes, impactRes] = await Promise.all([
          apiClient.get("/users/api/learning-analytics/", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
          apiClient.get("/users/api/impact-analytics/", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
        ]);
        if (mounted) {
          setLearningAnalytics(learningRes.data);
          setImpactAnalytics(impactRes.data);
        }
      } catch (e) {
        console.error("Failed to load analytics:", e);
      } finally {
        if (mounted) setLoadingAnalytics(false);
      }
    };
    if (token) {
      fetchOverview();
      fetchHistory();
      fetchLearningScore();
      fetchImpactScore();
      fetchAnalytics();
    }
    return () => {
      mounted = false;
    };
  }, [token]);

  // Heartbeat interval to keep session activity fresh (every 4 minutes)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const sendHeartbeat = async () => {
      try {
        const res = await apiClient.post(
          "/users/session/heartbeat/",
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!cancelled && res.data?.last_heartbeat_at) {
          setLastHeartbeat(res.data.last_heartbeat_at);
          setHeartbeatError(null);
        }
      } catch (e) {
        if (!cancelled) setHeartbeatError(e?.message || "heartbeat failed");
      }
    };
    // Send an immediate heartbeat to populate status quickly
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 240000); // 4 minutes
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  const formattedLastHeartbeat = lastHeartbeat
    ? new Date(lastHeartbeat).toLocaleTimeString()
    : null;

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  // Fetch score detail breakdown with filters
  const fetchScoreDetail = useCallback(
    async (role, page = 1, search = "") => {
      setScoreDetailLoading(true);
      setScoreDetailError("");
      try {
        const params = new URLSearchParams({
          role,
          page_size: "20",
          page: page.toString(),
        });
        if (search.trim()) params.append("search", search.trim());
        if (scoreDetailStartDate)
          params.append("start_date", scoreDetailStartDate);
        if (scoreDetailEndDate) params.append("end_date", scoreDetailEndDate);
        const res = await apiClient.get(
          `/users/progress/history/?${params.toString()}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        setScoreDetailData(res.data);
      } catch (e) {
        setScoreDetailError(e?.message || "Failed to load score details");
      } finally {
        setScoreDetailLoading(false);
      }
    },
    [token, scoreDetailStartDate, scoreDetailEndDate]
  );

  const openScoreDetail = useCallback((role) => {
    setScoreDetailRole(role);
    setScoreDetailPage(1);
    setScoreDetailSearch("");
    setScoreDetailStartDate("");
    setScoreDetailEndDate("");
    setShowScoreDetail(true);
    // Don't fetch - use data from overview
  }, []);

  const handleScoreDetailSearch = useCallback(
    (e) => {
      e.preventDefault();
      setScoreDetailPage(1);
      fetchScoreDetail(scoreDetailRole, 1, scoreDetailSearch);
    },
    [scoreDetailRole, scoreDetailSearch, fetchScoreDetail]
  );

  const handleScoreDetailPageChange = useCallback(
    (newPage) => {
      setScoreDetailPage(newPage);
      fetchScoreDetail(scoreDetailRole, newPage, scoreDetailSearch);
    },
    [scoreDetailRole, scoreDetailSearch, fetchScoreDetail]
  );

  const chartSeries =
    data?.daily_points_last_30d_student ||
    data?.daily_points_last_30d_teacher ||
    [];
  const breakdown =
    data?.breakdown_by_activity_type_student ||
    data?.breakdown_by_activity_type_teacher ||
    {};
  const pieData = Object.entries(breakdown)
    .map(([k, v]) => ({
      name: k.replace(/_/g, " ").toLowerCase(),
      value: v.points || 0,
    }))
    .filter((d) => d.value > 0);
  const COLORS = [
    "#667eea",
    "#764ba2",
    "#ffb347",
    "#48bb78",
    "#f56565",
    "#ed8936",
    "#805ad5",
  ];
  const loginSeries = data?.login_daily_minutes || [];
  const loginGaugePercent = data?.login_goal_progress_percent ?? 0;
  const gaugeData = [{ name: "progress", value: loginGaugePercent }];

  // Visibility: show teaching features to guides/teachers or admins, hide for pure students
  const canSeeTeaching = !!(
    user && (
      user.role === "guide" ||
      user.role === "both" ||
      user.is_staff ||
      user.is_superuser ||
      user.is_admin
    )
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Analytics Dashboard</h1>
          <p className={styles.subtitle}>
            Two families of insights: Teaching Insights (for creators) and
            Learning Insights (for learners).
          </p>
          {token && (
            <div className={styles.sessionStatus}>
              <span className={styles.sessionDot} />
              <span className={styles.sessionText}>
                Active session
                {formattedLastHeartbeat
                  ? ` • last ping ${formattedLastHeartbeat}`
                  : ""}
              </span>
              <button onClick={handleLogout} className={styles.logoutBtn}>
                Logout
              </button>
              {heartbeatError && (
                <em className={styles.hbError}>Heartbeat issue</em>
              )}
            </div>
          )}
        </div>
        <button className={styles.helpBtn} onClick={() => setShowHelp(true)}>
          <HelpCircle size={18} /> Learn the scores
        </button>
      </header>

      {/* Simplified Primary Tabs */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tabBtn} ${
            activeTab === "overview" ? styles.tabBtnActive : ""
          }`}
          onClick={() => setActiveTab("overview")}
        >
          📊 Overview
        </button>
        {/* Show Teaching tab for teachers/guides or admins regardless of impact score */}
        {canSeeTeaching && (
          <button
            className={`${styles.tabBtn} ${
              activeTab === "teaching" ? styles.tabBtnActive : ""
            }`}
            onClick={() => setActiveTab("teaching")}
          >
            <Activity size={16} /> Teaching
          </button>
        )}
        <button
          className={`${styles.tabBtn} ${
            activeTab === "learning" ? styles.tabBtnActive : ""
          }`}
          onClick={() => setActiveTab("learning")}
        >
          <Brain size={16} /> Learning
        </button>
      </div>

      {/* Persistent Filter Bar applying globally */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Date Range</label>
          <select
            className={styles.filterSelect}
            value={filterDateRange}
            onChange={(e) => setFilterDateRange(e.target.value)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Content Type</label>
          <select
            className={styles.filterSelect}
            value={filterContentType}
            onChange={(e) => setFilterContentType(e.target.value)}
          >
            <option value="all">All</option>
            <option value="posts">Posts</option>
            <option value="quizzes">Quizzes</option>
            <option value="lessons">Lessons</option>
            <option value="courses">Courses</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Subject</label>
          <select
            className={styles.filterSelect}
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
          >
            <option value="all">All</option>
            <option value="math">Math</option>
            <option value="science">Science</option>
            <option value="language">Language</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Language</label>
          <select
            className={styles.filterSelect}
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
          >
            <option value="all">All</option>
            <option value="en">English</option>
            <option value="ja">Japanese</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className={styles.loadingWrap}>Loading your activity…</div>
      )}
      {error && !loading && <div className={styles.errorWrap}>{error}</div>}

      {data && (
        <>
          {/* OVERVIEW TAB CONTENT */}
          {activeTab === "overview" && (
            <>
              <section className={styles.panel}>
                <h2 className={styles.sectionTitle}>Activity Summary</h2>
                <div className={styles.cards}>
                  {/* Show Impact Score for teachers/guides or admins */}
                  {canSeeTeaching && (
                    <div
                      className={styles.card}
                      onClick={() => setShowImpactScoreModal(true)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className={styles.cardHeader}>
                        <Activity /> <h3>Impact Score</h3>
                      </div>
                      <div className={styles.bigValue}>
                        {impactScore?.total_score ?? data.impact_score ?? 0}
                      </div>
                      <div className={styles.metaRow}>Creator impact</div>
                      <div className={styles.clickHint}>Breakdown</div>
                    </div>
                  )}
                  {learningScore && (
                    <div
                      className={styles.card}
                      onClick={() => setShowLearningScoreModal(true)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className={styles.cardHeader}>
                        <Brain /> <h3>Learning Score</h3>
                      </div>
                      <div className={styles.bigValue}>
                        {learningScore?.total_score ?? 0}
                      </div>
                      <div className={styles.metaRow}>Progress earned</div>
                      <div className={styles.clickHint}>Breakdown</div>
                    </div>
                  )}
                  <div className={styles.kpi}>
                    <div className={styles.kpiItem}>
                      <BarChartHorizontalBig />{" "}
                      <span>{data.total_quizzes_answered ?? 0}</span>
                      <label>Quizzes</label>
                    </div>
                    <div className={styles.kpiItem}>
                      <BookOpenCheck />{" "}
                      <span>{data.total_lessons_completed ?? 0}</span>
                      <label>Lessons</label>
                    </div>
                    <div className={styles.kpiItem}>
                      <Award />{" "}
                      <span>
                        {data.total_courses_enrolled ??
                          data.total_courses_completed ??
                          0}
                      </span>
                      <label>Courses</label>
                    </div>
                  </div>
                </div>
                {(data.learning_streak_days || data.impact_streak_days) && (
                  <div className={styles.streaks}>
                    {data.learning_streak_days && (
                      <div className={styles.streak}>
                        <Brain size={16} /> Learning Streak:{" "}
                        <b>{data.learning_streak_days}d</b>
                      </div>
                    )}
                    {data.impact_streak_days && (
                      <div className={styles.streak}>
                        <Activity size={16} /> Impact Streak:{" "}
                        <b>{data.impact_streak_days}d</b>
                      </div>
                    )}
                  </div>
                )}
              </section>
              <section className={styles.grid2}>
                <div className={styles.panel}>
                  <h3 className={styles.panelTitle}>
                    Daily Points ({filterDateRange})
                  </h3>
                  {chartSeries.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={chartSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f36" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => {
                            const x = new Date(d);
                            return `${x.getMonth() + 1}/${x.getDate()}`;
                          }}
                        />
                        <YAxis />
                        <Tooltip
                          labelFormatter={(d) =>
                            new Date(d).toLocaleDateString()
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="points"
                          stroke="#667eea"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className={styles.empty}>No points yet</div>
                  )}
                </div>
                <div className={styles.panel}>
                  <h3 className={styles.panelTitle}>Points Distribution</h3>
                  {pieData.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={95}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [`${v} pts`, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className={styles.empty}>No data</div>
                  )}
                </div>
              </section>
              <section className={styles.panel}>
                <h3 className={styles.panelTitle}>Recent Actions</h3>
                {loadingHistory ? (
                  <div className={styles.loadingWrap}>Loading…</div>
                ) : history?.results?.length ? (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Role</th>
                        <th>Activity</th>
                        <th>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.results
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.created_at || 0) -
                            new Date(a.created_at || 0)
                        )
                        .slice(0, 25)
                        .map((a) => (
                          <tr key={a.id}>
                            <td>{new Date(a.created_at).toLocaleString()}</td>
                            <td>{a.role_display || a.role}</td>
                            <td>
                              {a.activity_type_display || a.activity_type}
                            </td>
                            <td>{a.points}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <div className={styles.empty}>No actions yet</div>
                )}
              </section>
            </>
          )}

          {/* TEACHING TAB CONTENT */}
          {activeTab === "teaching" && (
            <>
              <section className={styles.panel}>
                <h2 className={styles.sectionTitle}>Teaching Performance</h2>
                <div className={styles.kpiRow}>
                  <div className={styles.kpiItemBox}>
                    <span className={styles.kpiLabel}>Impact Score</span>
                    <b>{impactScore?.total_score ?? data.impact_score ?? 0}</b>
                  </div>
                  <div className={styles.kpiItemBox}>
                    <span className={styles.kpiLabel}>Enrollments</span>
                    <b>
                      {impactScore?.course_items?.length ??
                        data.enrollments_detail?.length ??
                        0}
                    </b>
                  </div>
                  <div className={styles.kpiItemBox}>
                    <span className={styles.kpiLabel}>Quiz Answers</span>
                    <b>{impactScore?.quiz_items?.length ?? 0}</b>
                  </div>
                </div>
              </section>
              <section className={styles.grid2}>
                <div className={styles.panel}>
                  <h3 className={styles.panelTitle}>Strong Content</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Metric</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(impactAnalytics?.courses?.highest_completion || [])
                        .slice(0, 5)
                        .map((c, i) => (
                          <tr
                            key={`c-strong-${i}`}
                            className={styles.rowClickable}
                            onClick={() =>
                              c.permalink &&
                              router.push(`/courses/${c.permalink}`)
                            }
                          >
                            <td>{c.title}</td>
                            <td>Completion Rate</td>
                            <td>
                              {c.avg_completion_rate ??
                                c.completion_rate ??
                                "—"}
                              %
                            </td>
                          </tr>
                        ))}
                      {(impactAnalytics?.quizzes?.highest_accuracy || [])
                        .slice(0, 5)
                        .map((q, i) => (
                          <tr
                            key={`q-strong-${i}`}
                            className={styles.rowClickable}
                            onClick={() =>
                              q.permalink &&
                              router.push(`/quizzes/${q.permalink}`)
                            }
                          >
                            <td>{q.title}</td>
                            <td>Accuracy</td>
                            <td>{q.accuracy_rate ?? "—"}%</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.panel}>
                  <h3 className={styles.panelTitle}>Needs Attention</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Issue</th>
                        <th>Metric</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(impactAnalytics?.courses?.needs_attention || [])
                        .slice(0, 5)
                        .map((c, i) => (
                          <tr
                            key={`c-weak-${i}`}
                            className={styles.rowClickable}
                            onClick={() =>
                              c.permalink &&
                              router.push(`/courses/${c.permalink}`)
                            }
                          >
                            <td>{c.title}</td>
                            <td>Low Completion</td>
                            <td>{c.avg_completion_rate ?? "—"}%</td>
                          </tr>
                        ))}
                      {(impactAnalytics?.quizzes?.challenging || [])
                        .slice(0, 5)
                        .map((q, i) => (
                          <tr
                            key={`q-weak-${i}`}
                            className={styles.rowClickable}
                            onClick={() =>
                              q.permalink &&
                              router.push(`/quizzes/${q.permalink}`)
                            }
                          >
                            <td>{q.title}</td>
                            <td>Low Accuracy</td>
                            <td>{q.accuracy_rate ?? "—"}%</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className={styles.panel}>
                <h3 className={styles.panelTitle}>Recent Engagement</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Type</th>
                      <th>Title</th>
                      <th>User</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...(impactScore?.course_items || []),
                      impactScore?.quiz_items || [],
                    ]
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(b.enrolled_at || b.answered_at || 0) -
                          new Date(a.enrolled_at || a.answered_at || 0)
                      )
                      .slice(0, 25)
                      .map((item, i) => (
                        <tr key={`eng-${i}`}>
                          <td>
                            {item.enrolled_at
                              ? new Date(item.enrolled_at).toLocaleDateString()
                              : item.answered_at
                              ? new Date(item.answered_at).toLocaleDateString()
                              : "—"}
                          </td>
                          <td>
                            {item.course_title ? "Enrollment" : "Quiz Answer"}
                          </td>
                          <td>{item.course_title || item.quiz_title}</td>
                          <td>{item.student_name || "—"}</td>
                          <td>{item.points}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </section>
              <section className={styles.panel}>
                <h3 className={styles.panelTitle}>Common Mistake Hotspots</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Quiz</th>
                      <th>Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(impactAnalytics?.quizzes?.challenging || [])
                      .slice(0, 10)
                      .map((q, i) => (
                        <tr
                          key={`hot-${i}`}
                          className={styles.rowClickable}
                          onClick={() =>
                            q.permalink &&
                            router.push(`/quizzes/${q.permalink}`)
                          }
                        >
                          <td>{q.title}</td>
                          <td>{q.accuracy_rate ?? "—"}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </section>
            </>
          )}

          {/* LEARNING TAB CONTENT */}
          {activeTab === "learning" && (
            <>
              <section className={styles.panel}>
                <h2 className={styles.sectionTitle}>Learning Progress</h2>
                <div className={styles.kpiRow}>
                  <div className={styles.kpiItemBox}>
                    <span className={styles.kpiLabel}>Learning Score</span>
                    <b>{learningScore?.total_score ?? 0}</b>
                  </div>
                  <div className={styles.kpiItemBox}>
                    <span className={styles.kpiLabel}>Quizzes</span>
                    <b>{data.total_quizzes_answered ?? 0}</b>
                  </div>
                  <div className={styles.kpiItemBox}>
                    <span className={styles.kpiLabel}>Lessons</span>
                    <b>{data.total_lessons_completed ?? 0}</b>
                  </div>
                  <div className={styles.kpiItemBox}>
                    <span className={styles.kpiLabel}>Courses</span>
                    <b>
                      {data.total_courses_enrolled ??
                        data.total_courses_completed ??
                        0}
                    </b>
                  </div>
                </div>
              </section>
              <section className={styles.grid2}>
                <div className={styles.panel}>
                  <h3 className={styles.panelTitle}>Strengths</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Metric</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const toDate = (obj) =>
                          obj.last_timestamp ||
                          obj.answered_at ||
                          obj.completed_at ||
                          obj.enrolled_at ||
                          obj.enrolled_date ||
                          obj.last_attempt_at ||
                          obj.first_attempt_at ||
                          obj.timestamp ||
                          null;
                        // Heuristic: quizzes with high accuracy and multiple attempts → confident mastery
                        const quizStrong = (
                          learningAnalytics?.quizzes?.fast_correct || []
                        ).map((q) => ({
                          type: "Quiz",
                          title: q.quiz_title || `Quiz ${q.quiz_id}`,
                          permalink: q.quiz_permalink,
                          metricLabel: "First-try Correct",
                          metricValue: "✓",
                          _date: toDate(q),
                        }));
                        const courseStrong = (
                          learningAnalytics?.courses?.most_complete || []
                        ).map((c) => ({
                          type: "Course",
                          title: c.title,
                          permalink: c.permalink,
                          metricLabel: "Completion",
                          metricValue: `${
                            c.completion_rate ?? c.avg_completion_rate ?? "—"
                          }%`,
                          _date: toDate(c),
                        }));
                        const items = [...quizStrong, ...courseStrong]
                          .sort(
                            (a, b) =>
                              new Date(b._date || 0) - new Date(a._date || 0)
                          )
                          .slice(0, 5);
                        return items.length ? (
                          items.map((it, i) => (
                            <tr
                              key={`str-${i}`}
                              className={styles.rowClickable}
                              onClick={() =>
                                it.permalink &&
                                router.push(
                                  `/` +
                                    (it.type === "Course"
                                      ? "courses"
                                      : "quizzes") +
                                    `/${it.permalink}`
                                )
                              }
                            >
                              <td className={styles.contentCell}>
                                <span>{it.title}</span>
                                {it.permalink && <ExternalLink size={12} />}
                              </td>
                              <td>{it.type}</td>
                              <td>{it.metricValue}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className={styles.empty}>
                              No strengths detected yet.
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
                <div className={styles.panel}>
                  <h3 className={styles.panelTitle}>Weaknesses</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Issue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const toDate = (obj) =>
                          obj.last_timestamp ||
                          obj.answered_at ||
                          obj.completed_at ||
                          obj.enrolled_at ||
                          obj.enrolled_date ||
                          obj.last_attempt_at ||
                          obj.first_attempt_at ||
                          obj.timestamp ||
                          null;
                        // Heuristic: questions with many wrong attempts; courses with low completion
                        const quizWeak = (
                          learningAnalytics?.quizzes?.most_mistakes || []
                        ).map((q) => ({
                          type: "Quiz",
                          title: q.quiz_title || `Quiz ${q.quiz_id}`,
                          permalink: q.quiz_permalink,
                          issue: `${q.wrong_attempts ?? 0} mistakes`,
                          _date: toDate(q),
                        }));
                        const courseWeak = (
                          learningAnalytics?.courses?.most_incomplete || []
                        ).map((c) => ({
                          type: "Course",
                          title: c.title,
                          permalink: c.permalink,
                          issue: `Incomplete (${c.completed_lessons}/${c.total_lessons})`,
                          _date: toDate(c),
                        }));
                        const items = [...quizWeak, ...courseWeak]
                          .sort(
                            (a, b) =>
                              new Date(b._date || 0) - new Date(a._date || 0)
                          )
                          .slice(0, 5);
                        return items.length ? (
                          items.map((it, i) => (
                            <tr
                              key={`weak-${i}`}
                              className={styles.rowClickable}
                              onClick={() =>
                                it.permalink &&
                                router.push(
                                  `/` +
                                    (it.type === "Course"
                                      ? "courses"
                                      : "quizzes") +
                                    `/${it.permalink}`
                                )
                              }
                            >
                              <td className={styles.contentCell}>
                                <span>{it.title}</span>
                                {it.permalink && <ExternalLink size={12} />}
                              </td>
                              <td>{it.type}</td>
                              <td>{it.issue}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className={styles.empty}>
                              No weaknesses detected yet.
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className={styles.panel}>
                <h3 className={styles.panelTitle}>Recent Progress</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...(learningScore?.quiz_items || []),
                      learningScore?.lesson_items || [],
                      learningScore?.course_items || [],
                    ]
                      .sort(
                        (a, b) =>
                          new Date(
                            b.answered_at ||
                              b.completed_at ||
                              b.enrolled_at ||
                              0
                          ) -
                          new Date(
                            a.answered_at ||
                              a.completed_at ||
                              a.enrolled_at ||
                              0
                          )
                      )
                      .slice(0, 25)
                      .map((it, i) => {
                        const type = it.quiz_title
                          ? "Quiz"
                          : it.lesson_title
                          ? "Lesson"
                          : it.course_title
                          ? "Course"
                          : "Item";
                        const title =
                          it.quiz_title ||
                          it.lesson_title ||
                          it.course_title ||
                          "—";
                        const permalink =
                          it.quiz_permalink ||
                          it.lesson_permalink ||
                          it.course_permalink ||
                          it.link;
                        const pathPrefix = it.quiz_permalink
                          ? "quizzes"
                          : it.lesson_permalink
                          ? "lessons"
                          : it.course_permalink
                          ? "courses"
                          : "";
                        return (
                          <tr
                            key={`prog-${i}`}
                            className={permalink ? styles.rowClickable : ""}
                            onClick={() => {
                              if (permalink) {
                                router.push(`/${pathPrefix}/${permalink}`);
                              }
                            }}
                          >
                            <td>
                              {it.answered_at ||
                              it.completed_at ||
                              it.enrolled_at
                                ? new Date(
                                    it.answered_at ||
                                      it.completed_at ||
                                      it.enrolled_at
                                  ).toLocaleDateString()
                                : "—"}
                            </td>
                            <td>{type}</td>
                            <td className={styles.contentCell}>
                              <span>{title}</span>
                              {permalink && <ExternalLink size={12} />}
                            </td>
                            <td>{it.points}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </section>
              <section className={styles.panel}>
                <h3 className={styles.panelTitle}>Frequent Mistakes</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Wrong Attempts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(learningAnalytics?.quizzes?.most_mistakes || [])
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(b.last_timestamp || 0) -
                          new Date(a.last_timestamp || 0)
                      )
                      .slice(0, 10)
                      .map((q, i) => {
                        const title =
                          q.question_title || `Question ${q.question_id}`;
                        const permalink = q.quiz_permalink;
                        return (
                          <tr
                            key={`lm-${i}`}
                            className={permalink ? styles.rowClickable : ""}
                            onClick={() => {
                              if (permalink) {
                                router.push(`/quizzes/${permalink}`);
                              }
                            }}
                          >
                            <td className={styles.contentCell}>
                              <span>{title}</span>
                              {permalink && <ExternalLink size={12} />}
                            </td>
                            <td>{q.wrong_attempts}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </section>
            </>
          )}

          <section className={styles.grid2}>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Study Time This Week</h3>
              <div className={styles.studyFlex}>
                <div className={styles.gaugeWrap}>
                  <ResponsiveContainer width="100%" height={180}>
                    <RadialBarChart
                      innerRadius="40%"
                      outerRadius="90%"
                      data={gaugeData}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar
                        minAngle={15}
                        clockWise
                        dataKey="value"
                        cornerRadius={8}
                        fill="#667eea"
                      />
                      <Tooltip formatter={(v) => `${v}% of weekly goal`} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className={styles.gaugeCenter}>
                    <div className={styles.gaugeValue}>
                      {loginGaugePercent}%
                    </div>
                    <div className={styles.gaugeSub}>
                      of {data?.login_goal_weekly_minutes} min goal
                    </div>
                  </div>
                </div>
                <div className={styles.studyStats}>
                  <p>
                    <strong>Total:</strong> {data?.total_login_minutes_7d ?? 0}{" "}
                    min
                  </p>
                  <p>
                    <strong>Avg / day:</strong>{" "}
                    {data?.average_login_minutes_per_day_7d ?? 0} min
                  </p>
                  <p className={styles.tip}>
                    Goal set to {data?.login_goal_weekly_minutes} min/week.
                  </p>
                </div>
              </div>
            </div>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>
                Weekly Study Minutes (7 days)
              </h3>
              {loginSeries.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={loginSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => {
                        const x = new Date(d);
                        return `${x.getMonth() + 1}/${x.getDate()}`;
                      }}
                    />
                    <YAxis />
                    <Tooltip formatter={(v) => `${v} min`} />
                    <Bar
                      dataKey="minutes"
                      fill="#764ba2"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.empty}>No login time yet.</div>
              )}
            </div>
          </section>

          {/* Removed legacy topTab sub-tab section */}

          {/* Recent activity (exact items) */}
          <section className={styles.panel}>
            <h3 className={styles.panelTitle}>
              Recent Actions (How Points Were Earned)
            </h3>
            {loadingHistory ? (
              <div className={styles.loadingWrap}>Loading recent actions…</div>
            ) : errorHistory ? (
              <div className={styles.errorWrap}>{errorHistory}</div>
            ) : history?.results?.length ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Role</th>
                    <th>Activity</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {history.results.map((a) => (
                    <tr key={a.id}>
                      <td>{new Date(a.created_at).toLocaleString()}</td>
                      <td>{a.role_display || a.role}</td>
                      <td>{a.activity_type_display || a.activity_type}</td>
                      <td>{a.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.empty}>No recent actions recorded.</div>
            )}
          </section>

          {(data.lesson_completions_detail?.length ||
            data.course_completions_detail?.length ||
            data.enrollments_detail?.length) && (
            <section className={styles.panel}>
              <h3 className={styles.panelTitle}>Your Learning Journey</h3>
              <div className={styles.recentGrid}>
                {data.lesson_completions_detail?.length > 0 && (
                  <div>
                    <h4 className={styles.subhead}>
                      Lessons Completed ({data.lesson_completions_detail.length}
                      ) — Total: +
                      {data.lesson_completions_detail.reduce(
                        (sum, l) => sum + l.points,
                        0
                      )}{" "}
                      pts
                    </h4>
                    <ul className={styles.list}>
                      {data.lesson_completions_detail
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.completed_at || 0) -
                            new Date(a.completed_at || 0)
                        )
                        .slice(0, 10)
                        .map((l) => (
                          <li key={l.id}>
                            <button
                              onClick={() => l.link && router.push(l.link)}
                              className={styles.linkBtn}
                              disabled={!l.link}
                            >
                              <span>{l.lesson_title}</span>
                              {l.link && <ExternalLink size={12} />}
                            </button>
                            <em>
                              {new Date(l.completed_at).toLocaleDateString()}
                            </em>
                            <b className={styles.pointsBadge}>+{l.points}</b>
                            {l.course_title && <i> · {l.course_title}</i>}
                          </li>
                        ))}
                    </ul>
                    {data.lesson_completions_detail.length > 10 && (
                      <button
                        onClick={() => openScoreDetail("student")}
                        className={styles.viewMoreBtn}
                      >
                        View all {data.lesson_completions_detail.length} lessons
                        →
                      </button>
                    )}
                  </div>
                )}
                {data.courses_enrolled_detail?.length > 0 && (
                  <div>
                    <h4 className={styles.subhead}>
                      Courses Enrolled ({data.courses_enrolled_detail.length}) —
                      Total: +
                      {data.courses_enrolled_detail.reduce(
                        (sum, c) => sum + c.points,
                        0
                      )}{" "}
                      pts
                    </h4>
                    <div className={styles.filterBar}>
                      <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Sort</label>
                        <select
                          className={styles.filterSelect}
                          value={studentEnrollSort}
                          onChange={(e) => setStudentEnrollSort(e.target.value)}
                        >
                          <option value="newest">Newest</option>
                          <option value="oldest">Oldest</option>
                          <option value="az">A → Z</option>
                          <option value="za">Z → A</option>
                        </select>
                      </div>
                      <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Category</label>
                        <div className={styles.segmented}>
                          <button
                            className={`${styles.segmentBtn} ${
                              studentEnrollFilter === "all"
                                ? styles.segmentActive
                                : ""
                            }`}
                            onClick={() => setStudentEnrollFilter("all")}
                          >
                            All
                          </button>
                          <button
                            className={`${styles.segmentBtn} ${
                              studentEnrollFilter === "free"
                                ? styles.segmentActive
                                : ""
                            }`}
                            onClick={() => setStudentEnrollFilter("free")}
                          >
                            Free
                          </button>
                          <button
                            className={`${styles.segmentBtn} ${
                              studentEnrollFilter === "premium"
                                ? styles.segmentActive
                                : ""
                            }`}
                            onClick={() => setStudentEnrollFilter("premium")}
                          >
                            Premium
                          </button>
                        </div>
                      </div>
                    </div>
                    {(() => {
                      let list = [...data.courses_enrolled_detail];
                      if (studentEnrollFilter !== "all") {
                        list = list.filter((i) => {
                          const t = (i.enrollment_type || "").toLowerCase();
                          return studentEnrollFilter === "free"
                            ? t.includes("free")
                            : t.includes("premium");
                        });
                      }
                      if (studentEnrollSort === "newest")
                        list.sort(
                          (a, b) =>
                            new Date(b.enrolled_at) - new Date(a.enrolled_at)
                        );
                      else if (studentEnrollSort === "oldest")
                        list.sort(
                          (a, b) =>
                            new Date(a.enrolled_at) - new Date(b.enrolled_at)
                        );
                      else if (studentEnrollSort === "az")
                        list.sort((a, b) =>
                          (a.course_title || "").localeCompare(
                            b.course_title || ""
                          )
                        );
                      else if (studentEnrollSort === "za")
                        list.sort((a, b) =>
                          (b.course_title || "").localeCompare(
                            a.course_title || ""
                          )
                        );
                      return (
                        <ul className={styles.list}>
                          {list.map((c) => (
                            <li key={c.id}>
                              <button
                                onClick={() => c.link && router.push(c.link)}
                                className={styles.linkBtn}
                                disabled={!c.link}
                              >
                                <span>{c.course_title}</span>
                                {c.link && <ExternalLink size={12} />}
                              </button>
                              <em>
                                {new Date(c.enrolled_at).toLocaleDateString()}
                              </em>
                              <b className={styles.pointsBadge}>+{c.points}</b>
                              <i> · {c.enrollment_type}</i>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </div>
                )}
                {data.course_completions_detail?.length > 0 && (
                  <div>
                    <h4 className={styles.subhead}>
                      Courses Completed ({data.course_completions_detail.length}
                      ) — Total: +
                      {data.course_completions_detail.reduce(
                        (sum, c) => sum + c.points,
                        0
                      )}{" "}
                      pts
                    </h4>
                    <ul className={styles.list}>
                      {data.course_completions_detail
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.completed_at || 0) -
                            new Date(a.completed_at || 0)
                        )
                        .map((c) => (
                          <li key={c.id}>
                            <button
                              onClick={() => c.link && router.push(c.link)}
                              className={styles.linkBtn}
                              disabled={!c.link}
                            >
                              <span>{c.course_title}</span>
                              {c.link && <ExternalLink size={12} />}
                            </button>
                            <em>
                              {new Date(c.completed_at).toLocaleDateString()}
                            </em>
                            <b className={styles.pointsBadge}>+{c.points}</b>
                            {c.time_spent_days && (
                              <i> · {Math.round(c.time_spent_days)} days</i>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                {data.enrollments_detail?.length > 0 && (
                  <div>
                    <h4 className={styles.subhead}>
                      Student Enrollments ({data.enrollments_detail.length}) —
                      Total: +
                      {data.enrollments_detail.reduce(
                        (sum, e) => sum + e.points,
                        0
                      )}{" "}
                      pts
                    </h4>
                    <div className={styles.filterBar}>
                      <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Sort</label>
                        <select
                          className={styles.filterSelect}
                          value={teacherEnrollSort}
                          onChange={(e) => setTeacherEnrollSort(e.target.value)}
                        >
                          <option value="newest">Newest</option>
                          <option value="oldest">Oldest</option>
                          <option value="az">A → Z</option>
                          <option value="za">Z → A</option>
                        </select>
                      </div>
                      <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Category</label>
                        <div className={styles.segmented}>
                          <button
                            className={`${styles.segmentBtn} ${
                              teacherEnrollFilter === "all"
                                ? styles.segmentActive
                                : ""
                            }`}
                            onClick={() => setTeacherEnrollFilter("all")}
                          >
                            All
                          </button>
                          <button
                            className={`${styles.segmentBtn} ${
                              teacherEnrollFilter === "free"
                                ? styles.segmentActive
                                : ""
                            }`}
                            onClick={() => setTeacherEnrollFilter("free")}
                          >
                            Free
                          </button>
                          <button
                            className={`${styles.segmentBtn} ${
                              teacherEnrollFilter === "premium"
                                ? styles.segmentActive
                                : ""
                            }`}
                            onClick={() => setTeacherEnrollFilter("premium")}
                          >
                            Premium
                          </button>
                        </div>
                      </div>
                    </div>
                    {(() => {
                      let list = [...data.enrollments_detail];
                      if (teacherEnrollFilter !== "all") {
                        list = list.filter((i) =>
                          teacherEnrollFilter === "free"
                            ? !i.is_premium
                            : i.is_premium
                        );
                      }
                      if (teacherEnrollSort === "newest")
                        list.sort(
                          (a, b) =>
                            new Date(b.enrolled_at) - new Date(a.enrolled_at)
                        );
                      else if (teacherEnrollSort === "oldest")
                        list.sort(
                          (a, b) =>
                            new Date(a.enrolled_at) - new Date(b.enrolled_at)
                        );
                      else if (teacherEnrollSort === "az")
                        list.sort((a, b) =>
                          (a.course_title || "").localeCompare(
                            b.course_title || ""
                          )
                        );
                      else if (teacherEnrollSort === "za")
                        list.sort((a, b) =>
                          (b.course_title || "").localeCompare(
                            a.course_title || ""
                          )
                        );
                      return (
                        <ul className={styles.list}>
                          {list.map((e) => (
                            <li key={e.id}>
                              <button
                                onClick={() => e.link && router.push(e.link)}
                                className={styles.linkBtn}
                                disabled={!e.link}
                              >
                                <span>{e.course_title}</span>
                                {e.link && <ExternalLink size={12} />}
                              </button>
                              <em>{e.student_username}</em>
                              <b className={styles.pointsBadge}>+{e.points}</b>
                              <i>
                                {" "}
                                · {e.is_premium ? "👑 Premium" : "🆓 Free"}
                              </i>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </div>
                )}
              </div>
            </section>
          )}

          {showHelp && (
            <div
              className={styles.modalBackdrop}
              onClick={() => setShowHelp(false)}
            >
              <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.modalHead}>
                  <h3>
                    <HelpCircle /> Score & Activity Guide
                  </h3>
                  <button
                    onClick={() => setShowHelp(false)}
                    className={styles.close}
                  >
                    ×
                  </button>
                </div>
                <div className={styles.modalBody}>
                  {data.score_help?.learning_score && (
                    <p>
                      <b>Learning Score:</b> {data.score_help.learning_score}
                    </p>
                  )}
                  {data.score_help?.impact_score && (
                    <p>
                      <b>Impact Score:</b> {data.score_help.impact_score}
                    </p>
                  )}
                  {data.activity_help?.streak_definition && (
                    <p>
                      <b>Streaks:</b> {data.activity_help.streak_definition}
                    </p>
                  )}
                  {data.activity_help?.recent_lists && (
                    <p>
                      <b>Recent Lists:</b> {data.activity_help.recent_lists}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {showScoreDetail && (
            <div
              className={styles.modalBackdrop}
              onClick={() => setShowScoreDetail(false)}
            >
              <div
                className={styles.modalLarge}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.modalHead}>
                  <h3>
                    <Award />{" "}
                    {scoreDetailRole === "student" ? "Learning" : "Impact"}{" "}
                    Score Breakdown
                  </h3>
                  <button
                    onClick={() => setShowScoreDetail(false)}
                    className={styles.close}
                  >
                    ×
                  </button>
                </div>
                <div className={styles.modalBody}>
                  {scoreDetailRole === "student" ? (
                    <>
                      <h4 className={styles.subhead}>
                        Quiz Answers (
                        {data?.recent_correct_answers?.length || 0})
                      </h4>
                      {data?.recent_correct_answers?.length > 0 ? (
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Date & Time</th>
                              <th>Quiz</th>
                              <th>Topic</th>
                              <th>Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.recent_correct_answers
                              .slice(0, 50)
                              .map((q) => (
                                <tr key={q.id}>
                                  <td>
                                    {new Date(q.answered_at).toLocaleString()}
                                  </td>
                                  <td className={styles.contentCell}>
                                    {q.link ? (
                                      <button
                                        onClick={() => router.push(q.link)}
                                        className={styles.contentLink}
                                        title={`Go to ${q.quiz_title}`}
                                      >
                                        <span>{q.quiz_title}</span>
                                        <ExternalLink size={14} />
                                      </button>
                                    ) : (
                                      <span>{q.quiz_title}</span>
                                    )}
                                  </td>
                                  <td>{q.topic || q.subject || "—"}</td>
                                  <td>
                                    <b className={styles.pointsBadge}>
                                      +{q.points}
                                    </b>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.empty}>No quiz answers yet.</div>
                      )}

                      <h4 className={styles.subhead}>
                        Lesson Completions (
                        {data?.lesson_completions_detail?.length || 0})
                      </h4>
                      {data?.lesson_completions_detail?.length > 0 ? (
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Date & Time</th>
                              <th>Lesson</th>
                              <th>Course</th>
                              <th>Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.lesson_completions_detail.map((lesson) => (
                              <tr key={lesson.id}>
                                <td>
                                  {new Date(
                                    lesson.completed_at
                                  ).toLocaleString()}
                                </td>
                                <td className={styles.contentCell}>
                                  {lesson.link ? (
                                    <button
                                      onClick={() => router.push(lesson.link)}
                                      className={styles.contentLink}
                                      title={`Go to ${lesson.lesson_title}`}
                                    >
                                      <span>{lesson.lesson_title}</span>
                                      <ExternalLink size={14} />
                                    </button>
                                  ) : (
                                    <span>{lesson.lesson_title}</span>
                                  )}
                                </td>
                                <td>{lesson.course_title || "—"}</td>
                                <td>
                                  <b className={styles.pointsBadge}>
                                    +{lesson.points}
                                  </b>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.empty}>
                          No lessons completed yet.
                        </div>
                      )}

                      <h4
                        className={styles.subhead}
                        style={{ marginTop: "2rem" }}
                      >
                        Course Completions (
                        {data?.course_completions_detail?.length || 0})
                      </h4>
                      {data?.course_completions_detail?.length > 0 ? (
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Date & Time</th>
                              <th>Course</th>
                              <th>Time Spent</th>
                              <th>Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.course_completions_detail.map((course) => (
                              <tr key={course.id}>
                                <td>
                                  {new Date(
                                    course.completed_at
                                  ).toLocaleString()}
                                </td>
                                <td className={styles.contentCell}>
                                  {course.link ? (
                                    <button
                                      onClick={() => router.push(course.link)}
                                      className={styles.contentLink}
                                      title={`Go to ${course.course_title}`}
                                    >
                                      <span>{course.course_title}</span>
                                      <ExternalLink size={14} />
                                    </button>
                                  ) : (
                                    <span>{course.course_title}</span>
                                  )}
                                </td>
                                <td>
                                  {course.time_spent_days
                                    ? `${Math.round(
                                        course.time_spent_days
                                      )} days`
                                    : "—"}
                                </td>
                                <td>
                                  <b className={styles.pointsBadge}>
                                    +{course.points}
                                  </b>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.empty}>
                          No courses completed yet.
                        </div>
                      )}

                      <h4
                        className={styles.subhead}
                        style={{ marginTop: "2rem" }}
                      >
                        Quizzes Taken ({data?.quizzes_taken_detail?.length || 0}
                        )
                      </h4>
                      {data?.quizzes_taken_detail?.length > 0 ? (
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Quiz</th>
                              <th>Attempts</th>
                              <th>Correct</th>
                              <th>First Bonus</th>
                              <th>Total Points</th>
                              <th>Last Attempt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.quizzes_taken_detail.map((quiz) => (
                              <tr key={quiz.quiz_id}>
                                <td className={styles.contentCell}>
                                  {quiz.link ? (
                                    <button
                                      onClick={() => router.push(quiz.link)}
                                      className={styles.contentLink}
                                      title={`Go to ${quiz.quiz_title}`}
                                    >
                                      <span>{quiz.quiz_title}</span>
                                      <ExternalLink size={14} />
                                    </button>
                                  ) : (
                                    <span>{quiz.quiz_title}</span>
                                  )}
                                </td>
                                <td>{quiz.attempts_count}</td>
                                <td>{quiz.correct_count}</td>
                                <td>
                                  {quiz.first_attempt_bonus
                                    ? `+${quiz.first_attempt_bonus}`
                                    : "—"}
                                </td>
                                <td>
                                  <b className={styles.pointsBadge}>
                                    +{quiz.points_total}
                                  </b>
                                </td>
                                <td>
                                  {quiz.last_attempt_at
                                    ? new Date(
                                        quiz.last_attempt_at
                                      ).toLocaleString()
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.empty}>
                          No quizzes attempted yet.
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <h4 className={styles.subhead}>
                        Student Enrollments (
                        {data?.enrollments_detail?.length || 0})
                      </h4>
                      {data?.enrollments_detail?.length > 0 ? (
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Date & Time</th>
                              <th>Course</th>
                              <th>Student</th>
                              <th>Type</th>
                              <th>Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.enrollments_detail.map((enrollment) => (
                              <tr key={enrollment.id}>
                                <td>
                                  {new Date(
                                    enrollment.enrolled_at
                                  ).toLocaleString()}
                                </td>
                                <td className={styles.contentCell}>
                                  {enrollment.link ? (
                                    <button
                                      onClick={() =>
                                        router.push(enrollment.link)
                                      }
                                      className={styles.contentLink}
                                      title={`Go to ${enrollment.course_title}`}
                                    >
                                      <span>{enrollment.course_title}</span>
                                      <ExternalLink size={14} />
                                    </button>
                                  ) : (
                                    <span>{enrollment.course_title}</span>
                                  )}
                                </td>
                                <td>{enrollment.student_username}</td>
                                <td>
                                  {enrollment.is_premium
                                    ? "👑 Premium"
                                    : "🆓 Free"}
                                </td>
                                <td>
                                  <b className={styles.pointsBadge}>
                                    +{enrollment.points}
                                  </b>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.empty}>No enrollments yet.</div>
                      )}

                      <h4
                        className={styles.subhead}
                        style={{ marginTop: "2rem" }}
                      >
                        Quiz First Attempts (
                        {data?.quiz_first_attempts_detail?.length || 0})
                      </h4>
                      {data?.quiz_first_attempts_detail?.length > 0 ? (
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Date & Time</th>
                              <th>Quiz</th>
                              <th>Student</th>
                              <th>Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.quiz_first_attempts_detail.map((quiz) => (
                              <tr key={quiz.id}>
                                <td>
                                  {new Date(quiz.attempted_at).toLocaleString()}
                                </td>
                                <td>{quiz.quiz_title}</td>
                                <td>{quiz.student_username}</td>
                                <td>
                                  <b className={styles.pointsBadge}>
                                    +{quiz.points}
                                  </b>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.empty}>
                          No quiz attempts yet.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Learning Score Modal */}
          {showLearningScoreModal && learningScore && (
            <div
              className={styles.modalBackdrop}
              onClick={() => {
                setShowLearningScoreModal(false);
                // reset visible counts when closing
                setQuizVisibleCount(5);
                setLessonVisibleCount(5);
                setCourseVisibleCount(5);
              }}
            >
              <div
                className={styles.modalLarge}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.modalHead}>
                  <h3>
                    <Brain /> Your Learning Journey
                  </h3>
                  <button
                    onClick={() => setShowLearningScoreModal(false)}
                    className={styles.close}
                  >
                    ×
                  </button>
                </div>
                <div className={styles.modalBody}>
                  <div className={styles.scoreOverview}>
                    <h2>Total Score: {learningScore.total_score}</h2>
                    <p>
                      Earned from {learningScore.quiz_items.length} unique quiz
                      questions, {learningScore.lesson_items.length} lessons,
                      and {learningScore.course_items.length} course
                      enrollments.
                    </p>
                  </div>

                  {/* Quiz Questions Section */}
                  <h4 className={styles.subhead}>Quiz Questions (+1 each)</h4>
                  {learningScore.quiz_items.length > 0 ? (
                    <>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Quiz</th>
                            <th>Subject</th>
                            <th>Question</th>
                            <th>Answered</th>
                            <th>Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(learningScore.quiz_items || [])
                            .slice(0, quizVisibleCount)
                            .map((item, idx) => (
                              <tr key={idx}>
                                <td className={styles.contentCell}>
                                  {item.quiz_permalink ? (
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/quizzes/${item.quiz_permalink}`
                                        )
                                      }
                                      className={styles.contentLink}
                                      title={`Go to ${item.quiz_title}`}
                                    >
                                      <span>{item.quiz_title}</span>
                                      <ExternalLink size={14} />
                                    </button>
                                  ) : (
                                    <span>{item.quiz_title}</span>
                                  )}
                                </td>
                                <td>{item.subject || "—"}</td>
                                <td>{item.question_text}</td>
                                <td>
                                  {item.answered_at
                                    ? new Date(
                                        item.answered_at
                                      ).toLocaleDateString()
                                    : "—"}
                                </td>
                                <td>
                                  <b className={styles.pointsBadge}>
                                    +{item.points}
                                  </b>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {(learningScore.quiz_items?.length || 0) >
                        quizVisibleCount && (
                        <div className={styles.paginationRow}>
                          <button
                            className={styles.viewMoreBtn}
                            onClick={() =>
                              setQuizVisibleCount((prev) =>
                                Math.min(
                                  prev + 5,
                                  learningScore.quiz_items.length
                                )
                              )
                            }
                          >
                            See more
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.empty}>
                      No quiz questions answered correctly yet.
                    </div>
                  )}

                  {/* Completed Lessons Section */}
                  <h4 className={styles.subhead} style={{ marginTop: "2rem" }}>
                    Completed Lessons (+1 each)
                  </h4>
                  {learningScore.lesson_items.length > 0 ? (
                    <>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Lesson</th>
                            <th>Course</th>
                            <th>Subject</th>
                            <th>Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(learningScore.lesson_items || [])
                            .slice(0, lessonVisibleCount)
                            .map((item, idx) => (
                              <tr key={idx}>
                                <td className={styles.contentCell}>
                                  {item.lesson_permalink ? (
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/lessons/${item.lesson_permalink}`
                                        )
                                      }
                                      className={styles.contentLink}
                                      title={`Go to ${item.lesson_title}`}
                                    >
                                      <span>{item.lesson_title}</span>
                                      <ExternalLink size={14} />
                                    </button>
                                  ) : (
                                    <span>{item.lesson_title}</span>
                                  )}
                                </td>
                                <td>{item.course_title || "—"}</td>
                                <td>{item.subject || "—"}</td>
                                <td>
                                  <b className={styles.pointsBadge}>
                                    +{item.points}
                                  </b>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {(learningScore.lesson_items?.length || 0) >
                        lessonVisibleCount && (
                        <div className={styles.paginationRow}>
                          <button
                            className={styles.viewMoreBtn}
                            onClick={() =>
                              setLessonVisibleCount((prev) =>
                                Math.min(
                                  prev + 5,
                                  learningScore.lesson_items.length
                                )
                              )
                            }
                          >
                            See more
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.empty}>
                      No lessons completed yet.
                    </div>
                  )}

                  {/* Enrolled Courses Section */}
                  <h4 className={styles.subhead} style={{ marginTop: "2rem" }}>
                    Enrolled Courses (+2 free / +3 premium)
                  </h4>
                  {learningScore.course_items.length > 0 ? (
                    <>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Course</th>
                            <th>Subject</th>
                            <th>Type</th>
                            <th>Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(learningScore.course_items || [])
                            .slice(0, courseVisibleCount)
                            .map((item, idx) => (
                              <tr key={idx}>
                                <td className={styles.contentCell}>
                                  {item.course_permalink ? (
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/courses/${item.course_permalink}`
                                        )
                                      }
                                      className={styles.contentLink}
                                      title={`Go to ${item.course_title}`}
                                    >
                                      <span>{item.course_title}</span>
                                      <ExternalLink size={14} />
                                    </button>
                                  ) : (
                                    <span>{item.course_title}</span>
                                  )}
                                </td>
                                <td>{item.subject || "—"}</td>
                                <td>
                                  {item.is_premium ? "👑 Premium" : "🆓 Free"}
                                </td>
                                <td>
                                  <b className={styles.pointsBadge}>
                                    +{item.points}
                                  </b>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {(learningScore.course_items?.length || 0) >
                        courseVisibleCount && (
                        <div className={styles.paginationRow}>
                          <button
                            className={styles.viewMoreBtn}
                            onClick={() =>
                              setCourseVisibleCount((prev) =>
                                Math.min(
                                  prev + 5,
                                  learningScore.course_items.length
                                )
                              )
                            }
                          >
                            See more
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.empty}>No courses enrolled yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Impact Score Modal */}
          {showImpactScoreModal && impactScore && (
            <div
              className={styles.modalBackdrop}
              onClick={() => {
                setShowImpactScoreModal(false);
                setEnrollmentVisibleCount(5);
                setQuizAttemptVisibleCount(5);
              }}
            >
              <div
                className={styles.modalLarge}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.modalHead}>
                  <h3>
                    <Activity /> Your Impact Journey
                  </h3>
                  <button
                    onClick={() => setShowImpactScoreModal(false)}
                    className={styles.close}
                  >
                    ×
                  </button>
                </div>
                <div className={styles.modalBody}>
                  <div
                    className={styles.scoreOverview}
                    style={{
                      background:
                        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                    }}
                  >
                    <h2>Total Score: {impactScore.total_score}</h2>
                    <p>
                      Earned from {impactScore.course_items.length} student
                      enrollments and {impactScore.quiz_items.length} quiz
                      questions answered.
                    </p>
                  </div>

                  {/* Student Enrollments Section */}
                  <h4 className={styles.subhead}>
                    Student Enrollments (+2 free / +3 premium)
                  </h4>
                  {impactScore.course_items.length > 0 ? (
                    <>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Course</th>
                            <th>Subject</th>
                            <th>Type</th>
                            <th>Student</th>
                            <th>Enrolled</th>
                            <th>Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(impactScore.course_items || [])
                            .slice(0, enrollmentVisibleCount)
                            .map((item, idx) => (
                              <tr key={idx}>
                                <td className={styles.contentCell}>
                                  {item.course_permalink ? (
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/courses/${item.course_permalink}`
                                        )
                                      }
                                      className={styles.contentLink}
                                      title={`Go to ${item.course_title}`}
                                    >
                                      <span>{item.course_title}</span>
                                      <ExternalLink size={14} />
                                    </button>
                                  ) : (
                                    <span>{item.course_title}</span>
                                  )}
                                </td>
                                <td>{item.subject || "—"}</td>
                                <td>
                                  {item.is_free ? "🆓 Free" : "💎 Premium"}
                                </td>
                                <td>{item.student_name}</td>
                                <td>
                                  {item.enrolled_at
                                    ? new Date(
                                        item.enrolled_at
                                      ).toLocaleDateString()
                                    : "—"}
                                </td>
                                <td>
                                  <b className={styles.pointsBadge}>
                                    +{item.points}
                                  </b>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {(impactScore.course_items?.length || 0) >
                        enrollmentVisibleCount && (
                        <div className={styles.paginationRow}>
                          <button
                            className={styles.viewMoreBtn}
                            onClick={() =>
                              setEnrollmentVisibleCount((prev) =>
                                Math.min(
                                  prev + 5,
                                  impactScore.course_items.length
                                )
                              )
                            }
                          >
                            See more
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.empty}>
                      No student enrollments yet.
                    </div>
                  )}

                  {/* Quiz Questions Answered Section */}
                  <h4 className={styles.subhead} style={{ marginTop: "2rem" }}>
                    Quiz Questions Answered (+1 each unique user-question)
                  </h4>
                  {impactScore.quiz_items.length > 0 ? (
                    <>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Quiz</th>
                            <th>Subject</th>
                            <th>Question</th>
                            <th>Student</th>
                            <th>Answered</th>
                            <th>Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(impactScore.quiz_items || [])
                            .slice(0, quizAttemptVisibleCount)
                            .map((item, idx) => (
                              <tr key={idx}>
                                <td className={styles.contentCell}>
                                  {item.quiz_permalink ? (
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/quizzes/${item.quiz_permalink}`
                                        )
                                      }
                                      className={styles.contentLink}
                                      title={`Go to ${item.quiz_title}`}
                                    >
                                      <span>{item.quiz_title}</span>
                                      <ExternalLink size={14} />
                                    </button>
                                  ) : (
                                    <span>{item.quiz_title}</span>
                                  )}
                                </td>
                                <td>{item.subject || "—"}</td>
                                <td>{item.question_text || "—"}</td>
                                <td>{item.student_name}</td>
                                <td>
                                  {item.answered_at
                                    ? new Date(
                                        item.answered_at
                                      ).toLocaleDateString()
                                    : "—"}
                                </td>
                                <td>
                                  <b className={styles.pointsBadge}>
                                    +{item.points}
                                  </b>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {(impactScore.quiz_items?.length || 0) >
                        quizAttemptVisibleCount && (
                        <div className={styles.paginationRow}>
                          <button
                            className={styles.viewMoreBtn}
                            onClick={() =>
                              setQuizAttemptVisibleCount((prev) =>
                                Math.min(
                                  prev + 5,
                                  impactScore.quiz_items.length
                                )
                              )
                            }
                          >
                            See more
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.empty}>No quiz attempts yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Analytics Modal */}
          {showAnalyticsModal && (learningAnalytics || impactAnalytics) && (
            <div
              className={styles.modalOverlay}
              onClick={() => setShowAnalyticsModal(false)}
            >
              <div
                className={styles.modalLarge}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.modalHeader}>
                  <h2>
                    <BarChartHorizontalBig size={24} /> Your Analytics
                  </h2>
                  <button
                    className={styles.modalClose}
                    onClick={() => setShowAnalyticsModal(false)}
                  >
                    ✕
                  </button>
                </div>
                {/* Tab Navigation */}
                <div className={styles.tabNav}>
                  <button
                    className={`${styles.tabBtn} ${
                      activeAnalyticsTab === "impact" ? styles.tabBtnActive : ""
                    }`}
                    onClick={() => setActiveAnalyticsTab("impact")}
                  >
                    <Activity size={18} /> Teaching Analytics
                  </button>
                  <button
                    className={`${styles.tabBtn} ${
                      activeAnalyticsTab === "learning"
                        ? styles.tabBtnActive
                        : ""
                    }`}
                    onClick={() => setActiveAnalyticsTab("learning")}
                  >
                    <Brain size={18} /> Learning Analytics
                  </button>
                </div>
                <div className={styles.modalBody}>
                  {/* Teaching Analytics Tab */}
                  {activeAnalyticsTab === "impact" && impactAnalytics && (
                    <div className={styles.analyticsContent}>
                      <div className={styles.analyticsHeader}>
                        <Activity size={28} />
                        <div>
                          <h3>Your Teaching Impact</h3>
                          <p>
                            Statistics and insights about the content you have
                            created or uploaded. See how students interact with
                            your courses, lessons, and quizzes.
                          </p>
                        </div>
                      </div>
                      {/* ...existing impact analytics content... */}
                      {/* Recommendations */}
                      {impactAnalytics.recommendations &&
                        impactAnalytics.recommendations.length > 0 && (
                          <div className={styles.recommendationsSection}>
                            <h4 className={styles.sectionTitle}>
                              💡 Recommendations for Your Content
                            </h4>
                            {impactAnalytics.recommendations.map((rec, idx) => (
                              <div
                                key={idx}
                                className={`${styles.recommendationCard} ${
                                  styles["priority-" + rec.priority]
                                }`}
                              >
                                <div className={styles.recIcon}>
                                  {rec.priority === "high" && "🔥"}
                                  {rec.priority === "medium" && "⚡"}
                                  {rec.priority === "low" && "✨"}
                                </div>
                                <div className={styles.recContent}>
                                  <p>{rec.message}</p>
                                  {rec.course_permalink && (
                                    <button
                                      className={styles.recAction}
                                      onClick={() =>
                                        router.push(
                                          `/courses/${rec.course_permalink}`
                                        )
                                      }
                                    >
                                      View Course →
                                    </button>
                                  )}
                                  {rec.quiz_permalink && (
                                    <button
                                      className={styles.recAction}
                                      onClick={() =>
                                        router.push(
                                          `/quizzes/${rec.quiz_permalink}`
                                        )
                                      }
                                    >
                                      View Quiz →
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      {/* ...existing impact analytics grid/cards... */}
                      {/* Course Analytics */}
                      <div className={styles.analyticsGrid}>
                        {/* ...existing impact analytics cards... */}
                      </div>
                      {/* Quiz Analytics */}
                      {impactAnalytics.quizzes && (
                        <div className={styles.analyticsGrid}>
                          {/* ...existing impact quiz analytics cards... */}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Learning Analytics Tab */}
                  {activeAnalyticsTab === "learning" && learningAnalytics && (
                    <div className={styles.analyticsContent}>
                      <div className={styles.analyticsHeader}>
                        <Brain size={28} />
                        <div>
                          <h3>Your Learning Journey</h3>
                          <p>
                            Statistics and insights about your own learning
                            activity. See your study patterns, strengths, and
                            areas for improvement.
                          </p>
                        </div>
                      </div>

                      {/* Recommendations */}
                      {learningAnalytics.recommendations &&
                        learningAnalytics.recommendations.length > 0 && (
                          <div className={styles.recommendationsSection}>
                            <h4 className={styles.sectionTitle}>
                              💡 Recommendations for You
                            </h4>
                            {learningAnalytics.recommendations.map(
                              (rec, idx) => (
                                <div
                                  key={idx}
                                  className={`${styles.recommendationCard} ${
                                    styles["priority-" + rec.priority]
                                  }`}
                                >
                                  <div className={styles.recIcon}>
                                    {rec.priority === "high" && "🔥"}
                                    {rec.priority === "medium" && "⚡"}
                                    {rec.priority === "low" && "✨"}
                                  </div>
                                  <div className={styles.recContent}>
                                    <p>{rec.message}</p>
                                    {rec.course_permalink && (
                                      <button
                                        className={styles.recAction}
                                        onClick={() =>
                                          router.push(
                                            `/courses/${rec.course_permalink}`
                                          )
                                        }
                                      >
                                        View Course →
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}

                      {/* Course Analytics */}
                      <div className={styles.analyticsGrid}>
                        <div className={styles.analyticsCard}>
                          <h4 className={styles.cardTitle}>
                            📚 Most Incomplete Courses
                          </h4>
                          <p className={styles.cardDesc}>
                            Courses you started but haven&apos;t finished
                          </p>
                          {learningAnalytics.courses.most_incomplete &&
                          learningAnalytics.courses.most_incomplete.length >
                            0 ? (
                            <ul className={styles.analyticsList}>
                              {learningAnalytics.courses.most_incomplete
                                .slice()
                                .sort(
                                  (a, b) =>
                                    new Date(b.enrolled_date || 0) -
                                    new Date(a.enrolled_date || 0)
                                )
                                .map((course, idx) => (
                                  <li
                                    key={idx}
                                    className={styles.analyticsListItem}
                                  >
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/courses/${course.permalink}`
                                        )
                                      }
                                      className={styles.analyticsLink}
                                    >
                                      <span className={styles.analyticsName}>
                                        {course.title}
                                      </span>
                                      <span className={styles.analyticsValue}>
                                        {course.completion_rate}% (
                                        {course.completed_lessons}/
                                        {course.total_lessons})
                                      </span>
                                    </button>
                                  </li>
                                ))}
                            </ul>
                          ) : (
                            <p className={styles.emptyState}>
                              Great job! All courses are complete or no
                              incomplete courses.
                            </p>
                          )}
                        </div>

                        <div className={styles.analyticsCard}>
                          <h4 className={styles.cardTitle}>
                            🎯 Most Completed Courses
                          </h4>
                          <p className={styles.cardDesc}>
                            Your top performing courses
                          </p>
                          {learningAnalytics.courses.most_complete &&
                          learningAnalytics.courses.most_complete.length > 0 ? (
                            <ul className={styles.analyticsList}>
                              {learningAnalytics.courses.most_complete
                                .slice()
                                .sort(
                                  (a, b) =>
                                    new Date(b.enrolled_date || 0) -
                                    new Date(a.enrolled_date || 0)
                                )
                                .map((course, idx) => (
                                  <li
                                    key={idx}
                                    className={styles.analyticsListItem}
                                  >
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/courses/${course.permalink}`
                                        )
                                      }
                                      className={styles.analyticsLink}
                                    >
                                      <span className={styles.analyticsName}>
                                        {course.title}
                                      </span>
                                      <span className={styles.analyticsValue}>
                                        {course.completion_rate}%
                                      </span>
                                    </button>
                                  </li>
                                ))}
                            </ul>
                          ) : (
                            <p className={styles.emptyState}>
                              No completed courses yet.
                            </p>
                          )}
                        </div>

                        <div className={styles.analyticsCard}>
                          <h4 className={styles.cardTitle}>
                            📅 Latest Enrolled Courses
                          </h4>
                          <p className={styles.cardDesc}>
                            Your most recent enrollments
                          </p>
                          {learningAnalytics.courses.latest_enrolled &&
                          learningAnalytics.courses.latest_enrolled.length >
                            0 ? (
                            <ul className={styles.analyticsList}>
                              {learningAnalytics.courses.latest_enrolled.map(
                                (course, idx) => (
                                  <li
                                    key={idx}
                                    className={styles.analyticsListItem}
                                  >
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/courses/${course.permalink}`
                                        )
                                      }
                                      className={styles.analyticsLink}
                                    >
                                      <span className={styles.analyticsName}>
                                        {course.title}
                                      </span>
                                      <span className={styles.analyticsDate}>
                                        {new Date(
                                          course.enrolled_date
                                        ).toLocaleDateString()}
                                      </span>
                                    </button>
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className={styles.emptyState}>
                              No enrollments yet.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quiz Analytics */}
                      {learningAnalytics.quizzes && (
                        <div className={styles.analyticsGrid}>
                          <div className={styles.analyticsCard}>
                            <h4 className={styles.cardTitle}>
                              ❌ Most Mistakes
                            </h4>
                            <p className={styles.cardDesc}>
                              Questions you got wrong most often
                            </p>
                            {learningAnalytics.quizzes.most_mistakes &&
                            learningAnalytics.quizzes.most_mistakes.length >
                              0 ? (
                              <ul className={styles.analyticsList}>
                                {learningAnalytics.quizzes.most_mistakes
                                  .slice(0, 5)
                                  .map((q, idx) => (
                                    <li
                                      key={idx}
                                      className={styles.analyticsListItem}
                                    >
                                      <span className={styles.analyticsName}>
                                        Question {q.question_id}
                                      </span>
                                      <span className={styles.analyticsValue}>
                                        {q.wrong_attempts} wrong
                                      </span>
                                    </li>
                                  ))}
                              </ul>
                            ) : (
                              <p className={styles.emptyState}>
                                No mistakes tracked yet.
                              </p>
                            )}
                          </div>

                          <div className={styles.analyticsCard}>
                            <h4 className={styles.cardTitle}>
                              🔄 Most Repeated
                            </h4>
                            <p className={styles.cardDesc}>
                              Questions you practiced most
                            </p>
                            {learningAnalytics.quizzes.most_repeated &&
                            learningAnalytics.quizzes.most_repeated.length >
                              0 ? (
                              <ul className={styles.analyticsList}>
                                {learningAnalytics.quizzes.most_repeated
                                  .slice(0, 5)
                                  .map((q, idx) => (
                                    <li
                                      key={idx}
                                      className={styles.analyticsListItem}
                                    >
                                      <span className={styles.analyticsName}>
                                        Question {q.question_id}
                                      </span>
                                      <span className={styles.analyticsValue}>
                                        {q.total_attempts} attempts
                                      </span>
                                    </li>
                                  ))}
                              </ul>
                            ) : (
                              <p className={styles.emptyState}>
                                No repeated questions yet.
                              </p>
                            )}
                          </div>

                          <div className={styles.analyticsCard}>
                            <h4 className={styles.cardTitle}>
                              ⚡ Fast & Correct
                            </h4>
                            <p className={styles.cardDesc}>
                              Questions you got right first try
                            </p>
                            {learningAnalytics.quizzes.fast_correct &&
                            learningAnalytics.quizzes.fast_correct.length >
                              0 ? (
                              <p className={styles.bigStat}>
                                {learningAnalytics.quizzes.fast_correct.length}{" "}
                                questions
                              </p>
                            ) : (
                              <p className={styles.emptyState}>
                                No first-try successes yet.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Impact Analytics Tab */}
                  {activeAnalyticsTab === "impact" && impactAnalytics && (
                    <div className={styles.analyticsContent}>
                      <div className={styles.analyticsHeader}>
                        <Activity size={28} />
                        <div>
                          <h3>Your Teaching Impact</h3>
                          <p>
                            See how your content performs and where to improve
                          </p>
                        </div>
                      </div>

                      {/* Recommendations */}
                      {impactAnalytics.recommendations &&
                        impactAnalytics.recommendations.length > 0 && (
                          <div className={styles.recommendationsSection}>
                            <h4 className={styles.sectionTitle}>
                              💡 Recommendations for Your Content
                            </h4>
                            {impactAnalytics.recommendations.map((rec, idx) => (
                              <div
                                key={idx}
                                className={`${styles.recommendationCard} ${
                                  styles["priority-" + rec.priority]
                                }`}
                              >
                                <div className={styles.recIcon}>
                                  {rec.priority === "high" && "🔥"}
                                  {rec.priority === "medium" && "⚡"}
                                  {rec.priority === "low" && "✨"}
                                </div>
                                <div className={styles.recContent}>
                                  <p>{rec.message}</p>
                                  {rec.course_permalink && (
                                    <button
                                      className={styles.recAction}
                                      onClick={() =>
                                        router.push(
                                          `/courses/${rec.course_permalink}`
                                        )
                                      }
                                    >
                                      View Course →
                                    </button>
                                  )}
                                  {rec.quiz_permalink && (
                                    <button
                                      className={styles.recAction}
                                      onClick={() =>
                                        router.push(
                                          `/quizzes/${rec.quiz_permalink}`
                                        )
                                      }
                                    >
                                      View Quiz →
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                      {/* Course Analytics */}
                      <div className={styles.analyticsGrid}>
                        <div className={styles.analyticsCard}>
                          <h4 className={styles.cardTitle}>
                            🌟 Most Enrolled Courses
                          </h4>
                          <p className={styles.cardDesc}>
                            Your most popular courses
                          </p>
                          {impactAnalytics.courses.most_enrolled &&
                          impactAnalytics.courses.most_enrolled.length > 0 ? (
                            <ul className={styles.analyticsList}>
                              {impactAnalytics.courses.most_enrolled.map(
                                (course, idx) => (
                                  <li
                                    key={idx}
                                    className={styles.analyticsListItem}
                                  >
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/courses/${course.permalink}`
                                        )
                                      }
                                      className={styles.analyticsLink}
                                    >
                                      <span className={styles.analyticsName}>
                                        {course.title}
                                      </span>
                                      <span className={styles.analyticsValue}>
                                        {course.enrollment_count} students
                                      </span>
                                    </button>
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className={styles.emptyState}>
                              No enrollments yet.
                            </p>
                          )}
                        </div>

                        <div className={styles.analyticsCard}>
                          <h4 className={styles.cardTitle}>
                            ✅ Highest Completion
                          </h4>
                          <p className={styles.cardDesc}>
                            Courses with best completion rates
                          </p>
                          {impactAnalytics.courses.highest_completion &&
                          impactAnalytics.courses.highest_completion.length >
                            0 ? (
                            <ul className={styles.analyticsList}>
                              {impactAnalytics.courses.highest_completion.map(
                                (course, idx) => (
                                  <li
                                    key={idx}
                                    className={styles.analyticsListItem}
                                  >
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/courses/${course.permalink}`
                                        )
                                      }
                                      className={styles.analyticsLink}
                                    >
                                      <span className={styles.analyticsName}>
                                        {course.title}
                                      </span>
                                      <span className={styles.analyticsValue}>
                                        {course.avg_completion_rate}%
                                      </span>
                                    </button>
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className={styles.emptyState}>
                              No completion data yet.
                            </p>
                          )}
                        </div>

                        <div className={styles.analyticsCard}>
                          <h4 className={styles.cardTitle}>
                            ⚠️ Needs Attention
                          </h4>
                          <p className={styles.cardDesc}>
                            Courses with low completion rates
                          </p>
                          {impactAnalytics.courses.needs_attention &&
                          impactAnalytics.courses.needs_attention.length > 0 ? (
                            <ul className={styles.analyticsList}>
                              {impactAnalytics.courses.needs_attention.map(
                                (course, idx) => (
                                  <li
                                    key={idx}
                                    className={styles.analyticsListItem}
                                  >
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/courses/${course.permalink}`
                                        )
                                      }
                                      className={styles.analyticsLink}
                                    >
                                      <span className={styles.analyticsName}>
                                        {course.title}
                                      </span>
                                      <span className={styles.analyticsValue}>
                                        {course.avg_completion_rate}%
                                      </span>
                                    </button>
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className={styles.emptyState}>
                              All courses performing well!
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quiz Analytics */}
                      {impactAnalytics.quizzes && (
                        <div className={styles.analyticsGrid}>
                          <div className={styles.analyticsCard}>
                            <h4 className={styles.cardTitle}>
                              🔥 Most Attempted Quizzes
                            </h4>
                            <p className={styles.cardDesc}>
                              Quizzes with most student attempts
                            </p>
                            {impactAnalytics.quizzes.most_attempted &&
                            impactAnalytics.quizzes.most_attempted.length >
                              0 ? (
                              <ul className={styles.analyticsList}>
                                {impactAnalytics.quizzes.most_attempted.map(
                                  (quiz, idx) => (
                                    <li
                                      key={idx}
                                      className={styles.analyticsListItem}
                                    >
                                      <button
                                        onClick={() =>
                                          router.push(
                                            `/quizzes/${quiz.permalink}`
                                          )
                                        }
                                        className={styles.analyticsLink}
                                      >
                                        <span className={styles.analyticsName}>
                                          {quiz.title}
                                        </span>
                                        <span className={styles.analyticsValue}>
                                          {quiz.attempt_count} attempts
                                        </span>
                                      </button>
                                    </li>
                                  )
                                )}
                              </ul>
                            ) : (
                              <p className={styles.emptyState}>
                                No quiz attempts yet.
                              </p>
                            )}
                          </div>

                          <div className={styles.analyticsCard}>
                            <h4 className={styles.cardTitle}>
                              🎯 Highest Accuracy
                            </h4>
                            <p className={styles.cardDesc}>
                              Quizzes students do well on
                            </p>
                            {impactAnalytics.quizzes.highest_accuracy &&
                            impactAnalytics.quizzes.highest_accuracy.length >
                              0 ? (
                              <ul className={styles.analyticsList}>
                                {impactAnalytics.quizzes.highest_accuracy.map(
                                  (quiz, idx) => (
                                    <li
                                      key={idx}
                                      className={styles.analyticsListItem}
                                    >
                                      <button
                                        onClick={() =>
                                          router.push(
                                            `/quizzes/${quiz.permalink}`
                                          )
                                        }
                                        className={styles.analyticsLink}
                                      >
                                        <span className={styles.analyticsName}>
                                          {quiz.title}
                                        </span>
                                        <span className={styles.analyticsValue}>
                                          {quiz.accuracy_rate}%
                                        </span>
                                      </button>
                                    </li>
                                  )
                                )}
                              </ul>
                            ) : (
                              <p className={styles.emptyState}>
                                Need more attempts for accuracy data.
                              </p>
                            )}
                          </div>

                          <div className={styles.analyticsCard}>
                            <h4 className={styles.cardTitle}>
                              💪 Most Challenging
                            </h4>
                            <p className={styles.cardDesc}>
                              Quizzes students find difficult
                            </p>
                            {impactAnalytics.quizzes.challenging &&
                            impactAnalytics.quizzes.challenging.length > 0 ? (
                              <ul className={styles.analyticsList}>
                                {impactAnalytics.quizzes.challenging.map(
                                  (quiz, idx) => (
                                    <li
                                      key={idx}
                                      className={styles.analyticsListItem}
                                    >
                                      <button
                                        onClick={() =>
                                          router.push(
                                            `/quizzes/${quiz.permalink}`
                                          )
                                        }
                                        className={styles.analyticsLink}
                                      >
                                        <span className={styles.analyticsName}>
                                          {quiz.title}
                                        </span>
                                        <span className={styles.analyticsValue}>
                                          {quiz.accuracy_rate}% accuracy
                                        </span>
                                      </button>
                                    </li>
                                  )
                                )}
                              </ul>
                            ) : (
                              <p className={styles.emptyState}>
                                Need more attempts for difficulty data.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AnalyticsAndStatistics;

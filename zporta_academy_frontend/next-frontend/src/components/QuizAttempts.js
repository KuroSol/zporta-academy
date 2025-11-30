import React, { useEffect, useState, useContext, useCallback } from "react";
import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";
import { useRouter } from "next/router";
import styles from "@/styles/QuizAttempts.module.css";
import { Award, Activity, Brain, HelpCircle, BookOpenCheck, BarChartHorizontalBig, ExternalLink } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, RadialBarChart, RadialBar } from 'recharts';

const ActivityJourneyDashboard = () => {
  const { token, logout } = useContext(AuthContext);
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
  
  // Analytics state
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState('learning'); // 'learning' or 'impact'
  const [learningAnalytics, setLearningAnalytics] = useState(null);
  const [impactAnalytics, setImpactAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  
  // Score detail modal state
  const [showScoreDetail, setShowScoreDetail] = useState(false);
  const [scoreDetailRole, setScoreDetailRole] = useState(null); // 'student' or 'teacher'
  const [scoreDetailData, setScoreDetailData] = useState({ results: [], count: 0, next: null, previous: null });
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
        const res = await apiClient.get('/users/progress/overview/', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (mounted) setData(res.data);
      } catch (e) {
        if (mounted) setError(e?.message || 'Failed to load activity overview');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await apiClient.get('/users/progress/history/?page_size=10', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (mounted) setHistory(res.data);
      } catch (e) {
        if (mounted) setErrorHistory(e?.message || 'Failed to load activity history');
      } finally {
        if (mounted) setLoadingHistory(false);
      }
    };
    const fetchLearningScore = async () => {
      setLoadingLearningScore(true);
      try {
        const res = await apiClient.get('/users/api/learning-score/', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (mounted) setLearningScore(res.data);
      } catch (e) {
        console.error('Failed to load learning score:', e);
      } finally {
        if (mounted) setLoadingLearningScore(false);
      }
    };
    const fetchImpactScore = async () => {
      setLoadingImpactScore(true);
      try {
        const res = await apiClient.get('/users/api/impact-score/', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (mounted) setImpactScore(res.data);
      } catch (e) {
        console.error('Failed to load impact score:', e);
      } finally {
        if (mounted) setLoadingImpactScore(false);
      }
    };
    const fetchAnalytics = async () => {
      setLoadingAnalytics(true);
      try {
        const [learningRes, impactRes] = await Promise.all([
          apiClient.get('/users/api/learning-analytics/', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
          apiClient.get('/users/api/impact-analytics/', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        ]);
        if (mounted) {
          setLearningAnalytics(learningRes.data);
          setImpactAnalytics(impactRes.data);
        }
      } catch (e) {
        console.error('Failed to load analytics:', e);
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
    return () => { mounted = false; };
  }, [token]);

  // Heartbeat interval to keep session activity fresh (every 4 minutes)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const sendHeartbeat = async () => {
      try {
        const res = await apiClient.post('/users/session/heartbeat/', {}, { headers: { Authorization: `Bearer ${token}` } });
        if (!cancelled && res.data?.last_heartbeat_at) {
          setLastHeartbeat(res.data.last_heartbeat_at);
          setHeartbeatError(null);
        }
      } catch (e) {
        if (!cancelled) setHeartbeatError(e?.message || 'heartbeat failed');
      }
    };
    // Send an immediate heartbeat to populate status quickly
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 240000); // 4 minutes
    return () => { cancelled = true; clearInterval(interval); };
  }, [token]);

  const formattedLastHeartbeat = lastHeartbeat ? new Date(lastHeartbeat).toLocaleTimeString() : null;

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);
  
  // Fetch score detail breakdown with filters
  const fetchScoreDetail = useCallback(async (role, page = 1, search = "") => {
    setScoreDetailLoading(true);
    setScoreDetailError("");
    try {
      const params = new URLSearchParams({ role, page_size: '20', page: page.toString() });
      if (search.trim()) params.append('search', search.trim());
      if (scoreDetailStartDate) params.append('start_date', scoreDetailStartDate);
      if (scoreDetailEndDate) params.append('end_date', scoreDetailEndDate);
      const res = await apiClient.get(`/users/progress/history/?${params.toString()}`, { 
        headers: token ? { Authorization: `Bearer ${token}` } : {} 
      });
      setScoreDetailData(res.data);
    } catch (e) {
      setScoreDetailError(e?.message || 'Failed to load score details');
    } finally {
      setScoreDetailLoading(false);
    }
  }, [token, scoreDetailStartDate, scoreDetailEndDate]);
  
  const openScoreDetail = useCallback((role) => {
    setScoreDetailRole(role);
    setScoreDetailPage(1);
    setScoreDetailSearch("");
    setScoreDetailStartDate("");
    setScoreDetailEndDate("");
    setShowScoreDetail(true);
    // Don't fetch - use data from overview
  }, []);
  
  const handleScoreDetailSearch = useCallback((e) => {
    e.preventDefault();
    setScoreDetailPage(1);
    fetchScoreDetail(scoreDetailRole, 1, scoreDetailSearch);
  }, [scoreDetailRole, scoreDetailSearch, fetchScoreDetail]);
  
  const handleScoreDetailPageChange = useCallback((newPage) => {
    setScoreDetailPage(newPage);
    fetchScoreDetail(scoreDetailRole, newPage, scoreDetailSearch);
  }, [scoreDetailRole, scoreDetailSearch, fetchScoreDetail]);

  const chartSeries = data?.daily_points_last_30d_student || data?.daily_points_last_30d_teacher || [];
  const breakdown = data?.breakdown_by_activity_type_student || data?.breakdown_by_activity_type_teacher || {};
  const pieData = Object.entries(breakdown).map(([k, v]) => ({ name: k.replace(/_/g, ' ').toLowerCase(), value: v.points || 0 })).filter(d => d.value > 0);
  const COLORS = ['#667eea','#764ba2','#ffb347','#48bb78','#f56565','#ed8936','#805ad5'];
  const loginSeries = data?.login_daily_minutes || [];
  const loginGaugePercent = data?.login_goal_progress_percent ?? 0;
  const gaugeData = [{ name: 'progress', value: loginGaugePercent }];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Your Activity Journey</h1>
          <p className={styles.subtitle}>Clear, friendly insights across lessons, quizzes, and courses.</p>
          {token && (
            <div className={styles.sessionStatus}>
              <span className={styles.sessionDot} />
              <span className={styles.sessionText}>
                Active session{formattedLastHeartbeat ? ` • last ping ${formattedLastHeartbeat}` : ''}
              </span>
              <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
              {heartbeatError && <em className={styles.hbError}>Heartbeat issue</em>}
            </div>
          )}
        </div>
        <button className={styles.helpBtn} onClick={() => setShowHelp(true)}><HelpCircle size={18}/> Learn the scores</button>
      </header>

      {loading && (
        <div className={styles.loadingWrap}>Loading your activity…</div>
      )}
      {error && !loading && (
        <div className={styles.errorWrap}>{error}</div>
      )}

      {data && (
        <>
          {/* New Learning Score Card */}
          {learningScore && !loadingLearningScore && (
            <section className={styles.panel}>
              <div className={styles.learningScoreCard} onClick={() => setShowLearningScoreModal(true)}>
                <div className={styles.learningScoreHeader}>
                  <Brain size={32} />
                  <h2>Learning Score</h2>
                </div>
                <div className={styles.learningScoreValue}>{learningScore.total_score}</div>
                <div className={styles.learningScoreBreakdown}>
                  <span>🎯 Quizzes: {learningScore.breakdown.quiz_score}</span>
                  <span>📚 Lessons: {learningScore.breakdown.lesson_score}</span>
                  <span>🎓 Courses: {learningScore.breakdown.course_score}</span>
                </div>
                <div className={styles.clickHint}>Click to see detailed breakdown</div>
              </div>
            </section>
          )}
          
          {/* New Impact Score Card */}
          {impactScore && !loadingImpactScore && impactScore.total_score > 0 && (
            <section className={styles.panel}>
              <div className={styles.learningScoreCard} onClick={() => setShowImpactScoreModal(true)} style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}}>
                <div className={styles.learningScoreHeader}>
                  <Activity size={32} />
                  <h2>Impact Score</h2>
                </div>
                <div className={styles.learningScoreValue}>{impactScore.total_score}</div>
                <div className={styles.learningScoreBreakdown}>
                  <span>👥 Enrollments: {impactScore.breakdown.enrollment_score}</span>
                  <span>📝 Quiz Attempts: {impactScore.breakdown.quiz_attempt_score}</span>
                </div>
                <div className={styles.clickHint}>Click to see detailed breakdown</div>
              </div>
            </section>
          )}
          
          {/* Analytics Insights Card */}
          {(learningAnalytics || impactAnalytics) && !loadingAnalytics && (
            <section className={styles.panel}>
              <div className={styles.learningScoreCard} onClick={() => setShowAnalyticsModal(true)} style={{background: 'linear-gradient(135deg, #667eea 0%, #f093fb 50%, #f5576c 100%)'}}>
                <div className={styles.learningScoreHeader}>
                  <BarChartHorizontalBig size={32} />
                  <h2>Insights & Analytics</h2>
                </div>
                <div className={styles.learningScoreBreakdown}>
                  <span>📊 Study Patterns</span>
                  <span>💡 Recommendations</span>
                  <span>🎯 Performance Insights</span>
                </div>
                <div className={styles.clickHint}>Click to explore detailed analytics</div>
              </div>
            </section>
          )}
          
          <section className={styles.panel}>
            <div className={styles.cards}>
              {data.impact_score !== undefined && (
                <div className={styles.card} onClick={() => openScoreDetail('teacher')} style={{cursor: 'pointer'}}>
                  <div className={styles.cardHeader}><Activity/> <h3>Impact Score</h3></div>
                  <div className={styles.bigValue}>{data.impact_score}</div>
                  <div className={styles.metaRow}>All-time total points earned</div>
                  <div className={styles.clickHint}>Click for breakdown</div>
                </div>
              )}
              <div className={styles.kpi}>
                <div className={styles.kpiItem}><BarChartHorizontalBig/> <span>{data.total_quizzes_answered ?? 0}</span><label>Quizzes</label></div>
                <div className={styles.kpiItem}><BookOpenCheck/> <span>{data.total_lessons_completed ?? 0}</span><label>Lessons</label></div>
                <div className={styles.kpiItem}><Award/> <span>{data.total_courses_enrolled ?? data.total_courses_completed ?? 0}</span><label>Courses Enrolled</label></div>
              </div>
            </div>
            {(data.learning_streak_days || data.impact_streak_days) && (
              <div className={styles.streaks}>
                {data.learning_streak_days ? (<div className={styles.streak}><Brain size={16}/> Learning Streak: <b>{data.learning_streak_days}d</b></div>) : null}
                {data.impact_streak_days ? (<div className={styles.streak}><Activity size={16}/> Impact Streak: <b>{data.impact_streak_days}d</b></div>) : null}
              </div>
            )}
          </section>

          <section className={styles.grid2}>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Daily Points (30 days)</h3>
              {chartSeries.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="date" tickFormatter={(d)=>{const x=new Date(d);return `${x.getMonth()+1}/${x.getDate()}`}}/>
                    <YAxis />
                    <Tooltip labelFormatter={(d)=>new Date(d).toLocaleDateString()}/>
                    <Legend />
                    <Line type="monotone" dataKey="points" stroke="#667eea" strokeWidth={3} dot={{r:3}} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.empty}>No activity yet — start learning!</div>
              )}
            </div>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Points Distribution</h3>
              {pieData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v,n)=>[`${v} pts`, n]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.empty}>No breakdown available.</div>
              )}
            </div>
          </section>

          <section className={styles.grid2}>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Study Time This Week</h3>
              <div className={styles.studyFlex}>
                <div className={styles.gaugeWrap}>
                  <ResponsiveContainer width="100%" height={180}>
                    <RadialBarChart innerRadius="40%" outerRadius="90%" data={gaugeData} startAngle={180} endAngle={0}>
                      <RadialBar minAngle={15} clockWise dataKey="value" cornerRadius={8} fill="#667eea" />
                      <Tooltip formatter={(v)=>`${v}% of weekly goal`} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className={styles.gaugeCenter}>
                    <div className={styles.gaugeValue}>{loginGaugePercent}%</div>
                    <div className={styles.gaugeSub}>of {data?.login_goal_weekly_minutes} min goal</div>
                  </div>
                </div>
                <div className={styles.studyStats}>
                  <p><strong>Total:</strong> {data?.total_login_minutes_7d ?? 0} min</p>
                  <p><strong>Avg / day:</strong> {data?.average_login_minutes_per_day_7d ?? 0} min</p>
                  <p className={styles.tip}>Goal set to {data?.login_goal_weekly_minutes} min/week.</p>
                </div>
              </div>
            </div>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Weekly Study Minutes (7 days)</h3>
              {loginSeries.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={loginSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="date" tickFormatter={(d)=>{const x=new Date(d);return `${x.getMonth()+1}/${x.getDate()}`}}/>
                    <YAxis />
                    <Tooltip formatter={(v)=>`${v} min`}/>
                    <Bar dataKey="minutes" fill="#764ba2" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (<div className={styles.empty}>No login time yet.</div>)}
            </div>
          </section>

          {/* How you earned points (last 30 days) */}
          <section className={styles.panel}>
            <h3 className={styles.panelTitle}>How You Earned Points</h3>
            <div className={styles.breakdownWrap}>
              {(data.breakdown_by_activity_type_student || data.breakdown_by_activity_type_teacher) ? (
                <>
                  {data.breakdown_by_activity_type_student && (
                    <div className={styles.breakdownCol}>
                      <h4 className={styles.subhead}>Learning (Student)</h4>
                      <table className={styles.table}>
                        <thead><tr><th>Activity</th><th>Count</th><th>Total</th><th>Avg/Action</th></tr></thead>
                        <tbody>
                          {Object.entries(data.breakdown_by_activity_type_student).map(([k,v]) => (
                            <tr key={k}><td>{k.replace(/_/g,' ').toLowerCase()}</td><td>{v.count}</td><td>{v.points}</td><td>{v.count ? Math.round((v.points/v.count)*10)/10 : 0}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {data.breakdown_by_activity_type_teacher && (
                    <div className={styles.breakdownCol}>
                      <h4 className={styles.subhead}>Impact (Teacher)</h4>
                      <table className={styles.table}>
                        <thead><tr><th>Activity</th><th>Count</th><th>Total</th><th>Avg/Action</th></tr></thead>
                        <tbody>
                          {Object.entries(data.breakdown_by_activity_type_teacher).map(([k,v]) => (
                            <tr key={k}><td>{k.replace(/_/g,' ').toLowerCase()}</td><td>{v.count}</td><td>{v.points}</td><td>{v.count ? Math.round((v.points/v.count)*10)/10 : 0}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.empty}>No activity yet — once you start, we’ll show exactly how points add up.</div>
              )}
            </div>
          </section>

          {/* Recent activity (exact items) */}
          <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Recent Actions (How Points Were Earned)</h3>
            {loadingHistory ? (
              <div className={styles.loadingWrap}>Loading recent actions…</div>
            ) : errorHistory ? (
              <div className={styles.errorWrap}>{errorHistory}</div>
            ) : (history?.results?.length ? (
              <table className={styles.table}>
                <thead><tr><th>When</th><th>Role</th><th>Activity</th><th>Points</th></tr></thead>
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
            ))}
          </section>

          {(data.lesson_completions_detail?.length || data.course_completions_detail?.length || data.enrollments_detail?.length) && (
            <section className={styles.panel}>
              <h3 className={styles.panelTitle}>Your Learning Journey</h3>
              <div className={styles.recentGrid}>
                {data.lesson_completions_detail?.length > 0 && (
                  <div>
                    <h4 className={styles.subhead}>Lessons Completed ({data.lesson_completions_detail.length}) — Total: +{data.lesson_completions_detail.reduce((sum, l) => sum + l.points, 0)} pts</h4>
                    <ul className={styles.list}>
                      {data.lesson_completions_detail.slice(0, 10).map(l => (
                        <li key={l.id}>
                          <button 
                            onClick={() => l.link && router.push(l.link)} 
                            className={styles.linkBtn}
                            disabled={!l.link}
                          >
                            <span>{l.lesson_title}</span>
                            {l.link && <ExternalLink size={12} />}
                          </button>
                          <em>{new Date(l.completed_at).toLocaleDateString()}</em>
                          <b className={styles.pointsBadge}>+{l.points}</b>
                          {l.course_title && <i> · {l.course_title}</i>}
                        </li>
                      ))}
                    </ul>
                    {data.lesson_completions_detail.length > 10 && (
                      <button onClick={() => openScoreDetail('student')} className={styles.viewMoreBtn}>
                        View all {data.lesson_completions_detail.length} lessons →
                      </button>
                    )}
                  </div>
                )}
                {data.courses_enrolled_detail?.length > 0 && (
                  <div>
                    <h4 className={styles.subhead}>Courses Enrolled ({data.courses_enrolled_detail.length}) — Total: +{data.courses_enrolled_detail.reduce((sum, c) => sum + c.points, 0)} pts</h4>
                    <ul className={styles.list}>
                      {data.courses_enrolled_detail.map(c => (
                        <li key={c.id}>
                          <button 
                            onClick={() => c.link && router.push(c.link)} 
                            className={styles.linkBtn}
                            disabled={!c.link}
                          >
                            <span>{c.course_title}</span>
                            {c.link && <ExternalLink size={12} />}
                          </button>
                          <em>{new Date(c.enrolled_at).toLocaleDateString()}</em>
                          <b className={styles.pointsBadge}>+{c.points}</b>
                          <i> · {c.enrollment_type}</i>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.course_completions_detail?.length > 0 && (
                  <div>
                    <h4 className={styles.subhead}>Courses Completed ({data.course_completions_detail.length}) — Total: +{data.course_completions_detail.reduce((sum, c) => sum + c.points, 0)} pts</h4>
                    <ul className={styles.list}>
                      {data.course_completions_detail.map(c => (
                        <li key={c.id}>
                          <button 
                            onClick={() => c.link && router.push(c.link)} 
                            className={styles.linkBtn}
                            disabled={!c.link}
                          >
                            <span>{c.course_title}</span>
                            {c.link && <ExternalLink size={12} />}
                          </button>
                          <em>{new Date(c.completed_at).toLocaleDateString()}</em>
                          <b className={styles.pointsBadge}>+{c.points}</b>
                          {c.time_spent_days && <i> · {Math.round(c.time_spent_days)} days</i>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.enrollments_detail?.length > 0 && (
                  <div>
                    <h4 className={styles.subhead}>Student Enrollments ({data.enrollments_detail.length}) — Total: +{data.enrollments_detail.reduce((sum, e) => sum + e.points, 0)} pts</h4>
                    <ul className={styles.list}>
                      {data.enrollments_detail.slice(0, 10).map(e => (
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
                          <i> · {e.is_premium ? '👑 Premium' : '🆓 Free'}</i>
                        </li>
                      ))}
                    </ul>
                    {data.enrollments_detail.length > 10 && (
                      <button onClick={() => openScoreDetail('teacher')} className={styles.viewMoreBtn}>
                        View all {data.enrollments_detail.length} enrollments →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {showHelp && (
            <div className={styles.modalBackdrop} onClick={()=>setShowHelp(false)}>
              <div className={styles.modal} onClick={(e)=>e.stopPropagation()}>
                <div className={styles.modalHead}><h3><HelpCircle/> Score & Activity Guide</h3><button onClick={()=>setShowHelp(false)} className={styles.close}>×</button></div>
                <div className={styles.modalBody}>
                  {data.score_help?.learning_score && (<p><b>Learning Score:</b> {data.score_help.learning_score}</p>)}
                  {data.score_help?.impact_score && (<p><b>Impact Score:</b> {data.score_help.impact_score}</p>)}
                  {data.activity_help?.streak_definition && (<p><b>Streaks:</b> {data.activity_help.streak_definition}</p>)}
                  {data.activity_help?.recent_lists && (<p><b>Recent Lists:</b> {data.activity_help.recent_lists}</p>)}
                </div>
              </div>
            </div>
          )}

          {showScoreDetail && (
            <div className={styles.modalBackdrop} onClick={()=>setShowScoreDetail(false)}>
              <div className={styles.modalLarge} onClick={(e)=>e.stopPropagation()}>
                <div className={styles.modalHead}>
                  <h3><Award/> {scoreDetailRole === 'student' ? 'Learning' : 'Impact'} Score Breakdown</h3>
                  <button onClick={()=>setShowScoreDetail(false)} className={styles.close}>×</button>
                </div>
                <div className={styles.modalBody}>
                  {scoreDetailRole === 'student' ? (
                    <>
                      <h4 className={styles.subhead}>Quiz Answers ({data?.recent_correct_answers?.length || 0})</h4>
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
                            {data.recent_correct_answers.slice(0, 50).map(q => (
                              <tr key={q.id}>
                                <td>{new Date(q.answered_at).toLocaleString()}</td>
                                <td className={styles.contentCell}>
                                  {q.link ? (
                                    <button onClick={() => router.push(q.link)} className={styles.contentLink} title={`Go to ${q.quiz_title}`}>
                                      <span>{q.quiz_title}</span>
                                      <ExternalLink size={14} />
                                    </button>
                                  ) : (
                                    <span>{q.quiz_title}</span>
                                  )}
                                </td>
                                <td>{q.topic || q.subject || '—'}</td>
                                <td><b className={styles.pointsBadge}>+{q.points}</b></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.empty}>No quiz answers yet.</div>
                      )}

                      <h4 className={styles.subhead}>Lesson Completions ({data?.lesson_completions_detail?.length || 0})</h4>
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
                                <td>{new Date(lesson.completed_at).toLocaleString()}</td>
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
                                <td>{lesson.course_title || '—'}</td>
                                <td><b className={styles.pointsBadge}>+{lesson.points}</b></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.empty}>No lessons completed yet.</div>
                      )}

                      <h4 className={styles.subhead} style={{marginTop: '2rem'}}>Course Completions ({data?.course_completions_detail?.length || 0})</h4>
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
                                <td>{new Date(course.completed_at).toLocaleString()}</td>
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
                                <td>{course.time_spent_days ? `${Math.round(course.time_spent_days)} days` : '—'}</td>
                                <td><b className={styles.pointsBadge}>+{course.points}</b></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.empty}>No courses completed yet.</div>
                      )}

                      <h4 className={styles.subhead} style={{marginTop: '2rem'}}>Quizzes Taken ({data?.quizzes_taken_detail?.length || 0})</h4>
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
                                <td>{quiz.first_attempt_bonus ? `+${quiz.first_attempt_bonus}` : '—'}</td>
                                <td><b className={styles.pointsBadge}>+{quiz.points_total}</b></td>
                                <td>{quiz.last_attempt_at ? new Date(quiz.last_attempt_at).toLocaleString() : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.empty}>No quizzes attempted yet.</div>
                      )}
                    </>
                  ) : (
                    <>
                      <h4 className={styles.subhead}>Student Enrollments ({data?.enrollments_detail?.length || 0})</h4>
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
                                <td>{new Date(enrollment.enrolled_at).toLocaleString()}</td>
                                <td className={styles.contentCell}>
                                  {enrollment.link ? (
                                    <button 
                                      onClick={() => router.push(enrollment.link)} 
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
                                <td>{enrollment.is_premium ? '👑 Premium' : '🆓 Free'}</td>
                                <td><b className={styles.pointsBadge}>+{enrollment.points}</b></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.empty}>No enrollments yet.</div>
                      )}

                      <h4 className={styles.subhead} style={{marginTop: '2rem'}}>Quiz First Attempts ({data?.quiz_first_attempts_detail?.length || 0})</h4>
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
                                <td>{new Date(quiz.attempted_at).toLocaleString()}</td>
                                <td>{quiz.quiz_title}</td>
                                <td>{quiz.student_username}</td>
                                <td><b className={styles.pointsBadge}>+{quiz.points}</b></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.empty}>No quiz attempts yet.</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Learning Score Modal */}
          {showLearningScoreModal && learningScore && (
            <div className={styles.modalBackdrop} onClick={() => {
              setShowLearningScoreModal(false);
              // reset visible counts when closing
              setQuizVisibleCount(5);
              setLessonVisibleCount(5);
              setCourseVisibleCount(5);
            }}>
              <div className={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHead}>
                  <h3><Brain/> Your Learning Journey</h3>
                  <button onClick={() => setShowLearningScoreModal(false)} className={styles.close}>×</button>
                </div>
                <div className={styles.modalBody}>
                  <div className={styles.scoreOverview}>
                    <h2>Total Score: {learningScore.total_score}</h2>
                    <p>Earned from {learningScore.quiz_items.length} unique quiz questions, {learningScore.lesson_items.length} lessons, and {learningScore.course_items.length} course enrollments.</p>
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
                        {(learningScore.quiz_items || []).slice(0, quizVisibleCount).map((item, idx) => (
                          <tr key={idx}>
                            <td className={styles.contentCell}>
                              {item.quiz_permalink ? (
                                <button 
                                  onClick={() => router.push(`/quizzes/${item.quiz_permalink}`)} 
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
                            <td>{item.subject || '—'}</td>
                            <td>{item.question_text}</td>
                            <td>{item.answered_at ? new Date(item.answered_at).toLocaleDateString() : '—'}</td>
                            <td><b className={styles.pointsBadge}>+{item.points}</b></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(learningScore.quiz_items?.length || 0) > quizVisibleCount && (
                      <div className={styles.paginationRow}>
                        <button className={styles.viewMoreBtn} onClick={() => setQuizVisibleCount(prev => Math.min(prev + 5, learningScore.quiz_items.length))}>See more</button>
                      </div>
                    )}
                    </>
                  ) : (
                    <div className={styles.empty}>No quiz questions answered correctly yet.</div>
                  )}

                  {/* Completed Lessons Section */}
                  <h4 className={styles.subhead} style={{marginTop: '2rem'}}>Completed Lessons (+1 each)</h4>
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
                        {(learningScore.lesson_items || []).slice(0, lessonVisibleCount).map((item, idx) => (
                          <tr key={idx}>
                            <td className={styles.contentCell}>
                              {item.lesson_permalink ? (
                                <button 
                                  onClick={() => router.push(`/lessons/${item.lesson_permalink}`)} 
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
                            <td>{item.course_title || '—'}</td>
                            <td>{item.subject || '—'}</td>
                            <td><b className={styles.pointsBadge}>+{item.points}</b></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(learningScore.lesson_items?.length || 0) > lessonVisibleCount && (
                      <div className={styles.paginationRow}>
                        <button className={styles.viewMoreBtn} onClick={() => setLessonVisibleCount(prev => Math.min(prev + 5, learningScore.lesson_items.length))}>See more</button>
                      </div>
                    )}
                    </>
                  ) : (
                    <div className={styles.empty}>No lessons completed yet.</div>
                  )}

                  {/* Enrolled Courses Section */}
                  <h4 className={styles.subhead} style={{marginTop: '2rem'}}>Enrolled Courses (+2 free / +3 premium)</h4>
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
                        {(learningScore.course_items || []).slice(0, courseVisibleCount).map((item, idx) => (
                          <tr key={idx}>
                            <td className={styles.contentCell}>
                              {item.course_permalink ? (
                                <button 
                                  onClick={() => router.push(`/courses/${item.course_permalink}`)} 
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
                            <td>{item.subject || '—'}</td>
                            <td>{item.is_premium ? '👑 Premium' : '🆓 Free'}</td>
                            <td><b className={styles.pointsBadge}>+{item.points}</b></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(learningScore.course_items?.length || 0) > courseVisibleCount && (
                      <div className={styles.paginationRow}>
                        <button className={styles.viewMoreBtn} onClick={() => setCourseVisibleCount(prev => Math.min(prev + 5, learningScore.course_items.length))}>See more</button>
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
            <div className={styles.modalBackdrop} onClick={() => {
              setShowImpactScoreModal(false);
              setEnrollmentVisibleCount(5);
              setQuizAttemptVisibleCount(5);
            }}>
              <div className={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHead}>
                  <h3><Activity/> Your Impact Journey</h3>
                  <button onClick={() => setShowImpactScoreModal(false)} className={styles.close}>×</button>
                </div>
                <div className={styles.modalBody}>
                  <div className={styles.scoreOverview} style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}}>
                    <h2>Total Score: {impactScore.total_score}</h2>
                    <p>Earned from {impactScore.course_items.length} student enrollments and {impactScore.quiz_items.length} quiz questions answered.</p>
                  </div>

                  {/* Student Enrollments Section */}
                  <h4 className={styles.subhead}>Student Enrollments (+2 free / +3 premium)</h4>
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
                        {(impactScore.course_items || []).slice(0, enrollmentVisibleCount).map((item, idx) => (
                          <tr key={idx}>
                            <td className={styles.contentCell}>
                              {item.course_permalink ? (
                                <button 
                                  onClick={() => router.push(`/courses/${item.course_permalink}`)} 
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
                            <td>{item.subject || '—'}</td>
                            <td>{item.is_free ? '🆓 Free' : '💎 Premium'}</td>
                            <td>{item.student_name}</td>
                            <td>{item.enrolled_at ? new Date(item.enrolled_at).toLocaleDateString() : '—'}</td>
                            <td><b className={styles.pointsBadge}>+{item.points}</b></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(impactScore.course_items?.length || 0) > enrollmentVisibleCount && (
                      <div className={styles.paginationRow}>
                        <button className={styles.viewMoreBtn} onClick={() => setEnrollmentVisibleCount(prev => Math.min(prev + 5, impactScore.course_items.length))}>See more</button>
                      </div>
                    )}
                    </>
                  ) : (
                    <div className={styles.empty}>No student enrollments yet.</div>
                  )}

                  {/* Quiz Questions Answered Section */}
                  <h4 className={styles.subhead} style={{marginTop: '2rem'}}>Quiz Questions Answered (+1 each unique user-question)</h4>
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
                        {(impactScore.quiz_items || []).slice(0, quizAttemptVisibleCount).map((item, idx) => (
                          <tr key={idx}>
                            <td className={styles.contentCell}>
                              {item.quiz_permalink ? (
                                <button 
                                  onClick={() => router.push(`/quizzes/${item.quiz_permalink}`)} 
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
                            <td>{item.subject || '—'}</td>
                            <td>{item.question_text || '—'}</td>
                            <td>{item.student_name}</td>
                            <td>{item.answered_at ? new Date(item.answered_at).toLocaleDateString() : '—'}</td>
                            <td><b className={styles.pointsBadge}>+{item.points}</b></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(impactScore.quiz_items?.length || 0) > quizAttemptVisibleCount && (
                      <div className={styles.paginationRow}>
                        <button className={styles.viewMoreBtn} onClick={() => setQuizAttemptVisibleCount(prev => Math.min(prev + 5, impactScore.quiz_items.length))}>See more</button>
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
            <div className={styles.modalOverlay} onClick={() => setShowAnalyticsModal(false)}>
              <div className={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h2><BarChartHorizontalBig size={24} /> Your Analytics</h2>
                  <button className={styles.modalClose} onClick={() => setShowAnalyticsModal(false)}>✕</button>
                </div>
                {/* Tab Navigation */}
                <div className={styles.tabNav}>
                  <button 
                    className={`${styles.tabBtn} ${activeAnalyticsTab === 'impact' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveAnalyticsTab('impact')}
                  >
                    <Activity size={18} /> Teaching Analytics
                  </button>
                  <button 
                    className={`${styles.tabBtn} ${activeAnalyticsTab === 'learning' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveAnalyticsTab('learning')}
                  >
                    <Brain size={18} /> Learning Analytics
                  </button>
                </div>
                <div className={styles.modalBody}>
                  {/* Teaching Analytics Tab */}
                  {activeAnalyticsTab === 'impact' && impactAnalytics && (
                    <div className={styles.analyticsContent}>
                      <div className={styles.analyticsHeader}>
                        <Activity size={28} />
                        <div>
                          <h3>Your Teaching Impact</h3>
                          <p>Statistics and insights about the content you have created or uploaded. See how students interact with your courses, lessons, and quizzes.</p>
                        </div>
                      </div>
                      {/* ...existing impact analytics content... */}
                      {/* Recommendations */}
                      {impactAnalytics.recommendations && impactAnalytics.recommendations.length > 0 && (
                        <div className={styles.recommendationsSection}>
                          <h4 className={styles.sectionTitle}>💡 Recommendations for Your Content</h4>
                          {impactAnalytics.recommendations.map((rec, idx) => (
                            <div key={idx} className={`${styles.recommendationCard} ${styles['priority-' + rec.priority]}`}>
                              <div className={styles.recIcon}>
                                {rec.priority === 'high' && '🔥'}
                                {rec.priority === 'medium' && '⚡'}
                                {rec.priority === 'low' && '✨'}
                              </div>
                              <div className={styles.recContent}>
                                <p>{rec.message}</p>
                                {rec.course_permalink && (
                                  <button 
                                    className={styles.recAction}
                                    onClick={() => router.push(`/courses/${rec.course_permalink}`)}
                                  >
                                    View Course →
                                  </button>
                                )}
                                {rec.quiz_permalink && (
                                  <button 
                                    className={styles.recAction}
                                    onClick={() => router.push(`/quizzes/${rec.quiz_permalink}`)}
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
                  {activeAnalyticsTab === 'learning' && learningAnalytics && (
                    <div className={styles.analyticsContent}>
                      <div className={styles.analyticsHeader}>
                        <Brain size={28} />
                        <div>
                          <h3>Your Learning Journey</h3>
                          <p>Statistics and insights about your own learning activity. See your study patterns, strengths, and areas for improvement.</p>
                        </div>
                      </div>
                      
                      {/* Recommendations */}
                      {learningAnalytics.recommendations && learningAnalytics.recommendations.length > 0 && (
                        <div className={styles.recommendationsSection}>
                          <h4 className={styles.sectionTitle}>💡 Recommendations for You</h4>
                          {learningAnalytics.recommendations.map((rec, idx) => (
                            <div key={idx} className={`${styles.recommendationCard} ${styles['priority-' + rec.priority]}`}>
                              <div className={styles.recIcon}>
                                {rec.priority === 'high' && '🔥'}
                                {rec.priority === 'medium' && '⚡'}
                                {rec.priority === 'low' && '✨'}
                              </div>
                              <div className={styles.recContent}>
                                <p>{rec.message}</p>
                                {rec.course_permalink && (
                                  <button 
                                    className={styles.recAction}
                                    onClick={() => router.push(`/courses/${rec.course_permalink}`)}
                                  >
                                    View Course →
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
                          <h4 className={styles.cardTitle}>📚 Most Incomplete Courses</h4>
                          <p className={styles.cardDesc}>Courses you started but haven&apos;t finished</p>
                          {learningAnalytics.courses.most_incomplete && learningAnalytics.courses.most_incomplete.length > 0 ? (
                            <ul className={styles.analyticsList}>
                              {learningAnalytics.courses.most_incomplete.map((course, idx) => (
                                <li key={idx} className={styles.analyticsListItem}>
                                  <button 
                                    onClick={() => router.push(`/courses/${course.permalink}`)}
                                    className={styles.analyticsLink}
                                  >
                                    <span className={styles.analyticsName}>{course.title}</span>
                                    <span className={styles.analyticsValue}>{course.completion_rate}% ({course.completed_lessons}/{course.total_lessons})</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className={styles.emptyState}>Great job! All courses are complete or no incomplete courses.</p>
                          )}
                        </div>
                        
                        <div className={styles.analyticsCard}>
                          <h4 className={styles.cardTitle}>🎯 Most Completed Courses</h4>
                          <p className={styles.cardDesc}>Your top performing courses</p>
                          {learningAnalytics.courses.most_complete && learningAnalytics.courses.most_complete.length > 0 ? (
                            <ul className={styles.analyticsList}>
                              {learningAnalytics.courses.most_complete.map((course, idx) => (
                                <li key={idx} className={styles.analyticsListItem}>
                                  <button 
                                    onClick={() => router.push(`/courses/${course.permalink}`)}
                                    className={styles.analyticsLink}
                                  >
                                    <span className={styles.analyticsName}>{course.title}</span>
                                    <span className={styles.analyticsValue}>{course.completion_rate}%</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className={styles.emptyState}>No completed courses yet.</p>
                          )}
                        </div>
                        
                        <div className={styles.analyticsCard}>
                          <h4 className={styles.cardTitle}>📅 Latest Enrolled Courses</h4>
                          <p className={styles.cardDesc}>Your most recent enrollments</p>
                          {learningAnalytics.courses.latest_enrolled && learningAnalytics.courses.latest_enrolled.length > 0 ? (
                            <ul className={styles.analyticsList}>
                              {learningAnalytics.courses.latest_enrolled.map((course, idx) => (
                                <li key={idx} className={styles.analyticsListItem}>
                                  <button 
                                    onClick={() => router.push(`/courses/${course.permalink}`)}
                                    className={styles.analyticsLink}
                                  >
                                    <span className={styles.analyticsName}>{course.title}</span>
                                    <span className={styles.analyticsDate}>{new Date(course.enrolled_date).toLocaleDateString()}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className={styles.emptyState}>No enrollments yet.</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Quiz Analytics */}
                      {learningAnalytics.quizzes && (
                        <div className={styles.analyticsGrid}>
                          <div className={styles.analyticsCard}>
                            <h4 className={styles.cardTitle}>❌ Most Mistakes</h4>
                            <p className={styles.cardDesc}>Questions you got wrong most often</p>
                            {learningAnalytics.quizzes.most_mistakes && learningAnalytics.quizzes.most_mistakes.length > 0 ? (
                              <ul className={styles.analyticsList}>
                                {learningAnalytics.quizzes.most_mistakes.slice(0, 5).map((q, idx) => (
                                  <li key={idx} className={styles.analyticsListItem}>
                                    <span className={styles.analyticsName}>Question {q.question_id}</span>
                                    <span className={styles.analyticsValue}>{q.wrong_attempts} wrong</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className={styles.emptyState}>No mistakes tracked yet.</p>
                            )}
                          </div>
                          
                          <div className={styles.analyticsCard}>
                            <h4 className={styles.cardTitle}>🔄 Most Repeated</h4>
                            <p className={styles.cardDesc}>Questions you practiced most</p>
                            {learningAnalytics.quizzes.most_repeated && learningAnalytics.quizzes.most_repeated.length > 0 ? (
                              <ul className={styles.analyticsList}>
                                {learningAnalytics.quizzes.most_repeated.slice(0, 5).map((q, idx) => (
                                  <li key={idx} className={styles.analyticsListItem}>
                                    <span className={styles.analyticsName}>Question {q.question_id}</span>
                                    <span className={styles.analyticsValue}>{q.total_attempts} attempts</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className={styles.emptyState}>No repeated questions yet.</p>
                            )}
                          </div>
                          
                          <div className={styles.analyticsCard}>
                            <h4 className={styles.cardTitle}>⚡ Fast & Correct</h4>
                            <p className={styles.cardDesc}>Questions you got right first try</p>
                            {learningAnalytics.quizzes.fast_correct && learningAnalytics.quizzes.fast_correct.length > 0 ? (
                              <p className={styles.bigStat}>{learningAnalytics.quizzes.fast_correct.length} questions</p>
                            ) : (
                              <p className={styles.emptyState}>No first-try successes yet.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Impact Analytics Tab */}
                  {activeAnalyticsTab === 'impact' && impactAnalytics && (
                    <div className={styles.analyticsContent}>
                      <div className={styles.analyticsHeader}>
                        <Activity size={28} />
                        <div>
                          <h3>Your Teaching Impact</h3>
                          <p>See how your content performs and where to improve</p>
                        </div>
                      </div>
                      
                      {/* Recommendations */}
                      {impactAnalytics.recommendations && impactAnalytics.recommendations.length > 0 && (
                        <div className={styles.recommendationsSection}>
                          <h4 className={styles.sectionTitle}>💡 Recommendations for Your Content</h4>
                          {impactAnalytics.recommendations.map((rec, idx) => (
                            <div key={idx} className={`${styles.recommendationCard} ${styles['priority-' + rec.priority]}`}>
                              <div className={styles.recIcon}>
                                {rec.priority === 'high' && '🔥'}
                                {rec.priority === 'medium' && '⚡'}
                                {rec.priority === 'low' && '✨'}
                              </div>
                              <div className={styles.recContent}>
                                <p>{rec.message}</p>
                                {rec.course_permalink && (
                                  <button 
                                    className={styles.recAction}
                                    onClick={() => router.push(`/courses/${rec.course_permalink}`)}
                                  >
                                    View Course →
                                  </button>
                                )}
                                {rec.quiz_permalink && (
                                  <button 
                                    className={styles.recAction}
                                    onClick={() => router.push(`/quizzes/${rec.quiz_permalink}`)}
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
                          <h4 className={styles.cardTitle}>🌟 Most Enrolled Courses</h4>
                          <p className={styles.cardDesc}>Your most popular courses</p>
                          {impactAnalytics.courses.most_enrolled && impactAnalytics.courses.most_enrolled.length > 0 ? (
                            <ul className={styles.analyticsList}>
                              {impactAnalytics.courses.most_enrolled.map((course, idx) => (
                                <li key={idx} className={styles.analyticsListItem}>
                                  <button 
                                    onClick={() => router.push(`/courses/${course.permalink}`)}
                                    className={styles.analyticsLink}
                                  >
                                    <span className={styles.analyticsName}>{course.title}</span>
                                    <span className={styles.analyticsValue}>{course.enrollment_count} students</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className={styles.emptyState}>No enrollments yet.</p>
                          )}
                        </div>
                        
                        <div className={styles.analyticsCard}>
                          <h4 className={styles.cardTitle}>✅ Highest Completion</h4>
                          <p className={styles.cardDesc}>Courses with best completion rates</p>
                          {impactAnalytics.courses.highest_completion && impactAnalytics.courses.highest_completion.length > 0 ? (
                            <ul className={styles.analyticsList}>
                              {impactAnalytics.courses.highest_completion.map((course, idx) => (
                                <li key={idx} className={styles.analyticsListItem}>
                                  <button 
                                    onClick={() => router.push(`/courses/${course.permalink}`)}
                                    className={styles.analyticsLink}
                                  >
                                    <span className={styles.analyticsName}>{course.title}</span>
                                    <span className={styles.analyticsValue}>{course.avg_completion_rate}%</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className={styles.emptyState}>No completion data yet.</p>
                          )}
                        </div>
                        
                        <div className={styles.analyticsCard}>
                          <h4 className={styles.cardTitle}>⚠️ Needs Attention</h4>
                          <p className={styles.cardDesc}>Courses with low completion rates</p>
                          {impactAnalytics.courses.needs_attention && impactAnalytics.courses.needs_attention.length > 0 ? (
                            <ul className={styles.analyticsList}>
                              {impactAnalytics.courses.needs_attention.map((course, idx) => (
                                <li key={idx} className={styles.analyticsListItem}>
                                  <button 
                                    onClick={() => router.push(`/courses/${course.permalink}`)}
                                    className={styles.analyticsLink}
                                  >
                                    <span className={styles.analyticsName}>{course.title}</span>
                                    <span className={styles.analyticsValue}>{course.avg_completion_rate}%</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className={styles.emptyState}>All courses performing well!</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Quiz Analytics */}
                      {impactAnalytics.quizzes && (
                        <div className={styles.analyticsGrid}>
                          <div className={styles.analyticsCard}>
                            <h4 className={styles.cardTitle}>🔥 Most Attempted Quizzes</h4>
                            <p className={styles.cardDesc}>Quizzes with most student attempts</p>
                            {impactAnalytics.quizzes.most_attempted && impactAnalytics.quizzes.most_attempted.length > 0 ? (
                              <ul className={styles.analyticsList}>
                                {impactAnalytics.quizzes.most_attempted.map((quiz, idx) => (
                                  <li key={idx} className={styles.analyticsListItem}>
                                    <button 
                                      onClick={() => router.push(`/quizzes/${quiz.permalink}`)}
                                      className={styles.analyticsLink}
                                    >
                                      <span className={styles.analyticsName}>{quiz.title}</span>
                                      <span className={styles.analyticsValue}>{quiz.attempt_count} attempts</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className={styles.emptyState}>No quiz attempts yet.</p>
                            )}
                          </div>
                          
                          <div className={styles.analyticsCard}>
                            <h4 className={styles.cardTitle}>🎯 Highest Accuracy</h4>
                            <p className={styles.cardDesc}>Quizzes students do well on</p>
                            {impactAnalytics.quizzes.highest_accuracy && impactAnalytics.quizzes.highest_accuracy.length > 0 ? (
                              <ul className={styles.analyticsList}>
                                {impactAnalytics.quizzes.highest_accuracy.map((quiz, idx) => (
                                  <li key={idx} className={styles.analyticsListItem}>
                                    <button 
                                      onClick={() => router.push(`/quizzes/${quiz.permalink}`)}
                                      className={styles.analyticsLink}
                                    >
                                      <span className={styles.analyticsName}>{quiz.title}</span>
                                      <span className={styles.analyticsValue}>{quiz.accuracy_rate}%</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className={styles.emptyState}>Need more attempts for accuracy data.</p>
                            )}
                          </div>
                          
                          <div className={styles.analyticsCard}>
                            <h4 className={styles.cardTitle}>💪 Most Challenging</h4>
                            <p className={styles.cardDesc}>Quizzes students find difficult</p>
                            {impactAnalytics.quizzes.challenging && impactAnalytics.quizzes.challenging.length > 0 ? (
                              <ul className={styles.analyticsList}>
                                {impactAnalytics.quizzes.challenging.map((quiz, idx) => (
                                  <li key={idx} className={styles.analyticsListItem}>
                                    <button 
                                      onClick={() => router.push(`/quizzes/${quiz.permalink}`)}
                                      className={styles.analyticsLink}
                                    >
                                      <span className={styles.analyticsName}>{quiz.title}</span>
                                      <span className={styles.analyticsValue}>{quiz.accuracy_rate}% accuracy</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className={styles.emptyState}>Need more attempts for difficulty data.</p>
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

export default ActivityJourneyDashboard;

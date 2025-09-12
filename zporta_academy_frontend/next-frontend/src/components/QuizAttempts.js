import React, { useEffect, useState, useContext, useCallback } from "react";
import Link from "next/link";
import { quizPermalinkToUrl } from "@/utils/urls";
import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";
import styles from "@/styles/QuizAttempts.module.css";
import {
  AlertCircle, Loader, Inbox, Brain, Zap,
  TrendingUp, CalendarCheck2, Star, Clock, HelpCircle, ListChecks,
  ChevronsRight, Smile, Meh, Frown, Target, BarChartHorizontalBig,
  BookOpenCheck, ThumbsUp
} from 'lucide-react';


const formatDate = (isoString) => {
  if (!isoString) return "N/A";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) {
    console.error("Error formatting date:", e);
    return "Invalid Date";
  }
};

const getRelativeDateText = (isoString) => {
    if (!isoString) return { text: "N/A", isToday: false, isTomorrow: false, isOverdue: false };
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return { text: "Invalid Date", isToday: false, isTomorrow: false, isOverdue: false };

    const today = new Date();
    today.setHours(0,0,0,0);
    const targetDate = new Date(date);
    targetDate.setHours(0,0,0,0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let text;
    if (diffDays === 0) text = "Today";
    else if (diffDays === 1) text = "Tomorrow";
    else if (diffDays < 0) text = `${Math.abs(diffDays)} day(s) ago`;
    else text = `In ${diffDays} days`;

    return {
        text,
        fullDate: formatDate(isoString),
        isToday: diffDays === 0,
        isTomorrow: diffDays === 1,
        isOverdue: diffDays < 0
    };
};

const getMemoryStrengthConfig = (estimate) => {
  if (estimate === null || estimate === undefined) return { text: "No Data", colorClass: styles.strengthUnknown, icon: <HelpCircle /> };
  if (estimate >= 0.85) return { text: "Excellent", colorClass: styles.strengthExcellent, icon: <Star /> };
  if (estimate >= 0.7) return { text: "Strong", colorClass: styles.strengthStrong, icon: <ThumbsUp /> };
  if (estimate >= 0.5) return { text: "Good", colorClass: styles.strengthGood, icon: <Smile /> };
  if (estimate >= 0.3) return { text: "Fair", colorClass: styles.strengthFair, icon: <Meh /> };
  return { text: "Needs Work", colorClass: styles.strengthWeak, icon: <Frown /> };
};

const getLastReviewEffortText = (quality) => {
    if (quality === null || quality === undefined) return "N/A";
    if (quality >= 4) return "Felt Easy";
    if (quality === 3) return "Challenging";
    return "Felt Tough";
};

const MemoryItemCard = ({ item, type }) => {
  if (!item || !item.learnable_item_info) {
    return null;
  }
  const { learnable_item_info, next_review_at, current_retention_estimate, repetitions, last_quality_of_recall } = item;
  const reviewDateInfo = getRelativeDateText(next_review_at);
  const memoryStrength = getMemoryStrengthConfig(current_retention_estimate);
  const lastEffort = getLastReviewEffortText(last_quality_of_recall);
  const itemTitle = learnable_item_info?.title || learnable_item_info?.display_text || "Learnable Item";
  const { type: itemType, permalink } = learnable_item_info;
  const href = itemType === "question"
    ? quizPermalinkToUrl(permalink, { review: true })
    : quizPermalinkToUrl(permalink);
  let cardClass = `${styles.memoryItemCard} ${styles[type + 'Item'] || ''}`;
  let typeSpecificIcon = <HelpCircle className={styles.itemTypeIconBase} />;
  if (type === 'due' || reviewDateInfo.isOverdue) typeSpecificIcon = <Zap className={`${styles.itemTypeIconBase} ${styles.dueIconAnimation}`} />;
  else if (type === 'upcoming') typeSpecificIcon = <CalendarCheck2 className={`${styles.itemTypeIconBase} ${styles.upcomingIconAnimation}`} />;
  else if (type === 'strong') typeSpecificIcon = <Star className={`${styles.itemTypeIconBase} ${styles.strongIconAnimation}`} />;

  return (
    <div className={cardClass}>
      <div className={styles.cardHeader}><h4 className={styles.itemTitle}>{itemTitle}</h4></div>
      <div className={styles.itemDetails}>
        <div className={styles.detailRow}><Clock size={16} /><span>Next Review:</span><strong className={`${styles.detailValue} ${reviewDateInfo.isToday || reviewDateInfo.isOverdue ? styles.highlightReviewDate : ''}`}>{reviewDateInfo.text}</strong></div>
        <div className={styles.detailRow}><Brain size={16} /><span>Memory Strength:</span><strong className={`${styles.detailValue} ${memoryStrength.colorClass}`}>{memoryStrength.icon} {memoryStrength.text} ({current_retention_estimate !== null ? `${(current_retention_estimate * 100).toFixed(0)}%` : ''})</strong></div>
        <div className={styles.detailRow}><ListChecks size={16} /><span>Correct Streak:</span><strong className={styles.detailValue}>{repetitions ?? 0}</strong></div>
        {last_quality_of_recall !== null && (<div className={styles.detailRow}><HelpCircle size={16} /><span>Last Review Felt:</span><strong className={styles.detailValue}>{lastEffort}</strong></div>)}
      </div>
        {href !== '#' && (
          <a href={href}
            className={`${styles.actionButton} ${type === 'due' || reviewDateInfo.isOverdue ? styles.actionButtonPrimary : styles.actionButtonSecondary}`}>
            {type === 'due' || reviewDateInfo.isOverdue ? "Review Now" : "Review"} <ChevronsRight size={18} />
          </a>
        )}    
      </div>
  );
};

const QuizInsightCard = ({ item: insight }) => {
  if (!insight) {
    return null;
  }
  const memoryStrength = getMemoryStrengthConfig(insight.current_quiz_retention_estimate);
  const reviewDaysText = insight.retention_days === 0 ? "Today!" : insight.retention_days > 0 ? `in ~${insight.retention_days} days` : `Overdue`;
  return (
    <div className={`${styles.memoryItemCard} ${styles.quizInsightCard}`}>
      <div className={styles.cardHeader}><BookOpenCheck className={styles.itemTypeIconBase} /><h4 className={styles.itemTitle}>{insight.quiz_title}</h4></div>
      <p className={styles.quizInsightMessage}>{insight.message}</p>
      <div className={styles.itemDetails}>
        <div className={styles.detailRow}><Clock size={16} /><span>Next Ideal Review:</span><strong className={styles.detailValue}>{reviewDaysText}</strong></div>
        {insight.current_quiz_retention_estimate !== null && (<div className={styles.detailRow}><Brain size={16} /><span>Current Strength:</span><strong className={`${styles.detailValue} ${memoryStrength.colorClass}`}>{memoryStrength.icon} {memoryStrength.text} ({(insight.current_quiz_retention_estimate * 100).toFixed(0)}%)</strong></div>)}
      </div>
      <p className={styles.lastAttemptText}>Last Activity: {formatDate(insight.last_attempt_timestamp)}</p>
       <a href={quizPermalinkToUrl(insight.permalink)} className={`${styles.actionButton} ${styles.actionButtonView}`}>
          Go to Quiz <ChevronsRight size={18}/>
        </a>
    </div>
  );
};




// --- Main Dashboard Component ---
const QuizAttempts = () => {
  const [attemptOverview, setAttemptOverview] = useState(null);
  const [errorOverview, setErrorOverview] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);

  const [memoryProfile, setMemoryProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [errorProfile, setErrorProfile] = useState("");

  const [quizInsights, setQuizInsights] = useState([]);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [errorInsights, setErrorInsights] = useState("");

  const { token } = useContext(AuthContext); 

    // ─── DRILL-DOWN STATE ───────────────────────────────────────────
  const [openCategory, setOpenCategory]   = useState(null);
  const [drillQuizzes, setDrillQuizzes]   = useState([]);
  const [drillLoading, setDrillLoading]   = useState(false);
  const [drillError, setDrillError]       = useState("");

  const fetchData = useCallback(async (endpoint, setState, setError, setLoading) => {
    setLoading(true);
    try {
      const response = await apiClient.get(endpoint, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setState(response.data);
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
        fetchData("/analytics/quiz-attempt-overview/", setAttemptOverview, setErrorOverview, setLoadingOverview);
        fetchData("/analytics/user-memory-profile/", setMemoryProfile, setErrorProfile, setLoadingProfile);
        fetchData("/analytics/quiz-retention-insights/", setQuizInsights, setErrorInsights, setLoadingInsights);
    }
  }, [token, fetchData]);

  const renderSection = (title, items, type, isLoading, errorMsg, icon, noItemsInfo) => {
    let content;
    const validItems = Array.isArray(items) ? items.filter(item => item && (type !== 'insights' ? item.learnable_item_info : true)) : [];

    if (isLoading) {
        content = <div className={styles.loadingState}><Loader size={32} className="animate-spin" /> <p>Loading...</p></div>;
    } else if (errorMsg) {
        content = <div className={styles.errorState}><AlertCircle size={32} /> <p>{errorMsg}</p></div>;
    } else if (validItems.length === 0) {
        content = (
          <div className={styles.emptyState}>
            {noItemsInfo.icon}
            <h4>{noItemsInfo.title}</h4>
            <p>{noItemsInfo.message}</p>
            {noItemsInfo.link && (
              <Link href={noItemsInfo.link.to} className={styles.emptyStateLink}>
                {noItemsInfo.link.text}
              </Link>
            )}
          </div>
        );
    } else {
        const CardComponent = type === 'insights' ? QuizInsightCard : MemoryItemCard;
        content = <div className={styles.itemsGrid}>{validItems.map(item => <CardComponent key={`${type}-${item.id || item.quiz_id}`} item={item} type={type} />)}</div>;
    }

    return <section className={styles.dashboardSection}><h2 className={styles.sectionHeader}>{icon} {title} <span className={styles.sectionCount}>({validItems.length})</span></h2>{content}</section>;
  };
  // ─── Handle card clicks & fetch quizzes by type ─────────────────
  const handleCardClick = async (type) => {
    // toggle off if same card clicked
    if (type === openCategory) {
      setOpenCategory(null);
      return;
    }
    setOpenCategory(type);
    setDrillLoading(true);
    setDrillError("");

    try {
      const res = await apiClient.get(
        `/analytics/quiz-list/?type=${type}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setDrillQuizzes(res.data);
    } catch (err) {
      setDrillError(err.message || "Failed to load quizzes");
    } finally {
      setDrillLoading(false);
    }
  };

  return (
    <div className={styles.quizAttemptsPage}>
      <header className={styles.pageMasthead}>
        <h1 className={styles.mainTitle}>Your Learning Hub</h1>
        <p className={styles.mainSubtitle}>Stay sharp! Here's what your brain is working on.</p>
      </header>

      {(loadingProfile || loadingOverview) && !memoryProfile && !attemptOverview && (
        <div className={styles.fullPageLoader}><Loader size={48} className="animate-spin" /> <p>Loading Your Learning Data...</p></div>
      )}
      {(errorProfile || errorOverview) && !memoryProfile && !attemptOverview && (
        <div className={styles.fullPageError}><AlertCircle size={48} /> <p>{errorProfile || errorOverview}</p></div>
      )}

      {attemptOverview && (
        <section className={styles.dashboardSection}>
          <h2 className={styles.sectionHeader}><BarChartHorizontalBig size={24}/> Quiz Attempt Overview</h2>
            <div className={styles.summaryGrid}>
              <div
                className={styles.summaryCard}
                onClick={() => handleCardClick('taken')}
              >
                <BookOpenCheck className={styles.summaryIcon}/>
                <span className={styles.summaryValue}>
                  {attemptOverview.total_quizzes}
                </span>
                <p className={styles.summaryLabel}>Quizzes Taken</p>
              </div>

              <div
                className={styles.summaryCard}
                onClick={() => handleCardClick('correct')}
              >
                <ThumbsUp className={styles.summaryIcon}/>
                <span className={styles.summaryValue}>
                  {attemptOverview.total_correct}
                </span>
                <p className={styles.summaryLabel}>Correct</p>
              </div>

              <div
                className={styles.summaryCard}
                onClick={() => handleCardClick('mistake')}
              >
                <Frown className={styles.summaryIcon}/>
                <span className={styles.summaryValue}>
                  {attemptOverview.total_mistakes}
                </span>
                <p className={styles.summaryLabel}>Mistakes</p>
              </div>

              <div
                className={styles.summaryCard}
                onClick={() => handleCardClick('fixed')}
              >
                <Smile className={styles.summaryIcon}/>
                <span className={styles.summaryValue}>
                  {attemptOverview.quizzes_fixed}
                </span>
                <p className={styles.summaryLabel}>Fixed</p>
              </div>

              <div
                className={styles.summaryCard}
                onClick={() => handleCardClick('never_fixed')}
              >
                <Zap className={styles.summaryIcon}/>
                <span className={styles.summaryValue}>
                  {attemptOverview.never_fixed}
                </span>
                <p className={styles.summaryLabel}>Never Fixed</p>
              </div>
            </div>
              {openCategory && (
                <section className={styles.drillSection}>
                  <h3>
                    {{
                      taken:       "All Quizzes Taken",
                      correct:     "Quizzes You Got Right",
                      mistake:     "Quizzes You Missed",
                      fixed:       "Quizzes You Fixed",
                      never_fixed: "Quizzes You Never Fixed"
                    }[openCategory]}
                  </h3>

                  {drillLoading
                    ? <p>Loading…</p>
                    : drillError
                      ? <p className={styles.errorState}>{drillError}</p>
                      : (
                        <table className={styles.drillTable}>
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Title</th>
                              <th>Total Q’s</th>
                              <th>Go</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drillQuizzes.map(q => (
                              <tr key={q.id}>
                                <td>{q.id}</td>
                                <td>{q.title}</td>
                                <td>{q.total_questions}</td>
                                <td>
                                  <a href={quizPermalinkToUrl(q.permalink)} target="_blank" rel="noopener noreferrer">View</a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                  }
                </section>
              )}

        </section>
      )}

      {memoryProfile && (
        <>
          <section className={`${styles.dashboardSection} ${styles.highlightSection}`}>
            <h2 className={styles.sectionHeader}><Target size={28}/> Learning Snapshot</h2>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}><HelpCircle size={32} className={styles.summaryIcon}/> <span className={styles.summaryValue}>{memoryProfile.summary?.total_questions_tracked ?? 0}</span> <p className={styles.summaryLabel}>Items Tracked</p></div>
              <div className={`${styles.summaryCard} ${memoryProfile.summary?.items_due_count > 0 ? styles.summaryCardUrgent : ''}`}><Zap size={32} className={styles.summaryIcon}/> <span className={styles.summaryValue}>{memoryProfile.summary?.items_due_count ?? 0}</span> <p className={styles.summaryLabel}>Ready to Review!</p></div>
              <div className={styles.summaryCard}><Brain size={32} className={styles.summaryIcon}/> <span className={styles.summaryValue}>{memoryProfile.summary?.average_question_retention ?? 0}%</span> <p className={styles.summaryLabel}>Avg. Memory Strength</p></div>
              <div className={styles.summaryCard}><TrendingUp size={32} className={styles.summaryIcon}/> <span className={styles.summaryValue}>{memoryProfile.summary?.average_question_interval_days ?? 0}d</span> <p className={styles.summaryLabel}>Avg. Review Interval</p></div>
            </div>
          </section>

          {renderSection("Up Next: Review Time!", memoryProfile.items_to_review, 'due', loadingProfile, errorProfile, <Zap size={24} />, {icon: <ThumbsUp size={48}/>, title:"All Caught Up!", message:"Nothing needs your immediate attention. Great job!"})}
          {renderSection("Coming Soon: Practice These", memoryProfile.upcoming_review_items, 'upcoming', loadingProfile, errorProfile, <CalendarCheck2 size={24} />, {icon: <Inbox size={48}/>, title:"Nothing Scheduled Soon", message:"Keep learning new things to fill up your review calendar."})}
          {renderSection("Brain Champs: You Know These Well!", memoryProfile.strong_memory_items, 'strong', loadingProfile, errorProfile, <Star size={24} />, {icon: <Target size={48}/>, title:"Build Your Strengths", message:"Consistent review turns knowledge into mastery. Keep it up!"})}
        </>
      )}

      {renderSection("Overall Quiz Performance", quizInsights, 'insights', loadingInsights, errorInsights, <BarChartHorizontalBig size={24}/>, {icon: <BookOpenCheck size={48}/>, title:"No Quiz Insights Yet", message:"Complete some quizzes, and we'll show you how you're doing on them overall!", link: {to: "/learn", text: "Find Quizzes to Try"}})}
    </div>
  );
};

export default QuizAttempts;

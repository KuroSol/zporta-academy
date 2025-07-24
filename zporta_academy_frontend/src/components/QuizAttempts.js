import React, { useEffect, useState, useContext, useCallback } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api";
import { AuthContext } from "../context/AuthContext";
import styles from "./QuizAttempts.module.css"; // This CSS will be revamped
import { Filter } from 'lucide-react';
import {
  AlertCircle, Loader, Inbox, Brain, Zap, TrendingUp, CalendarCheck2, Star, Clock, HelpCircle, ListChecks, ChevronsRight, Smile, Meh, Frown, Target, BarChartHorizontalBig, BookOpenCheck, ThumbsUp
} from 'lucide-react';

// --- New helper for filter chips ---
 const Chip = ({ label, onRemove }) => (
   <span className={styles.chip}>
     {label} <Filter size={14} onClick={onRemove} />
   </span>
 );
 
// --- Helper Functions ---
const formatDate = (isoString) => {
  if (!isoString) return "N/A";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) {
    console.error("Error formatting date:", e, isoString);
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
        text: text,
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

// --- Card Component for Individual Memory Items ---
const MemoryItemCard = ({ item, type }) => {
  const {
    learnable_item_info,
    next_review_at,
    current_retention_estimate,
    repetitions,
    last_quality_of_recall
  } = item;

  const reviewDateInfo = getRelativeDateText(next_review_at);
  const memoryStrength = getMemoryStrengthConfig(current_retention_estimate);
  const lastEffort = getLastReviewEffortText(last_quality_of_recall);
  
  const itemTitle = learnable_item_info?.title || learnable_item_info?.display_text || "Learnable Item";
  const itemTypeForLink = learnable_item_info?.type?.toLowerCase();
  const itemIdForLink = learnable_item_info?.id;
  let reviewLink = '#';
  if (itemIdForLink) {
    if (itemTypeForLink === 'question') reviewLink = `/quizzes/question/${itemIdForLink}/review`;
    else if (itemTypeForLink === 'quiz') reviewLink = `/quizzes/${itemIdForLink}`;
  }

  let cardClass = styles.memoryItemCard;
  let typeSpecificIcon = <HelpCircle className={styles.itemTypeIconBase} />;
  if (type === 'due' || reviewDateInfo.isOverdue) {
    cardClass += ` ${styles.dueItem}`;
    typeSpecificIcon = <Zap className={`${styles.itemTypeIconBase} ${styles.dueIconAnimation}`} />;
  } else if (type === 'upcoming') {
    cardClass += ` ${styles.upcomingItem}`;
    typeSpecificIcon = <CalendarCheck2 className={`${styles.itemTypeIconBase} ${styles.upcomingIconAnimation}`} />;
  } else if (type === 'strong') {
    cardClass += ` ${styles.strongItem}`;
    typeSpecificIcon = <Star className={`${styles.itemTypeIconBase} ${styles.strongIconAnimation}`} />;
  }

  return (
    <div className={cardClass}>
      <div className={styles.cardHeader}>
        {typeSpecificIcon}
        <h4 className={styles.itemTitle}>{itemTitle}</h4>
      </div>
      
      <div className={styles.itemDetails}>
        <div className={styles.detailRow}>
          <Clock size={16} /> 
          <span>Next Review:</span> 
          <strong className={`${styles.detailValue} ${reviewDateInfo.isToday || reviewDateInfo.isOverdue ? styles.highlightReviewDate : ''}`}>
            {reviewDateInfo.text}
          </strong>
          {reviewDateInfo.text !== reviewDateInfo.fullDate && <span className={styles.fullDateTooltip}> ({reviewDateInfo.fullDate})</span>}
        </div>
        <div className={styles.detailRow}>
          <Brain size={16} />
          <span>Memory Strength:</span>
          <strong className={`${styles.detailValue} ${memoryStrength.colorClass}`}>
            {memoryStrength.icon} {memoryStrength.text} ({current_retention_estimate !== null ? `${(current_retention_estimate * 100).toFixed(0)}%` : ''})
          </strong>
        </div>
        <div className={styles.detailRow}>
          <ListChecks size={16} />
          <span>Correct Streak:</span>
          <strong className={styles.detailValue}>{repetitions ?? 0}</strong>
        </div>
        {last_quality_of_recall !== null && (
          <div className={styles.detailRow}>
            <HelpCircle size={16} /> 
            <span>Last Review Felt:</span>
            <strong className={styles.detailValue}>{lastEffort}</strong>
          </div>
        )}
      </div>
      
      {reviewLink !== '#' && (
        <Link to={reviewLink} className={`${styles.actionButton} ${type === 'due' || reviewDateInfo.isOverdue ? styles.actionButtonPrimary : styles.actionButtonSecondary}`}>
          {type === 'due' || reviewDateInfo.isOverdue ? "Review Now" : "Review"} <ChevronsRight size={18} />
        </Link>
      )}
    </div>
  );
};

// --- Component for Overall Quiz Retention Insights ---
const QuizInsightCard = ({ insight }) => {
  const memoryStrength = getMemoryStrengthConfig(insight.current_quiz_retention_estimate);
  const reviewDaysText = insight.retention_days === 0 ? "Today!" : insight.retention_days > 0 ? `in ~${insight.retention_days} days` : `Overdue`;

  return (
    <div className={`${styles.memoryItemCard} ${styles.quizInsightCard}`}>
      <div className={styles.cardHeader}>
        <BookOpenCheck className={styles.itemTypeIconBase} />
        <h4 className={styles.itemTitle}>{insight.quiz_title}</h4>
      </div>
      <p className={styles.quizInsightMessage}>{insight.message}</p>
      <div className={styles.itemDetails}>
        <div className={styles.detailRow}>
          <Clock size={16} />
          <span>Next Ideal Review:</span>
          <strong className={styles.detailValue}>{reviewDaysText}</strong>
        </div>
        {insight.current_quiz_retention_estimate !== null && (
          <div className={styles.detailRow}>
            <Brain size={16} />
            <span>Current Strength:</span>
            <strong className={`${styles.detailValue} ${memoryStrength.colorClass}`}>
              {memoryStrength.icon} {memoryStrength.text} ({(insight.current_quiz_retention_estimate * 100).toFixed(0)}%)
            </strong>
          </div>
        )}
      </div>
      <p className={styles.lastAttemptText}>Last Activity: {formatDate(insight.last_attempt_timestamp)}</p>
      <Link to={`/quizzes/${insight.quiz_id}`} className={`${styles.actionButton} ${styles.actionButtonView}`}>
        Go to Quiz <ChevronsRight size={18}/>
      </Link>
    </div>
  );
};

// --- Main Dashboard Component ---
const QuizAttempts = () => {
  const [errorOverview,  setErrorOverview]  = useState("");
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [errorFilters,   setErrorFilters]   = useState("");
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [memoryProfile, setMemoryProfile] = useState(null);
  const [quizInsights, setQuizInsights] = useState([]);
  const [attemptOverview, setAttemptOverview] = useState(null);
  const [filters, setFilters] = useState({ subjects: [], languages: [], locations: [] });
 
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [errorProfile, setErrorProfile] = useState("");
  const [errorInsights, setErrorInsights] = useState("");

  const { token, logout } = useContext(AuthContext);

  const fetchData = useCallback(
    async (endpoint, setData, setError, setLoading, type, params = {}) => {
      setLoading(true);
      setError("");
      try {
        const response = await apiClient.get(endpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          params,
        });
        setData(response.data);
      } catch (err) {
        setError(err.message || "Error");
      } finally {
        setLoading(false);
      }
    },
    [token, logout],
  );

  useEffect(() => {
    fetchData("/analytics/user-memory-profile/", setMemoryProfile, setErrorProfile, setLoadingProfile, 'profile');
    fetchData("/analytics/quiz-retention-insights/", setQuizInsights, setErrorInsights, setLoadingInsights, 'insights');
    fetchData("/analytics/quiz-attempt-overview/", setAttemptOverview, setErrorOverview, setLoadingOverview, 'overview');
    fetchData("/analytics/quiz-attempt-overview/", data => setFilters(data.filters), setErrorFilters, setLoadingFilters, 'filters');
 
  }, [fetchData]);

  const renderSection = (title, items, type, isLoading, errorMsg, icon, noItemsInfo) => {
    let content;
    const currentError = (type === 'due' || type === 'upcoming' || type === 'strong') ? errorProfile : errorInsights;

    if (isLoading) {
      content = <div className={styles.loadingState}><Loader size={32} className="animate-spin" /> <p>Loading {title.toLowerCase()}...</p></div>;
    } else if (currentError && (!items || items.length === 0)) { 
      content = <div className={styles.errorState}><AlertCircle size={32} /> <p>{currentError}</p></div>;
    } else if (!items || items.length === 0) {
      content = (
        <div className={styles.emptyState}>
          {noItemsInfo.icon}
          <h4>{noItemsInfo.title}</h4>
          <p>{noItemsInfo.message}</p>
          {noItemsInfo.link && <Link to={noItemsInfo.link.to} className={styles.emptyStateLink}>{noItemsInfo.link.text}</Link>}
        </div>
      );
    } else {
      content = (
        <div className={styles.itemsGrid}>
          {items.map(item => <MemoryItemCard key={`${type}-${item.id}`} item={item} type={type} />)}
        </div>
      );
    }
    return (
        <section className={styles.dashboardSection}>
            <h2 className={styles.sectionHeader}>
                {icon} {title} <span className={styles.sectionCount}>({items?.length || 0})</span>
            </h2>
            {content}
        </section>
    );
  };
  
  return (
    <div className={styles.quizAttemptsPage}>
      <header className={styles.pageMasthead}>
        <h1 className={styles.mainTitle}>Your Learning Hub</h1>
        <p className={styles.mainSubtitle}>Stay sharp! Here's what your brain is working on.</p>
      </header>

      {loadingProfile && !memoryProfile && (
          <div className={styles.fullPageLoader}><Loader size={48} className="animate-spin" /> <p>Loading Your Learning Data...</p></div>
      )}
      {errorProfile && !memoryProfile && (
          <div className={styles.fullPageError}><AlertCircle size={48} /> <p>{errorProfile}</p></div>
      )}
     {/* 1️⃣ Attempt Overview */}
     {attemptOverview && (
       <section className={styles.dashboardSection}>
         <h2 className={styles.sectionHeader}>
           <BarChartHorizontalBig size={24}/> Quiz Attempt Overview
         </h2>
         <div className={styles.summaryGrid}>
           <div className={styles.summaryCard}>
             <BookOpenCheck className={styles.summaryIcon}/>
             <span className={styles.summaryValue}>{attemptOverview.total_quizzes}</span>
             <p className={styles.summaryLabel}>Total Quizzes</p>
           </div>
           <div className={styles.summaryCard}>
             <ThumbsUp className={styles.summaryIcon}/>
             <span className={styles.summaryValue}>{attemptOverview.total_correct}</span>
             <p className={styles.summaryLabel}>Correct Answers</p>
           </div>
           <div className={styles.summaryCard}>
             <Frown className={styles.summaryIcon}/>
             <span className={styles.summaryValue}>{attemptOverview.total_mistakes}</span>
             <p className={styles.summaryLabel}>Mistakes</p>
           </div>
           <div className={styles.summaryCard}>
             <Smile className={styles.summaryIcon}/>
             <span className={styles.summaryValue}>{attemptOverview.quizzes_fixed}</span>
             <p className={styles.summaryLabel}>Fixed Quizzes</p>
           </div>
           <div className={styles.summaryCard}>
             <Zap className={styles.summaryIcon}/>
             <span className={styles.summaryValue}>{attemptOverview.never_fixed}</span>
             <p className={styles.summaryLabel}>Never Fixed</p>
           </div>
         </div>
       </section>
     )}

     {/* 2️⃣ Active Filters */}
     <section className={styles.filterSection}>
       <h2 className={styles.sectionHeader}>
         <HelpCircle size={24}/> Your Filters
       </h2>
       <div className={styles.filterChips}>
         {(filters.subjects || []).map(s => (
           <Chip key={s.id} label={s.name} onRemove={() => {/* removeSubject(s.id) */}} />
         ))}
        {(filters.languages || []).map(l => (
          <Chip key={l} label={l} onRemove={() => {/* removeLanguage(l) */}} />
        ))}

        {(filters.locations || []).map(loc => (
          <Chip key={loc} label={loc} onRemove={() => {/* removeLocation(loc) */}} />
        ))}
         <button className={styles.editFiltersButton}>
           Edit…
         </button>
       </div>
     </section>
      {memoryProfile && (
        <>
          <section className={`${styles.dashboardSection} ${styles.highlightSection}`}>
            <h2 className={styles.sectionHeader}><Target size={28}/> Learning Snapshot</h2>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                  <HelpCircle size={32} className={styles.summaryIcon}/> 
                  <span className={styles.summaryValue}>{memoryProfile.summary?.total_questions_tracked ?? 0}</span> 
                  <p className={styles.summaryLabel}>Items Tracked</p>
              </div>
              <div className={`${styles.summaryCard} ${memoryProfile.summary?.items_due_count > 0 ? styles.summaryCardUrgent : ''}`}>
                  <Zap size={32} className={styles.summaryIcon}/> 
                  <span className={styles.summaryValue}>{memoryProfile.summary?.items_due_count ?? 0}</span> 
                  <p className={styles.summaryLabel}>Ready to Review!</p>
              </div>
              <div className={styles.summaryCard}>
                  <Brain size={32} className={styles.summaryIcon}/> 
                  <span className={styles.summaryValue}>{memoryProfile.summary?.average_question_retention ?? 0}%</span> 
                  <p className={styles.summaryLabel}>Avg. Memory Strength</p>
              </div>
              <div className={styles.summaryCard}>
                  <TrendingUp size={32} className={styles.summaryIcon}/> 
                  <span className={styles.summaryValue}>{memoryProfile.summary?.average_question_interval_days ?? 0}d</span> 
                  <p className={styles.summaryLabel}>Avg. Review Interval</p>
              </div>
            </div>
          </section>
          
          {renderSection("Up Next: Review Time!", memoryProfile.items_to_review, 'due', loadingProfile, errorProfile, <Zap size={24} />, 
            {icon: <ThumbsUp size={48}/>, title:"All Caught Up!", message:"Nothing needs your immediate attention. Great job!"}
          )}
          {renderSection("Coming Soon: Practice These", memoryProfile.upcoming_review_items, 'upcoming', loadingProfile, errorProfile, <CalendarCheck2 size={24} />,
            {icon: <Inbox size={48}/>, title:"Nothing Scheduled Soon", message:"Keep learning new things to fill up your review calendar."}
          )}
          {renderSection("Brain Champs: You Know These Well!", memoryProfile.strong_memory_items, 'strong', loadingProfile, errorProfile, <Star size={24} />,
            {icon: <Target size={48}/>, title:"Build Your Strengths", message:"Consistent review turns knowledge into mastery. Keep it up!"}
          )}
        </>
      )}
      
      <section className={styles.dashboardSection}>
          <h2 className={styles.sectionHeader}>
              <BarChartHorizontalBig size={24} /> Overall Quiz Performance
          </h2>
          {loadingInsights && !quizInsights.length && (
              <div className={styles.loadingState}><Loader size={32} className="animate-spin" /> <p>Loading quiz performance...</p></div>
          )}
          {errorInsights && !quizInsights.length && (
              <div className={styles.errorState}><AlertCircle size={32}/> <p>{errorInsights}</p></div>
          )}
          {(!loadingInsights && !errorInsights && (!quizInsights || quizInsights.length === 0)) && (
              <div className={styles.emptyState}>
                  <BookOpenCheck size={48} />
                  <h4>No Quiz Insights Yet</h4>
                  <p>Complete some quizzes, and we'll show you how you're doing on them overall!</p>
                  <Link to="/explorer" className={styles.emptyStateLink}>Find Quizzes to Try</Link>
              </div>
          )}
          {quizInsights.length > 0 && (
              <div className={styles.itemsGrid}> {/* Reusing itemsGrid for quiz insights */}
              {quizInsights.map(insight => <QuizInsightCard key={`quiz-insight-${insight.quiz_id}`} insight={insight} />)}
              </div>
          )}
      </section>
    </div>
  );
};

export default QuizAttempts;

import React, { useEffect, useState, useContext, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api";
import { AuthContext } from "../context/AuthContext";
import styles from "./QuizAttempts.module.css";
import { 
  Filter, PlusCircle, Trash2, AlertCircle, Loader, Inbox, Brain, Zap, 
  TrendingUp, CalendarCheck2, Star, Clock, HelpCircle, ListChecks, 
  ChevronsRight, Smile, Meh, Frown, Target, BarChartHorizontalBig, 
  BookOpenCheck, ThumbsUp 
} from 'lucide-react';

// --- Helper Components & Functions ---

const Chip = ({ label, onRemove }) => (
  <span className={styles.chip}>
    {label}
    <Trash2 size={14} onClick={onRemove} className={styles.removeIcon} />
  </span>
);

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
  const itemTypeForLink = learnable_item_info?.type?.toLowerCase();
  const itemIdForLink = learnable_item_info?.id;
  let reviewLink = '#';
  if (itemIdForLink) {
    if (itemTypeForLink === 'question') reviewLink = `/quizzes/question/${itemIdForLink}/review`;
    else if (itemTypeForLink === 'quiz') reviewLink = `/quizzes/${itemIdForLink}`;
  }
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
      {reviewLink !== '#' && (<Link to={reviewLink} className={`${styles.actionButton} ${type === 'due' || reviewDateInfo.isOverdue ? styles.actionButtonPrimary : styles.actionButtonSecondary}`}>{type === 'due' || reviewDateInfo.isOverdue ? "Review Now" : "Review"} <ChevronsRight size={18} /></Link>)}
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
      <Link to={`/quizzes/${insight.quiz_id}`} className={`${styles.actionButton} ${styles.actionButtonView}`}>Go to Quiz <ChevronsRight size={18}/></Link>
    </div>
  );
};

// --- Editable Filter Table Component ---
const FilterManager = ({ token }) => {
  const [filters, setFilters] = useState({ interested_subjects: [], languages_spoken: [], location: "" });
  const [options, setOptions] = useState({ subjects: [], languages: [], regions: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const subjectMap = useMemo(() => new Map(options.subjects.map(s => [s.id, s.name])), [options.subjects]);
  const languageMap = useMemo(() => new Map(options.languages.map(l => [l.id, l.name])), [options.languages]);

  useEffect(() => {
    const loadAllFilterData = async () => {
      setIsLoading(true);
      setError("");
      try {
        const [prefsRes, subjectsRes, languagesRes, regionsRes] = await Promise.all([
          apiClient.get('/users/preferences/', { headers: { Authorization: `Bearer ${token}` } }),
          apiClient.get('/subjects/'), // CORRECTED URL
          apiClient.get('/feed/preferences/languages/'),
          apiClient.get('/feed/preferences/regions/')
        ]);
        setFilters(prefsRes.data);
        setOptions({
          subjects: subjectsRes.data || [],
          languages: languagesRes.data || [],
          regions: regionsRes.data || [],
        });
      } catch (err) {
        console.error("Failed to load filter data:", err);
        setError("Could not load your preferences.");
      } finally {
        setIsLoading(false);
      }
    };
    if (token) {
      loadAllFilterData();
    }
  }, [token]);

  const handleUpdatePreferences = async (payload) => {
    setIsSaving(true);
    try {
      const response = await apiClient.patch('/users/preferences/', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFilters(response.data);
    } catch (err) {
      console.error("Failed to update preferences:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const addFilterValue = (key, value) => {
    if (!value || filters[key].includes(value)) return;
    const rawValue = key === 'interested_subjects' ? parseInt(value, 10) : value;
    const updatedList = [...filters[key], rawValue];
    handleUpdatePreferences({ [key]: updatedList });
  };

  const removeFilterValue = (key, value) => {
    const updatedList = filters[key].filter(v => v !== value);
    handleUpdatePreferences({ [key]: updatedList });
  };
  
  const handleLocationChange = (e) => {
    const newLocation = e.target.value;
    if (newLocation !== filters.location) {
        setFilters(prev => ({...prev, location: newLocation}));
        handleUpdatePreferences({ location: newLocation });
    }
  };

  if (isLoading) {
    return <div className={styles.loadingState}><Loader size={24} className="animate-spin" /> <p>Loading Filters...</p></div>;
  }
  if (error) {
    return <div className={styles.errorState}><AlertCircle size={24} /> <p>{error}</p></div>;
  }

  const renderFilterRow = (type) => {
    const key = type === 'Subjects' ? 'interested_subjects' : 'languages_spoken';
    const currentValues = filters[key] || [];
    const availableOptions = type === 'Subjects' ? options.subjects : options.languages;
    const valueMap = type === 'Subjects' ? subjectMap : languageMap;
    const currentIdSet = new Set(currentValues);

    return (
      <tr key={key}>
        <td className={styles.filterType}>{type}</td>
        <td>
          <div className={styles.filterChips}>
            {currentValues.length > 0 ? currentValues.map(id => (
              <Chip
                key={id}
                label={valueMap.get(id) || id}
                onRemove={() => removeFilterValue(key, id)}
              />
            )) : <em>None selected</em>}
          </div>
        </td>
        <td>
          <select
            className={styles.addSelect}
            value=""
            onChange={(e) => addFilterValue(key, e.target.value)}
            disabled={isSaving}
          >
            <option value="">+ Add...</option>
            {availableOptions
              .filter(opt => !currentIdSet.has(opt.id))
              .map(opt => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))
            }
          </select>
        </td>
      </tr>
    );
  };

  return (
    <div className={isSaving ? styles.updatingOverlay : ''}>
      <table className={styles.filterTable}>
        <thead>
          <tr>
            <th>Type</th>
            <th>Your Selections</th>
            <th>Add New</th>
          </tr>
        </thead>
        <tbody>
          {renderFilterRow('Subjects')}
          {renderFilterRow('Languages')}
          <tr>
            <td className={styles.filterType}>Location</td>
            <td colSpan="2">
               <select
                className={styles.addSelect}
                value={filters.location || ''}
                onChange={handleLocationChange}
                disabled={isSaving}
              >
                <option value="">Select Location...</option>
                {options.regions.map(region => (
                  <option key={region.id} value={region.name}>
                    {region.name}
                  </option>
                ))}
              </select>
            </td>
          </tr>
        </tbody>
      </table>
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
        content = (<div className={styles.emptyState}>{noItemsInfo.icon}<h4>{noItemsInfo.title}</h4><p>{noItemsInfo.message}</p>{noItemsInfo.link && <Link to={noItemsInfo.link.to} className={styles.emptyStateLink}>{noItemsInfo.link.text}</Link>}</div>);
    } else {
        const CardComponent = type === 'insights' ? QuizInsightCard : MemoryItemCard;
        content = <div className={styles.itemsGrid}>{validItems.map(item => <CardComponent key={`${type}-${item.id || item.quiz_id}`} item={item} type={type} />)}</div>;
    }
    
    return <section className={styles.dashboardSection}><h2 className={styles.sectionHeader}>{icon} {title} <span className={styles.sectionCount}>({validItems.length})</span></h2>{content}</section>;
  };

  return (
    <div className={styles.quizAttemptsPage}>
      <header className={styles.pageMasthead}>
        <h1 className={styles.mainTitle}>Your Learning Hub</h1>
        <p className={styles.mainSubtitle}>Stay sharp! Here's what your brain is working on.</p>
      </header>

      {/* --- Full Page Loaders --- */}
      {(loadingProfile || loadingOverview) && !memoryProfile && !attemptOverview && (
        <div className={styles.fullPageLoader}><Loader size={48} className="animate-spin" /> <p>Loading Your Learning Data...</p></div>
      )}
      {(errorProfile || errorOverview) && !memoryProfile && !attemptOverview && (
        <div className={styles.fullPageError}><AlertCircle size={48} /> <p>{errorProfile || errorOverview}</p></div>
      )}

      {/* --- Filter Section --- */}
      <section className={styles.filterSection}>
        <h2 className={styles.sectionHeader}><Filter size={24}/> Your Content Filters</h2>
        <p className={styles.sectionDescription}>
          These settings personalize the content you see across Zporta Academy.
        </p>
        <FilterManager token={token} />
      </section>

      {/* --- Overview Section --- */}
      {attemptOverview && (
        <section className={styles.dashboardSection}>
          <h2 className={styles.sectionHeader}><BarChartHorizontalBig size={24}/> Quiz Attempt Overview</h2>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><BookOpenCheck className={styles.summaryIcon}/><span className={styles.summaryValue}>{attemptOverview.total_quizzes}</span><p className={styles.summaryLabel}>Quizzes Taken</p></div>
            <div className={styles.summaryCard}><ThumbsUp className={styles.summaryIcon}/><span className={styles.summaryValue}>{attemptOverview.total_correct}</span><p className={styles.summaryLabel}>Correct</p></div>
            <div className={styles.summaryCard}><Frown className={styles.summaryIcon}/><span className={styles.summaryValue}>{attemptOverview.total_mistakes}</span><p className={styles.summaryLabel}>Mistakes</p></div>
            <div className={styles.summaryCard}><Smile className={styles.summaryIcon}/><span className={styles.summaryValue}>{attemptOverview.quizzes_fixed}</span><p className={styles.summaryLabel}>Fixed</p></div>
            <div className={styles.summaryCard}><Zap className={styles.summaryIcon}/><span className={styles.summaryValue}>{attemptOverview.never_fixed}</span><p className={styles.summaryLabel}>Never Fixed</p></div>
          </div>
        </section>
      )}

      {/* --- Memory Profile Sections --- */}
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
      
      {/* --- Quiz Insights Section --- */}
      {renderSection("Overall Quiz Performance", quizInsights, 'insights', loadingInsights, errorInsights, <BarChartHorizontalBig size={24}/>, {icon: <BookOpenCheck size={48}/>, title:"No Quiz Insights Yet", message:"Complete some quizzes, and we'll show you how you're doing on them overall!", link: {to: "/explorer", text: "Find Quizzes to Try"}})}
    </div>
  );
};

export default QuizAttempts;

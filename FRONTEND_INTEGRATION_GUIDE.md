# Frontend Integration Task - AI Quiz Difficulty Explanations

## Overview

The backend API now returns detailed AI difficulty explanations for each quiz. This document describes what needs to be built in the frontend.

## What the API Provides

Every quiz returned by the API includes a `difficulty_explanation` object:

```javascript
quiz.difficulty_explanation = {
  difficulty_score: 672.18, // 0-1000 scale
  difficulty_level: "Very Hard", // 5-category text
  level_5: "Hard/Expert", // 5-level label with arrow
  emoji: "🔴", // Visual indicator
  confidence: 95, // 40-95%
  confidence_level: "Very High", // Text description
  explanation: "This quiz is rated...", // User-friendly explanation
  factors: {
    success_rate: 60.6, // % of users who answer correctly
    attempt_count: 71, // Total attempts
    avg_question_difficulty: 569.8, // Average question score
    reasons: [
      // List of factors
      "Moderate success rate (60.6%) - Balanced difficulty for most users",
      "Questions are challenging (avg 569.8)",
      "Based on 71 attempts - highly reliable ranking",
    ],
  },
};
```

## Frontend Tasks

### Task 1: Display Difficulty Badge on Quiz Cards

**Location**: Quiz card component (likely in Next.js `components/` folder)

**What to display**:

- Emoji indicator: `difficulty_explanation.emoji`
- Difficulty level text: `difficulty_explanation.level_5`
- Optional: Confidence percentage: `difficulty_explanation.confidence`

**Styling**:

```css
/* Color scheme for difficulty levels */
.difficulty-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: bold;
}

/* Green for easy */
.difficulty-badge.level-1 {
  background-color: #10b981;
  color: white;
}
/* Yellow for beginner-medium */
.difficulty-badge.level-2 {
  background-color: #f59e0b;
  color: white;
}
/* Orange for medium */
.difficulty-badge.level-3 {
  background-color: #f97316;
  color: white;
}
/* Red-orange for medium-hard */
.difficulty-badge.level-4 {
  background-color: #ef4444;
  color: white;
}
/* Dark red for hard */
.difficulty-badge.level-5 {
  background-color: #dc2626;
  color: white;
}
```

**Example implementation (React)**:

```jsx
function QuizCard({ quiz }) {
  const exp = quiz.difficulty_explanation;

  const getDifficultyColor = (level_5) => {
    const levelMap = {
      Beginner: "level-1",
      "Beginner ➜ Medium": "level-2",
      Medium: "level-3",
      "Medium ➜ Hard": "level-4",
      "Hard/Expert": "level-5",
    };
    return levelMap[level_5] || "level-3";
  };

  return (
    <div className="quiz-card">
      <div className={`difficulty-badge ${getDifficultyColor(exp.level_5)}`}>
        <span className="emoji">{exp.emoji}</span>
        <span className="level-text">{exp.level_5}</span>
      </div>

      <h3>{quiz.title}</h3>
      <p>{quiz.content?.slice(0, 100)}...</p>
    </div>
  );
}
```

**Acceptance Criteria**:

- [ ] Badge displays emoji + level_5 text
- [ ] Color changes based on difficulty level
- [ ] Responsive on mobile (emoji + short text visible)
- [ ] Tested with all 5 difficulty levels
- [ ] Works with right-to-left languages (if applicable)

---

### Task 2: Show Explanation Text on Hover/Tooltip

**What to display**:

- Show `difficulty_explanation.explanation` in a tooltip/popover on hover

**Example**:

```jsx
import { Tooltip } from "@radix-ui/react-tooltip"; // or your UI library

function QuizCardWithTooltip({ quiz }) {
  const exp = quiz.difficulty_explanation;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger>
        <div className={`difficulty-badge ${getDifficultyColor(exp.level_5)}`}>
          <span>{exp.emoji}</span>
          <span>{exp.level_5}</span>
        </div>
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p>{exp.explanation}</p>
        <p className="text-sm text-gray-500">
          {exp.confidence}% confidence • {exp.factors.attempt_count} attempts
        </p>
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
```

**Acceptance Criteria**:

- [ ] Tooltip appears on hover
- [ ] Shows explanation text clearly
- [ ] Shows confidence and attempt count
- [ ] Dismisses on click or move away
- [ ] Tooltip is readable on all screen sizes

---

### Task 3: Create Expandable "Why This Difficulty?" Section

**Location**: Quiz detail page (single quiz view)

**What to display**:

- Main explanation: `difficulty_explanation.explanation`
- AI factors: `difficulty_explanation.factors.reasons` (list)
- Success rate: `difficulty_explanation.factors.success_rate`
- Attempt count: `difficulty_explanation.factors.attempt_count`
- Confidence: `difficulty_explanation.confidence`

**Example HTML structure**:

```jsx
function QuizDetailPage({ quiz }) {
  const exp = quiz.difficulty_explanation;

  return (
    <div className="quiz-detail">
      <h1>{quiz.title}</h1>

      {/* Difficulty Section */}
      <section className="difficulty-analysis">
        <h2>Difficulty Analysis</h2>

        <div className="difficulty-header">
          <span className="emoji">{exp.emoji}</span>
          <div>
            <h3>{exp.level_5}</h3>
            <p className="score">Score: {exp.difficulty_score}/1000</p>
            <p className="confidence">
              AI Confidence: {exp.confidence}% ({exp.confidence_level})
            </p>
          </div>
        </div>

        <p className="explanation">{exp.explanation}</p>

        <details className="why-difficulty">
          <summary>Why this difficulty?</summary>
          <div className="details-content">
            <h4>AI Factors:</h4>
            <ul>
              {exp.factors.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>

            <div className="metrics">
              <div className="metric">
                <label>Success Rate</label>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${exp.factors.success_rate}%` }}
                  ></div>
                </div>
                <span>{exp.factors.success_rate.toFixed(1)}%</span>
              </div>

              <div className="metric">
                <label>Total Attempts</label>
                <strong>{exp.factors.attempt_count}</strong>
              </div>

              <div className="metric">
                <label>Question Difficulty</label>
                <strong>
                  {exp.factors.avg_question_difficulty.toFixed(1)}/1000
                </strong>
              </div>
            </div>

            <p className="note">
              Based on data from {exp.factors.attempt_count} user attempts
            </p>
          </div>
        </details>
      </section>
    </div>
  );
}
```

**Styling Example**:

```css
.difficulty-analysis {
  background: #f9fafb;
  border-left: 4px solid #3b82f6;
  padding: 1.5rem;
  border-radius: 0.5rem;
  margin: 2rem 0;
}

.difficulty-header {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
}

.difficulty-header .emoji {
  font-size: 2rem;
}

.difficulty-header h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1.25rem;
}

.explanation {
  font-size: 0.95rem;
  line-height: 1.6;
  color: #374151;
  margin-bottom: 1rem;
}

.why-difficulty summary {
  cursor: pointer;
  font-weight: 600;
  padding: 0.75rem;
  background: white;
  border-radius: 0.375rem;
  user-select: none;
}

.why-difficulty summary:hover {
  background: #f3f4f6;
}

.details-content {
  padding: 1rem 0.75rem;
  margin-top: 0.5rem;
}

.details-content ul {
  list-style: none;
  padding: 0;
}

.details-content li {
  padding: 0.5rem 0;
  color: #4b5563;
  border-bottom: 1px solid #e5e7eb;
}

.metrics {
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.metric {
  padding: 1rem;
  background: white;
  border-radius: 0.375rem;
}

.metric label {
  display: block;
  font-size: 0.85rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
}
```

**Acceptance Criteria**:

- [ ] Explanation text displays clearly
- [ ] Details section expands/collapses smoothly
- [ ] All AI factors listed with checkmarks
- [ ] Success rate shown with progress bar
- [ ] Attempt count and question difficulty visible
- [ ] Note about data reliability shown
- [ ] Mobile responsive (single column layout)

---

### Task 4: Quiz Listing/Browse Page with Difficulty Filter

**What to display**:

- All quizzes with difficulty badges
- Filter by difficulty level
- Sort by difficulty
- Show success rate as additional info

**Example**:

```jsx
function QuizBrowse() {
  const [quizzes, setQuizzes] = useState([]);
  const [filterLevel, setFilterLevel] = useState("all");
  const [sortBy, setSortBy] = useState("title");

  const difficultyLevels = [
    { value: "all", label: "All Difficulties" },
    { value: "Beginner", label: "🟢 Beginner" },
    { value: "Beginner ➜ Medium", label: "🟡 Beginner ➜ Medium" },
    { value: "Medium", label: "🟠 Medium" },
    { value: "Medium ➜ Hard", label: "🔶 Medium ➜ Hard" },
    { value: "Hard/Expert", label: "🔴 Hard/Expert" },
  ];

  const filteredQuizzes =
    filterLevel === "all"
      ? quizzes
      : quizzes.filter((q) => q.difficulty_explanation.level_5 === filterLevel);

  const sortedQuizzes = filteredQuizzes.sort((a, b) => {
    switch (sortBy) {
      case "difficulty":
        return (
          b.difficulty_explanation.difficulty_score -
          a.difficulty_explanation.difficulty_score
        );
      case "easiest":
        return (
          a.difficulty_explanation.difficulty_score -
          b.difficulty_explanation.difficulty_score
        );
      case "popular":
        return (
          b.difficulty_explanation.factors.attempt_count -
          a.difficulty_explanation.factors.attempt_count
        );
      default:
        return a.title.localeCompare(b.title);
    }
  });

  return (
    <div className="quiz-browse">
      <h1>Browse Quizzes</h1>

      {/* Filters */}
      <div className="filters">
        <label>Filter by Difficulty:</label>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
        >
          {difficultyLevels.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>

        <label>Sort by:</label>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="title">Title (A-Z)</option>
          <option value="difficulty">Hardest First</option>
          <option value="easiest">Easiest First</option>
          <option value="popular">Most Attempted</option>
        </select>
      </div>

      {/* Quiz Grid */}
      <div className="quiz-grid">
        {sortedQuizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} />
        ))}
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:

- [ ] Filter by all 5 difficulty levels
- [ ] Sort by difficulty (hardest/easiest)
- [ ] Sort by popularity (attempt count)
- [ ] Display difficulty badge on each card
- [ ] Show success rate percentage
- [ ] Show attempt count
- [ ] Responsive grid layout

---

### Task 5: User Dashboard - Recommended Quizzes by Difficulty

**What to display**:

- Show recommended quizzes at appropriate difficulty for user's level
- Show progress within difficulty tiers
- Suggest next difficulty level

**Example**:

```jsx
function UserDashboard({ userProfile, quizzes }) {
  const userAbility = userProfile.overall_ability_score; // e.g., 506.4

  // Categorize quizzes relative to user ability
  const tooEasy = quizzes.filter(
    (q) => q.difficulty_explanation.difficulty_score < userAbility - 100
  );
  const justRight = quizzes.filter((q) => {
    const diff = q.difficulty_explanation.difficulty_score;
    return diff >= userAbility - 100 && diff <= userAbility + 100;
  });
  const tooHard = quizzes.filter(
    (q) => q.difficulty_explanation.difficulty_score > userAbility + 100
  );

  return (
    <div className="dashboard">
      <h1>Welcome, {userProfile.name}!</h1>

      <div className="ability-section">
        <h2>Your Ability Level: {userAbility.toFixed(0)}</h2>

        <section className="recommended">
          <h3>🎯 Recommended for You</h3>
          <p>
            These quizzes match your current level ({justRight.length}{" "}
            available)
          </p>
          <div className="quiz-list">
            {justRight.slice(0, 5).map((quiz) => (
              <div key={quiz.id} className="quiz-item">
                <div className="difficulty-badge">
                  {quiz.difficulty_explanation.emoji}
                  {quiz.difficulty_explanation.level_5}
                </div>
                <h4>{quiz.title}</h4>
                <button>Start Quiz</button>
              </div>
            ))}
          </div>
        </section>

        <section className="progression">
          <h3>📈 Your Progression</h3>
          <div className="tier-progress">
            <div className="tier tier-easy">
              <span>Easy</span>
              <progress value={tooEasy.length} max={quizzes.length} />
              <span>{tooEasy.length} completed</span>
            </div>
            <div className="tier tier-current">
              <span>Current Level</span>
              <progress value={justRight.length} max={quizzes.length} />
              <span>{justRight.length} available</span>
            </div>
            <div className="tier tier-hard">
              <span>Challenge</span>
              <progress value={tooHard.length} max={quizzes.length} />
              <span>{tooHard.length} available</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:

- [ ] Show user's ability level
- [ ] Filter quizzes into 3 tiers: Too Easy, Just Right, Too Hard
- [ ] Display recommended quizzes prominently
- [ ] Show progress toward harder content
- [ ] Suggest next difficulty level
- [ ] Responsive layout

---

## Implementation Priority

**Phase 1 (Essential)** - Start here:

1. Task 1: Difficulty badge on quiz cards ⭐⭐⭐
2. Task 2: Explanation tooltip on hover ⭐⭐

**Phase 2 (Important)** - Do after Phase 1: 3. Task 3: Expandable details section ⭐⭐⭐ 4. Task 4: Filter/sort on browse page ⭐⭐

**Phase 3 (Nice to have)** - Polish features: 5. Task 5: Dashboard recommendations ⭐

---

## Testing Checklist

For each task, verify:

- [ ] Data loads from API correctly
- [ ] All 5 difficulty levels display with correct colors/emojis
- [ ] Confidence percentages show correct values
- [ ] Success rates display correctly
- [ ] Mobile responsive (test on iPhone/Android sizes)
- [ ] Works with different content lengths
- [ ] No broken styling
- [ ] Smooth transitions/animations
- [ ] Accessible to screen readers
- [ ] Works with right-to-left languages (if supported)

---

## Data Structure Reference

```typescript
interface DifficultyExplanation {
  difficulty_score: number; // 0-1000
  difficulty_level: string; // "Very Easy" | "Easy" | "Medium" | "Hard" | "Very Hard" | "Expert"
  level_5: string; // "Beginner" | "Beginner ➜ Medium" | "Medium" | "Medium ➜ Hard" | "Hard/Expert"
  emoji: string; // "🟢" | "🟡" | "🟠" | "🔶" | "🔴"
  confidence: number; // 40-95
  confidence_level: string; // "Low" | "Medium" | "High" | "Very High"
  explanation: string; // User-friendly explanation text
  factors: {
    success_rate: number; // 0-100%
    attempt_count: number; // Number of attempts
    avg_question_difficulty: number; // 0-1000
    unique_users?: number; // Number of users who attempted
    reasons: string[]; // List of factors
  };
}
```

---

## Questions?

**Q: Where do I get the quiz data with difficulty_explanation?**
A: The API endpoint `/api/quizzes/` and `/api/quizzes/<id>/` both return the `difficulty_explanation` field.

**Q: Can I customize the colors?**
A: Yes, the color mapping in Task 1 can be customized. Use your brand colors instead of the suggested ones.

**Q: What if difficulty_explanation is null or missing?**
A: Handle gracefully by showing a default "Difficulty Unknown" state. The field should always be present, but add error handling just in case.

**Q: How should I handle quizzes with no attempts?**
A: They'll have a difficulty_score of 400.0 (neutral) and 40% confidence. Display them as "Medium" with a note about limited data.

---

## Next Steps

1. Copy this document into your frontend project
2. Start with Task 1 (difficulty badge on cards)
3. Test with real API data
4. Move to Task 2 (tooltip), then Task 3 (details)
5. Add filtering and sorting (Task 4)
6. Optional: Dashboard recommendations (Task 5)

**Backend support ready. Let's build! 🚀**

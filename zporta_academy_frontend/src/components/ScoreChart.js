// src/components/ScoreChart.js

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
  Pie,
  Cell, 
} from 'recharts';
import './ScoreChart.css';

export default function ScoreChart({ score, target = 85 }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const data = [{ name: 'My Score', value: clampedScore }];

  const getBarColor = (value) => {
    if (value >= target) return '#16a34a'; // green
    if (value >= 50) return '#f59e0b';     // amber
    return '#dc2626';                      // red
  };

  const gap = clampedScore - target;
  const summaryText =
    gap === 0
      ? 'Perfect! You hit the target.'
      : gap > 0
      ? `Great! You're ${gap}% above your goal.`
      : `You’re ${Math.abs(gap)}% below target. Keep going!`;

  const summaryColor =
    gap === 0 ? '#16a34a' : gap > 0 ? '#16a34a' : '#dc2626';

  return (
    <div className="user-score-container">
      <ResponsiveContainer width={150} height={60}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
        >
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
            formatter={(v) => [`${v}%`, 'Score']}
          />
          <Bar dataKey="value" radius={[10, 10, 10, 10]} isAnimationActive>
            <LabelList
              dataKey="value"
              position="right"
              formatter={(val) => `${val}%`}
              style={{ fontSize: 12, fontWeight: 600, fill: '#374151' }}
            />
            <Cell fill={getBarColor(clampedScore)} />
          </Bar>
          <ReferenceLine
            x={target}
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="4 2"
            label={{
              position: 'top',
              value: `Target ${target}%`,
              fill: '#6366f1',
              fontSize: 11,
              fontWeight: 600,
              offset: 10
            }}
          />
        </BarChart>
      </ResponsiveContainer>
      <div
        className="score-description"
        style={{ color: summaryColor }}
      >
        {summaryText}
      </div>
    </div>
  );
}

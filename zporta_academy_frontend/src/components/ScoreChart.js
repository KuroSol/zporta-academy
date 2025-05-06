// src/components/ScoreChart.js

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  LabelList
} from 'recharts';
import './ScoreChart.css';

export default function ScoreChart({ score }) {
  const clampedScore = Math.max(0, Math.min(100, score));

  const data = [
    { name: 'Score', value: clampedScore },
  ];

  const getBarColor = (score) => {
    if (score >= 80) return '#27ae60'; // green
    if (score >= 50) return '#e67e22'; // orange
    return '#c0392b'; // red
  };

  return (
    <div className="user-score-container">
      <ResponsiveContainer width={120} height={60}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <XAxis type="number" hide domain={[0, 100]} />
          <YAxis type="category" dataKey="name" hide />
          <Bar dataKey="value" radius={[5, 5, 5, 5]}>
            <Cell fill={getBarColor(clampedScore)} />
            <LabelList dataKey="value" position="right" formatter={(v) => `${v}%`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

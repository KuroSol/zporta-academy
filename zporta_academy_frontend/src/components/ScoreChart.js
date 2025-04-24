// src/components/ScoreChart.js

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import './ScoreChart.css';

// COLORS: index 0 = filled score, index 1 = remaining
const COLORS = ['#ffc107', '#e0e0e0'];

export default function ScoreChart({ score }) {
  // Clamp score between 0 and 100
  const percent = Math.max(0, Math.min(100, score));
  const data = [
    { name: 'Score',     value: percent },
    { name: 'Remaining', value: 100 - percent }
  ];

  return (
    <ResponsiveContainer width={120} height={120}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          startAngle={90}
          endAngle={-270}
          innerRadius={40}
          outerRadius={55}
          paddingAngle={0}
          isAnimationActive={false}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index]}
              stroke="none"
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${value}%`, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}




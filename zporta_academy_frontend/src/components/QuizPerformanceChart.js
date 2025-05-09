import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from 'recharts';

const COLORS = ['#16a34a', '#dc2626'];

export default function QuizPerformanceChart({ total, correct }) {
  const wrong = total - correct;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  const data = [
    { name: 'Correct', value: correct },
    { name: 'Wrong', value: wrong },
  ];

  return (
    <ResponsiveContainer width={80} height={80}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={25}
          outerRadius={35}
          startAngle={90}
          endAngle={-270}
          isAnimationActive
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index]} stroke="none" />
          ))}
        </Pie>
        <text
          x="50%" y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: '14px', fontWeight: 'bold', fill: '#1f2937' }}
        >
          {percent}%
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}

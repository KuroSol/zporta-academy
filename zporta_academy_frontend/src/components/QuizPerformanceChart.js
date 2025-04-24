// src/components/QuizPerformanceChart.js
import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
  // Removed Legend from import
} from "recharts";

// Colors map: 0=Correct (Green), 1=Wrong (Red), 2=Other (Blue)
const COLORS = ["#4CAF50", "#F44336", "#2196F3"];

export default function QuizPerformanceChart({ total, correct, wrong }) {
  // Calculate data, ensuring 'Other' is only included if needed
  const otherValue = total - (correct + wrong);
  const baseData = [
    { name: "Correct", value: correct },
    { name: "Wrong",   value: wrong },
  ];
  if (otherValue > 0) {
      baseData.push({ name: "Other", value: otherValue });
  }

  // Filter out segments with zero value
  const data = baseData.filter(d => d.value > 0);

  // Determine colors based on the names present in the filtered data
  const currentColors = data.map(entry => {
      if (entry.name === "Correct") return COLORS[0];
      if (entry.name === "Wrong") return COLORS[1];
      if (entry.name === "Other") return COLORS[2];
      return "#CCCCCC"; // Fallback color
  });


  // Handle the case where there is no data
  if (data.length === 0) {
    return (
        <ResponsiveContainer width={120} height={120}> {/* Use fixed size for placeholder */}
            <div style={{ textAlign: 'center', color: '#999', fontSize: '12px', paddingTop: '40px' }}>No data</div>
        </ResponsiveContainer>
    );
  }

  return (
    // Keep ResponsiveContainer to respect CSS sizing
    <ResponsiveContainer width="100%" height="100%" aspect={1}>
      <PieChart width={120} height={120}> {/* Base size */}
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={35}
          outerRadius={48}
          fill="#8884d8"
          labelLine={false}
          paddingAngle={0} // Keep padding at 0
          // No label prop
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={currentColors[index]} stroke={currentColors[index]} />
          ))}
        </Pie>
        {/* Keep Tooltip for hover details */}
        <Tooltip />
        {/* --- REMOVED LEGEND --- */}
        {/* <Legend ... /> */}
        {/* --- END REMOVAL --- */}
      </PieChart>
    </ResponsiveContainer>
  );
}
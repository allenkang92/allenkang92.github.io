import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { subject: 'Data Analysis & Science', A: 85, fullMark: 100 },
  { subject: 'Interdisciplinary Research', A: 80, fullMark: 100 },
  { subject: 'Science Communication', A: 75, fullMark: 100 },
  { subject: 'Databases', A: 70, fullMark: 100 },
  { subject: 'Data Processing', A: 65, fullMark: 100 },
  { subject: 'Programming Languages', A: 60, fullMark: 100 },
  { subject: 'MLOps', A: 70, fullMark: 100 },
  { subject: 'Scientific Knowledge', A: 85, fullMark: 100 },
];

const SkillRadarChart = () => {
  return (
    <ResponsiveContainer width="100%" height={500}>
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="subject" />
        <PolarRadiusAxis angle={30} domain={[0, 100]} />
        <Radar name="Skills" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export default SkillRadarChart;
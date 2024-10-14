import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { subject: 'Data Analysis & Science', value: 55, fullMark: 100 },
  { subject: 'Interdisciplinary Research', value: 80, fullMark: 100 },
  { subject: 'Science Communication', value: 80, fullMark: 100 },
  { subject: 'Databases', value: 70, fullMark: 100 },
  { subject: 'Data Processing', value: 75, fullMark: 100 },
  { subject: 'Programming Languages', value: 55, fullMark: 100 },
  { subject: 'MLOps', value: 60, fullMark: 100 },
  { subject: 'Scientific Knowledge', value: 80, fullMark: 100 },
];

const SkillRadarChart = () => {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px', maxWidth: '600px', margin: '0 auto' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: '10px', fill: '#666' }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: '10px' }} />
          <Radar name="Skills" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SkillRadarChart;
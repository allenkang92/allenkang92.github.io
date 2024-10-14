import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { subject: ['Scientific', 'Knowledge'], value: 80, fullMark: 100 },
  { subject: ['Interdisciplinary', 'Research'], value: 80, fullMark: 100 },
  { subject: 'Data Analysis', value: 55, fullMark: 100 },
  { subject: 'Data Management', value: 70, fullMark: 100 },
  { subject: ['Programming', 'Languages'], value: 55, fullMark: 100 },
  { subject: 'MLOps', value: 60, fullMark: 100 },
  { subject: ['Science', 'Communication'], value: 80, fullMark: 100 },
  { subject: ['Data', 'Visualization'], value: 75, fullMark: 100 },
];

const SkillRadarChart = () => {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px', maxWidth: '600px', margin: '0 auto' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fontSize: '10px', fill: '#A8E1DB' }} 
            tickMargin={20}  // 축과 글씨 사이 간격
          />
          <PolarRadiusAxis 
            angle={45} 
            domain={[0, 100]} 
            tick={{ fontSize: '13px', fill: '#000000', fontWeight: 'bold' }}  // 텍스트 색상 및 볼드 처리
          />
          <Radar 
            name="Skills" 
            dataKey="value" 
            stroke="#A8E1DB" 
            fill="#A8E1DB" 
            fillOpacity={0.6}  // 민트색으로 채우기
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SkillRadarChart;

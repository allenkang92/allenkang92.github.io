import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { subject: 'Scientific Knowledge', value: 80, fullMark: 100 },
  { subject: 'Interdisciplinary Research', value: 80, fullMark: 100 },
  { subject: 'Data Analysis', value: 55, fullMark: 100 },
  { subject: 'Data Management', value: 70, fullMark: 100 },
  { subject: 'Programming Languages', value: 55, fullMark: 100 },
  { subject: 'MLOps', value: 60, fullMark: 100 },
  { subject: 'Science Communication', value: 80, fullMark: 100 },
  { subject: 'Data Visualization', value: 75, fullMark: 100 },
];

// 커스텀 tick 컴포넌트 생성 (두 줄로 나누기)
const renderCustomTick = ({ payload, x, y }) => {
  const lines = payload.value.split(' '); 
  return (
    <text x={x} y={y} textAnchor="middle" fill="#000000" fontSize="12px"> 
      {lines.map((line, index) => (
        <tspan x={x} dy={index * 16} key={index}>{line}</tspan> 
      ))}
    </text>
  );
};

const SkillRadarChart = () => {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px', maxWidth: '600px', margin: '0 auto' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart outerRadius="70%" data={data}>  {/* outerRadius 줄임 */}
          <PolarGrid />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={renderCustomTick} 
            tickMargin={80} // 간격을 더 넓게 설정
          />
          <PolarRadiusAxis 
            angle={60} // 각도 조정
            domain={[0, 100]} 
            tick={{ fontSize: '10px', fill: '#000000', fontWeight: 'bold' }}  
          />
          <Radar 
            name="Skills" 
            dataKey="value" 
            stroke="#A8E1DB" 
            fill="#A8E1DB" 
            fillOpacity={0.6} 
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SkillRadarChart;

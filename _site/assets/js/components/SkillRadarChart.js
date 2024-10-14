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
        <tspan x={x} dy={index * 20} key={index}>{line}</tspan>  // 줄 간격 늘림
      ))}
    </text>
  );
};

const SkillRadarChart = () => {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px', maxWidth: '600px', margin: '0 auto' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={renderCustomTick} 
            tickMargin={60} // 축과 텍스트 간의 간격 조정
          />
          <PolarRadiusAxis 
            angle={45} 
            domain={[0, 100]} 
            tick={{ fontSize: '7px', fill: '#000000', fontWeight: 'bold' }}  
          />
          <Radar 
            name="Skills" 
            dataKey="value" 
            stroke="#A8E1DB" 
            fill="#A8E1DB" 
            fillOpacity={0.6} 
          />
          <Legend wrapperStyle={{ paddingTop: '40px' }} />  {/* 범례와 차트 사이의 간격 크게 설정 */}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SkillRadarChart;

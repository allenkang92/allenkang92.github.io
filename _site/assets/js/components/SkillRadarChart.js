import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';

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

// 커스텀 tick 컴포넌트 생성 (두 줄로 나누기 및 패딩 추가)
const renderCustomTick = ({ payload, x, y }) => {
  const lines = payload.value.split(' ');
  const padding = 15;
  return (
    <text x={x} y={y - padding} textAnchor="middle" fill="#000000" fontSize="11px">
      {lines.map((line, index) => (
        <tspan x={x} dy={index * 13} key={index}>{line}</tspan>
      ))}
    </text>
  );
};

const SkillRadarChart = () => {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '600px', maxWidth: '700px', margin: '0 auto', paddingBottom: '150px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart outerRadius="75%" data={data}>  
          <PolarGrid />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={renderCustomTick} 
            tickMargin={30} 
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
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SkillRadarChart;

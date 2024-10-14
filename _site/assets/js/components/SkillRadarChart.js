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

// 커스텀 tick 컴포넌트 생성 (두 줄로 나누기 및 패딩 추가)
const renderCustomTick = ({ payload, x, y }) => {
  const lines = payload.value.split(' '); // 띄어쓰기 기준으로 두 줄로 나눔
  const padding = 15;  // 패딩 값 추가
  return (
    <text x={x} y={y - padding} textAnchor="middle" fill="#000000" fontSize="12px">  {/* 글꼴 크기 설정 및 패딩 반영 */}
      {lines.map((line, index) => (
        <tspan x={x} dy={index * 15} key={index}>{line}</tspan> // 두 줄로 나누어 출력, 줄 간격도 조정 가능
      ))}
    </text>
  );
};

const SkillRadarChart = () => {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', maxWidth: '700px', margin: '0 auto' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart outerRadius="85%" data={data}>  {/* outerRadius 값을 85%로 설정 */}
          <PolarGrid />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={renderCustomTick} 
            tickMargin={30} 
          />
          <PolarRadiusAxis 
            angle={45} 
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

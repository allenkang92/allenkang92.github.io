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
  const lines = payload.value.split(' '); // 띄어쓰기 기준으로 두 줄로 나눔
  return (
    <text x={x} y={y} textAnchor="middle" fontSize="12px" fill="#A8E1DB">  {/* 텍스트 색상 및 폰트 크기 설정 */}
      {lines.map((line, index) => (
        <tspan x={x} dy={index * 20} key={index}>{line}</tspan> // 줄 간격 더 넓게 설정
      ))}
    </text>
  );
};

const SkillRadarChart = () => {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px', maxWidth: '600px', margin: '0 auto' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart outerRadius="65%" data={data}>
          <PolarGrid />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={renderCustomTick} // 커스텀 tick 사용
            tickMargin={50} // 축과 텍스트 간의 간격 조정
          />
          <PolarRadiusAxis 
            angle={45} 
            domain={[0, 100]} 
            tick={{ fontSize: '10px', fill: '#000000', fontWeight: 'bold' }}  // 텍스트 색상 및 볼드 처리
          />
          <Radar 
            name="Skills" 
            dataKey="value" 
            stroke="#A8E1DB" 
            fill="#A8E1DB" 
            fillOpacity={0.6} // 레이더 색상 및 투명도 설정
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SkillRadarChart;

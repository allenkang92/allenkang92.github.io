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
    <div style={{ 
      width: '100%', 
      height: '600px', 
      maxWidth: '600px', 
      margin: '0 auto', 
      paddingBottom: '100px' 
    }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart outerRadius="70%" data={data}>  
          <PolarGrid />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={renderCustomTick} 
            tickMargin={30} 
          />
          <PolarRadiusAxis 
            angle={45} 
            domain={[0, 100]} 
            tick={{ fontSize: '8px', fill: '#000000', fontWeight: 'bold' }}  
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
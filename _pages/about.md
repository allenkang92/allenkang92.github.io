---
layout: default
title: About
permalink: /about/
---

{% include_relative about_me_all.md %}

<div class="radar-chart-container">
  <div id="skillRadarChart"></div>
</div>

<script src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/recharts/umd/Recharts.min.js"></script>

<script>
const data = [
  { subject: 'Data Analysis & Science', value: 85, fullMark: 100 },
  { subject: 'Interdisciplinary Research', value: 80, fullMark: 100 },
  { subject: 'Science Communication', value: 75, fullMark: 100 },
  { subject: 'Databases', value: 70, fullMark: 100 },
  { subject: 'Data Processing', value: 65, fullMark: 100 },
  { subject: 'Programming Languages', value: 60, fullMark: 100 },
  { subject: 'MLOps', value: 70, fullMark: 100 },
  { subject: 'Scientific Knowledge', value: 85, fullMark: 100 },
];

const SkillRadarChart = () => {
  const { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } = Recharts;
  
  return React.createElement(RadarChart, {
    width: 500,
    height: 400,
    data: data,
    style: { margin: '0 auto' }
  },
    React.createElement(PolarGrid),
    React.createElement(PolarAngleAxis, { dataKey: 'subject' }),
    React.createElement(PolarRadiusAxis),
    React.createElement(Radar, {
      name: 'Skills',
      dataKey: 'value',
      stroke: '#8884d8',
      fill: '#8884d8',
      fillOpacity: 0.6
    })
  );
};

document.addEventListener('DOMContentLoaded', function() {
  ReactDOM.render(
    React.createElement(SkillRadarChart),
    document.getElementById('skillRadarChart')
  );
});
</script>

---
layout: default
title: About
permalink: /about/
---

{% include_relative about_me_all.md %}

<div class="radar-chart-container">
  <div id="skillRadarChart"></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/react@17/umd/react.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@17/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/recharts@2.1.12/umd/Recharts.min.js"></script>

<script>
document.addEventListener('DOMContentLoaded', function() {
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined' || typeof Recharts === 'undefined') {
    console.error('Required libraries not loaded');
    return;
  }

  const { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } = Recharts;
  
  const data = [
    { subject: 'Data Analysis & Science', value: 85 },
    { subject: 'Interdisciplinary Research', value: 80 },
    { subject: 'Science Communication', value: 75 },
    { subject: 'Databases', value: 70 },
    { subject: 'Data Processing', value: 65 },
    { subject: 'Programming Languages', value: 60 },
    { subject: 'MLOps', value: 70 },
    { subject: 'Scientific Knowledge', value: 85 }
  ];

  const SkillRadarChart = () => 
    React.createElement(RadarChart, {
      width: 500,
      height: 400,
      data: data,
      margin: { top: 20, right: 20, bottom: 20, left: 20 }
    },
      React.createElement(PolarGrid),
      React.createElement(PolarAngleAxis, { dataKey: 'subject' }),
      React.createElement(PolarRadiusAxis, { angle: 30 }),
      React.createElement(Radar, {
        name: 'Skills',
        dataKey: 'value',
        stroke: '#8884d8',
        fill: '#8884d8',
        fillOpacity: 0.6
      })
    );

  const container = document.getElementById('skillRadarChart');
  if (container) {
    ReactDOM.render(React.createElement(SkillRadarChart), container);
  }
});
</script>

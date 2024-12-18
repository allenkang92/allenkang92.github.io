---
layout: default
title: About
permalink: /about/
---

{% include_relative about_me_all.md %}

<div class="radar-chart-container">
  <div id="skillRadarChart"></div>
</div>

<script crossorigin src="https://unpkg.com/react@17/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"></script>
<script crossorigin src="https://unpkg.com/recharts@2.1.12/umd/Recharts.js"></script>

<script>
window.addEventListener('load', function() {
  const { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } = Recharts;
  
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

  function SkillRadarChart() {
    return React.createElement(ResponsiveContainer, { width: '100%', height: 400 },
      React.createElement(RadarChart, { data: data },
        React.createElement(PolarGrid),
        React.createElement(PolarAngleAxis, { dataKey: 'subject' }),
        React.createElement(PolarRadiusAxis, { domain: [0, 100] }),
        React.createElement(Radar, {
          name: 'Skills',
          dataKey: 'value',
          stroke: '#8884d8',
          fill: '#8884d8',
          fillOpacity: 0.6
        })
      )
    );
  }

  const container = document.getElementById('skillRadarChart');
  if (container) {
    ReactDOM.render(React.createElement(SkillRadarChart), container);
  }
});
</script>

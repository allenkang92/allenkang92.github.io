import React from 'react';
import ReactDOM from 'react-dom';
import AboutPage from './components/AboutPage';
import SkillRadarChart from './components/SkillRadarChart';

// #about-page에 AboutPage 컴포넌트 렌더링
document.addEventListener('DOMContentLoaded', () => {
  const aboutPageContainer = document.getElementById('about-page');
  if (aboutPageContainer) {
    ReactDOM.render(<AboutPage />, aboutPageContainer);
  }

  // #skill-chart에 SkillRadarChart 컴포넌트 렌더링
  const skillChartContainer = document.getElementById('skill-chart');
  if (skillChartContainer) {
    ReactDOM.render(<SkillRadarChart />, skillChartContainer);
  }
});

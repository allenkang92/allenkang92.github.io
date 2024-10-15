import React from 'react';
import ReactDOM from 'react-dom';
import SkillRadarChart from './components/SkillRadarChart'; // 컴포넌트 경로 지정
import AboutPage from './components/AboutPage'; // AboutPage도 추가

document.addEventListener('DOMContentLoaded', () => {
  const chartContainer = document.getElementById('skill-chart');
  const aboutContainer = document.getElementById('about-page');

  if (chartContainer) {
    ReactDOM.render(<SkillRadarChart />, chartContainer); // SkillRadarChart를 특정 컨테이너에 렌더링
  }

  if (aboutContainer) {
    ReactDOM.render(<AboutPage />, aboutContainer); // AboutPage를 특정 컨테이너에 렌더링
  }
});

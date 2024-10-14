import React from 'react';
import ReactDOM from 'react-dom';
import SkillRadarChart from './SkillRadarChart';

document.addEventListener('DOMContentLoaded', () => {
  const chartContainer = document.getElementById('skill-chart');
  if (chartContainer) {
    ReactDOM.render(<SkillRadarChart />, chartContainer);
  }
});
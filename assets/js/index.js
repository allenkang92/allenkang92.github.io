import React from 'react';
import ReactDOM from 'react-dom';
import AboutPage from './components/AboutPage';
import SkillRadarChart from './components/SkillRadarChart';
import { BasicCalculator, PhysicsCalculator } from './calculators';

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

  const basicCalc = new BasicCalculator();
  const physicsCalc = new PhysicsCalculator();

  // 기본 계산기 이벤트 리스너
  const keys = document.querySelector('.calculator-keys');
  if (keys) {
    keys.addEventListener('click', event => {
      const { target } = event;
      const { value } = target;

      if (!target.matches('button')) {
        return;
      }

      switch (value) {
        case '+':
        case '-':
        case '*':
        case '/':
          basicCalc.handleOperator(value);
          break;
        case '=':
          basicCalc.handleOperator(value);
          break;
        case '.':
          basicCalc.inputDecimal(value);
          break;
        case 'clear':
          basicCalc.reset();
          break;
        default:
          if (Number.isInteger(parseFloat(value))) {
            basicCalc.inputDigit(value);
          }
      }

      basicCalc.updateDisplay(document.querySelector('.calculator-screen'));
    });
  }

  // 탭 전환 함수
  window.switchTab = function(tabName) {
    document.querySelectorAll('.calculator-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.remove('active');
    });
    
    document.getElementById(tabName + '-calculator').classList.add('active');
    event.target.classList.add('active');
  };

  // 물리량 계산기 함수들
  window.updatePhysicsInputs = function() {
    const formula = document.getElementById('physics-formula').value;
    const inputsDiv = document.getElementById('physics-inputs');
    const formulaDisplay = document.getElementById('physics-formula-display');
    
    let inputs = '';
    let formulaText = '';
    
    switch(formula) {
      case 'velocity':
        inputs = `
          <div class="input-group">
            <input type="number" id="distance" placeholder="거리">
            <select id="distance-unit">
              <option value="m">m</option>
              <option value="km">km</option>
            </select>
          </div>
          <div class="input-group">
            <input type="number" id="time" placeholder="시간">
            <select id="time-unit">
              <option value="s">s</option>
              <option value="h">h</option>
            </select>
          </div>
        `;
        formulaText = 'v = d/t';
        break;
      case 'acceleration':
        inputs = `
          <div class="input-group">
            <input type="number" id="velocity-change" placeholder="속도 변화">
            <select id="velocity-unit">
              <option value="m/s">m/s</option>
              <option value="km/h">km/h</option>
            </select>
          </div>
          <div class="input-group">
            <input type="number" id="time" placeholder="시간">
            <select id="time-unit">
              <option value="s">s</option>
              <option value="h">h</option>
            </select>
          </div>
        `;
        formulaText = 'a = Δv/t';
        break;
    }
    
    inputsDiv.innerHTML = inputs;
    formulaDisplay.textContent = formulaText;
  };

  window.calculatePhysics = function() {
    const formula = document.getElementById('physics-formula').value;
    const resultDiv = document.getElementById('physics-result');
    let result = '';
    
    switch(formula) {
      case 'velocity':
        const distance = parseFloat(document.getElementById('distance').value);
        const time = parseFloat(document.getElementById('time').value);
        const distanceUnit = document.getElementById('distance-unit').value;
        const timeUnit = document.getElementById('time-unit').value;
        
        const velocity = physicsCalc.calculateVelocity(distance, time, distanceUnit, timeUnit);
        result = physicsCalc.formatResult(velocity, 'm/s');
        break;
      
      case 'acceleration':
        const velocityChange = parseFloat(document.getElementById('velocity-change').value);
        const accTime = parseFloat(document.getElementById('time').value);
        const velocityUnit = document.getElementById('velocity-unit').value;
        const accTimeUnit = document.getElementById('time-unit').value;
        
        const acceleration = physicsCalc.calculateAcceleration(velocityChange, accTime, velocityUnit, accTimeUnit);
        result = physicsCalc.formatResult(acceleration, 'm/s²');
        break;
    }
    
    resultDiv.textContent = result;
  };
});

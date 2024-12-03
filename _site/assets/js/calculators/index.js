import { BasicCalculator } from './BasicCalculator';
import { PhysicsCalculator } from './PhysicsCalculator';
import { UnitConverter } from './UnitConverter';

document.addEventListener('DOMContentLoaded', () => {
  const basicCalc = new BasicCalculator();
  const physicsCalc = new PhysicsCalculator();
  const unitConverter = new UnitConverter();

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

    // 단위변환기 탭이 선택되었을 때 카테고리 옵션 초기화
    if (tabName === 'unit') {
      const categorySelect = document.getElementById('unit-category');
      if (categorySelect && !categorySelect.options.length) {
        const categories = unitConverter.getCategories();
        categorySelect.innerHTML = '<option value="">단위 종류 선택</option>' +
          categories.map(category => `<option value="${category}">${getCategoryName(category)}</option>`).join('');
      }
    }
  };

  // 단위 종류별 한글 이름
  function getCategoryName(category) {
    const names = {
      length: '길이',
      weight: '무게',
      temperature: '온도',
      area: '면적',
      volume: '부피'
    };
    return names[category] || category;
  }

  // 단위 카테고리 변경 이벤트 핸들러
  window.updateUnitOptions = function() {
    const category = document.getElementById('unit-category').value;
    const fromUnitSelect = document.getElementById('from-unit');
    const toUnitSelect = document.getElementById('to-unit');
    
    if (category) {
      const unitOptions = unitConverter.getUnitOptions(category);
      fromUnitSelect.innerHTML = '<option value="">단위 선택</option>' + unitOptions;
      toUnitSelect.innerHTML = '<option value="">단위 선택</option>' + unitOptions;
    } else {
      fromUnitSelect.innerHTML = '<option value="">단위 선택</option>';
      toUnitSelect.innerHTML = '<option value="">단위 선택</option>';
    }
  };

  // 단위 변환 실행
  window.performConversion = function() {
    const category = document.getElementById('unit-category').value;
    const fromUnit = document.getElementById('from-unit').value;
    const toUnit = document.getElementById('to-unit').value;
    const value = document.getElementById('unit-value').value;
    const resultDiv = document.getElementById('unit-result');

    if (!category || !fromUnit || !toUnit || value === '') {
      resultDiv.textContent = '모든 필드를 입력해주세요.';
      return;
    }

    const result = unitConverter.convert(parseFloat(value), fromUnit, toUnit, category);
    resultDiv.textContent = `${value} ${fromUnit} = ${result} ${toUnit}`;
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

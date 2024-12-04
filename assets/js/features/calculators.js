// 기본 계산기 클래스
class BasicCalculator {
  constructor() {
    this.displayValue = '0';
    this.firstOperand = null;
    this.waitingForSecondOperand = false;
    this.operator = null;
  }

  updateDisplay(display) {
    display.value = this.displayValue;
  }

  inputDigit(digit) {
    if (this.waitingForSecondOperand === true) {
      this.displayValue = digit;
      this.waitingForSecondOperand = false;
    } else {
      this.displayValue = this.displayValue === '0' ? digit : this.displayValue + digit;
    }
  }

  inputDecimal(dot) {
    if (this.waitingForSecondOperand === true) {
      this.displayValue = "0.";
      this.waitingForSecondOperand = false;
      return;
    }

    if (!this.displayValue.includes(dot)) {
      this.displayValue += dot;
    }
  }

  handleOperator(nextOperator) {
    const inputValue = parseFloat(this.displayValue);

    if (this.operator && this.waitingForSecondOperand) {
      this.operator = nextOperator;
      return;
    }

    if (this.firstOperand === null && !isNaN(inputValue)) {
      this.firstOperand = inputValue;
    } else if (this.operator) {
      const result = this.calculate(this.firstOperand, inputValue, this.operator);
      this.displayValue = `${parseFloat(result.toFixed(7))}`;
      this.firstOperand = result;
    }

    this.waitingForSecondOperand = true;
    this.operator = nextOperator;
  }

  calculate(firstOperand, secondOperand, operator) {
    if (operator === '+') return firstOperand + secondOperand;
    if (operator === '-') return firstOperand - secondOperand;
    if (operator === '*') return firstOperand * secondOperand;
    if (operator === '/') return firstOperand / secondOperand;
    return secondOperand;
  }

  reset() {
    this.displayValue = '0';
    this.firstOperand = null;
    this.waitingForSecondOperand = false;
    this.operator = null;
  }
}

// 물리량 계산기 클래스
class PhysicsCalculator {
  constructor() {
    this.units = {
      distance: { m: 1, km: 1000 },
      time: { s: 1, h: 3600 },
      velocity: { 'km/h': 3.6, 'm/s': 1 }
    };
  }

  calculateVelocity(distance, time, distanceUnit, timeUnit) {
    const convertedDistance = distance * this.units.distance[distanceUnit];
    const convertedTime = time * this.units.time[timeUnit];
    return convertedDistance / convertedTime;
  }

  calculateAcceleration(velocityChange, time, velocityUnit, timeUnit) {
    let convertedVelocity = velocityChange;
    if (velocityUnit === 'km/h') {
      convertedVelocity = velocityChange / 3.6; // Convert to m/s
    }
    const convertedTime = time * this.units.time[timeUnit];
    return convertedVelocity / convertedTime;
  }

  formatResult(value, unit) {
    return `${value.toFixed(2)} ${unit}`;
  }
}

// 계산기 초기화 및 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', () => {
  const calculator = new BasicCalculator();
  const calculatorDisplay = document.querySelector('.calculator-screen');
  const calculatorKeys = document.querySelector('.calculator-keys');

  if (calculatorKeys) {
    calculatorKeys.addEventListener('click', (event) => {
      const { target } = event;
      if (!target.matches('button')) return;

      if (target.classList.contains('operator')) {
        calculator.handleOperator(target.value);
        calculator.updateDisplay(calculatorDisplay);
        return;
      }

      if (target.classList.contains('clear')) {
        calculator.reset();
        calculator.updateDisplay(calculatorDisplay);
        return;
      }

      if (target.classList.contains('equal')) {
        calculator.handleOperator('=');
        calculator.updateDisplay(calculatorDisplay);
        return;
      }

      if (target.value === '.') {
        calculator.inputDecimal(target.value);
        calculator.updateDisplay(calculatorDisplay);
        return;
      }

      calculator.inputDigit(target.value);
      calculator.updateDisplay(calculatorDisplay);
    });
  }
});

// 탭 전환 함수
function switchTab(tabName) {
  // 모든 탭 컨텐츠 숨기기
  document.querySelectorAll('.calculator-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // 모든 탭 버튼 비활성화
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
  });
  
  // 선택된 탭 보이기
  const selectedTab = document.getElementById(tabName + '-calculator');
  if (selectedTab) {
    selectedTab.classList.add('active');
  }
  
  // 선택된 탭 버튼 활성화
  const selectedButton = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
  if (selectedButton) {
    selectedButton.classList.add('active');
  }
}

// 물리량 계산기 함수들
function updatePhysicsInputs() {
  const formula = document.getElementById('physics-formula').value;
  const inputsDiv = document.getElementById('physics-inputs');
  const formulaDisplay = document.getElementById('physics-formula-display');
  
  let html = '';
  switch(formula) {
    case 'velocity':
      html = `
        <div class="input-group">
          <label>거리 (d):</label>
          <input type="number" id="distance" placeholder="거리 입력">
          <select id="distance-unit">
            <option value="m">미터 (m)</option>
            <option value="km">킬로미터 (km)</option>
          </select>
        </div>
        <div class="input-group">
          <label>시간 (t):</label>
          <input type="number" id="time" placeholder="시간 입력">
          <select id="time-unit">
            <option value="s">초 (s)</option>
            <option value="h">시간 (h)</option>
          </select>
        </div>
      `;
      formulaDisplay.textContent = 'v = d/t';
      break;
    // 다른 물리량 케이스들 추가 가능
  }
  
  inputsDiv.innerHTML = html;
}

function calculatePhysics() {
  const formula = document.getElementById('physics-formula').value;
  const resultDiv = document.getElementById('physics-result');
  const physicsCalc = new PhysicsCalculator();
  
  switch(formula) {
    case 'velocity':
      const distance = parseFloat(document.getElementById('distance').value);
      const time = parseFloat(document.getElementById('time').value);
      const distanceUnit = document.getElementById('distance-unit').value;
      const timeUnit = document.getElementById('time-unit').value;
      
      if (isNaN(distance) || isNaN(time)) {
        resultDiv.textContent = '올바른 숫자를 입력해주세요.';
        return;
      }
      
      const velocity = physicsCalc.calculateVelocity(distance, time, distanceUnit, timeUnit);
      resultDiv.textContent = physicsCalc.formatResult(velocity, 'm/s');
      break;
    // 다른 물리량 케이스들 추가 가능
  }
}

// 단위 변환기 함수들
const unitCategories = {
  length: {
    name: '길이',
    units: {
      mm: '밀리미터 (mm)',
      cm: '센티미터 (cm)',
      m: '미터 (m)',
      km: '킬로미터 (km)',
      in: '인치 (in)',
      ft: '피트 (ft)',
      yd: '야드 (yd)',
      mi: '마일 (mi)'
    },
    conversions: {
      mm: 0.001,
      cm: 0.01,
      m: 1,
      km: 1000,
      in: 0.0254,
      ft: 0.3048,
      yd: 0.9144,
      mi: 1609.344
    }
  },
  // 다른 단위 카테고리들 추가 가능
};

function updateUnitOptions() {
  const category = document.getElementById('unit-category').value;
  const fromUnit = document.getElementById('from-unit');
  const toUnit = document.getElementById('to-unit');
  
  if (!category || !unitCategories[category]) {
    fromUnit.innerHTML = '<option value="">단위 선택</option>';
    toUnit.innerHTML = '<option value="">단위 선택</option>';
    return;
  }
  
  const units = unitCategories[category].units;
  let options = '<option value="">단위 선택</option>';
  
  for (const [key, name] of Object.entries(units)) {
    options += `<option value="${key}">${name}</option>`;
  }
  
  fromUnit.innerHTML = options;
  toUnit.innerHTML = options;
}

function performConversion() {
  const category = document.getElementById('unit-category').value;
  const value = parseFloat(document.getElementById('unit-value').value);
  const fromUnit = document.getElementById('from-unit').value;
  const toUnit = document.getElementById('to-unit').value;
  const resultDiv = document.getElementById('unit-result');
  
  if (!category || !fromUnit || !toUnit || isNaN(value)) {
    resultDiv.textContent = '모든 필드를 올바르게 입력해주세요.';
    return;
  }
  
  const conversions = unitCategories[category].conversions;
  const result = value * conversions[fromUnit] / conversions[toUnit];
  resultDiv.textContent = `${value} ${fromUnit} = ${result.toFixed(4)} ${toUnit}`;
}

// 페이지 로드 시 단위 카테고리 초기화
document.addEventListener('DOMContentLoaded', () => {
  const categorySelect = document.getElementById('unit-category');
  if (categorySelect) {
    let options = '<option value="">단위 종류 선택</option>';
    for (const [key, category] of Object.entries(unitCategories)) {
      options += `<option value="${key}">${category.name}</option>`;
    }
    categorySelect.innerHTML = options;
  }
});

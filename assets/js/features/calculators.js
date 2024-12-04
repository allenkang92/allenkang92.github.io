// 디바운스 함수
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 오류 처리 유틸리티
const ErrorMessages = {
  INVALID_NUMBER: '올바른 숫자를 입력하세요',
  DIVISION_BY_ZERO: '0으로 나눌 수 없습니다',
  MISSING_FIELDS: '모든 필드를 입력하세요',
  INVALID_INPUT: '입력값이 유효하지 않습니다',
  CALCULATION_ERROR: '계산 중 오류가 발생했습니다'
};

function showError(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = `오류: ${message}`;
  element.classList.add('error');
}

function clearError(elementId) {
  const element = document.getElementById(elementId);
  element.classList.remove('error');
}

// 기본 계산기 기능
const calculator = {
  displayValue: '0',
  firstOperand: null,
  waitingForSecondOperand: false,
  operator: null,
  
  reset() {
    this.displayValue = '0';
    this.firstOperand = null;
    this.waitingForSecondOperand = false;
    this.operator = null;
    updateDisplay();
  },
  
  inputDigit(digit) {
    const { displayValue, waitingForSecondOperand } = this;

    if (waitingForSecondOperand) {
      this.displayValue = digit;
      this.waitingForSecondOperand = false;
    } else {
      this.displayValue = displayValue === '0' ? digit : displayValue + digit;
    }
    updateDisplay();
  },
  
  inputDecimal(dot) {
    if (this.waitingForSecondOperand) {
      this.displayValue = '0.';
      this.waitingForSecondOperand = false;
      updateDisplay();
      return;
    }

    if (!this.displayValue.includes(dot)) {
      this.displayValue += dot;
      updateDisplay();
    }
  },
  
  handleOperator(nextOperator) {
    const { firstOperand, displayValue, operator } = this;
    const inputValue = parseFloat(displayValue);

    if (operator && this.waitingForSecondOperand) {
      this.operator = nextOperator;
      return;
    }

    if (firstOperand === null && !isNaN(inputValue)) {
      this.firstOperand = inputValue;
    } else if (operator) {
      try {
        const result = this.calculate(firstOperand, inputValue, operator);
        if (!isFinite(result)) {
          throw new Error(ErrorMessages.DIVISION_BY_ZERO);
        }
        this.displayValue = `${parseFloat(result.toFixed(7))}`;
        this.firstOperand = result;
      } catch (error) {
        showError('calculator-error', error.message);
        this.reset();
        return;
      }
    }

    this.waitingForSecondOperand = true;
    this.operator = nextOperator;
    updateDisplay();
  },
  
  calculate(firstOperand, secondOperand, operator) {
    switch (operator) {
      case '+': return firstOperand + secondOperand;
      case '-': return firstOperand - secondOperand;
      case '*': return firstOperand * secondOperand;
      case '/':
        if (secondOperand === 0) {
          throw new Error(ErrorMessages.DIVISION_BY_ZERO);
        }
        return firstOperand / secondOperand;
      default:
        return secondOperand;
    }
  }
};

// 물리량 계산기 기능
const physicsFormulas = {
  velocity: {
    formula: 'v = d/t',
    inputs: ['distance (m)', 'time (s)'],
    calculate: (d, t) => {
      if (t === 0) throw new Error(ErrorMessages.DIVISION_BY_ZERO);
      return d/t;
    },
    unit: 'm/s',
    validate: (inputs) => {
      if (inputs[1] <= 0) throw new Error('시간은 0보다 커야 합니다');
      if (inputs[0] < 0) throw new Error('거리는 0 이상이어야 합니다');
    }
  },
  acceleration: {
    formula: 'a = Δv/t',
    inputs: ['velocity change (m/s)', 'time (s)'],
    calculate: (v, t) => {
      if (t === 0) throw new Error(ErrorMessages.DIVISION_BY_ZERO);
      return v/t;
    },
    unit: 'm/s²',
    validate: (inputs) => {
      if (inputs[1] <= 0) throw new Error('시간은 0보다 커야 합니다');
    }
  },
  force: {
    formula: 'F = ma',
    inputs: ['mass (kg)', 'acceleration (m/s²)'],
    calculate: (m, a) => m*a,
    unit: 'N',
    validate: (inputs) => {
      if (inputs[0] <= 0) throw new Error('질량은 0보다 커야 합니다');
    }
  },
  kinetic: {
    formula: 'K = ½mv²',
    inputs: ['mass (kg)', 'velocity (m/s)'],
    calculate: (m, v) => 0.5*m*v*v,
    unit: 'J',
    validate: (inputs) => {
      if (inputs[0] <= 0) throw new Error('질량은 0보다 커야 합니다');
    }
  },
  potential: {
    formula: 'U = mgh',
    inputs: ['mass (kg)', 'height (m)'],
    calculate: (m, h) => m*9.81*h,
    unit: 'J',
    validate: (inputs) => {
      if (inputs[0] <= 0) throw new Error('질량은 0보다 커야 합니다');
      if (inputs[1] < 0) throw new Error('높이는 0 이상이어야 합니다');
    }
  }
};

// 단위 변환기 기능
const unitCategories = {
  length: {
    name: '길이',
    units: {
      mm: '밀리미터',
      cm: '센티미터',
      m: '미터',
      km: '킬로미터',
      in: '인치',
      ft: '피트',
      yd: '야드',
      mile: '마일'
    },
    conversions: {
      mm: 0.001,
      cm: 0.01,
      m: 1,
      km: 1000,
      in: 0.0254,
      ft: 0.3048,
      yd: 0.9144,
      mile: 1609.344
    }
  },
  weight: {
    name: '무게',
    units: {
      mg: '밀리그램',
      g: '그램',
      kg: '킬로그램',
      t: '톤',
      oz: '온스',
      lb: '파운드'
    },
    conversions: {
      mg: 0.000001,
      g: 0.001,
      kg: 1,
      t: 1000,
      oz: 0.0283495,
      lb: 0.453592
    }
  },
  area: {
    name: '면적',
    units: {
      mm2: '제곱밀리미터',
      cm2: '제곱센티미터',
      m2: '제곱미터',
      km2: '제곱킬로미터',
      ha: '헥타르',
      acre: '에이커',
      ft2: '제곱피트'
    },
    conversions: {
      mm2: 0.000001,
      cm2: 0.0001,
      m2: 1,
      km2: 1000000,
      ha: 10000,
      acre: 4046.86,
      ft2: 0.092903
    }
  },
  volume: {
    name: '부피',
    units: {
      ml: '밀리리터',
      l: '리터',
      m3: '세제곱미터',
      gal: '갤런(미국)',
      qt: '쿼트(미국)',
      pt: '파인트(미국)',
      cup: '컵(미국)'
    },
    conversions: {
      ml: 0.001,
      l: 1,
      m3: 1000,
      gal: 3.78541,
      qt: 0.946353,
      pt: 0.473176,
      cup: 0.236588
    }
  },
  temperature: {
    name: '온도',
    units: {
      C: '섭씨',
      F: '화씨',
      K: '켈빈'
    },
    // 온도는 특별한 변환 함수를 사용
    needsSpecialConversion: true
  },
  time: {
    name: '시간',
    units: {
      ms: '밀리초',
      s: '초',
      min: '분',
      h: '시간',
      day: '일',
      week: '주',
      month: '월(30일)',
      year: '년(365일)'
    },
    conversions: {
      ms: 0.001,
      s: 1,
      min: 60,
      h: 3600,
      day: 86400,
      week: 604800,
      month: 2592000,
      year: 31536000
    }
  }
};

// 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', function() {
  // 기본 계산기 이벤트
  const calculatorEl = document.querySelector('.calculator');
  if (calculatorEl) {
    calculatorEl.addEventListener('click', function(event) {
      const { target } = event;
      if (!target.matches('button')) return;

      const { value } = target;
      
      try {
        switch (value) {
          case '+':
          case '-':
          case '*':
          case '/':
          case '=':
            calculator.handleOperator(value);
            break;
          case '.':
            calculator.inputDecimal(value);
            break;
          case 'clear':
            calculator.reset();
            break;
          default:
            if (Number.isInteger(parseFloat(value))) {
              calculator.inputDigit(value);
            }
        }
      } catch (error) {
        showError('calculator-error', error.message);
      }
    });

    // 키보드 이벤트 처리
    document.addEventListener('keydown', function(event) {
      const key = event.key;
      
      if (key >= '0' && key <= '9') {
        calculator.inputDigit(key);
      } else if (key === '.') {
        calculator.inputDecimal(key);
      } else if (['+', '-', '*', '/'].includes(key)) {
        calculator.handleOperator(key);
      } else if (key === 'Enter') {
        calculator.handleOperator('=');
      } else if (key === 'Escape') {
        calculator.reset();
      }
    });
  }

  // 물리량 계산기 이벤트
  const physicsSelect = document.getElementById('physics-formula');
  if (physicsSelect) {
    physicsSelect.addEventListener('change', updatePhysicsInputs);
  }

  // 단위 변환기 이벤트
  const unitCategory = document.getElementById('unit-category');
  if (unitCategory) {
    Object.keys(unitCategories).forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = unitCategories[category].name;
      unitCategory.appendChild(option);
    });

    unitCategory.addEventListener('change', updateUnitOptions);
  }
});

// 화면 업데이트 함수들
function updateDisplay() {
  const display = document.querySelector('.calculator-screen');
  if (display) {
    display.value = calculator.displayValue;
    // 스크린 리더를 위한 설명 추가
    display.setAttribute('aria-label', `계산기 화면: ${calculator.displayValue}`);
  }
}

const updatePhysicsInputs = debounce(function() {
  const formula = document.getElementById('physics-formula').value;
  const inputsDiv = document.getElementById('physics-inputs');
  const formulaDisplay = document.getElementById('physics-formula-display');
  const resultDiv = document.getElementById('physics-result');

  // 이전 결과와 에러 메시지 초기화
  resultDiv.textContent = '';
  resultDiv.classList.remove('error');
  inputsDiv.innerHTML = '';
  
  if (!formula) {
    formulaDisplay.textContent = '물리량을 선택하세요';
    return;
  }

  const selectedFormula = physicsFormulas[formula];
  if (!selectedFormula) return;

  // 수식 표시
  formulaDisplay.textContent = `수식: ${selectedFormula.formula}`;

  // 입력 필드 생성
  selectedFormula.inputs.forEach((label, index) => {
    const inputGroup = document.createElement('div');
    inputGroup.className = 'form-group';

    const inputLabel = document.createElement('label');
    inputLabel.htmlFor = `physics-input-${index}`;
    inputLabel.textContent = label;

    const input = document.createElement('input');
    input.type = 'number';
    input.id = `physics-input-${index}`;
    input.className = 'physics-input';
    input.placeholder = `${label} 입력`;
    input.step = 'any';
    input.required = true;
    input.setAttribute('aria-label', label);

    inputGroup.appendChild(inputLabel);
    inputGroup.appendChild(input);
    inputsDiv.appendChild(inputGroup);
  });
}, 300);

function updateUnitOptions() {
  const category = document.getElementById('unit-category').value;
  const fromUnit = document.getElementById('from-unit');
  const toUnit = document.getElementById('to-unit');
  
  fromUnit.innerHTML = '<option value="">단위 선택</option>';
  toUnit.innerHTML = '<option value="">단위 선택</option>';
  
  if (category && unitCategories[category]) {
    Object.keys(unitCategories[category].units).forEach(unit => {
      const option1 = document.createElement('option');
      const option2 = document.createElement('option');
      option1.value = option2.value = unit;
      option1.textContent = option2.textContent = unit;
      fromUnit.appendChild(option1);
      toUnit.appendChild(option2.cloneNode(true));
    });
  }
}

// 계산 함수들
function calculatePhysics() {
  const formula = document.getElementById('physics-formula').value;
  const resultDiv = document.getElementById('physics-result');
  const selectedFormula = physicsFormulas[formula];

  if (!formula || !selectedFormula) {
    showError('physics-result', ErrorMessages.INVALID_INPUT);
    return;
  }

  // 입력값 수집
  const inputs = Array.from(document.querySelectorAll('.physics-input'))
    .map(input => parseFloat(input.value));

  try {
    // 입력값 검증
    if (!selectedFormula.validate(inputs)) {
      throw new Error(ErrorMessages.INVALID_INPUT);
    }

    // 계산 수행
    const result = selectedFormula.calculate(...inputs);
    
    if (!isFinite(result)) {
      throw new Error(ErrorMessages.CALCULATION_ERROR);
    }

    // 결과 표시
    resultDiv.textContent = `결과: ${result.toFixed(2)} ${selectedFormula.unit}`;
    resultDiv.classList.remove('error');
  } catch (error) {
    showError('physics-result', error.message);
  }
}

function performConversion() {
  const category = document.getElementById('unit-category').value;
  const fromUnit = document.getElementById('from-unit').value;
  const toUnit = document.getElementById('to-unit').value;
  const value = parseFloat(document.getElementById('unit-value').value);
  const resultDiv = document.getElementById('unit-result');

  try {
    if (!category || !fromUnit || !toUnit) {
      throw new Error(ErrorMessages.MISSING_FIELDS);
    }

    if (isNaN(value)) {
      throw new Error(ErrorMessages.INVALID_NUMBER);
    }

    let result;
    if (category === 'temperature') {
      result = convertTemperature(value, fromUnit, toUnit);
    } else {
      const fromValue = unitCategories[category].conversions[fromUnit];
      const toValue = unitCategories[category].conversions[toUnit];
      result = (value * fromValue) / toValue;
    }

    if (!isFinite(result)) {
      throw new Error(ErrorMessages.CALCULATION_ERROR);
    }

    clearError('unit-result');
    resultDiv.textContent = `${value} ${fromUnit} = ${result.toFixed(2)} ${toUnit}`;
  } catch (error) {
    showError('unit-result', error.message);
  }
}

function convertTemperature(value, from, to) {
  let celsius;
  
  // Convert to Celsius first
  switch(from) {
    case 'C': celsius = value; break;
    case 'F': celsius = (value - 32) * 5/9; break;
    case 'K': celsius = value - 273.15; break;
    default: throw new Error('잘못된 온도 단위입니다');
  }

  // Convert from Celsius to target unit
  switch(to) {
    case 'C': return celsius;
    case 'F': return celsius * 9/5 + 32;
    case 'K': return celsius + 273.15;
    default: throw new Error('잘못된 온도 단위입니다');
  }
}

// 탭 전환 함수
function switchTab(tabName) {
  // 모든 탭 버튼의 active 클래스와 aria-selected 상태 제거
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
    button.setAttribute('aria-selected', 'false');
  });

  // 선택된 탭 버튼에 active 클래스와 aria-selected 상태 추가
  const selectedButton = document.querySelector(`#${tabName}-tab`);
  selectedButton.classList.add('active');
  selectedButton.setAttribute('aria-selected', 'true');

  // 모든 계산기 탭 숨기기
  document.querySelectorAll('.calculator-tab').forEach(tab => {
    tab.classList.remove('active');
    tab.setAttribute('hidden', '');
  });

  // 선택된 계산기 탭 보이기
  const selectedTab = document.getElementById(`${tabName}-calculator`);
  selectedTab.classList.add('active');
  selectedTab.removeAttribute('hidden');
}

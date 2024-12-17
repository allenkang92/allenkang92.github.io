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
  if (element) {
    element.textContent = `오류: ${message}`;
    element.classList.add('error');
  }
}

function clearError(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.remove('error');
  }
}

// 기본 계산기 기능
class BasicCalculator {
  constructor() {
    this.displayValue = '0';
    this.firstOperand = null;
    this.waitingForSecondOperand = false;
    this.operator = null;
  }

  reset() {
    this.displayValue = '0';
    this.firstOperand = null;
    this.waitingForSecondOperand = false;
    this.operator = null;
    updateDisplay();
  }

  inputDigit(digit) {
    const { displayValue, waitingForSecondOperand } = this;

    if (waitingForSecondOperand) {
      this.displayValue = digit;
      this.waitingForSecondOperand = false;
    } else {
      this.displayValue = displayValue === '0' ? digit : displayValue + digit;
    }
    updateDisplay();
  }

  inputDecimal() {
    if (this.waitingForSecondOperand) {
      this.displayValue = '0.';
      this.waitingForSecondOperand = false;
      updateDisplay();
      return;
    }

    if (!this.displayValue.includes('.')) {
      this.displayValue += '.';
      updateDisplay();
    }
  }

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
  }

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

  getDisplayValue() {
    return this.displayValue;
  }
}

// 물리량 계산기 기능
class PhysicsCalculator {
  constructor() {
    this.formulas = [
      {
        id: 'velocity',
        name: '속도',
        formula: 'v = d/t',
        inputs: ['거리 (m)', '시간 (s)'],
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
      {
        id: 'acceleration',
        name: '가속도',
        formula: 'a = Δv/t',
        inputs: ['속도 변화 (m/s)', '시간 (s)'],
        calculate: (v, t) => {
          if (t === 0) throw new Error(ErrorMessages.DIVISION_BY_ZERO);
          return v/t;
        },
        unit: 'm/s²',
        validate: (inputs) => {
          if (inputs[1] <= 0) throw new Error('시간은 0보다 커야 합니다');
        }
      },
      {
        id: 'force',
        name: '힘',
        formula: 'F = ma',
        inputs: ['질량 (kg)', '가속도 (m/s²)'],
        calculate: (m, a) => m*a,
        unit: 'N',
        validate: (inputs) => {
          if (inputs[0] <= 0) throw new Error('질량은 0보다 커야 합니다');
        }
      },
      {
        id: 'kinetic',
        name: '운동 에너지',
        formula: 'K = ½mv²',
        inputs: ['질량 (kg)', '속도 (m/s)'],
        calculate: (m, v) => 0.5*m*v*v,
        unit: 'J',
        validate: (inputs) => {
          if (inputs[0] <= 0) throw new Error('질량은 0보다 커야 합니다');
        }
      },
      {
        id: 'potential',
        name: '위치 에너지',
        formula: 'U = mgh',
        inputs: ['질량 (kg)', '높이 (m)'],
        calculate: (m, h) => m*9.81*h,
        unit: 'J',
        validate: (inputs) => {
          if (inputs[0] <= 0) throw new Error('질량은 0보다 커야 합니다');
          if (inputs[1] < 0) throw new Error('높이는 0 이상이어야 합니다');
        }
      }
    ];
  }

  getFormulas() {
    return this.formulas;
  }

  calculate(formulaId, inputs) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) throw new Error(ErrorMessages.INVALID_INPUT);

    try {
      formula.validate(inputs);
    } catch (error) {
      throw error;
    }

    const result = formula.calculate(...inputs);
    if (!isFinite(result)) {
      throw new Error(ErrorMessages.CALCULATION_ERROR);
    }

    return { result, unit: formula.unit };
  }
}

// 단위 변환기 기능
class UnitConverter {
  constructor() {
    this.categories = {
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
  }

  getCategories() {
    return Object.keys(this.categories);
  }

  getUnits(category) {
    return Object.keys(this.categories[category].units);
  }

  convert(value, fromUnit, toUnit) {
    const category = Object.keys(this.categories).find(c => this.categories[c].units[fromUnit]);
    if (!category) throw new Error(ErrorMessages.INVALID_INPUT);

    if (category === 'temperature') {
      return this.convertTemperature(value, fromUnit, toUnit);
    }

    const fromValue = this.categories[category].conversions[fromUnit];
    const toValue = this.categories[category].conversions[toUnit];
    return (value * fromValue) / toValue;
  }

  convertTemperature(value, from, to) {
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
}

// 계산기 인스턴스 생성
const basicCalculator = new BasicCalculator();
const unitConverter = new UnitConverter();
const physicsCalculator = new PhysicsCalculator();

// 기본 계산기 이벤트 핸들러
document.addEventListener('click', (event) => {
  if (!event.target.matches('button')) return;

  try {
    if (event.target.matches('[data-number]')) {
      basicCalculator.inputDigit(event.target.textContent);
    } else if (event.target.matches('[data-operation]')) {
      basicCalculator.handleOperator(event.target.textContent);
    } else if (event.target.matches('[data-decimal]')) {
      basicCalculator.inputDecimal();
    } else if (event.target.matches('[data-clear]')) {
      basicCalculator.reset();
    }
    updateDisplay();
  } catch (error) {
    showError('calculator-error', error.message);
  }
});

// 물리량 계산기 이벤트 핸들러
const updatePhysicsInputs = debounce(() => {
  try {
    const formula = document.getElementById('physics-formula').value;
    const inputsDiv = document.getElementById('physics-inputs');
    const formulaDisplay = document.getElementById('physics-formula-display');
    
    if (!formula) return;
    
    const selectedFormula = physicsCalculator.getFormulas().find(f => f.id === formula);
    if (!selectedFormula) return;
    
    formulaDisplay.textContent = selectedFormula.formula;
    
    inputsDiv.innerHTML = selectedFormula.inputs.map((input, index) => `
      <div class="input-group">
        <label for="physics-input-${index}">${input}</label>
        <input type="number" id="physics-input-${index}" step="any">
      </div>
    `).join('');
  } catch (error) {
    showError('physics-error', error.message);
  }
}, 300);

// 단위 변환기 이벤트 핸들러
const updateUnitOptions = debounce(() => {
  try {
    const category = document.getElementById('unit-category').value;
    const fromSelect = document.getElementById('unit-from');
    const toSelect = document.getElementById('unit-to');
    
    const units = unitConverter.getUnits(category);
    
    [fromSelect, toSelect].forEach(select => {
      select.innerHTML = units.map(unit => 
        `<option value="${unit}">${unit}</option>`
      ).join('');
    });
  } catch (error) {
    showError('unit-error', error.message);
  }
}, 300);

// 계산 함수들
function calculatePhysics() {
  try {
    const formula = document.getElementById('physics-formula').value;
    const inputs = Array.from(document.querySelectorAll('#physics-inputs input'))
      .map(input => input.value);
    
    const { result, unit } = physicsCalculator.calculate(formula, inputs);
    document.getElementById('physics-result').textContent = `결과: ${result} ${unit}`;
    clearError('physics-error');
  } catch (error) {
    showError('physics-error', error.message);
  }
}

function performConversion() {
  try {
    const value = parseFloat(document.getElementById('unit-value').value);
    const fromUnit = document.getElementById('unit-from').value;
    const toUnit = document.getElementById('unit-to').value;
    
    const result = unitConverter.convert(value, fromUnit, toUnit);
    document.getElementById('unit-result').textContent = 
      `결과: ${value} ${fromUnit} = ${result.toFixed(6)} ${toUnit}`;
    clearError('unit-error');
  } catch (error) {
    showError('unit-error', error.message);
  }
}

// 화면 업데이트 함수들
function updateDisplay() {
  const display = document.querySelector('.current-operand');
  if (display) {
    display.textContent = basicCalculator.getDisplayValue();
  }
}

// 탭 전환 함수
function switchTab(tabName) {
  const tabs = document.querySelectorAll('.calculator-tab');
  const buttons = document.querySelectorAll('.tab-button');
  
  tabs.forEach(tab => {
    if (tab.id === `${tabName}-calculator`) {
      tab.classList.add('active');
      tab.removeAttribute('hidden');
    } else {
      tab.classList.remove('active');
      tab.setAttribute('hidden', '');
    }
  });
  
  buttons.forEach(button => {
    if (button.id === `${tabName}-tab`) {
      button.classList.add('active');
      button.setAttribute('aria-selected', 'true');
    } else {
      button.classList.remove('active');
      button.setAttribute('aria-selected', 'false');
    }
  });
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  // 물리량 계산기 초기화
  const physicsSelect = document.getElementById('physics-formula');
  if (physicsSelect) {
    physicsSelect.innerHTML = physicsCalculator.getFormulas()
      .map(formula => `<option value="${formula.id}">${formula.name}</option>`)
      .join('');
    updatePhysicsInputs();
  }
  
  // 단위 변환기 초기화
  const categorySelect = document.getElementById('unit-category');
  if (categorySelect) {
    categorySelect.innerHTML = unitConverter.getCategories()
      .map(category => `<option value="${category}">${category}</option>`)
      .join('');
    updateUnitOptions();
  }
});

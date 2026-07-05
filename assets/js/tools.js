(function() {
  'use strict';

  const formulas = {
    velocity: {
      label: 'Velocity / 속도 (v = d / t)',
      fields: [
        { id: 'distance', label: 'Distance / 거리', unit: 'm' },
        { id: 'time', label: 'Time / 시간', unit: 's' }
      ],
      calculate(values) {
        return values.distance / values.time;
      },
      unit: 'm/s'
    },
    acceleration: {
      label: 'Acceleration / 가속도 (a = Δv / t)',
      fields: [
        { id: 'deltaVelocity', label: 'Change in velocity / 속도 변화량', unit: 'm/s' },
        { id: 'time', label: 'Time / 시간', unit: 's' }
      ],
      calculate(values) {
        return values.deltaVelocity / values.time;
      },
      unit: 'm/s²'
    },
    force: {
      label: 'Force / 힘 (F = m × a)',
      fields: [
        { id: 'mass', label: 'Mass / 질량', unit: 'kg' },
        { id: 'acceleration', label: 'Acceleration / 가속도', unit: 'm/s²' }
      ],
      calculate(values) {
        return values.mass * values.acceleration;
      },
      unit: 'N'
    },
    kinetic: {
      label: 'Kinetic Energy / 운동 에너지 (K = 1/2 × m × v²)',
      fields: [
        { id: 'mass', label: 'Mass / 질량', unit: 'kg' },
        { id: 'velocity', label: 'Velocity / 속도', unit: 'm/s' }
      ],
      calculate(values) {
        return 0.5 * values.mass * values.velocity * values.velocity;
      },
      unit: 'J'
    },
    potential: {
      label: 'Potential Energy / 위치 에너지 (U = m × g × h)',
      fields: [
        { id: 'mass', label: 'Mass / 질량', unit: 'kg' },
        { id: 'gravity', label: 'Gravity / 중력가속도', unit: 'm/s²', value: 9.80665 },
        { id: 'height', label: 'Height / 높이', unit: 'm' }
      ],
      calculate(values) {
        return values.mass * values.gravity * values.height;
      },
      unit: 'J'
    }
  };

  const units = {
    length: {
      label: 'Length / 길이',
      items: {
        m: { label: 'Meter / 미터 (m)', factor: 1 },
        km: { label: 'Kilometer / 킬로미터 (km)', factor: 1000 },
        cm: { label: 'Centimeter / 센티미터 (cm)', factor: 0.01 },
        mm: { label: 'Millimeter / 밀리미터 (mm)', factor: 0.001 },
        in: { label: 'Inch / 인치 (in)', factor: 0.0254 },
        ft: { label: 'Foot / 피트 (ft)', factor: 0.3048 }
      }
    },
    mass: {
      label: 'Mass / 질량',
      items: {
        kg: { label: 'Kilogram / 킬로그램 (kg)', factor: 1 },
        g: { label: 'Gram / 그램 (g)', factor: 0.001 },
        mg: { label: 'Milligram / 밀리그램 (mg)', factor: 0.000001 },
        lb: { label: 'Pound / 파운드 (lb)', factor: 0.45359237 },
        oz: { label: 'Ounce / 온스 (oz)', factor: 0.028349523125 }
      }
    },
    time: {
      label: 'Time / 시간',
      items: {
        s: { label: 'Second / 초 (s)', factor: 1 },
        min: { label: 'Minute / 분 (min)', factor: 60 },
        h: { label: 'Hour / 시간 (h)', factor: 3600 },
        day: { label: 'Day / 일', factor: 86400 }
      }
    },
    temperature: {
      label: 'Temperature / 온도',
      items: {
        c: { label: 'Celsius / 섭씨 (°C)' },
        f: { label: 'Fahrenheit / 화씨 (°F)' },
        k: { label: 'Kelvin / 켈빈 (K)' }
      }
    }
  };

  let currentOperand = '';
  let previousOperand = '';
  let operation = null;
  let shouldResetDisplay = false;

  function formatNumber(value) {
    if (!Number.isFinite(value)) return 'Error / 오류';
    return Number.parseFloat(value.toPrecision(12)).toString();
  }

  function setText(selector, text) {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  }

  function setCalculatorError(message) {
    const error = document.getElementById('calculator-error');
    if (!error) return;
    if (!message) {
      error.hidden = true;
      error.textContent = '';
      return;
    }
    error.hidden = false;
    error.textContent = message;
  }

  function updateDisplay() {
    setText('.current-operand', currentOperand || '0');
    setText('.previous-operand', previousOperand && operation ? `${previousOperand} ${operation}` : '');
  }

  function appendNumber(number) {
    if (currentOperand === 'Error / 오류') {
      currentOperand = '';
    }
    setCalculatorError('');
    if (number === '.' && currentOperand.includes('.')) return;
    if (shouldResetDisplay) {
      currentOperand = '';
      shouldResetDisplay = false;
    }
    currentOperand = `${currentOperand}${number}`;
    updateDisplay();
  }

  function chooseOperation(nextOperation) {
    setCalculatorError('');
    if (!currentOperand && !previousOperand) return;
    if (!currentOperand) {
      operation = nextOperation;
      updateDisplay();
      return;
    }
    if (previousOperand) compute();
    operation = nextOperation;
    previousOperand = currentOperand;
    currentOperand = '';
    updateDisplay();
  }

  function compute() {
    const previous = Number.parseFloat(previousOperand);
    const current = Number.parseFloat(currentOperand);
    if (!Number.isFinite(previous) || !Number.isFinite(current) || !operation) return;

    let result;
    if (operation === '+') result = previous + current;
    if (operation === '-') result = previous - current;
    if (operation === '×') result = previous * current;
    if (operation === '÷' && current === 0) {
      currentOperand = 'Error / 오류';
      previousOperand = '';
      operation = null;
      shouldResetDisplay = true;
      updateDisplay();
      setCalculatorError('Error / 오류: 0으로 나눌 수 없습니다. AC로 초기화하거나 DEL로 입력을 수정해 주세요.');
      return;
    }
    if (operation === '÷') result = previous / current;

    currentOperand = formatNumber(result);
    setCalculatorError(Number.isFinite(result) ? '' : 'Error / 오류: 계산 결과를 확인해 주세요. AC로 초기화할 수 있습니다.');
    previousOperand = '';
    operation = null;
    shouldResetDisplay = true;
    updateDisplay();
  }

  function clearCalculator() {
    currentOperand = '';
    previousOperand = '';
    operation = null;
    shouldResetDisplay = false;
    setCalculatorError('');
    updateDisplay();
  }

  function deleteLast() {
    if (shouldResetDisplay || currentOperand === 'Error / 오류') {
      clearCalculator();
      return;
    }
    setCalculatorError('');
    currentOperand = currentOperand.slice(0, -1);
    updateDisplay();
  }

  function switchTab(tabName) {
    const tabs = document.querySelectorAll('[data-tab]');
    const panels = {
      basic: document.getElementById('basic-calculator'),
      physics: document.getElementById('physics-calculator'),
      unit: document.getElementById('unit-calculator')
    };

    tabs.forEach(tab => {
      const selected = tab.dataset.tab === tabName;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });

    Object.keys(panels).forEach(key => {
      const panel = panels[key];
      if (!panel) return;
      const selected = key === tabName;
      panel.classList.toggle('active', selected);
      panel.hidden = !selected;
    });
  }

  function updatePhysicsInputs() {
    const select = document.getElementById('physics-formula');
    const inputs = document.getElementById('physics-inputs');
    const formulaDisplay = document.getElementById('physics-formula-display');
    const result = document.getElementById('physics-result');
    if (!select || !inputs || !formulaDisplay || !result) return;

    const formula = formulas[select.value];
    result.textContent = '';
    inputs.innerHTML = '';

    if (!formula) {
      formulaDisplay.textContent = '';
      return;
    }

    formulaDisplay.textContent = formula.label;
    inputs.innerHTML = formula.fields.map(field => `
      <div class="form-group">
        <label for="physics-${field.id}">${field.label} (${field.unit})</label>
        <input id="physics-${field.id}" type="number" step="any" value="${field.value || ''}" inputmode="decimal">
      </div>
    `).join('');
  }

  function calculatePhysics() {
    const select = document.getElementById('physics-formula');
    const result = document.getElementById('physics-result');
    if (!select || !result) return;

    const formula = formulas[select.value];
    if (!formula) {
      result.textContent = 'Select a formula first. / 먼저 공식을 선택해 주세요.';
      return;
    }

    const values = {};
    for (const field of formula.fields) {
      const input = document.getElementById(`physics-${field.id}`);
      const value = Number.parseFloat(input ? input.value : '');
      if (!Number.isFinite(value)) {
        result.textContent = `Enter a valid value for ${field.label}. / ${field.label} 값을 올바르게 입력해 주세요.`;
        if (input) input.focus();
        return;
      }
      if ((field.id === 'time' || field.id === 'mass') && value === 0) {
        result.textContent = `${field.label} cannot be zero. / ${field.label} 값은 0일 수 없습니다.`;
        if (input) input.focus();
        return;
      }
      values[field.id] = value;
    }

    result.textContent = `${formatNumber(formula.calculate(values))} ${formula.unit}`;
  }

  function fillSelect(select, options, placeholder) {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    Object.entries(options).forEach(([value, item]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = item.label;
      select.appendChild(option);
    });
  }

  function updateUnitOptions() {
    const categorySelect = document.getElementById('unit-category');
    const fromUnit = document.getElementById('from-unit');
    const toUnit = document.getElementById('to-unit');
    const result = document.getElementById('unit-result');
    if (!categorySelect || !fromUnit || !toUnit) return;

    const category = units[categorySelect.value];
    if (result) result.textContent = '';
    if (!category) {
      fillSelect(fromUnit, {}, 'Select Unit / 단위 선택');
      fillSelect(toUnit, {}, 'Select Unit / 단위 선택');
      return;
    }

    fillSelect(fromUnit, category.items, 'Select Unit / 단위 선택');
    fillSelect(toUnit, category.items, 'Select Unit / 단위 선택');
  }

  function toKelvin(value, unit) {
    if (unit === 'c') return value + 273.15;
    if (unit === 'f') return (value - 32) * 5 / 9 + 273.15;
    return value;
  }

  function fromKelvin(value, unit) {
    if (unit === 'c') return value - 273.15;
    if (unit === 'f') return (value - 273.15) * 9 / 5 + 32;
    return value;
  }

  function performConversion() {
    const categoryKey = document.getElementById('unit-category')?.value;
    const valueInput = document.getElementById('unit-value');
    const fromKey = document.getElementById('from-unit')?.value;
    const toKey = document.getElementById('to-unit')?.value;
    const result = document.getElementById('unit-result');
    if (!valueInput || !result) return;

    const category = units[categoryKey];
    const value = Number.parseFloat(valueInput.value);
    if (!category || !fromKey || !toKey || !Number.isFinite(value)) {
      result.textContent = 'Choose units and enter a valid value. / 단위를 선택하고 올바른 값을 입력해 주세요.';
      return;
    }

    let converted;
    if (categoryKey === 'temperature') {
      converted = fromKelvin(toKelvin(value, fromKey), toKey);
    } else {
      converted = value * category.items[fromKey].factor / category.items[toKey].factor;
    }
    result.textContent = `${formatNumber(converted)} ${toKey}`;
  }

  function initCalculator() {
    document.querySelectorAll('[data-number]').forEach(button => {
      button.addEventListener('click', () => appendNumber(button.dataset.number));
    });
    document.querySelectorAll('[data-operation]').forEach(button => {
      button.addEventListener('click', () => chooseOperation(button.dataset.operation));
    });
    document.querySelector('[data-action="clear"]')?.addEventListener('click', clearCalculator);
    document.querySelector('[data-action="delete"]')?.addEventListener('click', deleteLast);
    document.querySelector('[data-equals]')?.addEventListener('click', compute);
    updateDisplay();
  }

  function initTabs() {
    document.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
      tab.addEventListener('keydown', event => {
        const tabs = Array.from(document.querySelectorAll('[data-tab]'));
        const currentIndex = tabs.indexOf(tab);
        let nextTab;
        // APG Tabs 패턴: 좌우 화살표 + Home/End
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          const direction = event.key === 'ArrowRight' ? 1 : -1;
          nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
        } else if (event.key === 'Home') {
          nextTab = tabs[0];
        } else if (event.key === 'End') {
          nextTab = tabs[tabs.length - 1];
        } else {
          return;
        }
        event.preventDefault();
        nextTab.focus();
        switchTab(nextTab.dataset.tab);
      });
    });
  }

  function initUnits() {
    const categorySelect = document.getElementById('unit-category');
    if (!categorySelect) return;
    fillSelect(categorySelect, units, 'Select Category / 범주 선택');
    categorySelect.addEventListener('change', updateUnitOptions);
    document.getElementById('unit-convert')?.addEventListener('click', performConversion);
  }

  function initPhysics() {
    document.getElementById('physics-formula')?.addEventListener('change', updatePhysicsInputs);
    document.getElementById('physics-calculate')?.addEventListener('click', calculatePhysics);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.calculator-container')) return;
    initTabs();
    initCalculator();
    initPhysics();
    initUnits();
  });

  window.switchTab = switchTab;
  window.updatePhysicsInputs = updatePhysicsInputs;
  window.calculatePhysics = calculatePhysics;
  window.updateUnitOptions = updateUnitOptions;
  window.performConversion = performConversion;
})();

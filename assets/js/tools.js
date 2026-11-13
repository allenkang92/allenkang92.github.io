(function() {
  'use strict';

  const formulas = {
    velocity: {
      label: '평균 속력 (v = d / t)',
      fields: [
        { id: 'distance', label: '총 이동 거리', unit: 'm' },
        { id: 'time', label: '경과 시간', unit: 's' }
      ],
      calculate(values) {
        return calculateDecimal(values.distance, values.time, '÷');
      },
      unit: 'm/s'
    },
    acceleration: {
      label: '가속도 (a = Δv / t)',
      fields: [
        { id: 'deltaVelocity', label: '속도 변화량', unit: 'm/s' },
        { id: 'time', label: '시간', unit: 's' }
      ],
      calculate(values) {
        return calculateDecimal(values.deltaVelocity, values.time, '÷');
      },
      unit: 'm/s²'
    },
    force: {
      label: '힘 (F = m × a)',
      fields: [
        { id: 'mass', label: '질량', unit: 'kg' },
        { id: 'acceleration', label: '가속도', unit: 'm/s²' }
      ],
      calculate(values) {
        return calculateDecimal(values.mass, values.acceleration, '×');
      },
      unit: 'N'
    },
    kinetic: {
      label: '운동 에너지 (K = 1/2 × m × v²)',
      fields: [
        { id: 'mass', label: '질량', unit: 'kg' },
        { id: 'velocity', label: '속도', unit: 'm/s' }
      ],
      calculate(values) {
        return multiplyCalculatorDecimals(['0.5', values.mass, values.velocity, values.velocity]);
      },
      unit: 'J'
    },
    potential: {
      label: '위치 에너지 (U = m × g × h)',
      fields: [
        { id: 'mass', label: '질량', unit: 'kg' },
        { id: 'gravity', label: '중력가속도', unit: 'm/s²', value: 9.80665 },
        { id: 'height', label: '높이', unit: 'm' }
      ],
      calculate(values) {
        return multiplyCalculatorDecimals([values.mass, values.gravity, values.height]);
      },
      unit: 'J'
    }
  };

  const units = {
    length: {
      label: '길이',
      items: {
        m: { label: '미터 (m)', factor: 1 },
        km: { label: '킬로미터 (km)', factor: 1000 },
        cm: { label: '센티미터 (cm)', factor: 0.01 },
        mm: { label: '밀리미터 (mm)', factor: 0.001 },
        in: { label: '인치 (in)', factor: 0.0254 },
        ft: { label: '피트 (ft)', factor: 0.3048 }
      }
    },
    mass: {
      label: '질량',
      items: {
        kg: { label: '킬로그램 (kg)', factor: 1 },
        g: { label: '그램 (g)', factor: 0.001 },
        mg: { label: '밀리그램 (mg)', factor: 0.000001 },
        lb: { label: '파운드 (lb)', factor: 0.45359237 },
        oz: { label: '온스 (oz)', factor: 0.028349523125 }
      }
    },
    time: {
      label: '시간',
      items: {
        s: { label: '초 (s)', factor: 1 },
        min: { label: '분 (min)', factor: 60 },
        h: { label: '시간 (h)', factor: 3600 },
        day: { label: '일 (day)', factor: 86400 }
      }
    },
    temperature: {
      label: '온도',
      items: {
        c: { label: '섭씨 (°C)' },
        f: { label: '화씨 (°F)' },
        k: { label: '켈빈 (K)' }
      }
    }
  };

  let currentOperand = '';
  let previousOperand = '';
  let operation = null;
  let shouldResetDisplay = false;
  // 결과에서 부호를 바꾼 뒤 삭제는 편집, 숫자 입력은 새 계산으로 처리한다.
  let signedResultCanBeEdited = false;
  let currentApproximate = false;
  let previousApproximate = false;
  let physicsErrorField = null;
  let physicsErrorPreviousInvalid = null;
  let physicsErrorPreviousDescription = null;
  let unitErrorField = null;
  let unitErrorPreviousInvalid = null;
  let unitErrorPreviousDescription = null;
  let unitErrorDependencies = [];

  function inputUnderflows(raw, value) {
    // A non-zero mantissa parsed as zero is outside JavaScript's number range.
    return value === 0 && /[1-9]/.test(raw.split(/[eE]/)[0]);
  }

  // Keep the user's decimal digits instead of rounding every intermediate
  // result to the 12 significant digits used for physical measurements.
  function parseCalculatorDecimal(raw) {
    if (raw.length > 1000) return null;
    const number = Number(raw);
    if (!Number.isFinite(number) || inputUnderflows(raw, number)) return null;
    const match = /^(-?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(raw);
    if (!match || !(match[2] || match[3])) return null;
    const coefficient = BigInt(`${match[1]}${(match[2] || '') + (match[3] || '')}`);
    return normalizeCalculatorDecimal(coefficient, Number(match[4] || 0) - (match[3] || '').length);
  }

  function normalizeCalculatorDecimal(coefficient, exponent) {
    if (coefficient === 0n) return { coefficient: 0n, exponent: 0 };
    while (coefficient % 10n === 0n) {
      coefficient /= 10n;
      exponent += 1;
    }
    return { coefficient, exponent };
  }

  function calculatorDecimalText({ coefficient, exponent }) {
    if (coefficient === 0n) return '0';
    const sign = coefficient < 0n ? '-' : '';
    const digits = (coefficient < 0n ? -coefficient : coefficient).toString();
    const magnitude = digits.length + exponent - 1;
    if (magnitude >= 21 || magnitude <= -7) {
      const mantissa = digits.length === 1 ? digits : `${digits[0]}.${digits.slice(1)}`;
      return `${sign}${mantissa}e${magnitude >= 0 ? '+' : ''}${magnitude}`;
    }
    const position = digits.length + exponent;
    if (position <= 0) return `${sign}0.${'0'.repeat(-position)}${digits}`;
    if (position >= digits.length) return `${sign}${digits}${'0'.repeat(position - digits.length)}`;
    return `${sign}${digits.slice(0, position)}.${digits.slice(position)}`;
  }

  function calculatorDivide(left, right) {
    let numerator = left.coefficient < 0n ? -left.coefficient : left.coefficient;
    let denominator = right.coefficient < 0n ? -right.coefficient : right.coefficient;
    const negative = (left.coefficient < 0n) !== (right.coefficient < 0n);
    let a = numerator;
    let b = denominator;
    while (b !== 0n) [a, b] = [b, a % b];
    numerator /= a;
    denominator /= a;
    let twos = 0;
    let fives = 0;
    let remaining = denominator;
    while (remaining % 2n === 0n) { remaining /= 2n; twos += 1; }
    while (remaining % 5n === 0n) { remaining /= 5n; fives += 1; }
    const exponent = left.exponent - right.exponent;
    if (remaining === 1n) {
      const places = Math.max(twos, fives);
      const coefficient = numerator * 2n ** BigInt(places - twos) * 5n ** BigInt(places - fives);
      return { decimal: normalizeCalculatorDecimal(negative ? -coefficient : coefficient, exponent - places), approximate: false };
    }

    // Non-terminating decimal: round to 17 significant decimal digits.
    let magnitude = numerator.toString().length - denominator.toString().length;
    if (magnitude >= 0 ? numerator < denominator * 10n ** BigInt(magnitude) :
      numerator * 10n ** BigInt(-magnitude) < denominator) magnitude -= 1;
    const scale = 16 - magnitude;
    const scaledNumerator = scale >= 0 ? numerator * 10n ** BigInt(scale) : numerator;
    const scaledDenominator = scale >= 0 ? denominator : denominator * 10n ** BigInt(-scale);
    let coefficient = scaledNumerator / scaledDenominator;
    if ((scaledNumerator % scaledDenominator) * 2n >= scaledDenominator) coefficient += 1n;
    return { decimal: normalizeCalculatorDecimal(negative ? -coefficient : coefficient, exponent - scale), approximate: true };
  }

  function calculateDecimal(left, right, operator) {
    if (operator === '÷') return calculatorDivide(left, right);
    if (operator === '×') {
      return { decimal: normalizeCalculatorDecimal(left.coefficient * right.coefficient, left.exponent + right.exponent), approximate: false };
    }
    const exponent = Math.min(left.exponent, right.exponent);
    const a = left.coefficient * 10n ** BigInt(left.exponent - exponent);
    const b = right.coefficient * 10n ** BigInt(right.exponent - exponent);
    return { decimal: normalizeCalculatorDecimal(operator === '+' ? a + b : a - b, exponent), approximate: false };
  }

  function multiplyCalculatorDecimals(values) {
    const decimals = values.map(value => typeof value === 'string' ? parseCalculatorDecimal(value) : value);
    return decimals.slice(1).reduce((product, value) => calculateDecimal(product.decimal, value, '×'), { decimal: decimals[0], approximate: false });
  }

  function decimalOutsideRange(decimal, maxTextLength = 1000) {
    const text = calculatorDecimalText(decimal);
    const value = Number(text);
    if (text.length > maxTextLength || !Number.isFinite(value)) return 'large';
    if (decimal.coefficient !== 0n) {
      const absolute = { coefficient: decimal.coefficient < 0n ? -decimal.coefficient : decimal.coefficient, exponent: decimal.exponent };
      // Treat values below the smallest printed JS number conservatively as
      // out of range, even if Number() rounds them up to MIN_VALUE.
      if (value === 0 || calculateDecimal(absolute, parseCalculatorDecimal('5e-324'), '-').decimal.coefficient < 0n) return 'small';
    }
    return null;
  }

  function formatMeasurementResult(result, unit) {
    let { coefficient, exponent } = result.decimal;
    const negative = coefficient < 0n;
    let magnitude = negative ? -coefficient : coefficient;
    const extra = magnitude.toString().length - 17;
    let rounded = false;
    if (extra > 0) {
      const divisor = 10n ** BigInt(extra);
      rounded = magnitude % divisor !== 0n;
      const remainder = magnitude % divisor;
      magnitude /= divisor;
      if (remainder * 2n >= divisor) magnitude += 1n;
      exponent += extra;
      coefficient = negative ? -magnitude : magnitude;
    }
    const decimal = normalizeCalculatorDecimal(coefficient, exponent);
    return `${calculatorDecimalText(decimal)} ${unit}${result.approximate || rounded ? ' (근삿값)' : ''}`;
  }

  function setText(selector, text) {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  }

  function invalidateResult(id, message) {
    const result = document.getElementById(id);
    if (result && result.textContent && result.textContent !== message) {
      result.textContent = message;
    }
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

  function setCalculatorPrecisionNotice(approximate) {
    const notice = document.getElementById('calculator-precision-notice');
    if (!notice) return;
    notice.hidden = !approximate;
    notice.textContent = approximate ? '나눗셈 결과를 유효 숫자 17자리로 반올림한 근삿값입니다. 이후 계산에도 근삿값이 사용됩니다.' : '';
  }

  function calculatorFailure(message) {
    currentOperand = '오류';
    previousOperand = '';
    operation = null;
    currentApproximate = false;
    previousApproximate = false;
    shouldResetDisplay = true;
    signedResultCanBeEdited = false;
    setCalculatorPrecisionNotice(false);
    updateDisplay();
    setCalculatorError(message);
    return false;
  }

  function updateDisplay() {
    setText('.current-operand', currentOperand || '0');
    setText('.previous-operand', previousOperand && operation ? `${previousOperand} ${operation}` : '');
    const previousLine = document.querySelector('.previous-operand-line');
    if (previousLine) previousLine.hidden = !(previousOperand && operation);
  }

  function appendNumber(number) {
    if (currentOperand === '오류') {
      currentOperand = '';
    }
    setCalculatorError('');
    if (shouldResetDisplay) {
      currentOperand = '';
      shouldResetDisplay = false;
      signedResultCanBeEdited = false;
      currentApproximate = false;
      setCalculatorPrecisionNotice(previousApproximate);
    }
    // 지수 표기를 편집 중일 때 소수점은 지수부에 추가할 수 없다.
    if (number === '.' && (currentOperand.includes('.') || /e/i.test(currentOperand))) return;
    if (number === '.' && !currentOperand) currentOperand = '0';
    if (number !== '.' && (currentOperand === '0' || currentOperand === '-0')) {
      currentOperand = currentOperand.startsWith('-') ? '-' : '';
    }
    currentOperand = `${currentOperand}${number}`;
    updateDisplay();
  }

  function toggleSign() {
    if (currentOperand === '오류') {
      currentOperand = '';
      shouldResetDisplay = false;
    }
    if (shouldResetDisplay) signedResultCanBeEdited = true;
    if (!currentOperand && previousOperand && operation) shouldResetDisplay = false;
    setCalculatorError('');
    currentOperand = currentOperand.startsWith('-')
      ? currentOperand.slice(1)
      : `-${currentOperand || '0'}`;
    updateDisplay();
  }

  function chooseOperation(nextOperation) {
    if (currentOperand === '오류') return;
    setCalculatorError('');
    if (!currentOperand && !previousOperand) return;
    if (!currentOperand) {
      operation = nextOperation;
      updateDisplay();
      return;
    }
    if (!parseCalculatorDecimal(currentOperand)) {
      calculatorFailure('입력값이 표현 가능한 범위를 벗어났거나 너무 깁니다. 초기화하거나 숫자를 다시 입력해 주세요.');
      return;
    }
    if (previousOperand && !compute()) return;
    operation = nextOperation;
    previousOperand = currentOperand;
    previousApproximate = currentApproximate;
    currentOperand = '';
    currentApproximate = false;
    // 새 연산은 다음 피연산자를 기다리는 상태이므로 결과 초기화 플래그를 남기지 않는다.
    shouldResetDisplay = false;
    signedResultCanBeEdited = false;
    updateDisplay();
  }

  function compute() {
    if (!previousOperand || !currentOperand || !operation) return false;
    const previous = parseCalculatorDecimal(previousOperand);
    const current = parseCalculatorDecimal(currentOperand);
    if (!previous || !current) {
      return calculatorFailure('입력값이 표현 가능한 범위를 벗어났거나 너무 깁니다. 초기화하거나 숫자를 다시 입력해 주세요.');
    }
    if (operation === '÷' && current.coefficient === 0n) {
      return calculatorFailure('0으로 나눌 수 없습니다. 초기화하거나 숫자를 다시 입력해 주세요.');
    }

    const result = calculateDecimal(previous, current, operation);
    const resultText = calculatorDecimalText(result.decimal);
    if (decimalOutsideRange(result.decimal)) {
      return calculatorFailure('계산 결과가 표현 가능한 범위를 벗어났습니다. 초기화하거나 숫자를 다시 입력해 주세요.');
    }
    currentOperand = resultText;
    currentApproximate = previousApproximate || currentApproximate || result.approximate;
    previousApproximate = false;
    setCalculatorPrecisionNotice(currentApproximate);
    setCalculatorError('');
    previousOperand = '';
    operation = null;
    shouldResetDisplay = true;
    signedResultCanBeEdited = false;
    updateDisplay();
    return true;
  }

  function clearCalculator() {
    currentOperand = '';
    previousOperand = '';
    operation = null;
    shouldResetDisplay = false;
    signedResultCanBeEdited = false;
    currentApproximate = false;
    previousApproximate = false;
    setCalculatorPrecisionNotice(false);
    setCalculatorError('');
    updateDisplay();
  }

  function deleteLast() {
    if ((shouldResetDisplay && !signedResultCanBeEdited) || currentOperand === '오류') {
      clearCalculator();
      return;
    }
    shouldResetDisplay = false;
    signedResultCanBeEdited = false;
    setCalculatorError('');
    const deletedOperand = currentOperand;
    currentOperand = currentOperand.slice(0, -1);
    // 지수의 마지막 숫자를 지우면 남은 지수 기호도 함께 제거한다.
    currentOperand = currentOperand.replace(/e[+-]?$/i, '');
    if (currentOperand === '-') currentOperand = deletedOperand === '-0' ? '' : '-0';
    // 현재 피연산자를 모두 지우면 새 입력이므로 이전 결과의 근삿값 표시는 제거한다.
    // 대기 중인 이전 피연산자가 근삿값인 경우의 안내는 유지한다.
    if (!currentOperand || /^-?0(?:\.0*)?$/.test(currentOperand)) {
      currentApproximate = false;
      setCalculatorPrecisionNotice(previousApproximate);
    }
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

    // 클릭이 탭에 포커스를 주지 않는 환경에서도 숨겨질 패널에 포커스를 남기지 않는다.
    const active = document.activeElement;
    const hidesFocusedPanel = Object.entries(panels).some(([key, panel]) =>
      key !== tabName && panel && panel.contains(active)
    );
    if (hidesFocusedPanel && panels[tabName]) {
      Array.from(tabs).find(tab => tab.dataset.tab === tabName)?.focus();
    }

    Object.keys(panels).forEach(key => {
      const panel = panels[key];
      if (!panel) return;
      const selected = key === tabName;
      panel.classList.toggle('active', selected);
      panel.hidden = !selected;
    });
  }

  // Keep a copied URL consistent with the calculator currently shown.
  function syncToolUrl(tabName) {
    const url = new URL(window.location.href);
    if (tabName === 'basic') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tabName);

    const formula = document.getElementById('physics-formula')?.value;
    if (tabName === 'physics' && Object.prototype.hasOwnProperty.call(formulas, formula)) {
      url.searchParams.set('formula', formula);
    } else {
      url.searchParams.delete('formula');
    }
    window.history.replaceState(window.history.state, '', url);
  }

  function updatePhysicsInputs() {
    const select = document.getElementById('physics-formula');
    const inputs = document.getElementById('physics-inputs');
    const formulaDisplay = document.getElementById('physics-formula-display');
    const result = document.getElementById('physics-result');
    if (!select || !inputs || !formulaDisplay || !result) return;

    clearPhysicsInputError();
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

  function clearPhysicsInputError() {
    if (!physicsErrorField) return;
    for (const [attribute, previous] of [
      ['aria-invalid', physicsErrorPreviousInvalid],
      ['aria-describedby', physicsErrorPreviousDescription]
    ]) {
      if (previous === null) physicsErrorField.removeAttribute(attribute);
      else physicsErrorField.setAttribute(attribute, previous);
    }
    physicsErrorField = null;
    physicsErrorPreviousInvalid = null;
    physicsErrorPreviousDescription = null;
  }

  function showPhysicsInputError(field, result, message) {
    clearPhysicsInputError();
    result.textContent = message;
    if (!field) return;
    physicsErrorField = field;
    physicsErrorPreviousInvalid = field.getAttribute('aria-invalid');
    physicsErrorPreviousDescription = field.getAttribute('aria-describedby');
    const descriptions = (physicsErrorPreviousDescription || '').split(/\s+/).filter(Boolean);
    if (!descriptions.includes('physics-result')) descriptions.push('physics-result');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', descriptions.join(' '));
    field.focus();
  }

  function calculatePhysics() {
    const select = document.getElementById('physics-formula');
    const result = document.getElementById('physics-result');
    if (!select || !result) return;

    clearPhysicsInputError();
    const formula = formulas[select.value];
    if (!formula) {
      showPhysicsInputError(select, result, '먼저 공식을 선택해 주세요.');
      return;
    }

    const values = {};
    for (const field of formula.fields) {
      const input = document.getElementById(`physics-${field.id}`);
      const value = Number.parseFloat(input ? input.value : '');
      if (!Number.isFinite(value)) {
        showPhysicsInputError(input, result, `${field.label} 값을 올바르게 입력해 주세요.`);
        return;
      }
      if (inputUnderflows(input.value, value)) {
        showPhysicsInputError(input, result, `${field.label} 값이 표현 가능한 범위보다 작습니다.`);
        return;
      }
      if (field.id === 'time' && value <= 0) {
        showPhysicsInputError(input, result, `${field.label}은 0보다 커야 합니다.`);
        return;
      }
      if ((field.id === 'mass' || field.id === 'distance') && value < 0) {
        showPhysicsInputError(input, result, `${field.label}은 0 이상이어야 합니다.`);
        return;
      }
      const decimal = parseCalculatorDecimal(input.value);
      if (!decimal) {
        showPhysicsInputError(input, result, `${field.label} 값이 너무 깁니다.`);
        return;
      }
      values[field.id] = decimal;
    }

    const calculated = formula.calculate(values);
    const range = decimalOutsideRange(calculated.decimal, Infinity);
    if (range === 'large') {
      result.textContent = '계산 결과가 표현 가능한 범위를 벗어났습니다.';
      return;
    }
    if (range === 'small') {
      result.textContent = '계산 결과가 표현 가능한 범위보다 작습니다.';
      return;
    }
    result.textContent = formatMeasurementResult(calculated, formula.unit);
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

    // 이전 오류 설명을 먼저 복원한 뒤, 현재 종류의 안내만 연결한다.
    clearUnitInputError();
    const guidance = document.getElementById('unit-temperature-guidance');
    const valueInput = document.getElementById('unit-value');
    if (guidance && valueInput) {
      const temperature = categorySelect.value === 'temperature';
      guidance.hidden = !temperature;
      const descriptions = (valueInput.getAttribute('aria-describedby') || '')
        .split(/\s+/).filter(id => id && id !== guidance.id);
      if (temperature) descriptions.push(guidance.id);
      if (descriptions.length) valueInput.setAttribute('aria-describedby', descriptions.join(' '));
      else valueInput.removeAttribute('aria-describedby');
    }

    const category = units[categorySelect.value];
    if (result) result.textContent = '';
    if (!category) {
      fillSelect(fromUnit, {}, '단위를 선택하세요');
      fillSelect(toUnit, {}, '단위를 선택하세요');
      return;
    }

    fillSelect(fromUnit, category.items, '단위를 선택하세요');
    fillSelect(toUnit, category.items, '단위를 선택하세요');
  }

  function convertTemperature(value, from, to) {
    const constant = number => parseCalculatorDecimal(number);
    const operation = (left, right, operator) => calculateDecimal(left, constant(right), operator).decimal;
    if (from === to) return { decimal: value, approximate: false };
    if (from === 'c' && to === 'f') {
      const scaled = operation(operation(value, '9', '×'), '5', '÷');
      return calculateDecimal(scaled, constant('32'), '+');
    }
    if (from === 'f' && to === 'c') {
      const scaled = operation(operation(value, '32', '-'), '5', '×');
      return calculateDecimal(scaled, constant('9'), '÷');
    }
    if (from === 'c' && to === 'k') return calculateDecimal(value, constant('273.15'), '+');
    if (from === 'f' && to === 'k') {
      const scaled = operation(operation(value, '459.67', '+'), '5', '×');
      return calculateDecimal(scaled, constant('9'), '÷');
    }
    if (from === 'k' && to === 'c') return calculateDecimal(value, constant('273.15'), '-');
    const scaled = operation(operation(operation(value, '273.15', '-'), '9', '×'), '5', '÷');
    return calculateDecimal(scaled, constant('32'), '+');
  }

  function clearUnitInputError() {
    if (!unitErrorField) return;
    for (const [attribute, previous] of [
      ['aria-invalid', unitErrorPreviousInvalid],
      ['aria-describedby', unitErrorPreviousDescription]
    ]) {
      if (previous === null) unitErrorField.removeAttribute(attribute);
      else unitErrorField.setAttribute(attribute, previous);
    }
    unitErrorField = null;
    unitErrorPreviousInvalid = null;
    unitErrorPreviousDescription = null;
    unitErrorDependencies = [];
  }

  function showUnitInputError(field, result, message, dependencies = []) {
    clearUnitInputError();
    result.textContent = message;
    if (!field) return;
    unitErrorField = field;
    unitErrorDependencies = dependencies;
    unitErrorPreviousInvalid = field.getAttribute('aria-invalid');
    unitErrorPreviousDescription = field.getAttribute('aria-describedby');
    const descriptions = (unitErrorPreviousDescription || '').split(/\s+/).filter(Boolean);
    if (!descriptions.includes('unit-result')) descriptions.push('unit-result');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', descriptions.join(' '));
    field.focus();
  }

  function performConversion() {
    const categoryInput = document.getElementById('unit-category');
    const categoryKey = categoryInput?.value;
    const valueInput = document.getElementById('unit-value');
    const fromInput = document.getElementById('from-unit');
    const toInput = document.getElementById('to-unit');
    const fromKey = fromInput?.value;
    const toKey = toInput?.value;
    const result = document.getElementById('unit-result');
    if (!valueInput || !result) return;

    clearUnitInputError();
    const category = units[categoryKey];
    const value = Number.parseFloat(valueInput.value);
    if (!category) {
      showUnitInputError(categoryInput, result, '변환 종류를 선택해 주세요.');
      return;
    }
    if (!Number.isFinite(value)) {
      showUnitInputError(valueInput, result, '변환할 값을 올바르게 입력해 주세요.');
      return;
    }
    if (inputUnderflows(valueInput.value, value)) {
      showUnitInputError(valueInput, result, '입력값이 표현 가능한 범위보다 작습니다.');
      return;
    }

    const inputDecimal = parseCalculatorDecimal(valueInput.value);
    if (!inputDecimal) {
      showUnitInputError(valueInput, result, '입력값이 너무 깁니다.');
      return;
    }
    if (!fromKey) {
      showUnitInputError(fromInput, result, '변환 전 단위를 선택해 주세요.');
      return;
    }
    if (!toKey) {
      showUnitInputError(toInput, result, '변환 후 단위를 선택해 주세요.');
      return;
    }

    if (categoryKey === 'temperature') {
      // Thermodynamic absolute zero, expressed in each input scale (NIST).
      const minimum = parseCalculatorDecimal({ c: '-273.15', f: '-459.67', k: '0' }[fromKey]);
      if (calculateDecimal(inputDecimal, minimum, '-').decimal.coefficient < 0n) {
        showUnitInputError(valueInput, result, '절대 영도 미만의 온도는 입력할 수 없습니다.', [fromInput]);
        return;
      }
    }

    const displayUnit = categoryKey === 'temperature'
      ? { c: '°C', f: '°F', k: 'K' }[toKey]
      : toKey;
    // 같은 단위에는 산술 변환이 필요 없으므로 검증된 입력을 그대로 보존한다.
    if (fromKey === toKey) {
      result.textContent = `${valueInput.value} ${displayUnit}`;
      return;
    }

    let converted;
    if (categoryKey === 'temperature') {
      converted = convertTemperature(inputDecimal, fromKey, toKey);
    } else {
      const factor = parseCalculatorDecimal(String(category.items[fromKey].factor));
      const divisor = parseCalculatorDecimal(String(category.items[toKey].factor));
      const scaled = calculateDecimal(inputDecimal, factor, '×').decimal;
      converted = calculateDecimal(scaled, divisor, '÷');
    }
    const range = decimalOutsideRange(converted.decimal, Infinity);
    if (range === 'large') {
      result.textContent = '변환 결과가 표현 가능한 범위를 벗어났습니다.';
      return;
    }
    if (range === 'small') {
      result.textContent = '변환 결과가 표현 가능한 범위보다 작습니다.';
      return;
    }
    result.textContent = formatMeasurementResult(converted, displayUnit);
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
    document.querySelector('[data-action="sign"]')?.addEventListener('click', toggleSign);
    document.querySelector('[data-equals]')?.addEventListener('click', compute);
    updateDisplay();
  }

  function initTabs() {
    document.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
        syncToolUrl(tab.dataset.tab);
      });
      tab.addEventListener('keydown', event => {
        // 수정 키, 입력기 조합 및 이미 처리된 이벤트는 기존 동작에 맡긴다.
        if (event.defaultPrevented || event.isComposing || event.keyCode === 229
          || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
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
        syncToolUrl(nextTab.dataset.tab);
      });
    });
  }

  // 일반 Enter만 계산하고 조합 입력 확정과 브라우저 단축키는 건드리지 않는다.
  function calculateOnEnter(event, buttonId) {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229
      || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    document.getElementById(buttonId)?.click();
  }

  function initUnits() {
    const categorySelect = document.getElementById('unit-category');
    if (!categorySelect) return;
    fillSelect(categorySelect, units, '종류를 선택하세요');
    categorySelect.addEventListener('change', () => {
      clearUnitInputError();
      updateUnitOptions();
    });
    const invalidate = event => {
      if (unitErrorField) {
        if (event.currentTarget !== unitErrorField && !unitErrorDependencies.includes(event.currentTarget)) return;
        clearUnitInputError();
        setText('#unit-result', '');
        return;
      }
      invalidateResult('unit-result', '입력이 변경되었습니다. 다시 변환해 주세요.');
    };
    document.getElementById('unit-value')?.addEventListener('input', invalidate);
    document.getElementById('unit-value')?.addEventListener('keydown', event => calculateOnEnter(event, 'unit-convert'));
    document.getElementById('from-unit')?.addEventListener('change', invalidate);
    document.getElementById('to-unit')?.addEventListener('change', invalidate);
    document.getElementById('unit-convert')?.addEventListener('click', performConversion);
  }

  function initPhysics() {
    document.getElementById('physics-formula')?.addEventListener('change', () => {
      updatePhysicsInputs();
      syncToolUrl('physics');
    });
    document.getElementById('physics-inputs')?.addEventListener('input', event => {
      if (event.target instanceof HTMLInputElement) {
        if (physicsErrorField) {
          if (event.target !== physicsErrorField) return;
          clearPhysicsInputError();
          setText('#physics-result', '');
          return;
        }
        invalidateResult('physics-result', '입력이 변경되었습니다. 다시 계산해 주세요.');
      }
    });
    document.getElementById('physics-inputs')?.addEventListener('keydown', event => {
      if (event.target instanceof HTMLInputElement && event.target.type === 'number') {
        calculateOnEnter(event, 'physics-calculate');
      }
    });
    document.getElementById('physics-calculate')?.addEventListener('click', calculatePhysics);
  }

  // Preserve focus unless history changes the selected tab or removes its panel/input.
  function restoreToolFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get('tab');
    const tab = ['basic', 'physics', 'unit'].includes(requestedTab) ? requestedTab : 'basic';

    const active = document.activeElement;
    const activePanel = active?.closest('.calculator-tab');
    const targetPanel = document.getElementById(`${tab}-calculator`);
    const targetTab = document.getElementById(`${tab}-tab`);
    const moveFocusedTab = active?.matches('.calculator-container [role="tab"][data-tab]') && active !== targetTab;
    if (activePanel && activePanel !== targetPanel) {
      targetTab?.focus();
    }
    switchTab(tab);
    if (moveFocusedTab) targetTab?.focus();
    if (tab !== 'physics') return;

    const formula = params.get('formula');
    const validFormula = Object.prototype.hasOwnProperty.call(formulas, formula) ? formula : '';
    const select = document.getElementById('physics-formula');
    if (!select) return;
    if (select.value !== validFormula) {
      if (document.getElementById('physics-inputs')?.contains(document.activeElement)) {
        select.focus();
      }
      select.value = validFormula;
      updatePhysicsInputs();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.calculator-container');
    if (!container) return;
    initTabs();
    initCalculator();
    initPhysics();
    initUnits();
    restoreToolFromUrl();
    window.addEventListener('popstate', restoreToolFromUrl);
    container.hidden = false;
    const notice = document.getElementById('calculator-load-notice');
    if (notice) notice.hidden = true;
  });

  window.switchTab = switchTab;
  window.updatePhysicsInputs = updatePhysicsInputs;
  window.calculatePhysics = calculatePhysics;
  window.updateUnitOptions = updateUnitOptions;
  window.performConversion = performConversion;
})();

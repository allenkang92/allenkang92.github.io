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

export { BasicCalculator, PhysicsCalculator };

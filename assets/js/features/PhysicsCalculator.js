class PhysicsCalculator {
  constructor() {
    this.formulas = {
      velocity: {
        name: '속도',
        formula: 'v = d/t',
        inputs: ['distance (m)', 'time (s)'],
        calculate: (d, t) => {
          if (t === 0) throw new Error('시간은 0이 될 수 없습니다');
          return d / t;
        },
        unit: 'm/s'
      },
      acceleration: {
        name: '가속도',
        formula: 'a = Δv/t',
        inputs: ['velocity change (m/s)', 'time (s)'],
        calculate: (v, t) => {
          if (t === 0) throw new Error('시간은 0이 될 수 없습니다');
          return v / t;
        },
        unit: 'm/s²'
      },
      force: {
        name: '힘',
        formula: 'F = ma',
        inputs: ['mass (kg)', 'acceleration (m/s²)'],
        calculate: (m, a) => m * a,
        unit: 'N'
      },
      kinetic: {
        name: '운동 에너지',
        formula: 'K = ½mv²',
        inputs: ['mass (kg)', 'velocity (m/s)'],
        calculate: (m, v) => 0.5 * m * v * v,
        unit: 'J'
      },
      potential: {
        name: '위치 에너지',
        formula: 'U = mgh',
        inputs: ['mass (kg)', 'height (m)'],
        calculate: (m, h) => m * 9.81 * h,
        unit: 'J'
      }
    };
  }

  getFormulas() {
    return Object.entries(this.formulas).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }

  calculate(formulaId, inputs) {
    const formula = this.formulas[formulaId];
    if (!formula) throw new Error('지원하지 않는 공식입니다');

    const values = inputs.map(value => {
      const num = parseFloat(value);
      if (isNaN(num)) throw new Error('모든 입력값은 숫자여야 합니다');
      return num;
    });

    return {
      result: formula.calculate(...values),
      unit: formula.unit
    };
  }
}

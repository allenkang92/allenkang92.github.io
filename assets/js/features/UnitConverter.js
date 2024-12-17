class UnitConverter {
  constructor() {
    this.categories = {
      length: {
        units: ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'],
        baseUnit: 'm',
        conversions: {
          mm: 0.001,
          cm: 0.01,
          m: 1,
          km: 1000,
          in: 0.0254,
          ft: 0.3048,
          yd: 0.9144,
          mi: 1609.34
        }
      },
      weight: {
        units: ['mg', 'g', 'kg', 'oz', 'lb'],
        baseUnit: 'kg',
        conversions: {
          mg: 0.000001,
          g: 0.001,
          kg: 1,
          oz: 0.0283495,
          lb: 0.453592
        }
      },
      temperature: {
        units: ['°C', '°F', 'K'],
        baseUnit: '°C'
      }
    };
  }

  convert(value, fromUnit, toUnit) {
    if (!value || isNaN(value)) throw new Error('유효한 숫자를 입력하세요');
    if (fromUnit === toUnit) return value;

    const category = this.findCategory(fromUnit);
    if (!category) throw new Error('지원하지 않는 단위입니다');

    if (category === 'temperature') {
      return this.convertTemperature(value, fromUnit, toUnit);
    }

    const baseValue = this.toBaseUnit(value, fromUnit, category);
    return this.fromBaseUnit(baseValue, toUnit, category);
  }

  findCategory(unit) {
    for (const [category, data] of Object.entries(this.categories)) {
      if (data.units.includes(unit)) return category;
    }
    return null;
  }

  toBaseUnit(value, fromUnit, category) {
    const { conversions, baseUnit } = this.categories[category];
    return value * conversions[fromUnit];
  }

  fromBaseUnit(value, toUnit, category) {
    const { conversions } = this.categories[category];
    return value / conversions[toUnit];
  }

  convertTemperature(value, fromUnit, toUnit) {
    let celsius;

    switch (fromUnit) {
      case '°C': celsius = value; break;
      case '°F': celsius = (value - 32) * 5/9; break;
      case 'K': celsius = value - 273.15; break;
      default: throw new Error('지원하지 않는 온도 단위입니다');
    }

    switch (toUnit) {
      case '°C': return celsius;
      case '°F': return (celsius * 9/5) + 32;
      case 'K': return celsius + 273.15;
      default: throw new Error('지원하지 않는 온도 단위입니다');
    }
  }

  getCategories() {
    return Object.keys(this.categories);
  }

  getUnits(category) {
    return this.categories[category]?.units || [];
  }
}

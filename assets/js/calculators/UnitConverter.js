export class UnitConverter {
  constructor() {
    this.conversionRates = {
      length: {
        mm: 0.001,
        cm: 0.01,
        m: 1,
        km: 1000,
        inch: 0.0254,
        ft: 0.3048,
        yd: 0.9144,
        mile: 1609.34
      },
      weight: {
        mg: 0.001,
        g: 1,
        kg: 1000,
        oz: 28.3495,
        lb: 453.592
      },
      temperature: {
        C: 'celsius',
        F: 'fahrenheit',
        K: 'kelvin'
      },
      area: {
        'm²': 1,
        'km²': 1000000,
        'ha': 10000,
        'acre': 4046.86,
        'ft²': 0.092903
      },
      volume: {
        'ml': 0.001,
        'l': 1,
        'm³': 1000,
        'gal': 3.78541,
        'qt': 0.946353
      }
    };
  }

  convert(value, fromUnit, toUnit, category) {
    if (!value || isNaN(value)) return '0';
    
    if (category === 'temperature') {
      return this.convertTemperature(value, fromUnit, toUnit);
    }

    const rates = this.conversionRates[category];
    if (!rates || !rates[fromUnit] || !rates[toUnit]) {
      return '변환할 수 없는 단위입니다.';
    }

    const baseValue = value * rates[fromUnit];
    const result = baseValue / rates[toUnit];
    return this.formatResult(result);
  }

  convertTemperature(value, fromUnit, toUnit) {
    let celsius;
    
    // 먼저 섭씨로 변환
    switch(fromUnit) {
      case 'C':
        celsius = value;
        break;
      case 'F':
        celsius = (value - 32) * 5/9;
        break;
      case 'K':
        celsius = value - 273.15;
        break;
    }

    // 목표 단위로 변환
    let result;
    switch(toUnit) {
      case 'C':
        result = celsius;
        break;
      case 'F':
        result = (celsius * 9/5) + 32;
        break;
      case 'K':
        result = celsius + 273.15;
        break;
    }

    return this.formatResult(result);
  }

  formatResult(value) {
    return Number(value.toFixed(4)).toString();
  }

  getUnitOptions(category) {
    const units = Object.keys(this.conversionRates[category]);
    return units.map(unit => `<option value="${unit}">${unit}</option>`).join('');
  }

  getCategories() {
    return Object.keys(this.conversionRates);
  }
}

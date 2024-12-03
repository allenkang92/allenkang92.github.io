export class PhysicsCalculator {
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

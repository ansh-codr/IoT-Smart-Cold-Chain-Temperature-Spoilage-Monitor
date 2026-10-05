export class PRNG {
  constructor(seed) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  gaussian(mean = 0, std = 1) {
    let u = 0, v = 0;
    while(u === 0) u = this.next(); 
    while(v === 0) v = this.next();
    const num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    return num * std + mean;
  }
}

export class SensorModel {
  constructor(prng, config = {}) {
    this.prng = prng;
    this.vocBaseline = config.vocBaseline || 300;
    this.temp = 4.0;
    this.humidity = 75.0;
    this.voc = this.vocBaseline;
    this.targetTemp = 4.0;
    this.vocDelta = 0;
    this.inertia = config.inertia || 0.1;
  }
  
  setTargetTemp(target) {
    this.targetTemp = target;
  }

  setVocDelta(delta) {
    this.vocDelta = delta;
  }

  tick() {
    this.temp += (this.targetTemp - this.temp) * this.inertia;
    const tempNoise = this.prng.gaussian(0, 0.1);
    
    const targetHumidity = 75.0 + (this.temp - 4.0) * 1.5;
    this.humidity += (targetHumidity - this.humidity) * 0.2;
    const humNoise = this.prng.gaussian(0, 0.5);

    const targetVoc = this.vocBaseline + this.vocDelta;
    this.voc += (targetVoc - this.voc) * 0.1;
    const vocNoise = this.prng.gaussian(0, 5);

    return {
      temp_c: Math.round((this.temp + tempNoise) * 100) / 100,
      humidity: Math.max(0, Math.min(100, Math.round((this.humidity + humNoise) * 10) / 10)),
      voc_raw: Math.max(0, Math.min(4095, Math.round(this.voc + vocNoise)))
    };
  }
}

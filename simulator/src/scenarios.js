export class ScenarioManager {
  constructor(sensorModel) {
    this.sensorModel = sensorModel;
    this.currentScenario = 'normal';
    this.timeInScenario = 0;
    this.scenarioQueue = [];
    this.offline = false;
  }

  setScenario(scenariosStr) {
    const parts = scenariosStr.split(',').map(s => s.trim()).filter(s => s);
    if (parts.length > 0) {
      this.currentScenario = parts[0];
      this.scenarioQueue = parts.slice(1);
      this.timeInScenario = 0;
      this.resetState();
    }
  }

  resetState() {
    this.sensorModel.setTargetTemp(4.0);
    this.sensorModel.setVocDelta(0);
    this.offline = false;
  }

  tick(intervalSecs) {
    this.timeInScenario += intervalSecs;
    
    switch (this.currentScenario) {
      case 'normal':
        this.sensorModel.setTargetTemp(4.0);
        this.sensorModel.setVocDelta(0);
        break;
      case 'breach':
        if (this.timeInScenario <= 20) {
          this.sensorModel.setTargetTemp(4.0);
        } else if (this.timeInScenario <= 80) {
          this.sensorModel.setTargetTemp(12.0);
        } else {
          this.sensorModel.setTargetTemp(4.0);
        }
        break;
      case 'door_open':
        if (this.timeInScenario <= 15) {
          this.sensorModel.setTargetTemp(8.0);
        } else {
          this.sensorModel.setTargetTemp(4.0);
        }
        break;
      case 'slow_drift':
        const extraTemp = Math.min(5.0, (this.timeInScenario / 10) * 0.1);
        this.sensorModel.setTargetTemp(4.0 + extraTemp);
        break;
      case 'spoilage':
        this.sensorModel.setTargetTemp(4.0);
        const delta = Math.min(1000, this.timeInScenario * 2); 
        this.sensorModel.setVocDelta(delta);
        break;
      case 'offline_burst':
        this.sensorModel.setTargetTemp(4.0);
        if (this.timeInScenario > 15 && this.timeInScenario <= 75) {
          this.offline = true;
        } else {
          this.offline = false;
        }
        break;
    }

    return { offline: this.offline };
  }
}

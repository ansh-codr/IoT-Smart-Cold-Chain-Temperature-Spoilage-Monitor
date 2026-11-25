import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAlertNotification,
  formatStatusMessage,
  formatReportSummary,
  generateReadingsCsv
} from '../src/services/telegramFormatter.js';

describe('telegramFormatter', () => {
  it('formats an alert notification correctly', () => {
    const alert = {
      severity: 'critical',
      type: 'TEMP_HIGH',
      action: 'opened',
      peak_value: 12.5,
      message: 'Temperature exceeded 8.0°C',
      started_at: 1717200000
    };
    const text = formatAlertNotification('node-01', alert);
    assert.match(text, /🚨 \*COLD-CHAIN ALERT: CRITICAL\*/);
    assert.match(text, /Node ID\*: `node-01`/);
    assert.match(text, /12\.5/);
    assert.match(text, /TEMP_HIGH/);
  });

  it('formats a status message correctly', () => {
    const data = {
      online: true,
      product_profile: { name: 'Insulin', t_min_c: 2, t_max_c: 8 },
      latest_reading: {
        temp_c: 4.2,
        ds18b20_temp_c: 4.15,
        humidity: 65,
        voc_raw: 410,
        ts: 1717200000
      },
      shelf_life: {
        remaining_life_percent: 88.5,
        remaining_life_hours: 212.4,
        rate_factor: 1.05
      }
    };
    const text = formatStatusMessage('node-01', data);
    assert.match(text, /🟢 Online/);
    assert.match(text, /Insulin/);
    assert.match(text, /4\.2°C/);
    assert.match(text, /88\.5%/);
  });

  it('generates a CSV report from readings array', () => {
    const readings = [
      {
        ts: 1717200000,
        temp_c: 4.0,
        ds18b20_temp_c: 3.98,
        dht22_temp_c: 4.05,
        humidity: 60,
        voc_raw: 380,
        buffered: false,
        seq: 1
      }
    ];
    const csv = generateReadingsCsv(readings);
    assert.match(csv, /Timestamp_UTC,Temp_C,DS18B20_Temp_C/);
    assert.match(csv, /4,3\.98,4\.05,60,380,false,1/);
  });
});

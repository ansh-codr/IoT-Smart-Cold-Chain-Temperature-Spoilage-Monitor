/**
 * services/telegramFormatter.js — Message formatting for Telegram Bot
 *
 * Formats alerts, real-time status snapshots, audit reports, and CSVs.
 */

export function formatAlertNotification(deviceId, alert) {
  const isCritical = alert.severity === 'critical';
  const icon = isCritical ? '🚨' : '⚠️';
  const actionLabel = alert.action ? alert.action.toUpperCase() : 'TRIGGERED';
  const dateStr = alert.started_at
    ? new Date(alert.started_at * 1000).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
    : 'Just now';

  return (
    `${icon} *COLD-CHAIN ALERT: ${alert.severity.toUpperCase()}*\n` +
    `• *Node ID*: \`${deviceId}\`\n` +
    `• *Alert Type*: \`${alert.type}\` (${actionLabel})\n` +
    `• *Value/Peak*: ${alert.peak_value != null ? alert.peak_value : 'N/A'}\n` +
    `• *Details*: ${alert.message || 'Threshold condition breached'}\n` +
    `• *Time*: ${dateStr}`
  );
}

export function formatStatusMessage(deviceId, data) {
  const onlineEmoji = data.online ? '🟢 Online' : '🔴 Offline';
  const latest = data.latest_reading;
  const profile = data.product_profile;
  const shelfLife = data.shelf_life;

  let msg = `❄️ *ColdChain Status: \`${deviceId}\`*\n`;
  msg += `• *Connectivity*: ${onlineEmoji}\n`;

  if (profile) {
    msg += `• *Monitored Product*: *${profile.name}* (${profile.t_min_c}°C to ${profile.t_max_c}°C)\n`;
  }

  if (latest) {
    const probeStr = latest.ds18b20_temp_c != null ? ` (DS18B20: ${latest.ds18b20_temp_c}°C)` : '';
    msg += `• *Temperature*: *${latest.temp_c}°C*${probeStr}\n`;
    msg += `• *Humidity*: ${latest.humidity != null ? `${latest.humidity}%` : 'N/A'}\n`;
    msg += `• *VOC (Gas)*: ${latest.voc_raw} ADC\n`;
    const readTime = new Date(latest.ts * 1000).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    msg += `• *Last Telemetry*: ${readTime}\n`;
  } else {
    msg += `• *Telemetry*: No readings received yet\n`;
  }

  if (shelfLife) {
    const pct = Number(shelfLife.remaining_life_percent).toFixed(1);
    const hrs = Number(shelfLife.remaining_life_hours).toFixed(1);
    const factor = Number(shelfLife.rate_factor).toFixed(2);
    msg += `• *Remaining Shelf Life*: *${pct}%* (${hrs} hrs left)\n`;
    msg += `• *Aging Burn Rate*: ${factor}× reference speed\n`;
  }

  if (data.spoilage_risk) {
    const sri = data.spoilage_risk;
    const badge = sri.level === 'critical' ? '🔴' : sri.level === 'moderate' ? '🟠' : sri.level === 'low' ? '🟡' : '🟢';
    msg += `• *Dual-Modal Spoilage Risk*: ${badge} *${sri.sri_score}%* (${sri.status_label})\n`;
    if (sri.synergy_factor > 1.0) {
      msg += `  ↳ _Cross-modal kinetic synergy active (${sri.synergy_factor}×)_\n`;
    }
  }

  if (data.active_alert) {
    msg += `\n⚠️ *Active Warning*: \`${data.active_alert.type}\` (${data.active_alert.severity})\n`;
  }

  return msg;
}

export function formatReportSummary(deviceId, { profile, stats, count }) {
  let msg = `📊 *Audit Report Summary: \`${deviceId}\`*\n`;
  if (profile) {
    msg += `• *Product*: *${profile.name}* (Safe: ${profile.t_min_c}°C to ${profile.t_max_c}°C)\n`;
  }
  msg += `• *Sample Count*: ${count} telemetry records\n`;

  if (stats) {
    msg += `• *Temp Min / Max / Avg*: ${stats.minTemp.toFixed(2)}°C / ${stats.maxTemp.toFixed(2)}°C / ${stats.avgTemp.toFixed(2)}°C\n`;
    msg += `• *Safe Zone Excursions*: ${stats.excursions} incidents\n`;
    msg += `• *Avg Humidity*: ${stats.avgHumidity.toFixed(1)}%\n`;
  }

  msg += `\n📎 Detailed audit CSV data attached below.`;
  return msg;
}

export function generateReadingsCsv(readings) {
  const headers = ['Timestamp_UTC', 'Temp_C', 'DS18B20_Temp_C', 'DHT22_Temp_C', 'Humidity', 'VOC_Raw', 'Buffered', 'Seq'];
  const lines = [headers.join(',')];

  for (const r of readings) {
    const tsStr = new Date(r.ts * 1000).toISOString();
    lines.push([
      tsStr,
      r.temp_c != null ? r.temp_c : '',
      r.ds18b20_temp_c != null ? r.ds18b20_temp_c : '',
      r.dht22_temp_c != null ? r.dht22_temp_c : '',
      r.humidity != null ? r.humidity : '',
      r.voc_raw != null ? r.voc_raw : '',
      r.buffered ? 'true' : 'false',
      r.seq != null ? r.seq : ''
    ].join(','));
  }

  return lines.join('\n');
}

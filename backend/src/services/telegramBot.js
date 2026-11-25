/**
 * services/telegramBot.js — Native Telegram Bot Service
 *
 * Implements push alerts, interactive command menu, dynamic node resolution (node-03, 4, 05),
 * and inline keyboard buttons for zero-typing interaction. Built with Node 20+ native fetch.
 */

import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import * as stateRepo from '../db/stateRepo.js';
import * as readingsRepo from '../db/readingsRepo.js';
import * as alertsRepo from '../db/alertsRepo.js';
import { computeRemaining } from './decayModel.js';
import {
  formatAlertNotification,
  formatStatusMessage,
  formatReportSummary,
  generateReadingsCsv
} from './telegramFormatter.js';

let isRunning = false;
let pollingAbortController = null;

const getApiUrl = (method) => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;

export async function sendMessage(chatId, text, parseMode = 'Markdown', replyMarkup = null) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  try {
    const body = { chat_id: chatId, text, parse_mode: parseMode };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const res = await fetch(getApiUrl('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) console.warn('[telegram] Send message failed:', data.description);
  } catch (err) {
    console.error('[telegram] Network error sending message:', err.message);
  }
}

export async function sendDocument(chatId, filename, content, caption = '') {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    if (caption) form.append('caption', caption);
    const blob = new Blob([content], { type: 'text/csv' });
    form.append('document', blob, filename);
    const res = await fetch(getApiUrl('sendDocument'), { method: 'POST', body: form });
    const data = await res.json();
    if (!data.ok) console.warn('[telegram] Send document failed:', data.description);
  } catch (err) {
    console.error('[telegram] Network error sending document:', err.message);
  }
}

export async function notifyAlert(deviceId, alert) {
  if (!env.TELEGRAM_ENABLED || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const text = formatAlertNotification(deviceId, alert);
  await sendMessage(env.TELEGRAM_CHAT_ID, text);
}

// Auto-resolves: "3" -> "node-03", "04" -> "node-04", or defaults to most active live node
async function resolveDeviceId(arg) {
  if (arg) {
    const clean = arg.trim().toLowerCase();
    if (/^\d+$/.test(clean)) return `node-${clean.padStart(2, '0')}`;
    return clean;
  }
  try {
    const [rows] = await pool.execute('SELECT device_id FROM device_state ORDER BY last_ts DESC LIMIT 1');
    if (rows.length > 0 && rows[0].device_id) return rows[0].device_id;
  } catch (_) {}
  return 'node-03';
}

async function getDeviceButtons(prefix = 'status') {
  try {
    const [devices] = await pool.execute('SELECT device_id FROM devices ORDER BY device_id ASC');
    if (!devices.length) return null;
    const buttons = devices.map(d => ({ text: `📦 ${d.device_id}`, callback_data: `${prefix}:${d.device_id}` }));
    const rows = [];
    for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
    return { inline_keyboard: rows };
  } catch (_) { return null; }
}

async function executeStatus(chatId, devId) {
  const deviceData = await stateRepo.getDeviceWithProfile(devId);
  if (!deviceData) return sendMessage(chatId, `❌ Node \`${devId}\` not registered.`);

  const state = await stateRepo.getState(pool, devId);
  const latestReading = await readingsRepo.getLatestReading(devId);
  const activeAlert = await alertsRepo.getPrimaryOpenAlert(devId);
  const now = Math.floor(Date.now() / 1000);
  const online = state ? (now - state.last_ts) <= env.ONLINE_THRESHOLD_S : false;

  let shelfLife = null;
  if (deviceData.profile && state) {
    shelfLife = computeRemaining(state.consumed_life_hours, deviceData.profile);
    shelfLife.rate_factor = state.last_rate_factor;
  }
  const msg = formatStatusMessage(devId, { online, latest_reading: latestReading, product_profile: deviceData.profile, shelf_life: shelfLife, active_alert: activeAlert });
  const keyboard = await getDeviceButtons('status');
  await sendMessage(chatId, msg, 'Markdown', keyboard);
}

async function executeReport(chatId, devId) {
  const deviceData = await stateRepo.getDeviceWithProfile(devId);
  const readings = await readingsRepo.queryReadings({ device_id: devId, limit: 150 });
  if (!readings.length) return sendMessage(chatId, `No readings found for \`${devId}\` to generate report.`);

  let minT = Infinity, maxT = -Infinity, sumT = 0, sumH = 0, excursions = 0;
  const profile = deviceData?.profile;
  for (const r of readings) {
    const t = Number(r.temp_c);
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
    sumT += t;
    if (r.humidity != null) sumH += Number(r.humidity);
    if (profile && (t < profile.t_min_c || t > profile.t_max_c)) excursions++;
  }
  const stats = { minTemp: minT, maxTemp: maxT, avgTemp: sumT / readings.length, avgHumidity: sumH / readings.length, excursions };
  const summary = formatReportSummary(devId, { profile, stats, count: readings.length });
  const csvContent = generateReadingsCsv(readings);
  await sendDocument(chatId, `${devId}_audit_${Date.now()}.csv`, csvContent, summary);
}

async function executeAlerts(chatId, devId) {
  const openAlerts = await alertsRepo.getOpenAlerts(devId);
  if (!openAlerts.length) return sendMessage(chatId, `✅ No active excursions for \`${devId}\`. All parameters normal.`);
  const lines = openAlerts.map(a => `• *${a.type}* (${a.severity}): ${a.message || 'Breached'} (Peak: ${a.peak_value ?? 'N/A'})`).join('\n');
  await sendMessage(chatId, `⚠️ *Active Alerts for \`${devId}\`*:\n${lines}`);
}

async function handleCommand(chatId, text) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase().replace(/@\w+$/, '');
  const arg = parts[1];

  if (cmd === '/start' || cmd === '/help') {
    const helpMsg = `❄️ *ColdChain IQ Telegram Bot*\n\nTap any command or use the / menu:\n• /status — Live sensor telemetry & shelf life\n• /report — Audit summary & CSV readings export\n• /alerts — Active excursions & risk register\n• /devices — List all registered cold-chain nodes\n• /help — Show this guide\n\n_Tip: You can specify nodes like \`/status node-03\`, \`/status 4\`, or \`/report 05\`!_`;
    const keyboard = await getDeviceButtons('status');
    await sendMessage(chatId, helpMsg, 'Markdown', keyboard);
  } else if (cmd === '/devices') {
    const [devices] = await pool.execute('SELECT device_id FROM devices ORDER BY device_id ASC');
    if (!devices.length) return sendMessage(chatId, 'No devices registered yet.');
    const lines = devices.map(d => `• \`${d.device_id}\``).join('\n');
    const keyboard = await getDeviceButtons('status');
    await sendMessage(chatId, `📦 *Monitored Cold-Chain Nodes*:\n${lines}\n\nTap a node below to view its live status:`, 'Markdown', keyboard);
  } else if (cmd === '/status') {
    const devId = await resolveDeviceId(arg);
    await executeStatus(chatId, devId);
  } else if (cmd === '/report') {
    const devId = await resolveDeviceId(arg);
    await executeReport(chatId, devId);
  } else if (cmd === '/alerts') {
    const devId = await resolveDeviceId(arg);
    await executeAlerts(chatId, devId);
  }
}

async function handleCallbackQuery(cb) {
  try {
    await fetch(getApiUrl('answerCallbackQuery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cb.id })
    });
    const data = cb.data || '';
    const [action, devId] = data.split(':');
    if (action === 'status' && devId) await executeStatus(cb.message.chat.id, devId);
    if (action === 'report' && devId) await executeReport(cb.message.chat.id, devId);
  } catch (err) {
    console.warn('[telegram] Error answering callback:', err.message);
  }
}

async function registerBotCommands() {
  try {
    await fetch(getApiUrl('setMyCommands'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'status', description: 'Live temp, humidity, VOC & shelf life' },
          { command: 'report', description: 'Audit summary & download CSV' },
          { command: 'alerts', description: 'Active warnings & excursion register' },
          { command: 'devices', description: 'List monitored hardware nodes' },
          { command: 'help', description: 'Show all bot commands and usage' }
        ]
      })
    });
  } catch (_) {}
}

export function startTelegramBot() {
  if (!env.TELEGRAM_ENABLED || !env.TELEGRAM_BOT_TOKEN) return;
  isRunning = true;
  pollingAbortController = new AbortController();
  console.log('[telegram] 🤖 Telegram Bot listener starting...');
  registerBotCommands();

  (async () => {
    let offset = 0;
    while (isRunning) {
      try {
        const res = await fetch(getApiUrl(`getUpdates?offset=${offset}&timeout=20`), { signal: pollingAbortController.signal });
        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const u of data.result) {
            offset = u.update_id + 1;
            if (u.message?.text) await handleCommand(u.message.chat.id, u.message.text);
            if (u.callback_query) await handleCallbackQuery(u.callback_query);
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') break;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  })();
}

export function stopTelegramBot() {
  isRunning = false;
  if (pollingAbortController) pollingAbortController.abort();
  console.log('[telegram] Telegram Bot listener stopped.');
}

/**
 * ESP32 Cold Chain Monitor — Validated Firmware
 * 
 * GLA University | B.Tech CSE Final Year Project
 * Smart Cold Chain Temperature & Spoilage Monitor
 *
 * Hardware:
 *   DS18B20  → GPIO 14  (1-Wire, 4.7kΩ pull-up to 3.3V)
 *   DHT22    → GPIO 27  (Single-wire)
 *   MQ-135   → GPIO 34  (Analog ADC, 12-bit, 0–4095)
 *
 * Libraries required (install via Arduino Library Manager):
 *   - OneWire              (by Paul Stoffregen)
 *   - DallasTemperature    (by Miles Burton)
 *   - DHT sensor library   (by Adafruit)
 *   - Adafruit Unified Sensor (dependency of DHT)
 *   - ArduinoJson          (by Benoit Blanchon, v6 or v7)
 *   - NTPClient            (by Fabrice Weinberg)
 *
 * Board: ESP32 Dev Module (Espressif Systems, install via Board Manager)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <NTPClient.h>
#include <WiFiUDP.h>
#include <Preferences.h>

// ─── Pin Configuration ────────────────────────────────────────────────────────
#define DS18B20_PIN    14    // DS18B20 1-Wire data pin
#define DHT_PIN        27    // DHT22 data pin
#define DHT_TYPE       DHT22
#define MQ135_PIN      34    // MQ-135 analog ADC pin

// ─── Network & Server Configuration ──────────────────────────────────────────
// NOTE: Both the ESP32 and your laptop must be on the same 2.4GHz network.
// Change SERVER_IP to the LAN IP shown by `ipconfig getifaddr en0` on your Mac.
const char* WIFI_SSID     = "Airtel_Ansh_Yadav";
const char* WIFI_PASS     = "Anshrao2311@";
const char* SERVER_URL    = "http://192.168.1.3:5000/api/readings";
const char* DEVICE_ID     = "node-01";

// ─── Timing Configuration ────────────────────────────────────────────────────
const unsigned long READING_INTERVAL_MS = 2000;  // 2s normal sending interval
const unsigned long WIFI_RETRY_MS       = 5000;  // 5s between WiFi retries
const unsigned long NTP_SYNC_INTERVAL_MS = 3600000UL; // Re-sync NTP every hour

// ─── Offline Ring Buffer ──────────────────────────────────────────────────────
#define BUFFER_SIZE 50

struct Reading {
  unsigned long ts;
  float temp_c;
  float humidity;
  int   voc_raw;
  int   seq;
};

Reading ringBuffer[BUFFER_SIZE];
int bufHead    = 0;   // next write slot (overwrites oldest when full)
int bufCount   = 0;   // number of valid readings currently buffered

// ─── Library Objects ─────────────────────────────────────────────────────────
OneWire           oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
DHT               dht(DHT_PIN, DHT_TYPE);
WiFiUDP           ntpUDP;
// UTC+5:30 = 19800 seconds offset for IST
NTPClient         timeClient(ntpUDP, "pool.ntp.org", 19800, 60000);
Preferences       prefs;

// ─── State ───────────────────────────────────────────────────────────────────
int  seqCounter    = 0;
bool ntpSynced     = false;
unsigned long lastNtpSyncMs = 0;

// ─────────────────────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[ESP32] Cold Chain Monitor — Booting...");

  // Load persisted seq counter from NVS flash (survives resets)
  prefs.begin("coldchain", false);
  seqCounter = prefs.getInt("seq", 0);
  Serial.printf("[ESP32] Resumed from seq=%d\n", seqCounter);

  // Init sensors
  ds18b20.begin();
  dht.begin();
  Serial.println("[ESP32] Sensors initialized (DS18B20, DHT22, MQ-135)");

  // Connect to WiFi
  connectWiFi();

  // Start NTP
  timeClient.begin();
  syncNTP();
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LOOP
// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  static unsigned long lastReadMs = 0;

  unsigned long now = millis();

  // Periodic NTP re-sync
  if (ntpSynced && (now - lastNtpSyncMs > NTP_SYNC_INTERVAL_MS)) {
    syncNTP();
  }

  if (now - lastReadMs >= READING_INTERVAL_MS) {
    lastReadMs = now;
    readAndSend();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WiFi Connection with Retry
// ─────────────────────────────────────────────────────────────────────────────
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WiFi] Connecting to SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected! IP: %s  RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("\n[WiFi] Failed — will retry on next reading cycle");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NTP Time Sync
// ─────────────────────────────────────────────────────────────────────────────
void syncNTP() {
  if (WiFi.status() != WL_CONNECTED) return;

  timeClient.update();
  ntpSynced = true;
  lastNtpSyncMs = millis();
  Serial.printf("[NTP] Synced — IST time: %s  Unix: %lu\n",
                timeClient.getFormattedTime().c_str(),
                (unsigned long)timeClient.getEpochTime());
}

// ─────────────────────────────────────────────────────────────────────────────
// Read Sensors
// ─────────────────────────────────────────────────────────────────────────────
bool readSensors(float &tempC, float &humidity, int &vocRaw) {
  // DS18B20 temperature
  ds18b20.requestTemperatures();
  tempC = ds18b20.getTempCByIndex(0);
  if (tempC == DEVICE_DISCONNECTED_C || tempC < -40.0 || tempC > 85.0) {
    // Fall back to DHT22 temperature if DS18B20 fails
    tempC = dht.readTemperature();
  }

  // DHT22 humidity
  humidity = dht.readHumidity();

  // MQ-135 raw ADC (12-bit, 0–4095)
  vocRaw = analogRead(MQ135_PIN);

  // Validate
  if (isnan(tempC) || isnan(humidity)) {
    Serial.println("[Sensor] ERROR: Failed to read from DHT22");
    return false;
  }
  if (tempC < -40.0 || tempC > 85.0) {
    Serial.printf("[Sensor] ERROR: temp_c=%.2f out of range\n", tempC);
    return false;
  }
  if (humidity < 0.0 || humidity > 100.0) {
    Serial.printf("[Sensor] ERROR: humidity=%.2f out of range\n", humidity);
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Read Sensors, Buffer Offline, and Send
// ─────────────────────────────────────────────────────────────────────────────
void readAndSend() {
  float tempC   = 0.0;
  float humidity = 0.0;
  int   vocRaw  = 0;

  if (!readSensors(tempC, humidity, vocRaw)) {
    Serial.println("[ESP32] Skipping send — sensor read failed");
    return;
  }

  // Get timestamp
  unsigned long ts = 0;
  if (ntpSynced) {
    ts = (unsigned long)timeClient.getEpochTime();
  } else {
    // Fallback: use millis()-based offset from an assumed start time
    // This will be inaccurate but preserves sequence ordering
    ts = 1700000000UL + (millis() / 1000UL);
  }

  // Increment & persist seq counter
  seqCounter++;
  prefs.putInt("seq", seqCounter);

  Serial.printf("[Sensor] seq=%d  T=%.2f°C  RH=%.1f%%  VOC=%d  ts=%lu\n",
                seqCounter, tempC, humidity, vocRaw, ts);

  // Try to send directly if WiFi is available
  if (WiFi.status() == WL_CONNECTED) {
    // First: flush any offline buffered readings
    if (bufCount > 0) {
      flushBuffer();
    }

    // Then: send current reading live
    bool sent = sendReading(ts, tempC, humidity, vocRaw, seqCounter, false);
    if (!sent) {
      // Send failed despite WiFi — buffer this reading
      bufferReading(ts, tempC, humidity, vocRaw, seqCounter);
    }
  } else {
    // No WiFi — buffer this reading for later
    Serial.println("[ESP32] WiFi offline — buffering reading");
    bufferReading(ts, tempC, humidity, vocRaw, seqCounter);
    connectWiFi(); // attempt reconnect for next cycle
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Send a Single Reading via HTTP POST
// Returns true on HTTP 200/201
// ─────────────────────────────────────────────────────────────────────────────
bool sendReading(unsigned long ts, float tempC, float humidity,
                 int vocRaw, int seq, bool buffered) {
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000); // 5s timeout

  // Build JSON payload — matches POST /api/readings contract
  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["seq"]       = seq;
  doc["ts"]        = (unsigned long)ts;
  doc["temp_c"]    = round(tempC * 100.0) / 100.0;  // 2 decimal places
  doc["humidity"]  = round(humidity * 10.0) / 10.0; // 1 decimal place
  doc["voc_raw"]   = vocRaw;
  doc["buffered"]  = buffered;

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  http.end();

  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("[HTTP] POST OK (%d) seq=%d buffered=%s\n",
                  httpCode, seq, buffered ? "true" : "false");
    return true;
  } else {
    Serial.printf("[HTTP] POST FAIL (%d) seq=%d\n", httpCode, seq);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Send a Batch of Readings (for offline buffer flush)
// Returns number successfully acknowledged
// ─────────────────────────────────────────────────────────────────────────────
int sendBatch(Reading* readings, int count) {
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000); // 10s for batches

  // Build JSON array payload
  DynamicJsonDocument doc(256 * count + 64);
  JsonArray arr = doc.to<JsonArray>();

  for (int i = 0; i < count; i++) {
    JsonObject obj = arr.createNestedObject();
    obj["device_id"] = DEVICE_ID;
    obj["seq"]       = readings[i].seq;
    obj["ts"]        = readings[i].ts;
    obj["temp_c"]    = round(readings[i].temp_c * 100.0) / 100.0;
    obj["humidity"]  = round(readings[i].humidity * 10.0) / 10.0;
    obj["voc_raw"]   = readings[i].voc_raw;
    obj["buffered"]  = true;  // All flushed readings are buffered
  }

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  String response = http.getString();
  http.end();

  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("[HTTP] Batch OK (%d) — sent %d buffered readings\n", httpCode, count);
    return count;
  } else {
    Serial.printf("[HTTP] Batch FAIL (%d): %s\n", httpCode, response.c_str());
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Add a Reading to the Ring Buffer (overwrites oldest when full)
// ─────────────────────────────────────────────────────────────────────────────
void bufferReading(unsigned long ts, float tempC, float humidity,
                   int vocRaw, int seq) {
  ringBuffer[bufHead] = { ts, tempC, humidity, vocRaw, seq };
  bufHead = (bufHead + 1) % BUFFER_SIZE;

  if (bufCount < BUFFER_SIZE) {
    bufCount++;
  }
  // If bufCount == BUFFER_SIZE, oldest reading is silently overwritten (ring behavior)
  Serial.printf("[Buffer] Stored reading seq=%d  buffer=%d/%d\n",
                seq, bufCount, BUFFER_SIZE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Flush the Ring Buffer to the Backend as a Single Batch POST
// ─────────────────────────────────────────────────────────────────────────────
void flushBuffer() {
  if (bufCount == 0) return;

  Serial.printf("[Buffer] Flushing %d offline readings...\n", bufCount);

  // Reconstruct the ordered buffer starting from the tail (oldest first)
  // Ring buffer tail = (bufHead - bufCount + BUFFER_SIZE) % BUFFER_SIZE
  int tail = (bufHead - bufCount + BUFFER_SIZE) % BUFFER_SIZE;

  Reading ordered[BUFFER_SIZE];
  for (int i = 0; i < bufCount; i++) {
    ordered[i] = ringBuffer[(tail + i) % BUFFER_SIZE];
  }

  int sent = sendBatch(ordered, bufCount);
  if (sent == bufCount) {
    // All readings acknowledged — clear buffer
    bufCount = 0;
    bufHead  = 0;
    Serial.println("[Buffer] Fully flushed — buffer cleared");
  } else {
    Serial.printf("[Buffer] Partial send (%d/%d) — will retry next cycle\n",
                  sent, bufCount);
  }
}


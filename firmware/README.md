# Firmware — ESP32 Arduino C++
**Scaffold only. Implementation deferred to the firmware phase.**

## Hardware

| Component | Role | Notes |
|---|---|---|
| ESP32 (any variant) | MCU + WiFi | Dual-core, 240 MHz |
| DS18B20 | Temperature | 1-Wire protocol, ±0.5°C accuracy |
| DHT22 | Temperature + Humidity | Single-wire protocol, ±0.5°C / ±2% RH |
| MQ-135 | VOC gas (indicative) | Requires 24h warm-up; output is raw ADC |

## Configuration (`config.h`)

The firmware agent must create `firmware/src/config.h` with at least:

```cpp
// Backend server URL — set to the laptop's LAN IP
#define SERVER_URL "http://192.168.1.100:3000/api/readings"

// Unique identifier for this sensor node
// Must match a device_id registered in the backend DB
#define DEVICE_ID "esp32-001"

// WiFi credentials
#define WIFI_SSID "YourSSID"
#define WIFI_PASS "YourPassword"

// Sensor reading interval in milliseconds
#define READING_INTERVAL_MS 30000

// Maximum readings to buffer offline (SPIFFS or EEPROM)
#define OFFLINE_BUFFER_SIZE 200
```

## Behaviour Spec (for the firmware agent)

1. Connect to WiFi on boot; retry every 5 s on failure.
2. Read DS18B20 and DHT22 every `READING_INTERVAL_MS` milliseconds; also sample MQ-135 ADC.
3. POST to `SERVER_URL` (single reading or batch if reconnecting after offline).
4. Sequence number (`seq`) is incremented and persisted to NVS / EEPROM so it survives resets.
5. If WiFi is unavailable, buffer readings up to `OFFLINE_BUFFER_SIZE`; on reconnect, send as batch with `buffered: true`.
6. The `ts` field should be NTP-synced Unix seconds. If NTP unavailable, use millis()-derived offset with a `buffered` flag.

## Library Dependencies (to be confirmed by firmware agent)

- `OneWire` + `DallasTemperature` — DS18B20
- `DHT` (Adafruit) — DHT22
- `WiFi` (built-in ESP32) — WiFi
- `HTTPClient` (built-in ESP32) — HTTP POST
- `ArduinoJson` — JSON serialisation
- `NTPClient` + `WiFiUDP` — time synchronisation
- `Preferences` (ESP-IDF NVS) — persistent seq counter

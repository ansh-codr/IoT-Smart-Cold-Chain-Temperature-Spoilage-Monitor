-- ============================================================
-- Smart Cold Chain Monitor — Database Schema
-- Engine: MySQL 8.x, InnoDB, utf8mb4
-- ============================================================
-- WARNING: Values marked [PLACEHOLDER] are indicative defaults
-- derived from general food science literature.
-- They are NOT lab-calibrated for any specific product.
-- Replace with validated values from your experiment data
-- before any production or research use.
-- ============================================================

CREATE DATABASE IF NOT EXISTS coldchain
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE coldchain;

-- ------------------------------------------------------------
-- Table: product_profiles
-- Stores the decay model parameters for each product category.
-- Q10 and Ea are alternative parameterisations of the same
-- Arrhenius-style model; both are stored so the backend can
-- switch between them via a config flag.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_profiles (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name                    VARCHAR(64)     NOT NULL UNIQUE,
  -- Reference storage temperature in °C (ideal conditions)
  t_ref_c                 DECIMAL(5,2)    NOT NULL,
  -- Minimum safe storage temperature in °C
  t_min_c                 DECIMAL(5,2)    NOT NULL,
  -- Maximum safe storage temperature in °C
  t_max_c                 DECIMAL(5,2)    NOT NULL,
  -- Expected shelf life under ideal (t_ref_c) conditions, in hours
  shelf_life_hours_at_ref DECIMAL(10,2)   NOT NULL,
  -- Q10 temperature coefficient (rate doubles every 10°C above T_ref when Q10=2)
  q10                     DECIMAL(6,4)    NOT NULL,
  -- Activation energy in kJ/mol for Arrhenius model (stored as kJ; backend converts to J)
  ea_kj_per_mol           DECIMAL(8,4)    NOT NULL,
  -- VOC ADC baseline reading under normal/fresh conditions (indicative)
  voc_baseline            SMALLINT UNSIGNED NOT NULL,
  -- VOC ADC delta above baseline that triggers SPOILAGE_SUSPECTED alert (indicative)
  voc_spoil_delta         SMALLINT UNSIGNED NOT NULL,

  PRIMARY KEY (id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Product decay model parameters. [PLACEHOLDER] values are indicative — not lab-calibrated.';

-- ------------------------------------------------------------
-- Table: devices
-- One row per physical ESP32 node.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  device_id   VARCHAR(64)     NOT NULL,
  name        VARCHAR(128)    NOT NULL,
  -- FK to product_profiles; NULL means no profile assigned yet
  profile_id  INT UNSIGNED    NULL,
  created_at  INT UNSIGNED    NOT NULL COMMENT 'Unix seconds UTC',

  PRIMARY KEY (device_id),
  CONSTRAINT fk_devices_profile
    FOREIGN KEY (profile_id) REFERENCES product_profiles(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Registered IoT sensor nodes';

-- ------------------------------------------------------------
-- Table: readings
-- Immutable sensor telemetry. Never UPDATE or DELETE rows here.
-- UNIQUE(device_id, seq) enforces idempotency for re-sends.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS readings (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id   VARCHAR(64)     NOT NULL,
  -- Monotonically increasing sequence number set by the firmware
  seq         INT UNSIGNED    NOT NULL,
  -- Sensor timestamp (firmware clock), Unix seconds UTC
  ts          INT UNSIGNED    NOT NULL,
  -- DS18B20 temperature reading, °C
  temp_c      DECIMAL(6,2)    NOT NULL,
  -- DHT22 relative humidity, %RH
  humidity    DECIMAL(5,2)    NOT NULL,
  -- MQ-135 raw ADC value (12-bit, 0–4095), indicative only
  voc_raw     SMALLINT UNSIGNED NOT NULL,
  -- true = this reading was buffered offline and sent late
  buffered    TINYINT(1)      NOT NULL DEFAULT 0,
  -- Wall-clock time the server received the reading, Unix seconds UTC
  received_at INT UNSIGNED    NOT NULL,

  PRIMARY KEY (id),
  -- Idempotency: same device cannot insert duplicate seq numbers
  UNIQUE KEY uq_device_seq (device_id, seq),
  -- Most common query pattern: device readings in time range
  INDEX idx_device_ts (device_id, ts),

  CONSTRAINT fk_readings_device
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Immutable sensor telemetry log';

-- ------------------------------------------------------------
-- Table: device_state
-- Mutable; one row per device. Updated atomically after each
-- reading is processed by the decay service.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_state (
  device_id             VARCHAR(64)   NOT NULL,
  -- Accumulated consumed shelf life in hours (Arrhenius-integrated)
  consumed_life_hours   DECIMAL(12,4) NOT NULL DEFAULT 0,
  -- Timestamp of the last reading used in the consumption calculation
  last_ts               INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT 'Unix seconds UTC',
  -- Rate factor from the most recent Arrhenius/Q10 calculation
  last_rate_factor      DECIMAL(8,6)  NOT NULL DEFAULT 1.000000,
  -- Wall-clock time this row was last updated
  updated_at            INT UNSIGNED  NOT NULL COMMENT 'Unix seconds UTC',
  -- Count of buffered readings recovered from offline bursts
  buffered_recovered_count INT UNSIGNED NOT NULL DEFAULT 0,

  PRIMARY KEY (device_id),
  CONSTRAINT fk_device_state_device
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Mutable per-device shelf life accumulator. Updated on every reading.';

-- ------------------------------------------------------------
-- Table: alerts
-- Stateful alert log. ended_at = NULL means the alert is active.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  device_id   VARCHAR(64)     NOT NULL,
  -- Alert type: TEMP_HIGH | TEMP_LOW | SHELF_LIFE_LOW | SPOILAGE_SUSPECTED | DEVICE_OFFLINE
  type        VARCHAR(32)     NOT NULL,
  -- Severity: warning | critical
  severity    VARCHAR(16)     NOT NULL,
  -- Unix seconds UTC when the condition was first detected
  started_at  INT UNSIGNED    NOT NULL,
  -- NULL while alert is active; set when condition resolves
  ended_at    INT UNSIGNED    NULL DEFAULT NULL,
  -- Worst sensor value observed during the alert window
  peak_value  DECIMAL(10,4)   NULL DEFAULT NULL,
  -- Human-readable description e.g. "Temperature exceeded 6°C (read 7.2°C)"
  message     VARCHAR(256)    NOT NULL,

  PRIMARY KEY (id),
  INDEX idx_alerts_device_started (device_id, started_at DESC),
  -- Used to find the current open alert of a given type for a device
  INDEX idx_alerts_open (device_id, type, ended_at),

  CONSTRAINT fk_alerts_device
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Stateful alert history. ended_at NULL = active alert.';

-- ============================================================
-- SEED DATA
-- [PLACEHOLDER] values — indicative, not lab-calibrated.
-- Sources: general food science / pharmacokinetics literature.
-- Replace with validated values before research/production use.
-- ============================================================

INSERT INTO product_profiles
  (name, t_ref_c, t_min_c, t_max_c, shelf_life_hours_at_ref, q10, ea_kj_per_mol, voc_baseline, voc_spoil_delta)
VALUES
  -- Dairy (e.g. pasteurised milk)
  -- t_ref=4°C (standard cold chain for dairy), safe range 2–6°C
  -- ~7 day shelf life at reference = 168 hours [PLACEHOLDER]
  -- Q10≈2.0 is a common food science default [PLACEHOLDER]
  -- Ea≈50 kJ/mol is representative for microbial growth [PLACEHOLDER]
  ('dairy',   4.00, 2.00, 6.00, 168.00,  2.0000, 50.0000, 600, 400),

  -- Pharma (e.g. vaccines, biological drugs, 2–8°C cold chain)
  -- t_ref=5°C, safe range 2–8°C
  -- ~30 day shelf life at reference = 720 hours [PLACEHOLDER]
  -- Q10≈2.5 slightly higher sensitivity [PLACEHOLDER]
  -- Ea≈60 kJ/mol [PLACEHOLDER]
  ('pharma',  5.00, 2.00, 8.00, 720.00,  2.5000, 60.0000, 300, 200),

  -- Produce (e.g. leafy vegetables)
  -- t_ref=4°C, wider safe range 1–8°C
  -- ~10 day shelf life = 240 hours [PLACEHOLDER]
  -- Q10≈2.0 [PLACEHOLDER]
  -- Ea≈55 kJ/mol [PLACEHOLDER]
  ('produce', 4.00, 1.00, 8.00, 240.00,  2.0000, 55.0000, 800, 500);

-- ============================================================
-- End of schema
-- ============================================================

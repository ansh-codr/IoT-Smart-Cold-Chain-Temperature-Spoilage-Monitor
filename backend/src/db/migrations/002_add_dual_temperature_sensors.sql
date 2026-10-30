-- ============================================================
-- COLDCHAIN IQ — Migration 002: Add Dual Temperature Sensors
-- Extends the readings table to independently store DS18B20
-- (primary temperature) and DHT22 (secondary temperature) readings.
--
-- Reversible:
--   DOWN: ALTER TABLE readings DROP COLUMN ds18b20_temp_c, DROP COLUMN dht22_temp_c;
-- ============================================================

USE coldchain;

SET @dbname = DATABASE();
SET @tablename = "readings";

-- 1. Add ds18b20_temp_c column safely if not exists
SET @columnname = "ds18b20_temp_c";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE readings ADD COLUMN ds18b20_temp_c DECIMAL(6,2) NULL AFTER temp_c;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Add dht22_temp_c column safely if not exists
SET @columnname = "dht22_temp_c";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE readings ADD COLUMN dht22_temp_c DECIMAL(6,2) NULL AFTER ds18b20_temp_c;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3. Safely ensure humidity column allows NULL (for DHT22 disconnection/fault)
SET @columnname = "humidity";
SET @isNullable = (SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname);
SET @preparedStatement = (SELECT IF(
  @isNullable = 'YES',
  "SELECT 1",
  "ALTER TABLE readings MODIFY COLUMN humidity DECIMAL(5,2) NULL;"
));
PREPARE alterHumidityNullable FROM @preparedStatement;
EXECUTE alterHumidityNullable;
DEALLOCATE PREPARE alterHumidityNullable;


-- ============================================================
-- COLDCHAIN IQ — Database Schema Migration
-- Extends the existing MySQL 8.x schema safely
-- ============================================================

USE coldchain;

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name                    VARCHAR(128)    NOT NULL,
  slug                    VARCHAR(64)     NOT NULL UNIQUE,
  contact_email           VARCHAR(128)    NULL,
  created_at              INT UNSIGNED    NOT NULL COMMENT 'Unix seconds UTC',
  updated_at              INT UNSIGNED    NOT NULL COMMENT 'Unix seconds UTC',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Users (synchronized with Firebase Auth UID)
CREATE TABLE IF NOT EXISTS users (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  firebase_uid            VARCHAR(128)    NOT NULL UNIQUE,
  email                   VARCHAR(128)    NOT NULL UNIQUE,
  display_name            VARCHAR(128)    NULL,
  system_role             ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  is_active               TINYINT(1)      NOT NULL DEFAULT 1,
  created_at              INT UNSIGNED    NOT NULL COMMENT 'Unix seconds UTC',
  updated_at              INT UNSIGNED    NOT NULL COMMENT 'Unix seconds UTC',
  PRIMARY KEY (id),
  INDEX idx_users_fb_uid (firebase_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Organization Memberships
CREATE TABLE IF NOT EXISTS organization_members (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  org_id                  INT UNSIGNED    NOT NULL,
  user_id                 INT UNSIGNED    NOT NULL,
  role                    ENUM('platform_admin', 'org_manager', 'operator') NOT NULL DEFAULT 'operator',
  joined_at               INT UNSIGNED    NOT NULL COMMENT 'Unix seconds UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_org_user (org_id, user_id),
  CONSTRAINT fk_member_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Warehouses / Storage Locations
CREATE TABLE IF NOT EXISTS warehouses (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  org_id                  INT UNSIGNED    NOT NULL,
  name                    VARCHAR(128)    NOT NULL,
  location                VARCHAR(255)    NULL,
  capacity_units          INT UNSIGNED    NULL,
  target_temp_c           DECIMAL(5,2)    NULL,
  status                  ENUM('active', 'maintenance', 'inactive') NOT NULL DEFAULT 'active',
  created_at              INT UNSIGNED    NOT NULL COMMENT 'Unix seconds UTC',
  PRIMARY KEY (id),
  CONSTRAINT fk_warehouse_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Link existing devices to Organizations and Warehouses safely
-- Check if org_id column exists before adding it
SET @dbname = DATABASE();
SET @tablename = "devices";
SET @columnname = "org_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE devices ADD COLUMN org_id INT UNSIGNED NULL, ADD COLUMN warehouse_id INT UNSIGNED NULL, ADD COLUMN api_key VARCHAR(64) NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 6. Inventory Items & Batches
CREATE TABLE IF NOT EXISTS inventory_items (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  org_id                  INT UNSIGNED    NOT NULL,
  warehouse_id            INT UNSIGNED    NOT NULL,
  profile_id              INT UNSIGNED    NOT NULL,
  batch_number            VARCHAR(64)     NOT NULL,
  quantity                DECIMAL(12,2)   NOT NULL DEFAULT 0,
  unit                    VARCHAR(32)     NOT NULL DEFAULT 'units',
  mfg_date                INT UNSIGNED    NULL,
  expiry_date             INT UNSIGNED    NULL,
  status                  ENUM('available', 'quarantined', 'depleted', 'expired') NOT NULL DEFAULT 'available',
  created_at              INT UNSIGNED    NOT NULL,
  updated_at              INT UNSIGNED    NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_batch_wh (batch_number, warehouse_id, profile_id),
  CONSTRAINT fk_inv_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inv_profile FOREIGN KEY (profile_id) REFERENCES product_profiles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Stock Movements (Audit Trail of Inventory)
CREATE TABLE IF NOT EXISTS stock_movements (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  org_id                  INT UNSIGNED    NOT NULL,
  inventory_id            INT UNSIGNED    NOT NULL,
  movement_type           ENUM('receive', 'dispatch', 'transfer', 'adjustment', 'spoilage_writeoff') NOT NULL,
  quantity_delta          DECIMAL(12,2)   NOT NULL,
  balance_after           DECIMAL(12,2)   NOT NULL,
  reference_id            VARCHAR(64)     NULL COMMENT 'Shipment ID or PO Number',
  notes                   TEXT            NULL,
  created_by_user_id      INT UNSIGNED    NULL,
  created_at              INT UNSIGNED    NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_sm_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_sm_inv FOREIGN KEY (inventory_id) REFERENCES inventory_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Shipments
CREATE TABLE IF NOT EXISTS shipments (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  org_id                  INT UNSIGNED    NOT NULL,
  shipment_code           VARCHAR(64)     NOT NULL UNIQUE,
  source_warehouse_id     INT UNSIGNED    NOT NULL,
  destination_name        VARCHAR(255)    NOT NULL,
  destination_address     TEXT            NULL,
  assigned_device_id      VARCHAR(64)     NULL,
  status                  ENUM('draft', 'planned', 'in_transit', 'delivered', 'inspection', 'completed', 'cancelled') NOT NULL DEFAULT 'planned',
  departure_time          INT UNSIGNED    NULL,
  expected_arrival_time   INT UNSIGNED    NULL,
  actual_arrival_time     INT UNSIGNED    NULL,
  risk_level              ENUM('low', 'moderate', 'high', 'critical') NOT NULL DEFAULT 'low',
  notes                   TEXT            NULL,
  created_at              INT UNSIGNED    NOT NULL,
  updated_at              INT UNSIGNED    NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_ship_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_ship_source_wh FOREIGN KEY (source_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ship_device FOREIGN KEY (assigned_device_id) REFERENCES devices(device_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Shipment Items (Multiple products per shipment)
CREATE TABLE IF NOT EXISTS shipment_items (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  shipment_id             INT UNSIGNED    NOT NULL,
  inventory_id            INT UNSIGNED    NULL,
  profile_id              INT UNSIGNED    NOT NULL,
  quantity                DECIMAL(12,2)   NOT NULL,
  unit                    VARCHAR(32)     NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_si_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
  CONSTRAINT fk_si_inv FOREIGN KEY (inventory_id) REFERENCES inventory_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_si_profile FOREIGN KEY (profile_id) REFERENCES product_profiles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Temperature Excursions Analysis
CREATE TABLE IF NOT EXISTS temperature_excursions (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  org_id                  INT UNSIGNED    NOT NULL,
  device_id               VARCHAR(64)     NOT NULL,
  shipment_id             INT UNSIGNED    NULL,
  start_ts                INT UNSIGNED    NOT NULL,
  end_ts                  INT UNSIGNED    NULL,
  min_temp_c              DECIMAL(5,2)    NOT NULL,
  max_temp_c              DECIMAL(5,2)    NOT NULL,
  duration_s              INT UNSIGNED    NULL,
  excursion_type          ENUM('TEMP_HIGH', 'TEMP_LOW') NOT NULL,
  severity                ENUM('warning', 'critical') NOT NULL,
  impact_summary          TEXT            NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_te_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_te_dev FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
  CONSTRAINT fk_te_ship FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Replacement Requests (Planner)
CREATE TABLE IF NOT EXISTS replacement_requests (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  request_code            VARCHAR(64)     NOT NULL UNIQUE,
  org_id                  INT UNSIGNED    NOT NULL,
  shipment_id             INT UNSIGNED    NULL,
  profile_id              INT UNSIGNED    NOT NULL,
  required_quantity       DECIMAL(12,2)   NOT NULL,
  unit                    VARCHAR(32)     NOT NULL,
  destination             VARCHAR(255)    NOT NULL,
  required_by_ts          INT UNSIGNED    NOT NULL,
  priority                ENUM('normal', 'urgent', 'critical') NOT NULL DEFAULT 'normal',
  reason                  TEXT            NOT NULL,
  status                  ENUM('draft', 'pending_approval', 'approved', 'allocated', 'dispatched', 'fulfilled', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending_approval',
  requested_by_user_id    INT UNSIGNED    NULL,
  created_at              INT UNSIGNED    NOT NULL,
  updated_at              INT UNSIGNED    NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_rr_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_rr_ship FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL,
  CONSTRAINT fk_rr_profile FOREIGN KEY (profile_id) REFERENCES product_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_rr_user FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Replacement Allocations (Warehouse fulfillment breakdown)
CREATE TABLE IF NOT EXISTS replacement_allocations (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  request_id              INT UNSIGNED    NOT NULL,
  warehouse_id            INT UNSIGNED    NOT NULL,
  inventory_id            INT UNSIGNED    NOT NULL,
  allocated_quantity      DECIMAL(12,2)   NOT NULL,
  allocated_at            INT UNSIGNED    NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_ra_req FOREIGN KEY (request_id) REFERENCES replacement_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ra_inv FOREIGN KEY (inventory_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  org_id                  INT UNSIGNED    NULL,
  user_id                 INT UNSIGNED    NULL,
  action                  VARCHAR(64)     NOT NULL,
  entity_type             VARCHAR(64)     NOT NULL,
  entity_id               VARCHAR(64)     NULL,
  details                 JSON            NULL,
  ip_address              VARCHAR(45)     NULL,
  created_at              INT UNSIGNED    NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_audit_org (org_id),
  INDEX idx_audit_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── SEED DEFAULT ORGANIZATION & WAREHOUSES ─────────────────────────────────
INSERT IGNORE INTO organizations (id, name, slug, contact_email, created_at, updated_at)
VALUES (1, 'Apex Pharma & Cold Logistics', 'apex-pharma', 'ops@apexpharma.com', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

INSERT IGNORE INTO warehouses (id, org_id, name, location, capacity_units, target_temp_c, status, created_at)
VALUES 
(1, 1, 'Central Cold Storage Alpha', 'New Delhi Hub 4', 50000, 4.0, 'active', UNIX_TIMESTAMP()),
(2, 1, 'North Logistics Hub 2', 'Noida Sector 62', 25000, 2.0, 'active', UNIX_TIMESTAMP());

-- Link existing node-01 to organization 1 and warehouse 1
UPDATE devices SET org_id = 1, warehouse_id = 1 WHERE device_id = 'node-01' AND org_id IS NULL;

-- Seed inventory items for demonstration
INSERT IGNORE INTO inventory_items (id, org_id, warehouse_id, profile_id, batch_number, quantity, unit, mfg_date, expiry_date, status, created_at, updated_at)
VALUES 
(1, 1, 1, 1, 'BATCH-DAIRY-2026-A1', 1200, 'liters', UNIX_TIMESTAMP() - 86400 * 2, UNIX_TIMESTAMP() + 86400 * 5, 'available', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(2, 1, 1, 2, 'VAX-COV-9981-B', 500, 'vials', UNIX_TIMESTAMP() - 86400 * 10, UNIX_TIMESTAMP() + 86400 * 20, 'available', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(3, 1, 2, 3, 'BERRY-EXP-4402', 450, 'kg', UNIX_TIMESTAMP() - 86400 * 1, UNIX_TIMESTAMP() + 86400 * 9, 'available', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());


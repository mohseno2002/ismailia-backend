CREATE TABLE IF NOT EXISTS nodes (
  id            TEXT PRIMARY KEY,
  name_ar       TEXT NOT NULL,
  kind          TEXT NOT NULL,
  km            REAL NOT NULL,
  bed_width     REAL,
  side_slope    REAL,
  bed_level     REAL,
  bed_slope     REAL,
  manning_n     REAL,
  gauge_width   REAL,
  gauge_slope   REAL,
  calib_type    TEXT,
  notes         TEXT,
  sort_order    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS calib_curves (
  node_id       TEXT NOT NULL REFERENCES nodes(id),
  curve_type    TEXT NOT NULL,
  a             REAL,
  b             REAL,
  h0            REAL,
  c_n           REAL,
  c_up          REAL,
  c_dn          REAL,
  intercept     REAL,
  avg_error_pct REAL,
  n_samples     INTEGER,
  PRIMARY KEY (node_id)
);

CREATE TABLE IF NOT EXISTS readings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id       TEXT NOT NULL REFERENCES nodes(id),
  reading_date  TEXT NOT NULL,
  wl_up         REAL,
  wl_dn         REAL,
  gates_open    INTEGER,
  q_manual      REAL,
  created_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(node_id, reading_date)
);
CREATE INDEX IF NOT EXISTS idx_readings_node_date ON readings(node_id, reading_date DESC);

CREATE TABLE IF NOT EXISTS calc_cache (
  cache_key     TEXT PRIMARY KEY,
  payload       TEXT NOT NULL,
  computed_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  action        TEXT NOT NULL,
  node_id       TEXT,
  detail        TEXT,
  ts            TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO nodes (id, name_ar, kind, km, bed_width, side_slope, bed_level, bed_slope, manning_n, gauge_width, gauge_slope, calib_type, notes, sort_order) VALUES
  ('fom',          'فم ترعة الإسماعيلية', 'mouth',     0.0,   40.0, 1.0, 12.23, 0.00005, 0.019, 40.0, 1.0, 'linear', '124 قراءة · قاع 12.23', 1),
  ('hajz_munir',   'حجز المنير',          'regulator', 28.0,  33.2, 2.0,  8.95, 0.00010, 0.018, 35.0, 2.0, 'power',  '36 قراءة · قاع فعلي 8.95', 2),
  ('hgz_43',       'حجز ك43',  'regulator', 43.0,  29.5, 2.0, 8.50, 0.00010, 0.025, 29.5, 2.0, NULL, 'تقديري معاير', 3),
  ('hgz_51',       'حجز ك51',  'regulator', 51.0,  27.6, 2.0, 8.00, 0.00010, 0.028, 27.6, 2.0, NULL, 'تقديري', 4),
  ('hgz_57',       'حجز ك57',  'regulator', 57.0,  26.1, 2.0, 7.50, 0.00010, 0.030, 26.1, 2.0, NULL, 'تقديري', 5),
  ('hgz_62',       'حجز ك62',  'regulator', 62.0,  24.9, 2.0, 7.00, 0.00010, 0.030, 24.9, 2.0, NULL, 'تقديري', 6),
  ('hgz_67',       'حجز ك67',  'regulator', 67.0,  23.7, 2.0, 6.80, 0.00010, 0.032, 23.7, 2.0, NULL, 'تقديري', 7),
  ('hgz_70',       'حجز ك70',  'regulator', 70.0,  22.9, 2.0, 6.50, 0.00010, 0.033, 22.9, 2.0, NULL, 'تقديري', 8),
  ('hajz_salhiya', 'حجز الصالحية',        'regulator', 75.0,  21.7, 2.0,  6.72, 0.00010, 0.038, 56.0, 2.0, 'power',  '76 قراءة · قاع 6.72', 9),
  ('hgz_77',       'حجز ك77',  'regulator', 77.0,  21.2, 2.0, 6.10, 0.00010, 0.038, 21.2, 2.0, NULL, 'تقديري', 10),
  ('hgz_82',       'حجز ك82',  'regulator', 82.0,  20.0, 2.0, 5.80, 0.00012, 0.038, 20.0, 2.0, NULL, 'تقديري', 11),
  ('hgz_89',       'حجز ك89',  'regulator', 89.0,  18.3, 2.0, 5.50, 0.00012, 0.035, 18.3, 2.0, NULL, 'تقديري', 12),
  ('hgz_93',       'حجز ك93',  'regulator', 93.0,  17.3, 2.0, 5.30, 0.00012, 0.030, 17.3, 2.0, NULL, 'تقديري', 13),
  ('hgz_98',       'حجز ك98',  'regulator', 98.0,  16.1, 2.0, 5.00, 0.00012, 0.028, 16.1, 2.0, NULL, 'تقديري', 14),
  ('hgz_111',      'حجز ك111', 'regulator', 111.0, 12.9, 2.0, 4.50, 0.00012, 0.028, 12.9, 2.0, NULL, 'تقديري', 15),
  ('hgz_123',      'حجز ك123', 'regulator', 123.0, 10.0, 2.0, 4.00, 0.00012, 0.0

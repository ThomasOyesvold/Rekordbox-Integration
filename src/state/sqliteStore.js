import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let db = null;
const APP_STATE_KEY = 'app_state';

function normalizeTrackPair(trackAId, trackBId) {
  if (!trackAId || !trackBId) {
    throw new Error('trackAId and trackBId are required.');
  }

  return String(trackAId) <= String(trackBId)
    ? [String(trackAId), String(trackBId)]
    : [String(trackBId), String(trackAId)];
}

function parseJson(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ensureColumns(tableName, columns) {
  const statement = db.prepare(`PRAGMA table_info(${tableName})`);
  const existing = new Set(statement.all().map((row) => row.name));

  for (const column of columns) {
    if (existing.has(column.name)) {
      continue;
    }

    const defaultValue = column.defaultValue !== undefined
      ? ` DEFAULT ${column.defaultValue}`
      : '';
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}${defaultValue};`);
  }
}

export function initDatabase(dbFilePath) {
  if (db) {
    return db;
  }

  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
  db = new DatabaseSync(dbFilePath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      xml_path TEXT NOT NULL,
      parsed_at TEXT NOT NULL,
      track_count INTEGER NOT NULL,
      playlist_count INTEGER NOT NULL,
      folder_count INTEGER NOT NULL,
      selected_folders TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL,
      algorithm_version TEXT NOT NULL,
      source_xml_path TEXT,
      selected_folders TEXT NOT NULL,
      track_count INTEGER NOT NULL,
      notes TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      track_id TEXT PRIMARY KEY,
      signature TEXT NOT NULL,
      signature_version TEXT NOT NULL,
      bpm REAL,
      musical_key TEXT,
      duration_seconds REAL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS track_similarity (
      track_a_id TEXT NOT NULL,
      track_b_id TEXT NOT NULL,
      algorithm_version TEXT NOT NULL,
      score REAL NOT NULL,
      components TEXT NOT NULL,
      computed_at TEXT NOT NULL,
      analysis_run_id INTEGER,
      PRIMARY KEY (track_a_id, track_b_id, algorithm_version)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS anlz_waveform_cache (
      ext_path TEXT PRIMARY KEY,
      sample_count INTEGER NOT NULL,
      duration_seconds REAL NOT NULL,
      avg_red INTEGER NOT NULL,
      avg_green INTEGER NOT NULL,
      avg_blue INTEGER NOT NULL,
      height_avg REAL NOT NULL,
      height_max INTEGER NOT NULL,
      bins TEXT NOT NULL,
      rhythm_signature TEXT,
      kick_signature TEXT,
      signature_version TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      state_key TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_import_history_parsed_at ON import_history(parsed_at DESC);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_analysis_runs_created_at ON analysis_runs(created_at DESC);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_track_similarity_computed_at ON track_similarity(computed_at DESC);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_anlz_waveform_cache_updated_at ON anlz_waveform_cache(updated_at DESC);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_app_state_updated_at ON app_state(updated_at DESC);');

  ensureColumns('anlz_waveform_cache', [
    { name: 'rhythm_signature', type: 'TEXT' },
    { name: 'kick_signature', type: 'TEXT' },
    { name: 'signature_version', type: 'TEXT' }
  ]);

  return db;
}

function assertDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
}

export function isDatabaseReady() {
  return Boolean(db);
}

export function saveImportHistory(entry) {
  assertDb();

  const statement = db.prepare(`
    INSERT INTO import_history (
      xml_path,
      parsed_at,
      track_count,
      playlist_count,
      folder_count,
      selected_folders
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  statement.run(
    entry.xmlPath,
    entry.parsedAt,
    entry.trackCount,
    entry.playlistCount,
    entry.folderCount,
    JSON.stringify(entry.selectedFolders || [])
  );
}

export function getRecentImports(limit = 10) {
  assertDb();

  const statement = db.prepare(`
    SELECT id, xml_path, parsed_at, track_count, playlist_count, folder_count, selected_folders
    FROM import_history
    ORDER BY id DESC
    LIMIT ?
  `);

  const rows = statement.all(limit);

  return rows.map((row) => ({
    id: row.id,
    xmlPath: row.xml_path,
    parsedAt: row.parsed_at,
    trackCount: row.track_count,
    playlistCount: row.playlist_count,
    folderCount: row.folder_count,
    selectedFolders: parseJson(row.selected_folders, [])
  }));
}

export function createAnalysisRun(entry) {
  assertDb();

  const statement = db.prepare(`
    INSERT INTO analysis_runs (
      created_at,
      status,
      algorithm_version,
      source_xml_path,
      selected_folders,
      track_count,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = statement.run(
    now,
    entry.status || 'running',
    entry.algorithmVersion,
    entry.sourceXmlPath || null,
    JSON.stringify(entry.selectedFolders || []),
    entry.trackCount || 0,
    entry.notes || null
  );

  return Number(result.lastInsertRowid);
}

export function completeAnalysisRun(runId, status = 'completed', notes = null) {
  assertDb();

  const statement = db.prepare(`
    UPDATE analysis_runs
    SET completed_at = ?, status = ?, notes = ?
    WHERE id = ?
  `);

  statement.run(new Date().toISOString(), status, notes, runId);
}

export function getAnalysisRun(runId) {
  assertDb();

  const statement = db.prepare(`
    SELECT id, created_at, completed_at, status, algorithm_version, source_xml_path, selected_folders, track_count, notes
    FROM analysis_runs
    WHERE id = ?
  `);

  const row = statement.get(runId);
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    status: row.status,
    algorithmVersion: row.algorithm_version,
    sourceXmlPath: row.source_xml_path,
    selectedFolders: parseJson(row.selected_folders, []),
    trackCount: row.track_count,
    notes: row.notes
  };
}

export function upsertTrackSignature(entry) {
  assertDb();

  const statement = db.prepare(`
    INSERT INTO tracks (
      track_id,
      signature,
      signature_version,
      bpm,
      musical_key,
      duration_seconds,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(track_id) DO UPDATE SET
      signature = excluded.signature,
      signature_version = excluded.signature_version,
      bpm = excluded.bpm,
      musical_key = excluded.musical_key,
      duration_seconds = excluded.duration_seconds,
      updated_at = excluded.updated_at
  `);

  statement.run(
    String(entry.trackId),
    entry.signature,
    entry.signatureVersion,
    entry.bpm ?? null,
    entry.musicalKey || null,
    entry.durationSeconds ?? null,
    new Date().toISOString()
  );
}

export function getTrackSignature(trackId) {
  assertDb();

  const statement = db.prepare(`
    SELECT track_id, signature, signature_version, bpm, musical_key, duration_seconds, updated_at
    FROM tracks
    WHERE track_id = ?
  `);

  const row = statement.get(String(trackId));
  if (!row) {
    return null;
  }

  return {
    trackId: row.track_id,
    signature: row.signature,
    signatureVersion: row.signature_version,
    bpm: row.bpm,
    musicalKey: row.musical_key,
    durationSeconds: row.duration_seconds,
    updatedAt: row.updated_at
  };
}

export function saveSimilarityScore(entry) {
  assertDb();

  const [trackAId, trackBId] = normalizeTrackPair(entry.trackAId, entry.trackBId);
  const statement = db.prepare(`
    INSERT INTO track_similarity (
      track_a_id,
      track_b_id,
      algorithm_version,
      score,
      components,
      computed_at,
      analysis_run_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(track_a_id, track_b_id, algorithm_version) DO UPDATE SET
      score = excluded.score,
      components = excluded.components,
      computed_at = excluded.computed_at,
      analysis_run_id = excluded.analysis_run_id
  `);

  statement.run(
    trackAId,
    trackBId,
    entry.algorithmVersion,
    entry.score,
    JSON.stringify(entry.components || {}),
    new Date().toISOString(),
    entry.analysisRunId || null
  );
}

export function getCachedSimilarity(entry) {
  assertDb();

  const [trackAId, trackBId] = normalizeTrackPair(entry.trackAId, entry.trackBId);
  const statement = db.prepare(`
    SELECT track_a_id, track_b_id, algorithm_version, score, components, computed_at, analysis_run_id
    FROM track_similarity
    WHERE track_a_id = ? AND track_b_id = ? AND algorithm_version = ?
  `);

  const row = statement.get(trackAId, trackBId, entry.algorithmVersion);
  if (!row) {
    return null;
  }

  return {
    trackAId: row.track_a_id,
    trackBId: row.track_b_id,
    algorithmVersion: row.algorithm_version,
    score: row.score,
    components: parseJson(row.components, {}),
    computedAt: row.computed_at,
    analysisRunId: row.analysis_run_id
  };
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

export function saveAnlzWaveformSummary(entry) {
  assertDb();

  const statement = db.prepare(`
    INSERT INTO anlz_waveform_cache (
      ext_path,
      sample_count,
      duration_seconds,
      avg_red,
      avg_green,
      avg_blue,
      height_avg,
      height_max,
      bins,
      rhythm_signature,
      kick_signature,
      signature_version,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ext_path) DO UPDATE SET
      sample_count = excluded.sample_count,
      duration_seconds = excluded.duration_seconds,
      avg_red = excluded.avg_red,
      avg_green = excluded.avg_green,
      avg_blue = excluded.avg_blue,
      height_avg = excluded.height_avg,
      height_max = excluded.height_max,
      bins = excluded.bins,
      rhythm_signature = excluded.rhythm_signature,
      kick_signature = excluded.kick_signature,
      signature_version = excluded.signature_version,
      updated_at = excluded.updated_at
  `);

  const heights = Array.isArray(entry.bins) ? entry.bins : [];
  const colors = Array.isArray(entry.binColors) ? entry.binColors : [];
  const rhythmSignature = Array.isArray(entry.rhythmSignature) ? entry.rhythmSignature : null;
  const kickSignature = Array.isArray(entry.kickSignature) ? entry.kickSignature : null;
  statement.run(
    String(entry.extPath),
    Number(entry.sampleCount) || 0,
    Number(entry.durationSeconds) || 0,
    Number(entry.avgColor?.red) || 0,
    Number(entry.avgColor?.green) || 0,
    Number(entry.avgColor?.blue) || 0,
    Number(entry.height?.avg) || 0,
    Number(entry.height?.max) || 0,
    JSON.stringify({
      heights,
      colors
    }),
    rhythmSignature ? JSON.stringify(rhythmSignature) : null,
    kickSignature ? JSON.stringify(kickSignature) : null,
    entry.signatureVersion ? String(entry.signatureVersion) : null,
    new Date().toISOString()
  );
}

export function getAnlzWaveformSummary(extPath) {
  assertDb();

  const statement = db.prepare(`
    SELECT
      ext_path,
      sample_count,
      duration_seconds,
      avg_red,
      avg_green,
      avg_blue,
      height_avg,
      height_max,
      bins,
      rhythm_signature,
      kick_signature,
      signature_version,
      updated_at
    FROM anlz_waveform_cache
    WHERE ext_path = ?
  `);

  const row = statement.get(String(extPath));
  if (!row) {
    return null;
  }

  const parsedBins = parseJson(row.bins, []);
  const bins = Array.isArray(parsedBins) ? parsedBins : (Array.isArray(parsedBins?.heights) ? parsedBins.heights : []);
  const binColors = Array.isArray(parsedBins?.colors) ? parsedBins.colors : [];
  const rhythmSignature = parseJson(row.rhythm_signature, null);
  const kickSignature = parseJson(row.kick_signature, null);

  return {
    extPath: row.ext_path,
    sampleCount: row.sample_count,
    durationSeconds: row.duration_seconds,
    avgColor: {
      red: row.avg_red,
      green: row.avg_green,
      blue: row.avg_blue
    },
    height: {
      avg: row.height_avg,
      max: row.height_max
    },
    bins,
    binColors,
    rhythmSignature: Array.isArray(rhythmSignature) ? rhythmSignature : null,
    kickSignature: Array.isArray(kickSignature) ? kickSignature : null,
    signatureVersion: row.signature_version || null,
    updatedAt: row.updated_at
  };
}

export function saveAppState(state) {
  assertDb();

  const statement = db.prepare(`
    INSERT INTO app_state (
      state_key,
      state_json,
      updated_at
    ) VALUES (?, ?, ?)
    ON CONFLICT(state_key) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `);

  statement.run(
    APP_STATE_KEY,
    JSON.stringify(state || {}),
    new Date().toISOString()
  );
}

export function loadAppState() {
  assertDb();

  const statement = db.prepare(`
    SELECT state_json, updated_at
    FROM app_state
    WHERE state_key = ?
  `);

  const row = statement.get(APP_STATE_KEY);
  if (!row) {
    return null;
  }

  const parsed = parseJson(row.state_json, null);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  return {
    ...parsed,
    updatedAt: parsed.updatedAt ?? row.updated_at ?? null
  };
}

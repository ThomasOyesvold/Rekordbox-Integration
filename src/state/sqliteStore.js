import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let db = null;

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

  db.exec('CREATE INDEX IF NOT EXISTS idx_import_history_parsed_at ON import_history(parsed_at DESC);');

  return db;
}

function assertDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
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
    selectedFolders: JSON.parse(row.selected_folders)
  }));
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

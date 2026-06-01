import bcrypt from "bcrypt";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";

const defaultDatabasePath = process.env.RAILWAY_ENVIRONMENT === undefined
  ? resolve("data/cat-meow-studio.sqlite")
  : "/data/cat-meow-studio.sqlite";

export function openDatabase() {
  const databasePath = process.env.CMS_DATABASE_PATH ?? defaultDatabasePath;
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  migrate(db);
  seedAdminFromEnv(db);
  return db;
}

export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      selected_sprite_asset_id TEXT,
      selected_music_asset_id TEXT,
      selected_sfx_asset_id TEXT,
      active_mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, project_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (project_id, kind, id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sprite_palette_colors (
      project_id TEXT NOT NULL,
      palette_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      rgba TEXT NOT NULL,
      PRIMARY KEY (project_id, palette_index),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_users (
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  addColumnIfMissing(db, "users", "role", "TEXT NOT NULL DEFAULT 'user'");
  addColumnIfMissing(db, "projects", "project_id", "TEXT NOT NULL DEFAULT 'cat-meow-studio'");
}

export async function createAdminUser(db, email, password, role = "admin") {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);

  if (existing !== undefined) {
    return false;
  }

  const timestamp = new Date().toISOString();
  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare(`
    INSERT INTO users (id, email, role, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(createId(), normalizedEmail, normalizeRole(role), passwordHash, timestamp, timestamp);
  return true;
}

function seedAdminFromEnv(db) {
  const email = process.env.CMS_ADMIN_EMAIL;
  const password = process.env.CMS_ADMIN_PASSWORD;

  if (email === undefined || password === undefined || email.trim() === "" || password === "") {
    return;
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase());

  if (existing !== undefined) {
    db.prepare("UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?").run(new Date().toISOString(), existing.id);
    return;
  }

  const timestamp = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(password, 12);
  db.prepare(`
    INSERT INTO users (id, email, role, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(createId(), email.trim().toLowerCase(), "admin", passwordHash, timestamp, timestamp);
}

export function createId() {
  return randomBytes(18).toString("base64url");
}

function addColumnIfMissing(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function normalizeRole(role) {
  return role === "admin" ? "admin" : "user";
}

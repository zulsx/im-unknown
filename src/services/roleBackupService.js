import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

const memoryBackups = new Map(); // `${guildId}:${userId}` -> string[]
let pool = null;
let tableReady = false;

function getPool() {
  if (pool) return pool;

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_RESTORE_URL;

  if (!connectionString) {
    logger.warn('[roleBackupService] No PostgreSQL connection string found in env; using memory fallback only.');
    return null;
  }

  pool = new Pool({
    connectionString,
    ssl:
      connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
  });

  return pool;
}

async function ensureTable() {
  const dbPool = getPool();
  if (!dbPool || tableReady) return;

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS role_backups (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, user_id)
    );
  `);

  tableReady = true;
}

function sanitizeRoleIds(guildId, roleIds = []) {
  const gId = String(guildId);
  return [...new Set((Array.isArray(roleIds) ? roleIds : []).map(String))].filter(
    (id) => Boolean(id) && id !== gId
  );
}

function parseRoleIdsColumn(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function saveMemberRoles(guildId, userId, roleIds = []) {
  if (!guildId || !userId) return;

  const gId = String(guildId);
  const uId = String(userId);
  const cleanRoles = sanitizeRoleIds(gId, roleIds);
  const key = `${gId}:${uId}`;

  memoryBackups.set(key, cleanRoles);

  try {
    await ensureTable();
    const dbPool = getPool();
    if (!dbPool) return;

    await dbPool.query(
      `
      INSERT INTO role_backups (guild_id, user_id, role_ids, updated_at)
      VALUES ($1, $2, $3::jsonb, NOW())
      ON CONFLICT (guild_id, user_id)
      DO UPDATE SET role_ids = EXCLUDED.role_ids, updated_at = NOW();
      `,
      [gId, uId, JSON.stringify(cleanRoles)]
    );

    logger.info(`[roleBackupService] Saved ${cleanRoles.length} roles for ${uId} in guild ${gId}`);
  } catch (error) {
    logger.error('[roleBackupService] Failed to save role backup to PostgreSQL:', error);
  }
}

export async function getSavedRoles(guildId, userId) {
  if (!guildId || !userId) return [];

  const gId = String(guildId);
  const uId = String(userId);
  const key = `${gId}:${uId}`;

  try {
    await ensureTable();
    const dbPool = getPool();
    if (dbPool) {
      const { rows } = await dbPool.query(
        `SELECT role_ids FROM role_backups WHERE guild_id = $1 AND user_id = $2`,
        [gId, uId]
      );

      if (rows.length > 0) {
        const cleanRoles = sanitizeRoleIds(gId, parseRoleIdsColumn(rows[0].role_ids));
        memoryBackups.set(key, cleanRoles);
        return cleanRoles;
      }
    }
  } catch (error) {
    logger.error('[roleBackupService] Failed to read role backup from PostgreSQL:', error);
  }

  return memoryBackups.get(key) ?? [];
}

export function extractRoleIds(member) {
  if (!member?.roles?.cache || !member?.guild?.id) return [];
  const guildId = String(member.guild.id);
  return member.roles.cache
    .filter((role) => String(role.id) !== guildId)
    .map((role) => String(role.id));
}

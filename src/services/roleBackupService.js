import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

const memoryBackups = new Map(); // guildId -> Map(userId -> string[])
let pool = null;
let tableReady = false;

function getPool() {
  if (pool) return pool;
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_RESTORE_URL;

  if (!connectionString) return null;

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
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
  return [...new Set(roleIds)].filter((id) => Boolean(id) && String(id) !== String(guildId));
}

export async function saveMemberRoles(guildId, userId, roleIds = []) {
  if (!guildId || !userId) return;

  const cleanRoles = sanitizeRoleIds(guildId, roleIds);

  if (!memoryBackups.has(guildId)) {
    memoryBackups.set(guildId, new Map());
  }
  memoryBackups.get(guildId).set(userId, cleanRoles);

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
      [String(guildId), String(userId), JSON.stringify(cleanRoles)]
    );

    logger.debug(`[roleBackupService] Saved ${cleanRoles.length} roles for ${userId} in guild ${guildId}`);
  } catch (error) {
    logger.error('[roleBackupService] Failed to save role backup to PostgreSQL:', error);
  }
}

export async function getSavedRoles(guildId, userId) {
  if (!guildId || !userId) return [];

  try {
    await ensureTable();
    const dbPool = getPool();
    if (dbPool) {
      const { rows } = await dbPool.query(
        `SELECT role_ids FROM role_backups WHERE guild_id = $1 AND user_id = $2`,
        [String(guildId), String(userId)]
      );

      if (rows.length > 0 && Array.isArray(rows[0].role_ids)) {
        return sanitizeRoleIds(guildId, rows[0].role_ids);
      }
    }
  } catch (error) {
    logger.error('[roleBackupService] Failed to read role backup from PostgreSQL:', error);
  }

  return memoryBackups.get(guildId)?.get(userId) ?? [];
}

export function extractRoleIds(member) {
  if (!member?.roles?.cache || !member?.guild?.id) return [];
  return member.roles.cache
    .filter((role) => role.id !== member.guild.id)
    .map((role) => role.id);
}

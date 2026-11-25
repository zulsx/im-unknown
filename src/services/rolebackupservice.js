import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve('data');
const BACKUP_FILE = path.join(DATA_DIR, 'roleBackups.json');

const backups = new Map();
let isLoaded = false;

async function ensureLoaded() {
  if (isLoaded) return;
  isLoaded = true;

  try {
    const raw = await fs.readFile(BACKUP_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    for (const [guildId, usersObj] of Object.entries(parsed)) {
      backups.set(guildId, new Map(Object.entries(usersObj)));
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to load role backups:', error);
    }
  }
}

async function saveToDisk() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const dataObj = {};
    for (const [guildId, userMap] of backups.entries()) {
      dataObj[guildId] = Object.fromEntries(userMap.entries());
    }
    await fs.writeFile(BACKUP_FILE, JSON.stringify(dataObj, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save role backups:', error);
  }
}

export async function saveMemberRoles(guildId, userId, roleIds) {
  await ensureLoaded();
  if (!backups.has(guildId)) {
    backups.set(guildId, new Map());
  }

  // Filter out @everyone ID (which equals the guildId)
  const cleanRoles = [...new Set(roleIds)].filter((id) => id !== guildId);
  backups.get(guildId).set(userId, cleanRoles);
  await saveToDisk();
}

export async function getSavedRoles(guildId, userId) {
  await ensureLoaded();
  return backups.get(guildId)?.get(userId) ?? [];
}

export function extractRoleIds(member) {
  return member.roles.cache
    .filter((role) => role.id !== member.guild.id)
    .map((role) => role.id);
}
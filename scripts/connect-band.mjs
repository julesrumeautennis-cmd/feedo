// Run locally. The generated keys stay in a file ignored by Git.
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { band } from '../server/band.js';

const file = '.env.band.local';
const saved = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
const env = { ...process.env, ...saved };
const persist = (entries) => {
  Object.assign(saved, entries);
  const temp = file + '.tmp';
  writeFileSync(temp, Object.entries(saved).map(([k,v]) => k+'='+JSON.stringify(v)).join('\n')+'\n', { mode: 0o600 });
  renameSync(temp, file);
};
if (!env.BAND_REGISTRATION_KEY) throw new Error('Renseigner BAND_REGISTRATION_KEY dans .env.local.');
const agents = {};
for (const [role, description] of Object.entries({
  scout: 'Observe les relevés simulés et les remet au mentor.',
  mentor: 'Compare les relevés reçus et formule une hypothèse.',
  auditor: 'Relit les preuves et décide si la vérification est permise.',
})) {
  const prefix = 'BAND_' + role.toUpperCase();
  let key = env[prefix + '_KEY'];
  let id = env[prefix + '_ID'];
  if (!key || !id) {
    const data = await band(env.BAND_REGISTRATION_KEY, '/me/agents/register', {
      agent: { name: 'Feedo ' + role, description },
    });
    key = data.credentials.api_key;
    id = data.agent.id;
    persist({ [prefix + '_KEY']: key, [prefix + '_ID']: id });
  }
  agents[role] = { key, id };
}
const first = agents.scout;
const room = env.BAND_CHAT_ID || (await band(first.key, '/agent/chats', { chat: { title: 'Feedo · Salle de formation' } })).id;
persist({ BAND_CHAT_ID: room });
const path = '/agent/chats/' + encodeURIComponent(room) + '/participants';
const members = await band(first.key, path);
for (const role of ['mentor', 'auditor']) {
  if (!members.some(member => member.id === agents[role].id)) {
    await band(first.key, path, { participant: { participant_id: agents[role].id } });
  }
}
console.log('Salle et trois agents BAND configurés. Clés conservées dans .env.band.local.');

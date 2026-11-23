import { createSession, availableActions, act } from '../src/training/session.js';
import { bandConfig, runHandoff } from './band.js';
import { readReference } from './reference.js';

const cache = new Map();
function cached(key, duration, work) {
  const existing = cache.get(key);
  if (existing && existing.until > Date.now()) return existing.pending;
  const entry = { until: Date.now() + duration, pending: work() };
  cache.set(key, entry);
  entry.pending.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
  return entry.pending;
}

export async function sponsorRequest(body, env) {
  const config = bandConfig(env);
  if (body?.task === 'status') return { telem: !!env.TELEM_API_KEY, band: !!config };
  if (body?.task === 'reference') {
    if (!env.TELEM_API_KEY) return { status: 'unconfigured', provider: 'Telem' };
    return { status: 'live', provider: 'Telem', ...await cached('reference', 3600000, () => readReference(env.TELEM_API_KEY)) };
  }
  if (body?.task !== 'handoff' || !['A','B'].includes(body.variant) ||
    !Array.isArray(body.history) || body.history.length > 128) throw new RangeError('Requête inconnue');
  let state = createSession({ variant: body.variant });
  for (const id of body.history) {
    if (!availableActions(state).some(action => action.id === id)) throw new RangeError('Action incohérente');
    state = act(state, id);
  }
  if (state.stage === 'observe' || !state.readings?.length) throw new RangeError('Prends une photo du raccord avant la contre-vérification.');
  if (!config) return { status: 'unconfigured', provider: 'BAND' };
  // Limit spending and duplicate posts to one exchange per distinct hydraulic state per minute.
  const key = JSON.stringify([config.room, state.variant, state.stage, state.isolated, state.repaired, state.readings]);
  return { status: 'live', provider: 'BAND', ...await cached(key, 60000, () => runHandoff(config, state)) };
}

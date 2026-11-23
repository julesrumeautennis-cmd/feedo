import { sponsorRequest } from '../server/providers.js';
export async function handle(req, res, env = process.env) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type','application/json');
  function reply(code, data) { res.statusCode = code; res.end(JSON.stringify(data)); }
  if (req.method !== 'POST') return reply(405, { error: 'Utiliser POST.' });
  if (!(req.headers['content-type'] || '').startsWith('application/json')) return reply(415, { error: 'JSON requis.' });
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return reply(403, { error:'Origine non autorisée.' }); }
    catch { return reply(403, { error:'Origine non valide.' }); }
  }
  try {
    let body = req.body;
    if (!body) {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 8192) return reply(413, { error:'Requête trop longue.' });
      }
      body = JSON.parse(raw);
    } else if (typeof body === 'string') body = JSON.parse(body);
    reply(200, await sponsorRequest(body, env));
  } catch (error) {
    if (error instanceof RangeError || error instanceof SyntaxError) return reply(400, { error: 'Historique ou requête invalide.' });
    reply(502, { error: 'Le fournisseur n’a pas confirmé la requête. Tu peux réessayer.' });
  }
}
export default function handler(req,res) { return handle(req,res); }

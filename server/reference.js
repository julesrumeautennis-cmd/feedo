import { Telem } from '@telemai/sdk';

export const sourceUrl = 'https://www.epa.gov/watersense/home-maintenance';

export async function readReference(apiKey, client = new Telem({ apiKey })) {
  const response = await client.fetch(sourceUrl, { inlineContent: true, inlineMaxChars: 30000, contentFormat: 'markdown' });
  const page = response.results.find(row => row.content && !row.error && row.url === sourceUrl);
  const content = page?.content?.replace(/\s+/g, ' ') || '';
  // Enable the teaching note only when the fetched source actually covers this observation.
  if (!/meter.{0,180}(?:no water|not using|water is being used)/i.test(content) ||
      !/(?:reading|meter).{0,160}(?:changed|change|leak)/i.test(content)) {
    throw new Error('La source récupérée ne confirme pas cet indice.');
  }
  return { url: sourceUrl, title: 'EPA WaterSense · Home Maintenance',
    guidance: 'Compare deux relevés pendant une période sans usage. Une variation du compteur justifie une recherche de fuite.',
    trace: response.interactionId, retrievedAt: page.fetchedAt || new Date().toISOString() };
}

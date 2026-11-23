import './tools.css';

const host = document.querySelector('#sponsor-tools');
let current;
let version = 0;
const endpoint = '/api/training';

async function request(payload) {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(35000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Service indisponible.');
  return result;
}

if (host) {
  const panel = document.createElement('details');
  panel.className = 'training-sources';
  const title = document.createElement('summary');
  title.textContent = 'Sources et contre-vérification';
  const reference = document.createElement('button');
  const handoff = document.createElement('button');
  const feedback = document.createElement('p');
  feedback.setAttribute('aria-live','polite');
  reference.type = handoff.type = 'button';
  reference.textContent = 'Consulter la source · Telem';
  handoff.textContent = 'Solliciter les agents · BAND';
  handoff.disabled = true;
  panel.append(title, reference, handoff, feedback);
  host.append(panel);
  let running = false;
  function updateButtons() {
    reference.disabled = running;
    handoff.disabled = running || !current?.history?.includes('photograph');
  }
  window.addEventListener('feedo:state', event => {
    version++;
    feedback.replaceChildren();
    current = event.detail;
    updateButtons();
  });
  async function run(task) {
    const startVersion = version;
    running = true;
    updateButtons();
    feedback.textContent = 'Vérification en cours…';
    try {
      const payload = task === 'reference' ? { task } : { task, variant: current.variant, history: current.history };
      const data = await request(payload);
      if (version !== startVersion) return;
      if (data.status === 'unconfigured') {
        feedback.textContent = data.provider + ' attend sa connexion. ';
        if (task === 'reference') {
          const link = document.createElement('a');
          link.href = 'https://www.epa.gov/watersense/home-maintenance';
          link.textContent = 'Ouvrir la source EPA WaterSense';
          link.target = '_blank'; link.rel = 'noopener noreferrer'; feedback.append(link);
        }
      } else if (task === 'reference') {
        feedback.textContent = data.guidance + ' ';
        const link = document.createElement('a');
        link.href = data.url; link.textContent = data.title; link.target = '_blank'; link.rel = 'noopener noreferrer';
        feedback.append(link);
      } else {
        feedback.textContent = data.verdict + ' · ' + data.receipts.length + ' transmissions relues sur BAND.';
      }
    } catch {
      if (version === startVersion) feedback.textContent = 'Le service n’a pas confirmé la requête. Réessayez dans un instant.';
    } finally {
      running = false;
      updateButtons();
    }
  }
  reference.addEventListener('click', () => run('reference'));
  handoff.addEventListener('click', () => run('handoff'));
}

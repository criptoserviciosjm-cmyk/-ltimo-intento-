/* Monitor de Tasas - PWA estática (Netlify)
   - Lee rates.json
   - Se actualiza automáticamente (polling)
   - Funciona offline (último valor cacheado)
*/

const RATES_URL = '/rates.json';
const POLL_MS = 2 * 60 * 1000; // cada 2 minutos

const grid = document.getElementById('ratesGrid');
const serverUpdatedEl = document.getElementById('serverUpdated');
const clientNowEl = document.getElementById('clientNow');
const subline = document.getElementById('subline');
const refreshBtn = document.getElementById('refreshBtn');

function fmtNumber(n){
  // Mantiene enteros; si hay decimales, muestra hasta 4
  if (Number.isInteger(n)) return n.toString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function fmtDateTime(iso){
  try{
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(d);
  }catch{ return '—'; }
}

function tickClientClock(){
  const now = new Date();
  clientNowEl.textContent = new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(now);
}

function renderRates(data){
  const rates = Array.isArray(data?.rates) ? data.rates : [];
  grid.innerHTML = '';

  if (!rates.length){
    grid.innerHTML = `<div class="card"><div class="title">Sin datos</div><div class="small">No se encontraron tasas en rates.json</div></div>`;
    return;
  }

  for (const r of rates){
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card__head">
        <div>
          <div class="title">${escapeHtml(r.title ?? '—')}</div>
          <div class="pair">${escapeHtml(r.pair ?? '')}</div>
        </div>
        <div class="badge"><span class="dot" aria-hidden="true"></span><span>En línea</span></div>
      </div>
      <div class="rate">
        <div class="rate__value">${fmtNumber(Number(r.value))}</div>
        <div class="rate__unit">${escapeHtml(r.unit ?? '')}</div>
      </div>
      <div class="small">Última carga: <span>${fmtDateTime(data.updated_at)}</span></div>
    `;
    grid.appendChild(card);
  }
}

function escapeHtml(str){
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadRates({forceNetwork=false}={}){
  try{
    subline.textContent = 'Actualizando…';

    // cache-busting para evitar que el navegador se quede con una versión vieja
    const url = forceNetwork ? `${RATES_URL}?t=${Date.now()}` : RATES_URL;

    const res = await fetch(url, {
      cache: forceNetwork ? 'no-store' : 'default'
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    renderRates(data);
    serverUpdatedEl.textContent = fmtDateTime(data.updated_at);
    subline.textContent = 'Listo';
  }catch(err){
    subline.textContent = 'Sin conexión (mostrando último valor si existe)';
    // Si falla, el Service Worker puede servir cache. Si aún así falla, mostramos el error.
    if (!grid.children.length){
      grid.innerHTML = `
        <div class="card">
          <div class="title">No se pudo cargar</div>
          <div class="small">Revisa tu conexión o intenta más tarde.</div>
        </div>
      `;
    }
  }
}

refreshBtn.addEventListener('click', () => loadRates({forceNetwork:true}));

// reloj
setInterval(tickClientClock, 1000);
tickClientClock();

// carga inicial + polling
loadRates({forceNetwork:true});
setInterval(() => loadRates({forceNetwork:true}), POLL_MS);

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
    } catch (e) {
      // silencioso
    }
  });
}

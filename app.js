/* Cotizador — estático, sin build. Precios: precios.json
   Estructura pensada para POS: items -> lines() + extras() -> buildOrder().
   Para un POS: enviar buildOrder() por POST a una API (ej. Pages Functions + D1). */

const $ = s => document.querySelector(s);
const money = n => '$' + Math.round(n).toLocaleString('es-AR');
const nice = k => k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const CDN = {
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
};
const label = k => ({ byn: 'B/N' })[k] || nice(k);
const MODES = { sheet: 'Hojas', photo: 'Fotos' };

const defProd = () => 'byn' in P.impresion ? 'byn' : Object.keys(P.impresion)[0];
let P, mode = 'sheet', items = [], ring = 0, zone = '', uid = 0;

/* ---------- Modelo ---------- */
// Cada línea {sku, desc, qty, unit} es el contrato con un futuro POS.
function lines(it) {
  if (it.type === 'photo')
    return [{ sku: 'fotos.' + it.size, desc: `${it.size} × ${it.qty}`, qty: it.qty, unit: P.fotos[it.size] }];
  return [{ sku: 'impresion.' + it.prod, desc: `${it.pages} pág × ${it.copies} cop · ${label(it.prod)}`, qty: it.pages * it.copies, unit: P.impresion[it.prod] }];
}
const sum = ls => ls.reduce((a, l) => a + l.qty * l.unit, 0);
const itemTotal = it => sum(lines(it));
const cur = () => items.filter(i => i.type === mode);
function extras() {
  const e = [];
  if (mode === 'sheet' && ring > 0) e.push({ sku: 'acabado.anillado', desc: 'Anillado', qty: ring, unit: P.acabado.anillado });
  if (zone) e.push({ sku: 'envio.' + zone, desc: 'Envío ' + nice(zone), qty: 1, unit: P.envio[zone] });
  return e;
}
const total = () => cur().reduce((a, it) => a + itemTotal(it), 0) + sum(extras());

function buildOrder() {
  return {
    ts: new Date().toISOString(),
    tipo: mode,
    items: cur().map(it => ({ name: it.name, lines: lines(it), total: itemTotal(it) })),
    extras: extras(),
    total: total()
  };
}

function summary() {
  const o = buildOrder();
  const out = [`*Pedido — ${MODES[mode]}*`, ''];
  o.items.forEach(i => out.push(`• ${i.name}: ${i.lines[0].desc} — ${money(i.total)}`));
  if (o.extras.length) out.push('');
  o.extras.forEach(l => out.push(`${l.desc}: ${l.qty > 1 ? l.qty + ' × ' + money(l.unit) + ' = ' : ''}${money(l.qty * l.unit)}`));
  out.push('', `*Total: ${money(o.total)}*`);
  return out.join('\n');
}

function newItem(o = {}) {
  const size = P.fotos['10x15'] ? '10x15' : Object.keys(P.fotos)[0];
  const it = { id: ++uid, name: mode === 'photo' ? 'Foto' : 'Impresión', type: mode, pages: 1, copies: 1, prod: defProd(), size, qty: 1, note: '', ...o };
  items.push(it);
  return it;
}

/* ---------- Archivos ---------- */
const loaded = {};
const load = src => loaded[src] ||= new Promise((ok, no) => {
  const s = document.createElement('script');
  s.src = src; s.onload = ok; s.onerror = no; document.head.append(s);
});

async function countPages(f) {
  const ext = f.name.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    await load(CDN.pdf);
    pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
    return (await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise).numPages;
  }
  if (ext === 'docx') {
    await load(CDN.zip);
    const z = await JSZip.loadAsync(await f.arrayBuffer());
    const m = (await z.file('docProps/app.xml').async('string')).match(/<Pages>(\d+)<\/Pages>/);
    if (m) return +m[1];
  }
  return 0;
}

async function addFiles(files) {
  for (const f of files) {
    const img = f.type.startsWith('image/');
    if (mode === 'photo' && !img) continue;
    const it = newItem({ name: f.name, note: mode === 'sheet' && !img ? '…' : '' });
    render();
    if (mode === 'sheet' && !img) {
      try {
        const n = await countPages(f);
        if (n) { it.pages = n; it.note = ''; } else it.note = '¿págs?';
      } catch { it.note = '¿págs?'; }
      render();
    }
  }
}

/* ---------- UI ---------- */
const num = (k, text, v) => `<label>${text}<input type="number" inputmode="numeric" min="1" step="1" value="${v}" data-k="${k}"></label>`;

function card(it) {
  const body = it.type === 'photo'
    ? `<div class="r2 ph"><select data-k="size">${Object.entries(P.fotos).map(([s, p]) => `<option value="${s}" ${s === it.size ? 'selected' : ''}>${s} — ${money(p)}</option>`).join('')}</select>${num('qty', 'Cant', it.qty)}</div>`
    : `<div class="r2">${num('pages', 'Pág', it.pages)}${num('copies', 'Cop', it.copies)}<select data-k="prod">${Object.keys(P.impresion).map(k => `<option value="${k}" ${k === it.prod ? 'selected' : ''}>${esc(label(k))}</option>`).join('')}</select></div>`;
  return `<section class="card" data-id="${it.id}">
    <div class="r1"><div class="nm"><b>${esc(it.name)}</b>${it.note ? `<small>${esc(it.note)}</small>` : ''}</div><span class="s" data-sub>${money(itemTotal(it))}</span><button data-a="del" aria-label="Quitar">✕</button></div>
    ${body}
  </section>`;
}

function render() {
  document.querySelectorAll('#mode button').forEach(b => {
    const n = items.filter(i => i.type === b.dataset.v).length;
    b.classList.toggle('on', b.dataset.v === mode);
    b.querySelector('i').textContent = n || '';
  });
  $('#items').innerHTML = cur().map(card).join('');
  $('#ringBox').style.display = mode === 'sheet' ? '' : 'none';
  $('#files').accept = mode === 'photo' ? 'image/*' : '.pdf,.docx,image/*';
  totals();
}

function totals() {
  document.querySelectorAll('.card').forEach(c => {
    const it = items.find(i => i.id == c.dataset.id);
    if (it) c.querySelector('[data-sub]').textContent = money(itemTotal(it));
  });
  $('#tot').textContent = money(total());
}

const find = el => items.find(i => i.id == el.closest('.card')?.dataset.id);

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const a = b.dataset.a;
  if (a === 'mode') mode = b.dataset.v;
  else {
    const it = find(b);
    if (a === 'del') items = items.filter(i => i !== it);
  }
  render();
});

document.addEventListener('input', e => {
  const t = e.target, k = t.dataset.k, it = find(t);
  if (!it || !k) return;
  it[k] = t.type === 'number' ? Math.max(1, parseInt(t.value) || 1) : t.value;
  totals();
});

$('#ring').oninput = e => { ring = Math.max(0, parseInt(e.target.value) || 0); totals(); };
$('#zone').onchange = e => { zone = e.target.value; totals(); };
$('#add').onclick = () => { newItem(); render(); };
$('#pick').onclick = () => $('#files').click();
$('#files').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };
$('#clear').onclick = () => {
  if (!cur().length && !ring && !zone) return;
  if (!confirm('¿Limpiar la cotización?')) return;
  items = items.filter(i => i.type !== mode); ring = 0; zone = '';
  $('#ring').value = ''; $('#zone').value = '';
  render();
};
$('#copy').onclick = async () => {
  await navigator.clipboard.writeText(summary());
  $('#copy').textContent = 'Copiado';
  setTimeout(() => $('#copy').textContent = 'Copiar', 1200);
};
$('#wa').onclick = () => open('https://wa.me/?text=' + encodeURIComponent(summary()), '_blank');

/* ---------- Init ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

// Archivos recibidos desde "Compartir" (ver sw.js): solo imágenes => Fotos, si no => Hojas.
async function takeShared() {
  if (!/[?&]shared=/.test(location.search) || !('caches' in window)) return;
  const c = await caches.open('shared'), files = [];
  for (const k of await c.keys()) {
    const res = await c.match(k), b = await res.blob();
    files.push(new File([b], decodeURIComponent(res.headers.get('x-name') || 'archivo'), { type: res.headers.get('content-type') || b.type }));
    await c.delete(k);
  }
  history.replaceState(null, '', location.pathname);
  if (!files.length) return;
  mode = files.every(f => f.type.startsWith('image/')) ? 'photo' : 'sheet';
  render();
  addFiles(files);
}

fetch('precios.json', { cache: 'no-cache' }).then(r => r.json()).then(j => {
  P = j;
  $('#ringTxt').textContent = `Anillado · ${money(P.acabado.anillado)} c/u`;
  $('#zone').innerHTML = '<option value="">Retiro</option>' +
    Object.entries(P.envio).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([z, p]) => `<option value="${z}">${nice(z)} — ${money(p)}</option>`).join('');
  render();
  takeShared();
}).catch(() => { $('#items').innerHTML = '<p class="mut">No se pudo cargar precios.json (abrilo desde un servidor, no con file://).</p>'; });

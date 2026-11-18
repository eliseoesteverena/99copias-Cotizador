/* Menú auto-ejecutable: se renderiza donde está el <script src="menu.js">.
   Estilos en style.css (.menu). Para agregar secciones, editar MENU. */
(() => {
  const MENU = {
    cotizador: { label: 'Cotizador', href: './' },
    precios:   { label: 'Precios (JSON)', href: 'precios.json' },
    // pos:    { label: 'POS', href: 'pos.html' },
  };
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';

  const here = location.pathname.replace(/index\.html$/, '');
  const isHere = href => new URL(href, location.href).pathname.replace(/index\.html$/, '') === here;

  const box = document.createElement('div');
  box.className = 'menu';
  box.innerHTML =
    `<button class="ic" aria-label="Menú" aria-haspopup="true" aria-expanded="false">${ICON}</button>` +
    `<nav hidden>${Object.entries(MENU).map(([id, m]) =>
      `<a href="${m.href}" data-id="${id}"${isHere(m.href) ? ' aria-current="page"' : ''}>${m.label}</a>`).join('')}</nav>`;
  document.currentScript.before(box);

  const btn = box.querySelector('button'), nav = box.querySelector('nav');
  const set = open => { nav.hidden = !open; btn.setAttribute('aria-expanded', open); };
  btn.onclick = e => { e.stopPropagation(); set(nav.hidden); };
  document.addEventListener('click', e => { if (!box.contains(e.target) || e.target.closest('a')) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
})();

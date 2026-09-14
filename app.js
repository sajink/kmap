'use strict';

const CELL = 62;
const GRAY2 = ['00', '01', '11', '10'];
const VAR_NAMES = ['A', 'B', 'C', 'D'];
const COLORS = ['#5cc8ff', '#ff6bd6', '#7dffb0', '#ffd166', '#b18cff', '#ff8f5e', '#4ce0d2', '#ff5f7e'];

/* ---------------- map geometry ---------------- */

function mapConfig(n) {
  if (n === 2) return { rowVars: ['A'], colVars: ['B'], rowCodes: ['0', '1'], colCodes: ['0', '1'] };
  if (n === 3) return { rowVars: ['A'], colVars: ['B', 'C'], rowCodes: ['0', '1'], colCodes: GRAY2 };
  return { rowVars: ['A', 'B'], colVars: ['C', 'D'], rowCodes: GRAY2, colCodes: GRAY2 };
}

function cellIndex(cfg, r, c) {
  return parseInt(cfg.rowCodes[r] + cfg.colCodes[c], 2);
}

function positionOf(cfg, index) {
  for (let r = 0; r < cfg.rowCodes.length; r++)
    for (let c = 0; c < cfg.colCodes.length; c++)
      if (cellIndex(cfg, r, c) === index) return { r, c };
  return null;
}

/* ---------------- Quine–McCluskey ---------------- */

function primeImplicants(minterms, dontcares, n) {
  const full = (1 << n) - 1;
  const all = [...new Set([...minterms, ...dontcares])];
  if (!all.length) return [];

  let current = all.map(m => ({ value: m, mask: full, covers: [m] }));
  const primes = [];
  const seen = new Set();

  while (current.length) {
    const used = new Array(current.length).fill(false);
    const next = new Map();

    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const a = current[i], b = current[j];
        if (a.mask !== b.mask) continue;
        const diff = (a.value ^ b.value) & a.mask;
        if (diff === 0 || (diff & (diff - 1)) !== 0) continue;
        used[i] = used[j] = true;
        const mask = a.mask & ~diff;
        const value = a.value & mask;
        const key = mask + '_' + value;
        if (!next.has(key)) {
          const covers = [...new Set([...a.covers, ...b.covers])].sort((x, y) => x - y);
          next.set(key, { value, mask, covers });
        }
      }
    }

    current.forEach((t, i) => {
      if (used[i]) return;
      const key = t.mask + '_' + t.value;
      if (seen.has(key)) return;
      seen.add(key);
      primes.push(t);
    });

    current = [...next.values()];
  }

  primes.forEach(p => {
    p.coverSet = new Set(p.covers);
    p.term = termOf(p, n);
    p.cells = cellsOf(p, n);
    p.size = p.cells.length;
  });
  primes.sort((a, b) => b.size - a.size || a.value - b.value);
  return primes;
}

function cellsOf(p, n) {
  const cells = [];
  for (let i = 0; i < (1 << n); i++) if ((i & p.mask) === p.value) cells.push(i);
  return cells;
}

function termOf(p, n) {
  let s = '';
  for (let v = 0; v < n; v++) {
    const bit = 1 << (n - 1 - v);
    if (!(p.mask & bit)) continue;
    s += VAR_NAMES[v] + ((p.value & bit) ? '' : "'");
  }
  return s || '1';
}

/* Minimal cover: essential prime implicants first, then exhaustive branch & bound. */
function selectCover(primes, minterms) {
  const need = new Set(minterms);
  const chosen = [];
  const essential = new Set();

  for (const m of minterms) {
    const hits = primes.filter(p => p.coverSet.has(m));
    if (hits.length === 1) essential.add(hits[0]);
  }
  for (const p of essential) {
    chosen.push(p);
    p.covers.forEach(m => need.delete(m));
  }

  const rest = primes.filter(p => !essential.has(p));
  const extra = search(rest, need, rest.length);
  return { chosen: [...chosen, ...(extra || [])], essential };
}

function search(primes, remaining, limit) {
  if (remaining.size === 0) return [];
  if (limit === 0) return null;
  const target = remaining.values().next().value;
  const cands = primes.filter(p => p.coverSet.has(target)).sort((a, b) => b.size - a.size);
  for (let k = 1; k <= limit; k++) {
    for (const p of cands) {
      const next = new Set([...remaining].filter(m => !p.coverSet.has(m)));
      const sub = search(primes.filter(q => q !== p), next, k - 1);
      if (sub) return [p, ...sub];
    }
  }
  return null;
}

/* ---------------- rendering ---------------- */

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderMap(cfg, n, opts) {
  const { minterms, dontcares, groups = [], dimOthers = false, stagger = false } = opts;
  const mset = new Set(minterms), dset = new Set(dontcares);
  const rows = cfg.rowCodes.length, cols = cfg.colCodes.length;

  const wrap = el('div', 'kmap');
  wrap.appendChild(el('div', 'corner', cfg.rowVars.join('') + ' \\ ' + cfg.colVars.join('')));

  const ch = el('div', 'colheads');
  ch.style.gridTemplateColumns = `repeat(${cols}, ${CELL}px)`;
  cfg.colCodes.forEach(code => ch.appendChild(el('span', null, code)));
  wrap.appendChild(ch);

  const rh = el('div', 'rowheads');
  rh.style.gridTemplateRows = `repeat(${rows}, ${CELL}px)`;
  cfg.rowCodes.forEach(code => rh.appendChild(el('span', null, code)));
  wrap.appendChild(rh);

  const cells = el('div', 'cells');
  cells.style.gridTemplateColumns = `repeat(${cols}, ${CELL}px)`;
  const highlighted = new Set();
  groups.forEach(g => g.cells.forEach(i => highlighted.add(i)));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = cellIndex(cfg, r, c);
      const val = dset.has(idx) ? 'X' : (mset.has(idx) ? '1' : '0');
      const cell = el('div', 'cell ' + (val === 'X' ? 'dc' : val === '1' ? 'one' : 'zero'));
      if (dimOthers && !highlighted.has(idx)) cell.classList.add('dim');
      cell.appendChild(el('span', 'idx', String(idx)));
      cell.appendChild(el('span', null, val));
      cells.appendChild(cell);
    }
  }

  groups.forEach((g, gi) => {
    drawGroup(cells, cfg, g.cells, g.color || COLORS[gi % COLORS.length], stagger ? gi : 0);
  });

  wrap.appendChild(cells);
  return wrap;
}

function cyclicRuns(values, total) {
  const set = new Set(values);
  if (set.size === 0) return [];
  if (set.size === total) return [[0, total - 1]];
  const runs = [];
  for (let i = 0; i < total; i++) {
    if (!set.has(i) || set.has((i - 1 + total) % total)) continue;
    let len = 1;
    while (set.has((i + len) % total)) len++;
    const end = i + len - 1;
    if (end <= total - 1) runs.push([i, end]);
    else runs.push([i, total - 1], [0, end % total]);
  }
  return runs;
}

function drawGroup(container, cfg, cellIdxs, color, offsetIdx) {
  const rows = new Set(), cols = new Set();
  cellIdxs.forEach(i => {
    const p = positionOf(cfg, i);
    if (p) { rows.add(p.r); cols.add(p.c); }
  });
  const inset = 5 + (offsetIdx % 4) * 4;
  for (const [r0, r1] of cyclicRuns([...rows], cfg.rowCodes.length)) {
    for (const [c0, c1] of cyclicRuns([...cols], cfg.colCodes.length)) {
      const box = el('div', 'group');
      box.style.borderColor = color;
      box.style.left = (c0 * CELL + inset) + 'px';
      box.style.top = (r0 * CELL + inset) + 'px';
      box.style.width = ((c1 - c0 + 1) * CELL - 2 * inset) + 'px';
      box.style.height = ((r1 - r0 + 1) * CELL - 2 * inset) + 'px';
      container.appendChild(box);
    }
  }
}

function card(title, caption, node) {
  const c = el('div', 'card');
  if (title) {
    const h = el('h3');
    h.innerHTML = title;
    c.appendChild(h);
  }
  if (caption) c.appendChild(el('p', 'cap', caption));
  c.appendChild(node);
  return c;
}

function stage(title, note) {
  const s = el('section', 'stage');
  s.appendChild(el('h2', null, title));
  if (note) s.appendChild(el('p', 'note', note));
  return s;
}

/* ---------------- solve ---------------- */

function parseList(text, n) {
  if (!text.trim()) return [];
  const max = (1 << n) - 1;
  return text.split(/[\s,;]+/).filter(Boolean).map(t => {
    const v = Number(t);
    if (!Number.isInteger(v) || v < 0 || v > max)
      throw new Error(`"${t}" is not a valid minterm for ${n} variables (allowed 0–${max}).`);
    return v;
  });
}

function solve() {
  const n = Number(document.getElementById('vars').value);
  const out = document.getElementById('output');
  const errBox = document.getElementById('error');
  errBox.hidden = true;
  out.innerHTML = '';

  let minterms, dontcares;
  try {
    minterms = [...new Set(parseList(document.getElementById('minterms').value, n))].sort((a, b) => a - b);
    dontcares = [...new Set(parseList(document.getElementById('dontcares').value, n))].sort((a, b) => a - b);
  } catch (e) {
    errBox.textContent = e.message;
    errBox.hidden = false;
    return;
  }
  dontcares = dontcares.filter(d => !minterms.includes(d));

  saveEntry({ n, minterms: minterms.join(','), dontcares: dontcares.join(',') });

  const cfg = mapConfig(n);
  const vars = VAR_NAMES.slice(0, n);
  const fn = `F(${vars.join(',')}) = &sum;m(${minterms.join(',')})` +
    (dontcares.length ? ` + d(${dontcares.join(',')})` : '');

  /* Stage 1 */
  const s1 = stage('Stage 1 — Fill the map', 'Every minterm is placed as a 1 and circled; don\'t cares appear as X.');
  const row1 = el('div', 'grid-row');
  row1.appendChild(card(fn, minterms.length ? 'Cells with 1 are the results to be covered.' : 'No minterms — the function is 0.',
    renderMap(cfg, n, {
      minterms, dontcares,
      groups: minterms.map((m, i) => ({ cells: [m], color: COLORS[i % COLORS.length] }))
    })));
  s1.appendChild(row1);
  out.appendChild(s1);

  if (!minterms.length) {
    const sf = stage('Result', null);
    sf.appendChild(el('div', 'result', 'F = 0'));
    out.appendChild(sf);
    return;
  }

  const primes = primeImplicants(minterms, dontcares, n);
  primes.forEach((p, i) => { p.color = COLORS[i % COLORS.length]; });

  /* Stage 2 */
  const s2 = stage('Stage 2 — Fold adjacent cells (prime implicants)',
    'Each map below shows one maximal grouping of 2^k adjacent 1s. Inside a group the variables that keep the same value form the product term; the variables that change are eliminated.');
  const row2 = el('div', 'grid-row');
  primes.forEach((p, i) => {
    const changing = vars.filter((v, vi) => !(p.mask & (1 << (n - 1 - vi))));
    const caption = `cells ${p.cells.join(', ')} — ${p.size} cell${p.size > 1 ? 's' : ''}; ` +
      (changing.length ? `${changing.join(',')} change${changing.length > 1 ? '' : 's'} → eliminated` : 'nothing changes');
    row2.appendChild(card(
      `Group ${i + 1}: <span class="term" style="color:${p.color}">${p.term}</span>`,
      caption,
      renderMap(cfg, n, { minterms, dontcares, groups: [p], dimOthers: true })
    ));
  });
  s2.appendChild(row2);
  out.appendChild(s2);

  /* Stage 3 */
  const { chosen, essential } = selectCover(primes, minterms);
  const s3 = stage('Stage 3 — Add and reduce',
    'The prime-implicant chart shows which minterm each group covers. Groups that are the only cover for some minterm are essential; the rest are added only if minterms remain uncovered, and redundant groups are dropped.');

  const table = el('table', 'chart');
  const head = el('tr');
  head.appendChild(el('th', null, 'implicant'));
  minterms.forEach(m => head.appendChild(el('th', null, 'm' + m)));
  head.appendChild(el('th', null, 'used'));
  table.appendChild(head);

  primes.forEach((p, i) => {
    const tr = el('tr');
    if (essential.has(p)) tr.className = 'essential';
    const th = el('th', 'pi');
    th.innerHTML = `<span style="color:${p.color}">■</span> ${p.term}`;
    tr.appendChild(th);
    minterms.forEach(m => {
      const td = el('td', p.coverSet.has(m) ? 'mark' : null, p.coverSet.has(m) ? '✔' : '');
      tr.appendChild(td);
    });
    tr.appendChild(el('td', null, essential.has(p) ? 'essential' : chosen.includes(p) ? 'yes' : 'redundant'));
    table.appendChild(tr);
  });
  s3.appendChild(table);

  const finalMap = renderMap(cfg, n, { minterms, dontcares, groups: chosen, stagger: true });
  const legend = el('div', 'legend');
  chosen.forEach(p => {
    const d = el('div');
    const sw = el('span', 'swatch');
    sw.style.borderColor = p.color;
    d.appendChild(sw);
    d.appendChild(el('span', null, p.term));
    legend.appendChild(d);
  });
  const holder = el('div');
  holder.appendChild(finalMap);
  holder.appendChild(legend);

  const row3 = el('div', 'grid-row');
  row3.appendChild(card('Minimal cover', 'All selected groups drawn on one map.', holder));
  s3.appendChild(row3);

  const steps = el('ul', 'steps');
  chosen.forEach(p => {
    const li = el('li');
    li.innerHTML = `<b>${p.term}</b> covers m(${p.covers.filter(m => minterms.includes(m)).join(',')})` +
      (essential.has(p) ? ' — essential' : '');
    steps.appendChild(li);
  });
  s3.appendChild(steps);

  const expr = chosen.some(p => p.mask === 0)
    ? '1'
    : chosen.map(p => p.term).join(' + ') || '0';
  s3.appendChild(el('div', 'result', `F(${vars.join(',')}) = ${expr}`));
  out.appendChild(s3);
}

/* ---------------- history (localStorage) ---------------- */

const HISTORY_KEY = 'kmap-history';
const HISTORY_LIMIT = 10;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntry(entry) {
  const history = loadHistory().filter(e =>
    !(e.n === entry.n && e.minterms === entry.minterms && e.dontcares === entry.dontcares));
  history.unshift(entry);
  history.length = Math.min(history.length, HISTORY_LIMIT);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* storage unavailable or full — skip persisting */
  }
  renderHistoryMenu();
}

function renderHistoryMenu() {
  const menu = document.getElementById('historyMenu');
  menu.innerHTML = '';
  const history = loadHistory();
  if (!history.length) {
    menu.appendChild(el('div', 'empty', 'No solved problems yet.'));
    return;
  }
  history.forEach(entry => {
    const btn = el('button', 'hist-item');
    btn.type = 'button';
    btn.innerHTML = `<span class="fn">F(${VAR_NAMES.slice(0, entry.n).join(',')})</span> = &sum;m(${entry.minterms})` +
      (entry.dontcares ? ` + d(${entry.dontcares})` : '');
    btn.addEventListener('click', () => {
      document.getElementById('vars').value = String(entry.n);
      document.getElementById('minterms').value = entry.minterms;
      document.getElementById('dontcares').value = entry.dontcares;
      closeHistoryMenu();
      solve();
    });
    menu.appendChild(btn);
  });
}

function openHistoryMenu() {
  document.getElementById('historyMenu').hidden = false;
  document.getElementById('historyBtn').setAttribute('aria-expanded', 'true');
}

function closeHistoryMenu() {
  document.getElementById('historyMenu').hidden = true;
  document.getElementById('historyBtn').setAttribute('aria-expanded', 'false');
}

document.getElementById('historyBtn').addEventListener('click', e => {
  e.stopPropagation();
  const menu = document.getElementById('historyMenu');
  if (menu.hidden) openHistoryMenu(); else closeHistoryMenu();
});
document.addEventListener('click', e => {
  if (!e.target.closest('.menu')) closeHistoryMenu();
});
renderHistoryMenu();

document.getElementById('form').addEventListener('submit', e => {
  e.preventDefault();
  solve();
});
solve();

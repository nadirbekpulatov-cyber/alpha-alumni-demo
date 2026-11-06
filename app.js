// Прототип каталога выпускников ALPHA. Всё живёт в браузере: бота, базы и отправки нет.
(() => {
  const D = window.DEMO;
  const KEY = 'alpha-alumni-demo-v2';
  const LIMIT = 30, SHOW_FROM = 5, START_SEEN = 24;
  const app = document.getElementById('app');
  const tabsEl = document.getElementById('tabs');
  const sheetRoot = document.getElementById('sheet-root');
  const toastEl = document.getElementById('toast');

  // ---------- состояние ----------
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* приватный режим — живём в памяти */ } },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
  function fresh(ready) {
    const me = Object.assign({ n: D.me.n, g: D.me.g, sp: '', role: '', use: '', co: '', hideCo: false, prog: '', year: 0,
      to: ['sovet'], accept: true, events: true, digest: true, filled: false }, ready ? Object.assign({}, D.meReady, { filled: true }) : {});
    return {
      logged: !!ready, me, seen: [], seenCount: START_SEEN,
      out: D.outgoing.map((r, i) => Object.assign({ id: 'o' + i, helped: null }, r)),
      inc: D.incoming.map((r, i) => Object.assign({ id: 'i' + i }, r)),
      board: JSON.parse(JSON.stringify(D.board)), boardF: 'all',
      q: '', picks: { prog: false, year: false, open: false }, f: { sp: [], prog: [], year: [] }, reqTab: 'out', returnTo: null
    };
  }
  const params = new URLSearchParams(location.search);
  if (params.has('reset')) store.clear();
  let S = params.get('demo') === 'ready' ? fresh(true) : (store.get() || fresh(false));
  if (params.has('reset') || params.has('demo')) history.replaceState(null, '', location.pathname + location.hash);
  const save = () => store.set(S);
  save();

  // ---------- помощники ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (id, cls) => `<svg class="ico${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const person = id => D.people.find(p => p.id === Number(id));
  const mono = n => n.split(/\s+/).filter(w => !/^oʻgʻli|qizi$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const useLabel = p => p.g === 'f' ? 'Полезна' : 'Полезен';
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return (m === 1 && h !== 11) ? a : (m >= 2 && m <= 4 && (h < 12 || h > 14)) ? b : c; };
  const people = n => n + ' ' + plural(n, 'человек', 'человека', 'человек');
  const norm = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[ʻʼ‘’`']/g, "'");
  const ago = d => d === 0 ? 'сегодня' : d === 1 ? 'вчера' : d + ' ' + plural(d, 'день', 'дня', 'дней') + ' назад';
  const firstName = p => /oʻgʻli|qizi/i.test(p.n) ? p.n.split(' ')[1] : p.n.split(' ')[0];
  const he = p => p.g === 'f' ? 'она' : 'он';
  const LOGO = '<svg class="logo" viewBox="0 0 2000 345" aria-label="ALPHA" role="img"><path fill="currentColor" d="M0 345 197 0l197 345h-78L197 135 78 345ZM488 5h68v272h169v68H488ZM850 0h126a125 125 0 0 1 0 250h-58v95h-68ZM918 62v126h58a63 63 0 0 0 0-126ZM1224 0h67v135h148V0h68v345h-68V203h-148v142h-67ZM1605 345 1802 0l197 345h-78l-119-210-119 210Z"/></svg>';
  const langSeg = () => `<div class="seg" role="group" aria-label="Язык"><button aria-pressed="true">RU</button><button data-lang>UZ</button><button data-lang>EN</button></div>`;

  let toastT;
  function toast(msg) {
    toastEl.innerHTML = ico('check') + '<span>' + esc(msg) + '</span>';
    toastEl.classList.add('on'); clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('on'), 2800);
  }

  // ---------- навигация ----------
  let inApp = 0, catalogScroll = 0, current = '';
  const go = h => { location.hash = h; };
  function back(fallback) { if (inApp > 0) history.back(); else go(fallback || '#catalog'); }
  window.addEventListener('hashchange', () => { inApp++; route(); });

  function shell({ tabs, dock }) {
    tabsEl.hidden = !tabs;
    if (tabs) {
      const n = S.me.filled ? S.inc.filter(r => r.st === 'new').length : 0;
      const t = (id, h, label, icon, badge) => `<a class="tab" href="${h}" ${tabs === id ? 'aria-current="page"' : ''}><span class="pill">${ico(icon)}</span><span>${label}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</a>`;
      tabsEl.innerHTML = '<div class="in">' + t('catalog', '#catalog', 'Каталог', 'search') + t('board', '#board', 'Вопросы', 'ask') + t('req', '#req', 'Запросы', 'inbox', n) + t('me', '#me', 'Профиль', 'user') + '</div>';
    }
    app.classList.toggle('no-tabs', !tabs);
    document.body.classList.toggle('dock-on', !!dock);
  }

  function route() {
    closeSheet(true);
    const h = location.hash.replace(/^#/, '');
    if (current === 'catalog') catalogScroll = window.scrollY;
    if (!S.logged) { current = 'login'; viewLogin(); window.scrollTo(0, 0); return; }
    const [name, arg] = h.split('/');
    current = name || 'catalog';
    if (current === 'p') viewCard(arg);
    else if (current === 'ask') viewAsk(arg);
    else if (current === 'alpha') viewAskAlpha();
    else if (current === 'me') viewMe();
    else if (current === 'req') viewReq();
    else if (current === 'admin') viewAdmin();
    else if (current === 'graduates') viewGrads();
    else if (current === 'board') viewBoard();
    else if (current === 'qa') viewQ(arg);
    else if (current === 'newq') viewNewQ();
    else if (current === 'digest') viewDigest();
    else { current = 'catalog'; viewCatalog(); window.scrollTo(0, catalogScroll); return; }
    window.scrollTo(0, 0);
  }

  // ---------- вход ----------
  function viewLogin() {
    shell({});
    app.innerHTML = `<div class="login">
      <div class="top">${LOGO}${langSeg()}</div>
      <div class="mid">
        <h1>Выпускники ALPHA</h1>
        <p class="sub">Здесь выпускники ALPHA находят своих. Нужный человек сам решит, дать ли контакт</p>
        <button class="btn main wide" id="tg">${ico('send')}Войти через Telegram</button>
        <p class="hint center">Бот проверит, что вы в чате «ALPHA - клуб выпускников»</p>
      </div>
      <p class="foot-note">Прототип: вход имитируется, все люди и компании выдуманы</p>
    </div>`;
    const b = document.getElementById('tg');
    b.onclick = () => {
      b.onclick = null; b.setAttribute('aria-busy', 'true');
      b.innerHTML = 'Бот проверяет вход <span class="dots"><i></i><i></i><i></i></span>';
      setTimeout(() => { S.logged = true; if (!S.me.filled) S.returnTo = '#catalog'; save(); location.replace(S.me.filled ? '#catalog' : '#me'); route(); toast('Вы вошли как ' + S.me.n); }, 1100);
    };
  }

  // ---------- каталог ----------
  function results() {
    const words = norm(S.q.trim()).split(/\s+/).filter(Boolean);
    return D.people.filter(p => {
      if (words.length) {
        const hay = norm([p.n, p.role, p.sp, p.use, p.prog, p.year].join(' '));
        if (!words.every(w => hay.includes(w))) return false;
      } else if (p.stale) return false; // давно не обновлялся: вне подборок, поиск находит
      if (S.picks.prog && p.prog !== S.me.prog) return false;
      if (S.picks.year && p.year !== S.me.year) return false;
      if (S.picks.open && p.st !== 'open') return false;
      if (S.f.sp.length && !S.f.sp.includes(p.sp)) return false;
      if (S.f.prog.length && !S.f.prog.includes(p.prog)) return false;
      if (S.f.year.length && !S.f.year.includes(p.year)) return false;
      return true;
    });
  }
  const statusMeta = p => (p.st === 'open' ? '<span class="open">принимает запросы</span>' : '<span class="pause">запросы на паузе</span>') +
    (p.stale ? '<span class="stale">давно не обновлялся</span>' : '');
  const cardHTML = p => `<a class="card" href="#p/${p.id}">
      <div class="ava" aria-hidden="true">${mono(p.n)}</div>
      <div class="body"><div class="name">${esc(p.n)}</div><div class="role">${esc(p.role)}</div>
      <div class="use"><span>${useLabel(p)}:</span> ${esc(p.use)}</div>
      <div class="meta"><span>${esc(p.prog)}, ${p.year}</span>${statusMeta(p)}</div></div></a>`;
  const fCount = () => S.f.sp.length + S.f.prog.length + S.f.year.length;

  function viewCatalog() {
    shell({ tabs: 'catalog' });
    const pk = (k, label) => `<button class="chip" data-pick="${k}" aria-pressed="${S.picks[k]}">${label}</button>`;
    const fc = fCount();
    app.innerHTML = `
      <div class="top">${LOGO}${langSeg()}</div>
      <h1>Выпускники</h1>
      <p class="sub">Найдите нужного выпускника ALPHA — он сам решит, дать ли контакт</p>
      <label class="search">${ico('search')}<input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Юрист, найм, экспорт…" value="${esc(S.q)}" aria-label="Поиск по выпускникам">
        <button class="clear" id="qx" aria-label="Очистить поиск" ${S.q ? '' : 'hidden'}>${ico('close')}</button></label>
      <div class="picks">
        <button class="chip key" id="filters">${ico('filter')}Фильтры${fc ? `<span class="n">${fc}</span>` : ''}</button>
        ${pk('prog', 'Моя программа')}${pk('year', 'Мой год')}${pk('open', 'Принимает запросы')}
      </div>
      ${S.me.filled ? '' : `<div class="banner"><p><b>Заполните профиль — минута</b>Без него нельзя просить контакт</p><a class="btn" href="#me">Заполнить</a></div>`}
      <div id="list"></div>`;
    renderList();
    const q = document.getElementById('q'), qx = document.getElementById('qx');
    q.oninput = () => { S.q = q.value; save(); qx.hidden = !S.q; renderList(); };
    q.onkeydown = e => { if (e.key === 'Enter') q.blur(); };
    qx.onclick = e => { e.preventDefault(); S.q = ''; save(); q.value = ''; qx.hidden = true; renderList(); q.focus(); };
    app.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
      const k = b.dataset.pick;
      if (k === 'prog' && !S.me.prog) return toast('Укажите программу в профиле — подборка заработает');
      if (k === 'year' && !S.me.year) return toast('Укажите год в профиле — подборка заработает');
      S.picks[k] = !S.picks[k]; save(); b.setAttribute('aria-pressed', S.picks[k]); renderList();
    });
    document.getElementById('filters').onclick = openFilters;
  }

  function renderList() {
    const list = document.getElementById('list'); if (!list) return;
    const r = results();
    if (r.length) {
      const filtered = S.q.trim() || fCount() || Object.values(S.picks).some(Boolean);
      list.innerHTML = `<p class="count">${filtered ? 'Нашли ' + people(r.length) : people(r.length) + ' в демо-каталоге'}</p>` + r.map(cardHTML).join('');
      return;
    }
    const q = S.q.trim();
    list.innerHTML = `<div class="state"><h3>${q ? 'Никого по запросу «' + esc(q) + '»' : 'Никого с такими условиями'}</h3>
      <p>Спросите ALPHA — подберём человека из выпускников.</p>
      <div class="row"><a class="btn main" href="#alpha">Спросить ALPHA</a>${q ? '<a class="btn" href="#newq">Спросить выпускников</a>' : '<button class="btn" id="resetf">Сбросить фильтры</button>'}</div></div>`;
    const rf = document.getElementById('resetf');
    if (rf) rf.onclick = () => { S.f = { sp: [], prog: [], year: [] }; S.picks = { prog: false, year: false, open: false }; save(); viewCatalog(); };
  }

  function openFilters() {
    const groups = [['sp', 'Сфера', D.spheres], ['prog', 'Программа ALPHA', D.programs], ['year', 'Год выпуска', D.years]];
    const body = () => groups.map(([k, l, vals]) => `<p class="lbl2">${l}</p><div class="row">${vals.map(v =>
      `<button class="chip" data-f="${k}" data-v="${v}" aria-pressed="${S.f[k].includes(v)}">${v}</button>`).join('')}</div>`).join('');
    const foot = () => { const n = results().length; return `<button class="btn main wide" data-close>${n ? 'Показать ' + people(n) : 'Никого — сбросьте фильтр'}</button><div class="flag"><button class="btn text" id="freset">Сбросить</button></div>`; };
    const sh = openSheet({ title: 'Фильтры', body: body(), foot: foot(), onClose: () => { if (current === 'catalog') viewCatalog(); } });
    const refresh = () => { sh.querySelector('.bd').innerHTML = body(); sh.querySelector('.ft').innerHTML = foot(); bind(); };
    function bind() {
      sh.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
        const k = b.dataset.f, v = k === 'year' ? Number(b.dataset.v) : b.dataset.v, a = S.f[k];
        S.f[k] = a.includes(v) ? a.filter(x => x !== v) : a.concat(v); save(); refresh();
      });
      sh.querySelector('#freset').onclick = () => { S.f = { sp: [], prog: [], year: [] }; save(); refresh(); };
      sh.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeSheet());
    }
    bind();
  }

  // ---------- карточка ----------
  function viewCard(id) {
    const p = person(id);
    if (!p) return go('#catalog');
    if (!S.seen.includes(p.id)) {
      if (S.seenCount >= LIMIT) return viewLimit();
      S.seen.push(p.id); S.seenCount++; save();
    }
    shell({ dock: true });
    const left = LIMIT - S.seenCount;
    const sent = S.out.find(r => r.pid === p.id && r.st !== 'no');
    const co = p.co ? esc(p.co) : `<span class="hid">${ico('hide')}скрыто</span>`;
    const req = p.st === 'open' ? '<span class="open">принимает</span>' : `<span class="pause">на паузе ${esc(p.until || '')}</span>`;
    const openTo = p.to.map(t => D.openTo[t]).join(', ');
    let dock;
    if (sent && sent.st === 'ok') dock = `<button class="btn main wide" id="tgw">${ico('send')}Написать в Telegram</button><p class="hint">${esc(firstName(p))} ${p.g === 'f' ? 'открыла' : 'открыл'} вам контакт</p>`;
    else if (sent) dock = `<button class="btn done wide" disabled>${ico('check')}Запрос отправлен</button><p class="hint">${sent.st === 'later' ? 'Доставим завтра: сегодня у ' + esc(firstName(p)) + ' много запросов' : 'Ответ придёт в бот'} · <a href="#req" style="text-decoration:underline;text-underline-offset:3px">мои запросы</a></p>`;
    else if (p.st !== 'open') dock = `<button class="btn main wide" disabled>Попросить контакт</button><p class="hint">${esc(firstName(p))} сейчас не принимает запросы</p>`;
    else if (!S.me.filled) dock = `<button class="btn main wide" disabled>Попросить контакт</button><p class="hint">Сначала <a href="#me" id="fill" style="color:var(--fg);text-decoration:underline;text-underline-offset:3px">заполните профиль</a> — минута</p>`;
    else dock = `<a class="btn main wide" href="#ask/${p.id}">Попросить контакт</a>`;
    app.innerHTML = `
      <div class="top"><button class="iconbtn" id="back" aria-label="Назад">${ico('back')}</button></div>
      ${left <= SHOW_FROM ? `<div class="left">${ico('clock')}<span>${left ? 'Сегодня можно открыть ещё ' + left + ' ' + plural(left, 'карточку', 'карточки', 'карточек') + ' из ' + LIMIT : 'Это последняя карточка на сегодня. Завтра откроются снова'}</span></div>` : ''}
      <div class="prof"><div class="ava lg" aria-hidden="true">${mono(p.n)}</div><div class="name">${esc(p.n)}</div><div class="role">${esc(p.role)}</div></div>
      <dl class="facts">
        <div><dt>Компания</dt><dd>${co}</dd></div>
        <div><dt>Программа ALPHA</dt><dd>${esc(p.prog)}, ${p.year}</dd></div>
        <div><dt>Запросы</dt><dd>${req}</dd></div>
        <div><dt>Открыт${p.g === 'f' ? 'а' : ''} к</dt><dd>${openTo}</dd></div>
      </dl>
      <p class="quote"><span>${useLabel(p)}</span>${esc(p.use)}</p>
      ${p.stale ? '<p class="hint">Профиль давно не обновлялся — данные могли устареть</p>' : ''}
      <div class="dock">${dock}<div class="flag"><button class="btn text" id="flag">Пожаловаться</button></div></div>`;
    document.getElementById('back').onclick = () => back('#catalog');
    const fill = document.getElementById('fill');
    if (fill) fill.onclick = () => { S.returnTo = '#p/' + p.id; save(); };
    document.getElementById('flag').onclick = () => openComplaint(p);
    const tgw = document.getElementById('tgw');
    if (tgw) tgw.onclick = () => toast('В пилоте откроется чат в Telegram');
  }

  function viewLimit() {
    shell({ tabs: 'catalog' });
    app.innerHTML = `<div class="top"><button class="iconbtn" id="back" aria-label="Назад">${ico('back')}</button></div>
      <div class="state"><h3>На сегодня профили закончились</h3><p>Можно открыть ${LIMIT} карточек в день — так выпускники защищены от спама. Завтра откроются снова, список и поиск работают.</p>
      <div class="row"><a class="btn" href="#req">Мои запросы</a><button class="btn text" id="more">Сбросить счётчик (демо)</button></div></div>`;
    document.getElementById('back').onclick = () => back('#catalog');
    document.getElementById('more').onclick = () => { S.seenCount = START_SEEN; S.seen = []; save(); back('#catalog'); };
  }

  function openComplaint(p) {
    const reasons = ['Просит деньги', 'Массовая рассылка', 'Оскорбления', 'Другое'];
    const sh = openSheet({ title: 'Пожаловаться', body: `<p class="hint" style="margin:0 2px 12px">Жалобу увидит только модератор ALPHA. ${esc(p.n)} не узнает, кто пожаловался.</p>
      <div class="group">${reasons.map(r => `<button class="item" data-r>${ico('flag')}<span>${r}</span></button>`).join('')}</div>` });
    sh.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { closeSheet(); toast('Жалоба ушла модератору ALPHA'); });
  }

  // ---------- запрос контакта ----------
  let draft = { pid: 0, type: 'sovet', text: '' };
  function viewAsk(id) {
    const p = person(id);
    if (!p) return go('#catalog');
    if (!S.me.filled) { S.returnTo = '#p/' + p.id; save(); return location.replace('#me'); }
    if (p.st !== 'open' || S.out.find(r => r.pid === p.id && r.st !== 'no')) return location.replace('#p/' + p.id);
    if (draft.pid !== p.id) draft = { pid: p.id, type: 'sovet', text: '' };
    shell({ dock: true });
    const ph = { sovet: 'Например: как выбрать агентство', pred: 'Например: совместная акция', vak: 'Например: ищу начальника склада' };
    const fit = () => p.to.includes(draft.type)
      ? `${esc(firstName(p))} ${p.g === 'f' ? 'открыта' : 'открыт'} к ${D.openTo[draft.type]} — запрос придёт сразу.`
      : `${esc(firstName(p))} не отмечал${p.g === 'f' ? 'а' : ''} ${D.openTo[draft.type]}. Запрос ${he(p)} увидит и решит сам${p.g === 'f' ? 'а' : ''}.`;
    app.innerHTML = `
      <div class="top"><button class="iconbtn" id="back" aria-label="Назад">${ico('back')}</button></div>
      <h1>Запрос контакта</h1>
      <p class="sub">${esc(p.n)} увидит ваш профиль и эту строку. Контакт откроется, только если ${he(p)} согласится.</p>
      <div class="field"><span class="lbl">Тип запроса</span>
        <div class="seg big" role="group" aria-label="Тип запроса">${Object.entries(D.types).map(([k, v]) => `<button data-t="${k}" aria-pressed="${draft.type === k}">${v}</button>`).join('')}</div>
        <p class="hint" id="fit">${fit()}</p></div>
      <div class="field"><label class="lbl" for="rt">Что нужно — одной строкой</label>
        <input class="inp" id="rt" maxlength="140" autocomplete="off" enterkeyhint="send" placeholder="${ph[draft.type]}" value="${esc(draft.text)}">
        <p class="err" id="rterr" hidden>Напишите одной строкой, что нужно — без этого запрос не уйдёт</p></div>
      <div class="dock"><button class="btn main wide" id="send">${ico('send')}Отправить запрос</button><p class="hint">Переписка — в Telegram, каталог хранит только запрос</p></div>`;
    document.getElementById('back').onclick = () => back('#p/' + p.id);
    const rt = document.getElementById('rt'), err = document.getElementById('rterr');
    app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      draft.type = b.dataset.t;
      app.querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-pressed', x === b));
      document.getElementById('fit').innerHTML = fit();
      rt.placeholder = ph[draft.type];
    });
    rt.oninput = () => { draft.text = rt.value; if (rt.value.trim().length >= 5) { err.hidden = true; rt.classList.remove('bad'); } };
    rt.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); send(); } };
    const btn = document.getElementById('send');
    btn.onclick = send;
    function send() {
      if (draft.text.trim().length < 5) { err.hidden = false; rt.classList.add('bad'); rt.focus(); return; }
      rt.blur(); btn.setAttribute('aria-busy', 'true'); btn.onclick = null;
      btn.innerHTML = 'Отправляем <span class="dots"><i></i><i></i><i></i></span>';
      setTimeout(() => {
        const later = !!p.full;
        S.out.unshift({ id: 'o' + Date.now(), pid: p.id, type: draft.type, text: draft.text.trim(), st: later ? 'later' : 'wait', days: 0, helped: null });
        save(); draft = { pid: 0, type: 'sovet', text: '' };
        location.replace('#p/' + p.id);
        toast(later ? 'Запрос отправлен. Доставим завтра: сегодня у ' + firstName(p) + ' много запросов' : 'Запрос отправлен. Ответ придёт в бот');
      }, 900);
    }
  }

  function viewAskAlpha() {
    shell({ dock: true });
    const q = S.q.trim();
    app.innerHTML = `
      <div class="top"><button class="iconbtn" id="back" aria-label="Назад">${ico('back')}</button></div>
      <h1>Спросите ALPHA</h1>
      <p class="sub">Расскажите, кого ищете и зачем. Подберём человека среди выпускников и напишем в бот.</p>
      <div class="field"><label class="lbl" for="aq">Кого ищете</label>
        <textarea class="inp" id="aq" rows="4" placeholder="Например: инженер-нефтяник, чтобы оценить оборудование перед покупкой">${q ? 'Ищу: ' + esc(q) : ''}</textarea>
        <p class="err" id="aqerr" hidden>Напишите хотя бы пару слов — так подберём точнее</p></div>
      <div class="dock"><button class="btn main wide" id="send">${ico('send')}Отправить ALPHA</button></div>`;
    document.getElementById('back').onclick = () => back('#catalog');
    const btn = document.getElementById('send'), aq = document.getElementById('aq');
    btn.onclick = () => {
      if (aq.value.trim().length < 5) { document.getElementById('aqerr').hidden = false; aq.classList.add('bad'); aq.focus(); return; }
      btn.onclick = null; btn.innerHTML = 'Отправляем <span class="dots"><i></i><i></i><i></i></span>';
      setTimeout(() => { S.q = ''; save(); location.replace('#catalog'); toast('Запрос ушёл ALPHA. Ответ придёт в бот'); }, 900);
    };
  }

  // ---------- мой профиль ----------
  function viewMe() {
    shell({ tabs: 'me' });
    const m = S.me;
    const chips = (k, vals, multi) => vals.map(v => {
      const on = multi ? m[k].includes(v) : m[k] === v;
      return `<button class="chip" data-k="${k}" data-v="${v}" ${multi ? 'data-multi' : ''} aria-pressed="${on}">${multi ? D.openTo[v].replace(/^./, c => c.toUpperCase()).replace(/ям$|ям$/, '') : v}</button>`;
    }).join('');
    const toLabels = { sovet: 'Совет и знакомство', pred: 'Деловые предложения', vak: 'Вакансии' };
    const sw = (k, t, s) => `<button class="switch" role="switch" data-sw="${k}" aria-checked="${!!m[k]}"><span>${t}<small>${s}</small></span><i></i></button>`;
    const ex = m.sp ? `Пример для сферы «${esc(m.sp)}»: <b>${esc(D.examples[m.sp])}</b>` : 'Выберите сферу — покажем пример';
    const preview = m.filled ? `<p class="count">Так вас видят в каталоге</p>${cardHTML({ id: 0, n: m.n, g: m.g, role: m.role, use: m.use, prog: m.prog, year: m.year, st: m.accept ? 'open' : 'pause' }).replace('<a class="card" href="#p/0">', '<div class="card" style="cursor:default">').replace(/<\/a>$/, '</div>').replace(esc(m.n) + '</div>', esc(m.n) + '<span class="me-tag">это вы</span></div>')}` : '';
    app.innerHTML = `
      <div class="top">${LOGO}${langSeg()}</div>
      <h1>Мой профиль</h1>
      <p class="sub">${m.filled ? 'Меняйте, когда меняется работа. Раз в полгода бот спросит, всё ли актуально.' : 'Первый шаг — расскажите о себе. Минута, имя и фото уже из Telegram.'}</p>
      ${preview}
      <div class="field"><label class="lbl" for="fn">Имя</label><input class="inp" id="fn" data-in="n" autocomplete="name" value="${esc(m.n)}"></div>
      <div class="field"><span class="lbl">В карточке писать<small>Подставили по фамилии — поправьте, если ошиблись</small></span>
        <div class="seg big" role="group"><button data-g="m" aria-pressed="${m.g === 'm'}">Полезен</button><button data-g="f" aria-pressed="${m.g === 'f'}">Полезна</button></div></div>
      <div class="field" id="f-sp"><span class="lbl">Сфера</span><div class="row">${chips('sp', D.spheres)}</div></div>
      <div class="field" id="f-role"><label class="lbl" for="fr">Должность и отрасль</label><input class="inp" id="fr" data-in="role" placeholder="Например: HR-директор, ритейл" value="${esc(m.role)}"></div>
      <div class="field" id="f-use"><label class="lbl" for="fu">С чем к вам приходят за советом?<small>Сначала совет, потом помощь — одной строкой</small></label>
        <textarea class="inp" id="fu" data-in="use" rows="2" maxlength="160" placeholder="Подскажу по … · помогу с …">${esc(m.use)}</textarea>
        <p class="example" id="ex">${ex}</p></div>
      <div class="field"><label class="lbl" for="fc">Компания<small>Видна только в открытой карточке</small></label><input class="inp" id="fc" data-in="co" autocomplete="organization" placeholder="Можно не указывать" value="${esc(m.co)}"></div>
      ${sw('hideCo', 'Скрыть компанию', 'В карточке будет «скрыто»')}
      <div class="field" id="f-prog" style="margin-top:18px"><span class="lbl">Программа ALPHA</span><div class="row">${chips('prog', D.programs)}</div></div>
      <div class="field" id="f-year"><span class="lbl">Год выпуска</span><div class="row">${chips('year', D.years)}</div></div>
      <div class="field"><span class="lbl">К чему вы открыты<small>Такие запросы придут сразу, остальные — на ваше решение</small></span>
        <div class="row">${Object.keys(toLabels).map(k => `<button class="chip" data-k="to" data-v="${k}" data-multi aria-pressed="${m.to.includes(k)}">${toLabels[k]}</button>`).join('')}</div></div>
      <button class="btn main wide" id="save">${m.filled ? 'Сохранить изменения' : 'Сохранить профиль'}</button>
      <p class="err" id="saveerr" hidden></p>
      <h2>Настройки</h2>
      ${sw('accept', 'Принимаю запросы', 'Выключите — поставим паузу, у вас кнопка станет серой')}
      ${sw('events', 'События ALPHA в боте', 'Не чаще двух раз в месяц, ночью без звука')}
      ${sw('digest', 'Дайджест раз в неделю', 'Три вопроса недели в вашей сфере и «вам сказали спасибо»')}
      <div class="flag" style="margin:-2px 0 4px"><a class="btn text" href="#digest">Как выглядит дайджест</a></div>
      <div class="group" style="margin-top:12px">
        <button class="item" id="refer">${ico('share')}<span>Посоветовать ALPHA коллеге</span></button>
        <a class="item" href="#graduates">${ico('check')}<span>Для выпускников</span><small>скидка 10 %</small></a>
        <a class="item" href="#admin">${ico('chart')}<span>Вкладка команды ALPHA</span><small>демо</small></a>
        <button class="item" id="reset">${ico('clock')}<span>Начать демо заново</span></button>
      </div>
      <div class="flag"><button class="btn text" id="leave">Уйти из каталога</button></div>`;

    app.querySelectorAll('[data-in]').forEach(el => el.oninput = () => { m[el.dataset.in] = el.value; save(); });
    app.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { m.g = b.dataset.g; save(); app.querySelectorAll('[data-g]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const k = b.dataset.k, v = k === 'year' ? Number(b.dataset.v) : b.dataset.v;
      if (b.hasAttribute('data-multi')) {
        m[k] = m[k].includes(v) ? m[k].filter(x => x !== v) : m[k].concat(v);
        b.setAttribute('aria-pressed', m[k].includes(v));
      } else {
        m[k] = v;
        app.querySelectorAll(`[data-k="${k}"]`).forEach(x => x.setAttribute('aria-pressed', x === b));
        if (k === 'sp') document.getElementById('ex').innerHTML = `Пример для сферы «${esc(v)}»: <b>${esc(D.examples[v])}</b>`;
      }
      save();
    });
    app.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => {
      const k = b.dataset.sw; m[k] = !m[k]; save(); b.setAttribute('aria-checked', m[k]);
      if (k === 'accept') toast(m[k] ? 'Пауза снята — запросы снова приходят' : 'Пауза: вас не беспокоят, профиль виден с меткой');
      if (k === 'digest') toast(m[k] ? 'Дайджест включён: раз в неделю, в понедельник' : 'Дайджест выключен. Включить можно здесь же');
    });
    document.getElementById('save').onclick = () => {
      const miss = [];
      if (!m.sp) miss.push(['f-sp', 'сферу']);
      if (!m.role.trim()) miss.push(['f-role', 'должность']);
      if (!m.use.trim()) miss.push(['f-use', 'с чем приходят за советом']);
      if (!m.prog) miss.push(['f-prog', 'программу']);
      if (!m.year) miss.push(['f-year', 'год']);
      const e = document.getElementById('saveerr');
      if (miss.length) { e.hidden = false; e.textContent = 'Осталось указать: ' + miss.map(x => x[1]).join(', '); document.getElementById(miss[0][0]).scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      const first = !m.filled; m.filled = true; save();
      const ret = S.returnTo; S.returnTo = null; save();
      if (ret) { location.replace(ret); toast('Профиль готов. Теперь можно попросить контакт'); }
      else { viewMe(); window.scrollTo(0, 0); toast(first ? 'Профиль готов. Теперь можно просить контакты' : 'Изменения сохранены'); }
    };
    document.getElementById('refer').onclick = openRefer;
    document.getElementById('reset').onclick = () => { store.clear(); S = fresh(false); save(); location.replace('#catalog'); route(); };
    document.getElementById('leave').onclick = () => toast('В прототипе выход отключён. В пилоте профиль скроется сразу');
  }

  function openRefer() {
    const link = 'alpha.uz/graduates?ref=' + D.me.ref;
    const sh = openSheet({ title: 'Посоветовать ALPHA коллеге', body: `
      <p class="hint" style="margin:0 2px">Личная ссылка ведёт коллегу на страницу «Для выпускников» с ценой выпускника. Заявки по ней ALPHA засчитает вам.</p>
      <div class="linkbox"><code>${link}</code><button class="btn" id="copy">Скопировать</button></div>
      <p class="hint" style="margin:0 2px 8px">Демо-ссылка. <a href="#graduates" style="text-decoration:underline;text-underline-offset:3px">Что увидит коллега</a></p>`,
      foot: `<button class="btn main wide" id="share">${ico('share')}Отправить коллеге</button>` });
    const copy = () => { try { navigator.clipboard.writeText('https://' + link).then(() => toast('Ссылка скопирована'), () => toast('Ссылка скопирована')); } catch (e) { toast('Ссылка скопирована'); } };
    sh.querySelector('#copy').onclick = copy;
    sh.querySelector('#share').onclick = () => {
      if (navigator.share) navigator.share({ title: 'ALPHA', text: 'Учусь в ALPHA — посмотри программы', url: 'https://' + link }).catch(() => {});
      else copy();
    };
  }

  // ---------- мои запросы ----------
  function viewReq() {
    shell({ tabs: 'req' });
    const nIn = S.me.filled ? S.inc.length : 0;
    const tab = S.reqTab;
    const outHTML = S.out.length ? S.out.map(r => {
      const p = person(r.pid);
      let s;
      if (r.st === 'wait') s = `<div class="s wait">${ico('clock')}ждёт ответа · ${ago(r.days)}</div>`;
      else if (r.st === 'later') s = `<div class="s wait">${ico('clock')}доставим завтра — сегодня у получателя много запросов</div>`;
      else if (r.st === 'ok') {
        s = `<div class="s ok">${ico('check')}контакт открыт — <button class="link" data-tg>написать в Telegram</button></div>`;
        if (r.days >= 7) s += r.helped == null
          ? `<div class="acts"><span class="hint" style="margin:0;align-self:center">Помогло?</span><button class="btn" data-h="yes" data-id="${r.id}">Да</button><button class="btn" data-h="no" data-id="${r.id}">Нет</button></div>`
          : `<p class="hint" style="margin:6px 0 0">${r.helped === 'yes' ? esc(firstName(p)) + ' получит в боте: «вам сказали спасибо»' : 'Спасибо за ответ'}</p>`;
      } else s = `<div class="s no">сейчас не получится</div>`;
      return `<div class="req"><div class="ava sm" aria-hidden="true">${mono(p.n)}</div><div class="t"><b>${esc(p.n)}</b><span class="type">${D.types[r.type]}</span> · ${esc(r.text)}${s}</div></div>`;
    }).join('') : '<p class="empty-note">Запросов пока нет. Найдите человека в каталоге.</p>';
    const inHTML = !S.me.filled
      ? `<div class="state" style="box-shadow:none;padding:12px 0"><h3>Запросы к вам появятся после профиля</h3><p>Без профиля вас не видно в каталоге.</p><a class="btn" href="#me">Заполнить профиль</a></div>`
      : S.inc.map(r => {
        const p = person(r.pid);
        let s;
        if (r.st === 'new') s = `<div class="acts"><button class="btn main" data-a="ok" data-id="${r.id}">Открыть контакт</button><button class="btn" data-a="no" data-id="${r.id}">Сейчас не получится</button></div>`;
        else if (r.st === 'ok') s = `<div class="s ok">${ico('check')}вы открыли контакт — бот передал ваш Telegram</div>`;
        else s = `<div class="s no">отказ ушёл нейтрально: «сейчас не получится»</div>`;
        return `<div class="req"><div class="ava sm" aria-hidden="true">${mono(p.n)}</div><div class="t"><b>${esc(p.n)}</b><span class="type">${D.types[r.type]}</span> · ${esc(r.text)}<div class="s wait" style="margin-top:4px">${ago(r.days)}</div>${s}</div></div>`;
      }).join('');
    app.innerHTML = `
      <div class="top">${LOGO}${langSeg()}</div>
      <h1>Мои запросы</h1>
      <p class="sub">Ответы приходят в бот. Без ответа запрос закроется через 7 дней.</p>
      <div class="seg big" role="group" aria-label="Какие запросы" style="margin-bottom:12px">
        <button data-rt="out" aria-pressed="${tab === 'out'}">Я попросил ${S.out.length}</button>
        <button data-rt="in" aria-pressed="${tab === 'in'}">Ко мне ${nIn}</button></div>
      <div class="group">${tab === 'out' ? outHTML : inHTML}</div>
      ${tab === 'in' && S.me.filled ? '<p class="hint">Решить можно здесь или в боте. В день приходит не больше трёх новых запросов, остальные — назавтра.</p>' : ''}`;
    app.querySelectorAll('[data-rt]').forEach(b => b.onclick = () => { if (S.reqTab === b.dataset.rt) return; S.reqTab = b.dataset.rt; save(); slideThen(b, viewReq); });
    app.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => toast('В пилоте откроется чат в Telegram'));
    app.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { const r = S.out.find(x => x.id === b.dataset.id); r.helped = b.dataset.h; save(); viewReq(); });
    app.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const r = S.inc.find(x => x.id === b.dataset.id); r.st = b.dataset.a; save(); viewReq();
      toast(r.st === 'ok' ? 'Контакт открыт. Бот передал ваш Telegram' : 'Ответили «сейчас не получится»');
    });
  }


  // ---------- доска вопросов (раунд 11: вопрос → ответ → разбор → «спасибо») ----------
  const who = pid => pid === 0 ? { id: 0, n: S.me.n, g: S.me.g, role: S.me.role || 'выпускник ALPHA' } : person(pid);
  const ansWord = n => n ? n + ' ' + plural(n, 'ответ', 'ответа', 'ответов') : 'ждёт первого ответа';
  const marked = p => p.g === 'f' ? 'отметила' : 'отметил';
  const myThanks = () => S.board.filter(q => q.pid !== 0 && q.ans.some(a => a.pid === 0 && a.useful));

  function qCard(q) {
    const a = who(q.pid), mine = q.pid === 0, my = q.ans.find(x => x.pid === 0);
    let flag = '';
    if (mine) flag = '<span class="me-tag" style="margin:0">ваш вопрос</span>';
    else if (my && my.useful) flag = '<span class="open">ваш ответ полезен</span>';
    else if (my) flag = '<span>вы ответили</span>';
    return `<a class="card qcard" href="#qa/${q.id}"><div class="body">
      <div class="meta" style="margin:0 0 8px"><span class="tag">${esc(q.sp)}</span>${q.razbor ? '<span class="tag dark">разбор</span>' : ''}<span>${ago(q.days)}</span></div>
      <div class="qtext">${esc(q.text)}</div>
      <div class="meta"><span>${mine ? 'Вы' : esc(a.n)}</span><span${q.ans.length ? '' : ' class="pause"'}>${ansWord(q.ans.length)}</span>${flag}</div></div></a>`;
  }

  function viewBoard() {
    shell({ tabs: 'board' });
    const f = S.boardF, sp = S.me.sp;
    let list = S.board.slice().sort((a, b) => a.days - b.days);
    if (f === 'sp') list = list.filter(q => q.sp === sp);
    if (f === 'razbor') list = list.filter(q => q.razbor);
    const thanks = S.me.filled ? myThanks() : [];
    const waiting = S.me.filled && sp ? S.board.filter(q => q.pid !== 0 && q.sp === sp && !q.ans.some(a => a.pid === 0)).length : 0;
    const fb = (k, l) => `<button data-bf="${k}" aria-pressed="${f === k}">${l}</button>`;
    app.innerHTML = `
      <div class="top">${LOGO}${langSeg()}</div>
      <h1>Вопросы</h1>
      <p class="sub">Спросите выпускников — ответят те, кто в теме. Лучшие ответы становятся разборами</p>
      ${thanks.length ? `<a class="left ok" href="#qa/${thanks[0].id}">${ico('check')}<span><b>Вам сказали спасибо</b>${esc(who(thanks[0].pid).n)} ${marked(who(thanks[0].pid))} ваш ответ полезным</span></a>` : ''}
      ${waiting && f !== 'sp' ? `<button class="left" id="tosp">${ico('inbox')}<span>В сфере «${esc(sp)}» ждут совета: ${waiting} ${plural(waiting, 'вопрос', 'вопроса', 'вопросов')}</span></button>` : ''}
      <a class="btn main wide" href="#newq" style="margin-bottom:14px">Задать вопрос</a>
      <div class="seg big" role="group" aria-label="Какие вопросы" style="margin-bottom:12px">${fb('all', 'Все')}${fb('sp', 'Моя сфера')}${fb('razbor', 'Разборы')}</div>
      <div id="qlist">${list.length ? list.map(qCard).join('') : `<div class="state"><h3>${f === 'razbor' ? 'Разборов пока нет' : 'В вашей сфере вопросов пока нет'}</h3><p>Задайте первый — ответы придут в бот.</p><a class="btn main" href="#newq">Задать вопрос</a></div>`}</div>`;
    app.querySelectorAll('[data-bf]').forEach(b => b.onclick = () => {
      if (b.dataset.bf === 'sp' && !sp) return toast('Укажите сферу в профиле — подборка заработает');
      if (S.boardF === b.dataset.bf) return;
      S.boardF = b.dataset.bf; save(); slideThen(b, viewBoard);
    });
    const tosp = document.getElementById('tosp');
    if (tosp) tosp.onclick = () => { S.boardF = 'sp'; save(); viewBoard(); };
  }

  function viewQ(id) {
    const q = S.board.find(x => x.id === id);
    if (!q) return go('#board');
    shell({});
    const a = who(q.pid), mine = q.pid === 0, answered = q.ans.some(x => x.pid === 0);
    const ansHTML = q.ans.length ? q.ans.map((x, i) => {
      const p = who(x.pid);
      let s = '';
      if (x.useful) s = `<div class="s ok">${ico('check')}${x.pid === 0 ? esc(firstName(a)) + ' ' + marked(a) + ' ваш ответ полезным — вам сказали спасибо' : 'полезный ответ'}</div>`;
      else if (mine) s = `<div class="acts"><button class="btn" data-use="${i}">${ico('check')}Полезный ответ</button></div>`;
      return `<div class="req"><div class="ava sm" aria-hidden="true">${mono(p.n)}</div><div class="t"><b>${x.pid === 0 ? 'Вы' : esc(p.n)}</b><span class="type">${esc(p.role)} · ${ago(x.days)}</span>${x.pid !== 0 ? ` · <a class="plink" href="#p/${x.pid}">профиль</a>` : ''}
        <p class="atext">${esc(x.text)}</p>${s}</div></div>`;
    }).join('') : '<p class="empty-note">Ответов пока нет. Ответьте первым — автор узнает в боте.</p>';
    const razbor = q.razbor ? `<div class="razbor"><span class="k">Разбор</span><h3>${esc(q.razbor.t)}</h3><ol>${q.razbor.pts.map(t => `<li>${esc(t)}</li>`).join('')}</ol><p>Собрал модератор ALPHA из ответов, с согласия авторов</p></div>` : '';
    let form;
    if (mine) form = '<p class="hint">Ответы приходят в бот. Отметьте полезный — автору скажем спасибо, а модератор ALPHA может собрать из него разбор.</p>';
    else if (answered) form = `<p class="hint">Вы уже ответили. ${esc(firstName(a))} узнает в боте.</p>`;
    else if (!S.me.filled) form = `<button class="btn main wide" disabled>Ответить</button><p class="hint">Сначала <a href="#me" id="fill" style="color:var(--fg);text-decoration:underline;text-underline-offset:3px">заполните профиль</a> — минута</p>`;
    else form = `<div class="field"><label class="lbl" for="an">Ваш ответ<small>Коротко: что сработало у вас</small></label>
        <textarea class="inp" id="an" rows="3" maxlength="600" placeholder="Например: мы начинали с…"></textarea>
        <p class="err" id="anerr" hidden>Пара предложений — так ответ поможет</p></div>
      <button class="btn main wide" id="ansend">${ico('send')}Ответить</button>`;
    app.innerHTML = `
      <div class="top"><button class="iconbtn" id="back" aria-label="Назад">${ico('back')}</button></div>
      <div class="meta" style="margin:0 2px 8px"><span class="tag">${esc(q.sp)}</span><span>${ago(q.days)}</span></div>
      <h1 class="qh">${esc(q.text)}</h1>
      <p class="sub">${mine ? 'Ваш вопрос' : esc(a.n) + ' · ' + esc(a.role)}</p>
      ${razbor}
      <h2>${q.ans.length ? 'Ответы · ' + q.ans.length : 'Ответы'}</h2>
      <div class="group">${ansHTML}</div>
      <div style="margin-top:18px">${form}</div>
      ${mine ? '' : '<div class="flag" style="margin-top:10px"><button class="btn text" id="flag">Пожаловаться</button></div>'}`;
    document.getElementById('back').onclick = () => back('#board');
    const fill = document.getElementById('fill');
    if (fill) fill.onclick = () => { S.returnTo = '#qa/' + q.id; save(); };
    const fl = document.getElementById('flag');
    if (fl) fl.onclick = () => openComplaint(a);
    app.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
      const x = q.ans[Number(b.dataset.use)]; x.useful = true; save(); viewQ(q.id);
      toast(firstName(who(x.pid)) + ' получит в боте: «вам сказали спасибо»');
    });
    const send = document.getElementById('ansend');
    if (send) {
      const an = document.getElementById('an'), err = document.getElementById('anerr');
      an.oninput = () => { if (an.value.trim().length >= 10) { err.hidden = true; an.classList.remove('bad'); } };
      send.onclick = () => {
        if (an.value.trim().length < 10) { err.hidden = false; an.classList.add('bad'); an.focus(); return; }
        an.blur(); send.onclick = null; send.setAttribute('aria-busy', 'true');
        send.innerHTML = 'Публикуем <span class="dots"><i></i><i></i><i></i></span>';
        setTimeout(() => {
          q.ans.push({ pid: 0, days: 0, text: an.value.trim() }); save(); viewQ(q.id);
          toast('Ответ на доске. ' + firstName(a) + ' узнает в боте');
        }, 800);
      };
    }
  }

  let qdraft = { sp: '', text: '' };
  function viewNewQ() {
    if (!S.me.filled) { S.returnTo = '#newq'; save(); return location.replace('#me'); }
    if (!qdraft.sp) qdraft.sp = S.me.sp || '';
    shell({ dock: true });
    app.innerHTML = `
      <div class="top"><button class="iconbtn" id="back" aria-label="Назад">${ico('back')}</button></div>
      <h1>Вопрос выпускникам</h1>
      <p class="sub">Вопрос увидят все выпускники, а в дайджест он попадёт тем, кто в этой сфере. Самый полезный ответ отметите вы.</p>
      <div class="field" id="f-qsp"><span class="lbl">Сфера</span><div class="row">${D.spheres.map(v => `<button class="chip" data-qs="${v}" aria-pressed="${qdraft.sp === v}">${v}</button>`).join('')}</div>
        <p class="err" id="qsperr" hidden>Выберите сферу — так вопрос найдёт тех, кто в теме</p></div>
      <div class="field"><label class="lbl" for="qt">Вопрос<small>Одним-двумя предложениями</small></label>
        <textarea class="inp" id="qt" rows="3" maxlength="200" placeholder="Например: как удержать сильного менеджера, если конкурент платит больше?">${esc(qdraft.text)}</textarea>
        <p class="err" id="qterr" hidden>Напишите вопрос хотя бы в несколько слов</p></div>
      <div class="dock"><button class="btn main wide" id="send">${ico('send')}Опубликовать вопрос</button><p class="hint">Ответы придут в бот</p></div>`;
    document.getElementById('back').onclick = () => back('#board');
    const qt = document.getElementById('qt'), btn = document.getElementById('send');
    app.querySelectorAll('[data-qs]').forEach(b => b.onclick = () => {
      qdraft.sp = b.dataset.qs; document.getElementById('qsperr').hidden = true;
      app.querySelectorAll('[data-qs]').forEach(x => x.setAttribute('aria-pressed', x === b));
    });
    qt.oninput = () => { qdraft.text = qt.value; if (qt.value.trim().length >= 10) { document.getElementById('qterr').hidden = true; qt.classList.remove('bad'); } };
    btn.onclick = () => {
      if (!qdraft.sp) { document.getElementById('qsperr').hidden = false; document.getElementById('f-qsp').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      if (qdraft.text.trim().length < 10) { document.getElementById('qterr').hidden = false; qt.classList.add('bad'); qt.focus(); return; }
      qt.blur(); btn.onclick = null; btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = 'Публикуем <span class="dots"><i></i><i></i><i></i></span>';
      setTimeout(() => {
        const id = 'q' + Date.now();
        S.board.unshift({ id, pid: 0, sp: qdraft.sp, days: 0, text: qdraft.text.trim(), ans: [] });
        save(); qdraft = { sp: '', text: '' };
        location.replace('#qa/' + id);
        toast('Вопрос на доске. Ответы придут в бот');
      }, 900);
    };
  }

  // ---------- дайджест в боте (как придёт раз в неделю) ----------
  function viewDigest() {
    shell({});
    const sp = S.me.sp || 'Продажи';
    const others = S.board.filter(q => q.pid !== 0).sort((a, b) => a.days - b.days);
    const top = others.filter(q => q.sp === sp).concat(others.filter(q => q.sp !== sp)).slice(0, 3);
    const th = myThanks()[0];
    const rz = S.board.filter(q => q.razbor).sort((a, b) => a.days - b.days)[0];
    app.innerHTML = `
      <div class="top"><button class="iconbtn" id="back" aria-label="Назад">${ico('back')}</button><span class="demo-tag">демо · так придёт в боте</span></div>
      <h1>Дайджест недели</h1>
      <p class="sub">Одно сообщение в неделю, в понедельник в 10:00. Выключается в профиле.</p>
      <div class="bot">
        <div class="bot-hd"><div class="ava sm" aria-hidden="true">A</div><div><b>ALPHA · выпускники</b><span>бот</span></div></div>
        <div class="bubble">
          <p><b>Вопросы недели в сфере «${esc(sp)}»</b></p>
          <ol>${top.map(q => `<li>${esc(q.text)} <span>— ${ansWord(q.ans.length)}</span></li>`).join('')}</ol>
          ${th ? `<p><b>Вам сказали спасибо.</b> ${esc(who(th.pid).n)} ${marked(who(th.pid))} ваш ответ полезным.</p>` : ''}
          ${rz ? `<p><b>Новый разбор:</b> ${esc(rz.razbor.t)}</p>` : ''}
          <span class="time">10:00</span>
        </div>
        <div class="bot-btns"><a class="bbtn" href="#board">Открыть вопросы</a><button class="bbtn" id="off">${S.me.digest ? 'Выключить дайджест' : 'Дайджест выключен'}</button></div>
      </div>
      <p class="hint">Без счётчиков и писем «мы скучаем». С 22:00 до 08:00 бот пишет без звука.</p>`;
    document.getElementById('back').onclick = () => back('#me');
    const off = document.getElementById('off');
    off.onclick = () => {
      if (!S.me.digest) return toast('Включить дайджест можно в профиле');
      S.me.digest = false; save(); off.textContent = 'Дайджест выключен'; toast('Дайджест выключен. Включить — в профиле');
    };
  }

  // ---------- для выпускников ----------
  function viewGrads() {
    shell({});
    app.innerHTML = `
      <div class="top"><button class="iconbtn" id="back" aria-label="Назад">${ico('back')}</button><span class="demo-tag">демо</span></div>
      <h1>Для выпускников</h1>
      <p class="sub">Выпускникам ALPHA и коллегам по их личной ссылке — цена выпускника на программы 2026 года.</p>
      <div class="group">${D.grads.map((g, i) => `<div class="req"><div class="t"><b>${esc(g)}</b><span class="type">поток 2026 · скидка выпускника −10 %</span></div><button class="btn" data-g="${i}" style="align-self:center;min-height:38px;font-size:14px">Оставить заявку</button></div>`).join('')}</div>
      <p class="hint">Скидка 10 % условная — размер утвердит ALPHA. Заявка с кодом выпускника засчитывается тому, кто посоветовал.</p>`;
    document.getElementById('back').onclick = () => back('#me');
    app.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
      b.outerHTML = `<span class="s ok" style="align-self:center">${ico('check')}заявка ушла</span>`;
      toast('Заявка ушла ALPHA. Менеджер напишет в Telegram');
    });
  }

  // ---------- вкладка команды ALPHA ----------
  function viewAdmin() {
    shell({});
    const A = D.admin;
    const pct = (a, b) => Math.round(a / b * 100);
    const med = Math.round(A.base * A.median / 100);
    const share = (A.profiles / A.base * 100).toFixed(1).replace('.', ',');
    app.innerHTML = `
      <div class="top"><button class="iconbtn" id="back" aria-label="Назад">${ico('back')}</button><span class="demo-tag">демо · цифры условные</span></div>
      <h1>Вкладка команды ALPHA</h1>
      <p class="sub">Пилот, первый месяц. Главное — заходят ли люди каждую неделю. Через 3 месяца — эти же цифры и 2–3 живые истории.</p>
      <h2>Заходы и возвраты</h2>
      <div class="two">
        <div class="kpi"><div class="k">Зашли за месяц</div><div class="v">${A.visitors}</div><p class="note">из ${A.profiles} с профилем</p></div>
        <div class="kpi"><div class="k">Заходят каждую неделю</div><div class="v">${pct(A.returned, A.visitors)} %</div><p class="note">${A.returned} человек — цель площадки</p></div>
      </div>
      <h2>Как ведут себя на сайте</h2>
      <ul class="topics">${A.behavior.map(([t, n]) => `<li><span>${esc(t)}</span><b>${n}</b></li>`).join('')}</ul>
      <p class="hint">Что смотрят, где задерживаются, где уходят. Без имён.</p>
      <h2>Профили и контакты</h2>
      <div class="kpi"><div class="k">Профили в каталоге</div><div class="v">${A.profiles} <small>из ${A.profilesGoal} к третьему месяцу</small></div>
        <div class="bar"><b style="width:${pct(A.profiles, A.profilesGoal)}%"></b><i style="left:${pct(med, A.profilesGoal)}%"></i></div>
        <div class="bar-legend"><span>0</span><span>медиана ${med}</span><span>цель ${A.profilesGoal}</span></div>
        <p class="note">${share} % из 1 282 участников чата «ALPHA - клуб выпускников». Цель — 20 %, медиана вовлечённых в сообществах выпускников — ${String(A.median).replace('.', ',')} % (CASE, 2025).</p></div>
      <div class="kpi"><div class="k">Открытые контакты</div><div class="v">${A.contacts} <small>из ${A.contactsGoal} за месяц</small></div>
        <div class="bar"><b style="width:${pct(A.contacts, A.contactsGoal)}%"></b></div></div>
      <div class="two">
        <div class="kpi"><div class="k">«Помогло — да»</div><div class="v">${pct(A.helpedYes, A.helpedAnswers)} %</div><p class="note">${A.helpedYes} из ${A.helpedAnswers} ответов через 7 дней</p></div>
        <div class="kpi"><div class="k">Заявки по ссылкам</div><div class="v">${A.refLinks}</div><p class="note">«Посоветовать ALPHA коллеге»</p></div>
      </div>
      <h2>Доска вопросов</h2>
      <div class="two">
        <div class="kpi"><div class="k">Вопросов за месяц</div><div class="v">${A.questions}</div><p class="note">${A.answered} с ответом</p></div>
        <div class="kpi"><div class="k">Разборов</div><div class="v">${A.razbory}</div><p class="note">собрал модератор, с согласия авторов</p></div>
      </div>
      <h2>Что ищут — темы спроса</h2>
      <ul class="topics">${A.topics.map(([t, n]) => `<li><span>${esc(t)}</span><b>${n}</b></li>`).join('')}</ul>
      <p class="hint">Из «Спросите ALPHA» и поиска, без имён. Раз в месяц.</p>
      <h2>Искали, но не нашли</h2>
      <ul class="topics">${A.empty.map(t => `<li><span>${esc(t)}</span></li>`).join('')}</ul>
      <p class="hint">Кого пригласить в каталог в первую очередь.</p>
      <h2>Порядок</h2>
      <div class="two">
        <div class="kpi"><div class="k">Жалобы</div><div class="v">${A.complaints}</div><p class="note">разбирает модератор</p></div>
        <div class="kpi"><div class="k">Баны</div><div class="v">${A.bans}</div><p class="note">деньги, рассылка, оскорбления</p></div>
      </div>
      <p class="hint" style="margin-top:14px">Покупки курсов по коду выпускника появятся, когда продажи ALPHA начнут его фиксировать.</p>`;
    document.getElementById('back').onclick = () => back('#me');
  }

  // ---------- шторка ----------
  let sheetClose = null;
  function openSheet({ title, body, foot, onClose }) {
    sheetRoot.innerHTML = `<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="grab-zone"><div class="grab"></div><div class="hd"><h3>${esc(title)}</h3><button class="iconbtn" data-x aria-label="Закрыть">${ico('close')}</button></div></div>
      <div class="bd">${body}</div>${foot ? `<div class="ft">${foot}</div>` : ''}</div>`;
    const scrim = sheetRoot.querySelector('.scrim'), sh = sheetRoot.querySelector('.sheet');
    sh.getBoundingClientRect();
    scrim.classList.add('on'); sh.classList.add('on');
    sheetClose = onClose || null;
    scrim.onclick = () => closeSheet();
    sh.querySelector('[data-x]').onclick = () => closeSheet();
    // смахнуть вниз
    const zone = sh.querySelector('.grab-zone');
    let y0 = null, dy = 0, t0 = 0;
    zone.addEventListener('pointerdown', e => { if (e.target.closest('[data-x]')) return; y0 = e.clientY; dy = 0; t0 = performance.now(); sh.style.transition = 'none'; zone.setPointerCapture(e.pointerId); });
    zone.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = `translateY(${dy}px)`; });
    const end = () => {
      if (y0 == null) return; y0 = null; sh.style.transition = ''; sh.style.transform = '';
      const v = dy / Math.max(1, performance.now() - t0);
      if (dy > 110 || v > 0.6) closeSheet();
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    return sh;
  }
  function closeSheet(instant) {
    const sh = sheetRoot.querySelector('.sheet'); if (!sh) return;
    const cb = sheetClose; sheetClose = null;
    if (instant) { sheetRoot.innerHTML = ''; return; }
    sh.classList.remove('on'); sheetRoot.querySelector('.scrim').classList.remove('on');
    setTimeout(() => { if (!sheetRoot.querySelector('.sheet.on')) sheetRoot.innerHTML = ''; }, 330);
    if (cb) cb();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  // язык
  document.addEventListener('click', e => { if (e.target.closest('[data-lang]')) toast('Узбекский и английский — в пилоте'); });

  // ---------- ленты по краям (как в дашборде, статично) ----------
  const R = [[[-.08, 1.04], [.06, .88], [.12, .74], [.04, .64], [-.1, .62]], [[.62, -.06], [.86, .12], [1.1, .06]]];
  function spline(p, s) {
    const n = p.length - 1, f = Math.min(s * n, n - 1e-6), i = Math.floor(f), u = f - i;
    const a = p[Math.max(i - 1, 0)], b = p[i], c = p[i + 1], d = p[Math.min(i + 2, n)];
    return [0, 1].map(k => .5 * (2 * b[k] + (-a[k] + c[k]) * u + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * u * u + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * u * u * u));
  }
  function ribbons() {
    const cv = document.getElementById('ribbons'), w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = w * dpr; cv.height = h * dpr;
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    rCv = cv; rX = x; rW = w; rH = h; drawRibbons(rT0);
  }
  // Фон +20 % (выбор Надыра 06.11): ленты 30 %, медленный дрейф ~30 с, два свечения в CSS.
  let rCv, rX, rW, rH, rT0 = 0, rLast = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  function drawRibbons(t) {
    const x = rX, w = rW, h = rH; if (!x) return;
    x.clearRect(0, 0, w, h);
    x.lineWidth = .6; x.strokeStyle = 'rgba(78,84,107,.30)';
    const W = [80, 56].map(v => v * Math.max(1, w / 420)), N = [24, 18], S2 = 120, ph = t * 2 * Math.PI / 30;
    R.forEach((pts, a) => {
      const c = Array.from({ length: S2 + 1 }, (_, j) => { const [px, py] = spline(pts, j / S2); return [px * w, py * h]; });
      const half = c.map((_, j) => W[a] / 2 * (.25 + .75 * Math.abs(Math.sin(j / S2 * Math.PI * 1.6 + a + ph * (a ? -.5 : 1)))));
      x.beginPath();
      for (let i = 0; i < N[a]; i++) {
        const o = i / (N[a] - 1) - .5;
        for (let j = 0; j <= S2; j++) {
          const p = c[j], q = c[Math.min(j + 1, S2)], m = c[Math.max(j - 1, 0)], dx = q[0] - m[0], dy = q[1] - m[1], l = Math.hypot(dx, dy) || 1;
          const X = p[0] - dy / l * o * half[j] * 2, Y = p[1] + dx / l * o * half[j] * 2; j ? x.lineTo(X, Y) : x.moveTo(X, Y);
        }
      }
      x.stroke();
    });
  }
  function ribbonLoop(now) {
    requestAnimationFrame(ribbonLoop);
    if (still.matches || document.hidden || now - rLast < 66) return; // ~15 кадров/с, хватает для медленного дрейфа
    rLast = now; rT0 = now / 1000; drawRibbons(rT0);
  }
  requestAnimationFrame(ribbonLoop);

  // Кнопки «Глянец + стрелка» и переезжающая капсула в переключателях — достраиваются после каждого рендера.
  const ARROW = '<svg class="ico" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  // Сначала капсула доезжает, потом экран перерисовывается — новая капсула встаёт на то же место.
  function slideThen(b, fn) {
    b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    if (still.matches) fn(); else setTimeout(fn, 240);
  }
  function placeThumb(seg) {
    const th = seg.querySelector(':scope > .thumb'), b = seg.querySelector('[aria-pressed="true"]');
    if (!th) return;
    if (!b) { th.style.opacity = 0; return; }
    th.style.opacity = 1; th.style.width = b.offsetWidth + 'px'; th.style.transform = `translateX(${b.offsetLeft - 3}px)`;
  }
  function decorate(root) {
    root.querySelectorAll('.btn.main.wide:not([data-deco])').forEach(b => {
      b.dataset.deco = 1;
      const icon = b.querySelector(':scope > .ico');
      const nub = document.createElement('span'); nub.className = 'nub'; nub.setAttribute('aria-hidden', 'true');
      if (icon) nub.appendChild(icon); else nub.innerHTML = ARROW;
      const txt = document.createElement('span'); txt.className = 'txt';
      while (b.firstChild) txt.appendChild(b.firstChild);
      b.append(txt, nub);
    });
    root.querySelectorAll('.seg:not([data-deco])').forEach(seg => {
      seg.dataset.deco = 1;
      const th = document.createElement('i'); th.className = 'thumb'; th.setAttribute('aria-hidden', 'true');
      seg.prepend(th); seg.classList.add('slide');
      th.style.transition = 'none'; placeThumb(seg); th.offsetWidth; th.style.transition = '';
    });
  }
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'attributes') { const seg = m.target.closest('.seg.slide'); if (seg) placeThumb(seg); }
    }
    decorate(document.body);
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
  if (document.fonts) document.fonts.ready.then(() => document.querySelectorAll('.seg.slide').forEach(placeThumb));

  // ---------- Отзыв тестера (только на время теста, 06.11) ----------
  // Алишер, Александр, Мурад, Антон, Камила, Иззат. Личная ссылка ?t=murad сразу подставляет имя.
  const TESTERS = { alisher: 'Алишер', alexander: 'Александр', murad: 'Мурад', anton: 'Антон', kamila: 'Камила', izzat: 'Иззат' };
  const FB_URL = location.hostname.endsWith('github.io') ? 'https://alpha-alumni-demo.nadirbek-pulatov-87c.workers.dev/api/feedback' : '/api/feedback';
  const FB_WHO = 'alpha-fb-who', FB_Q = 'alpha-fb-queue';
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const tParam = (params.get('t') || '').toLowerCase();
  if (TESTERS[tParam]) ls.set(FB_WHO, TESTERS[tParam]);
  const SCREENS = { catalog: 'Каталог', p: 'Карточка', ask: 'Запрос контакта', me: 'Профиль', req: 'Запросы', board: 'Вопросы', qa: 'Вопрос', newq: 'Задать вопрос',
    digest: 'Дайджест', graduates: 'Для выпускников', alpha: 'Спросить ALPHA', team: 'Вкладка команды', login: 'Вход' };
  const screenName = () => { const k = (location.hash.slice(1).split('/')[0]) || 'login'; return SCREENS[k] || k; };

  async function postFb(item) {
    const r = await fetch(FB_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
    if (!r.ok) throw new Error(r.status);
  }
  async function flushFb() {
    let q; try { q = JSON.parse(ls.get(FB_Q) || '[]'); } catch (e) { q = []; }
    if (!q.length) return;
    const left = [];
    for (const it of q) { try { await postFb(it); } catch (e) { left.push(it); } }
    ls.set(FB_Q, JSON.stringify(left));
  }

  const fbBtn = document.createElement('button');
  fbBtn.className = 'fb'; fbBtn.type = 'button'; fbBtn.textContent = 'Отзыв';
  fbBtn.setAttribute('aria-label', 'Оставить отзыв о прототипе');
  document.body.appendChild(fbBtn);
  fbBtn.onclick = () => {
    const screen = screenName();
    let mood = 0, who = ls.get(FB_WHO) || '';
    const names = [...Object.values(TESTERS), 'Другой'];
    const sh = openSheet({ title: 'Отзыв о прототипе', body: `
      <p class="hint" style="margin:0 2px 4px">Экран: <b style="color:var(--fg);font-weight:500">${esc(screen)}</b>. Пишите как есть — что мешает, что непонятно, чего не хватает.</p>
      <p class="lbl2">Как вам этот экран?</p>
      <div class="seg big" role="group" aria-label="Оценка"><button data-m="1" aria-pressed="false">Сложно</button><button data-m="2" aria-pressed="false">Нормально</button><button data-m="3" aria-pressed="false">Удобно</button></div>
      <p class="lbl2">Что сказать</p>
      <textarea class="inp" id="fbt" maxlength="2000" placeholder="Например: не понял, куда нажать, чтобы…"></textarea>
      <p class="err" id="fberr" hidden>Выберите оценку или напишите пару слов</p>
      <p class="lbl2">Кто вы</p>
      <div class="row">${names.map(n => `<button class="chip" data-w="${esc(n)}" aria-pressed="${who === n}">${esc(n)}</button>`).join('')}</div>`,
      foot: `<button class="btn main wide" id="fbsend">${ico('send')}Отправить отзыв</button>` });
    sh.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mood = +b.dataset.m; sh.querySelectorAll('[data-m]').forEach(x => x.setAttribute('aria-pressed', x === b)); sh.querySelector('#fberr').hidden = true; });
    sh.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { who = b.dataset.w; ls.set(FB_WHO, who); sh.querySelectorAll('[data-w]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    const ta = sh.querySelector('#fbt');
    ta.oninput = () => { sh.querySelector('#fberr').hidden = true; };
    sh.querySelector('#fbsend').onclick = async e => {
      const text = ta.value.trim();
      if (!text && !mood) { sh.querySelector('#fberr').hidden = false; ta.focus(); return; }
      const btn = e.currentTarget; btn.disabled = true;
      btn.innerHTML = 'Отправляем <span class="dots"><i></i><i></i><i></i></span>';
      const item = { who, screen, mood: mood || null, text, w: innerWidth };
      try { await postFb(item); closeSheet(); toast('Спасибо! Отзыв у Надыра'); }
      catch (err) {
        let q; try { q = JSON.parse(ls.get(FB_Q) || '[]'); } catch (x) { q = []; }
        q.push(item); ls.set(FB_Q, JSON.stringify(q));
        closeSheet(); toast('Связь подвела — отзыв сохранён, отправим сами');
      }
    };
  };
  flushFb();
  addEventListener('online', flushFb);

  let rT;
  addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { ribbons(); document.querySelectorAll('.seg.slide').forEach(placeThumb); }, 150); });
  ribbons();
  route();
  decorate(document.body);
})();

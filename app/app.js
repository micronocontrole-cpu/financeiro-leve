/* Micro no Controle — o app do MEI
   Tudo roda no celular; os dados ficam no aparelho (IndexedDB) e o backup vai para onde a pessoa quiser. */
(function () {
  'use strict';

  /* ================= utilidades ================= */
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function arred(n) { return n >= 0 ? Math.round(n * 100 + 1e-7) / 100 : -Math.round(-n * 100 + 1e-7) / 100; }
  function brl(n) { n = arred(+n || 0); return (n < 0 ? '-R$ ' : 'R$ ') + Motor.fmtBR(Math.abs(n)); }
  function num(v) { var n = Motor.numero(v); return isNaN(n) ? 0 : n; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return ('0' + n).slice(-2); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hoje() { return iso(new Date()); }
  function deISO(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function somaDias(s, n) { var d = deISO(s); d.setDate(d.getDate() + n); return iso(d); }
  function dm(s) { if (!s) return ''; var p = s.split('-'); return p[2] + '/' + p[1]; }
  function dma(s) { if (!s) return ''; var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  function mesNome(ym) { var p = ym.split('-'); return MESES[+p[1] - 1] + (p[0] != new Date().getFullYear() ? ' de ' + p[0] : ''); }
  function ymDe(s) { return s.slice(0, 7); }
  function ymSoma(ym, n) { var p = ym.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function diaRel(s) {
    var h = hoje(); if (s === h) return 'hoje'; if (s === somaDias(h, 1)) return 'amanhã'; if (s === somaDias(h, -1)) return 'ontem';
    return DIAS[deISO(s).getDay()] + ', ' + dm(s);
  }
  function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function iniciais(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function soDig(s) { return String(s || '').replace(/\D/g, ''); }
  function foneWa(f) { var d = soDig(f); if (!d) return ''; if (d.length === 10 || d.length === 11) d = '55' + d; return d; }
  function linkWa(fone, msg) { var n = foneWa(fone); return 'https://wa.me/' + (n || '') + '?text=' + encodeURIComponent(msg); }
  function track(ev, d) { try { if (window.fbq) fbq('trackCustom', ev, d || {}); } catch (e) {} }

  var toastT;
  function toast(msg) {
    var t = $('.toast'); if (t) t.remove();
    t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, 2600);
  }
  function copiar(txt, msg) {
    function ok() { toast(msg || 'Copiado!'); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, fallback); else fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Não deu para copiar. Segure o texto e copie.'); } ta.remove(); }
  }

  /* ================= dados ================= */
  var SETORES = {
    beleza: { nome: 'Beleza', i: '💇', nat: 'servico' },
    roupas: { nome: 'Roupas e acessórios', i: '👗', nat: 'comercio' },
    alimentacao: { nome: 'Alimentação', i: '🍔', nat: 'comercio' },
    construcao: { nome: 'Obras e reformas', i: '🛠️', nat: 'servico' },
    servicos: { nome: 'Serviços pessoais', i: '🧰', nat: 'servico' },
    outro: { nome: 'Outro', i: '🏪', nat: 'comercio' }
  };
  var NAT = { comercio: 'Comércio (revenda)', industria: 'Indústria (fabrico)', servico: 'Serviço' };
  var FORMAS = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito', ifood: 'iFood', fiado: 'Fiado' };
  var CATS = { mercadoria: 'Mercadoria / material', aluguel: 'Aluguel', contas: 'Luz, água, internet', transporte: 'Transporte', impostos: 'DAS / impostos', pessoal: 'Ajudante / funcionário', maquina: 'Taxas e maquininha', outros: 'Outros' };

  function novoEstado() {
    return {
      v: 1,
      neg: { nome: '', dono: '', setor: '', atividade: '', mei: true, cnpj: '', abertura: '', limite: '', pix: { tipo: '', chave: '', nome: '', cidade: '' },
        taxas: { debito: '', credito_vista: '', credito_2a6: '', credito_7a12: '' }, ifood: { plano: 'basico', comissao: '', taxaPag: '' }, usaIfood: false },
      mov: [], cli: [], ag: [], orc: [], conf: [], das: {},
      cfg: { onboard: false, ultimoBackup: null, criado: hoje(), orcNum: 0 }
    };
  }
  var E = null;

  var db = null;
  function abrirDB() {
    return new Promise(function (ok) {
      try {
        var r = indexedDB.open('micro-no-controle', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
        r.onsuccess = function () { db = r.result; ok(); };
        r.onerror = function () { ok(); };
      } catch (e) { ok(); }
    });
  }
  function lerEstado() {
    return new Promise(function (ok) {
      if (db) {
        try {
          var g = db.transaction('kv').objectStore('kv').get('estado');
          g.onsuccess = function () { ok(g.result || lerLS()); };
          g.onerror = function () { ok(lerLS()); };
          return;
        } catch (e) {}
      }
      ok(lerLS());
    });
  }
  function lerLS() { try { return JSON.parse(localStorage.getItem('mnc-estado') || 'null'); } catch (e) { return null; } }
  var salvarT, pediuPersist = false;
  function salvar() {
    clearTimeout(salvarT);
    salvarT = setTimeout(function () {
      var txt = JSON.stringify(E);
      if (db) { try { db.transaction('kv', 'readwrite').objectStore('kv').put(JSON.parse(txt), 'estado'); } catch (e) { try { localStorage.setItem('mnc-estado', txt); } catch (e2) {} } }
      else { try { localStorage.setItem('mnc-estado', txt); } catch (e) {} }
      if (!pediuPersist && navigator.storage && navigator.storage.persist) { pediuPersist = true; navigator.storage.persist().catch(function () {}); }
    }, 120);
  }
  function completar(x) {
    var base = novoEstado();
    if (!x || typeof x !== 'object') return base;
    Object.keys(base).forEach(function (k) { if (x[k] == null) x[k] = base[k]; });
    Object.keys(base.neg).forEach(function (k) { if (x.neg[k] == null) x.neg[k] = base.neg[k]; });
    ['pix', 'taxas', 'ifood'].forEach(function (k) { Object.keys(base.neg[k]).forEach(function (j) { if (x.neg[k][j] == null) x.neg[k][j] = base.neg[k][j]; }); });
    Object.keys(base.cfg).forEach(function (k) { if (x.cfg[k] == null) x.cfg[k] = base.cfg[k]; });
    return x;
  }

  /* ---------- regras de negócio ---------- */
  function natPadrao() {
    var a = E.neg.atividade;
    if (a === 'comercio' || a === 'industria' || a === 'servico') return a;
    return (SETORES[E.neg.setor] || SETORES.outro).nat;
  }
  function pedeNatureza() { return E.neg.atividade === 'ambos'; }
  function cliente(id) { for (var i = 0; i < E.cli.length; i++) if (E.cli[i].id === id) return E.cli[i]; return null; }
  function acharOuCriarCliente(nome, fone) {
    nome = String(nome || '').trim(); if (!nome) return null;
    var k = nome.toLowerCase(), c = null;
    E.cli.forEach(function (x) { if (x.nome.toLowerCase() === k) c = x; });
    if (!c) { c = { id: uid(), nome: nome, fone: fone || '', criado: hoje() }; E.cli.push(c); }
    else if (fone && !c.fone) c.fone = fone;
    return c;
  }
  // Saldo do cliente (FIFO): quanto deve, quanto está vencido, venc. mais antigo em aberto
  function saldoCliente(id) {
    var deb = [], pago = 0;
    E.mov.forEach(function (m) {
      if (m.cli !== id) return;
      if ((m.tipo === 'venda' && m.forma === 'fiado') || m.tipo === 'antigo') deb.push(m);
      else if (m.tipo === 'receb') pago += m.valor;
    });
    deb.sort(function (a, b) { var va = a.venc || a.data, vb = b.venc || b.data; return va < vb ? -1 : va > vb ? 1 : (a.data < b.data ? -1 : a.data > b.data ? 1 : 0); });
    var total = 0, vencido = 0, venc = null, h = hoje();
    deb.forEach(function (m) {
      var resta = m.valor;
      if (pago > 0) { var u = Math.min(pago, resta); resta -= u; pago -= u; }
      if (resta > 0.004) {
        total += resta;
        var v = m.venc || m.data;
        if (v < h) vencido += resta;
        if (!venc || v < venc) venc = v;
      }
    });
    return { total: arred(total), vencido: arred(vencido), venc: venc, credito: arred(pago) };
  }
  function devedores() {
    return E.cli.map(function (c) { var s = saldoCliente(c.id); return { c: c, s: s }; })
      .filter(function (x) { return x.s.total > 0; })
      .sort(function (a, b) { return (b.s.vencido - a.s.vencido) || (b.s.total - a.s.total); });
  }
  function totaisMes(ym) {
    var t = { vendas: 0, despesas: 0, retiradas: 0, recebido: 0, qtd: 0, hoje: 0 }, h = hoje();
    E.mov.forEach(function (m) {
      if (ymDe(m.data) !== ym) return;
      if (m.tipo === 'venda') { t.vendas += m.valor; t.qtd++; if (m.data === h) t.hoje += m.valor; }
      else if (m.tipo === 'despesa') t.despesas += m.valor;
      else if (m.tipo === 'retirada') t.retiradas += m.valor;
      else if (m.tipo === 'receb') t.recebido += m.valor;
    });
    Object.keys(t).forEach(function (k) { t[k] = arred(t[k]); });
    return t;
  }
  // Limite do MEI (receita bruta = vendas pelo valor cheio, na data da venda)
  function limiteAno(ano) {
    // LC 123 + Lei Complementar 238/2026: R$ 81 mil até 2026, R$ 110 mil em 2027, R$ 140 mil a partir de 2028
    var cheio = num(E.neg.limite) > 0 ? num(E.neg.limite) : ano >= 2028 ? 140000 : ano === 2027 ? 110000 : 81000;
    var ab = E.neg.abertura;
    if (ab && +ab.slice(0, 4) === ano) { var meses = 12 - (+ab.slice(5, 7)) + 1; return arred(cheio / 12 * meses); }
    return cheio;
  }
  function receitaAno(ano) {
    var t = 0; E.mov.forEach(function (m) { if (m.tipo === 'venda' && +m.data.slice(0, 4) === ano) t += m.valor; }); return arred(t);
  }
  function receitasMes(ym) {
    var r = { comercio: [0, 0], industria: [0, 0], servico: [0, 0] };
    E.mov.forEach(function (m) {
      if (m.tipo !== 'venda' || ymDe(m.data) !== ym) return;
      var n = r[m.nat] ? m.nat : natPadrao();
      r[n][m.nf ? 1 : 0] += m.valor;
    });
    return r;
  }

  /* ---------- Pix ---------- */
  function pixPronto() { var p = E.neg.pix; return !!(p.tipo && p.chave && !Pix.validarChave(p.chave, p.tipo)); }
  function codigoPix(valor, txid, msg) {
    var p = E.neg.pix;
    return Pix.gerar({ chave: p.chave, tipo: p.tipo, nome: p.nome || E.neg.nome, cidade: p.cidade || 'BRASIL', valor: valor, txid: txid, mensagem: msg });
  }
  function qrCanvas(texto, tamanho) {
    var q = qrcode(0, 'M'); q.addData(texto); q.make();
    var n = q.getModuleCount(), borda = 2, cel = Math.floor(tamanho / (n + borda * 2)) || 2, lado = cel * (n + borda * 2);
    var cv = document.createElement('canvas'); cv.width = cv.height = lado;
    var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, lado, lado); g.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + borda) * cel, (r + borda) * cel, cel, cel);
    return cv;
  }

  /* ---------- imagem para WhatsApp (cobrança, orçamento) ---------- */
  function quebrar(g, texto, larg) {
    var pal = String(texto).split(' '), linhas = [], l = '';
    pal.forEach(function (p) { var t = l ? l + ' ' + p : p; if (g.measureText(t).width > larg && l) { linhas.push(l); l = p; } else l = t; });
    if (l) linhas.push(l); return linhas;
  }
  function cartaoImagem(o) {
    // o: { titulo, para, linhas:[[esq,dir]], total, rotTotal, nota, pix, rotPix }
    var W = 1080, cv = document.createElement('canvas'), g = cv.getContext('2d');
    cv.width = W; cv.height = 3200;
    g.fillStyle = '#F3F7F6'; g.fillRect(0, 0, W, cv.height);
    g.fillStyle = '#0F3D3E'; g.fillRect(0, 0, W, 200);
    g.lineWidth = 12; g.strokeStyle = '#2EC4B6'; g.beginPath(); g.arc(96, 100, 38, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#2EC4B6'; g.beginPath(); g.arc(96, 100, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '800 50px "Bricolage Grotesque", system-ui, sans-serif';
    g.fillText((E.neg.nome || 'Meu negócio').slice(0, 30), 160, 98);
    g.fillStyle = '#BFE3DE'; g.font = '600 32px Figtree, system-ui, sans-serif';
    g.fillText(o.titulo, 160, 146);
    var y = 270;
    g.fillStyle = '#5A6A6D'; g.font = '600 34px Figtree, system-ui, sans-serif';
    if (o.para) { g.fillText('Para: ' + o.para, 70, y); y += 30; }
    y += 40;
    g.font = '500 34px Figtree, system-ui, sans-serif';
    (o.linhas || []).forEach(function (L) {
      g.fillStyle = '#1A2628'; g.textAlign = 'left'; g.fillText(String(L[0]).slice(0, 40), 70, y);
      g.textAlign = 'right'; g.fillText(L[1], W - 70, y); g.textAlign = 'left'; y += 58;
    });
    if ((o.linhas || []).length) { g.strokeStyle = '#D9E3E2'; g.lineWidth = 3; g.beginPath(); g.moveTo(70, y - 26); g.lineTo(W - 70, y - 26); g.stroke(); y += 20; }
    g.fillStyle = '#5A6A6D'; g.font = '600 34px Figtree, system-ui, sans-serif'; g.fillText(o.rotTotal || 'Valor', 70, y + 10);
    g.fillStyle = '#0F3D3E'; g.font = '800 76px "Bricolage Grotesque", system-ui, sans-serif'; g.fillText(brl(o.total), 70, y + 95); y += 150;
    if (o.nota) { g.fillStyle = '#5A6A6D'; g.font = '500 30px Figtree, system-ui, sans-serif'; quebrar(g, o.nota, W - 140).slice(0, 4).forEach(function (l) { g.fillText(l, 70, y); y += 42; }); y += 16; }
    if (o.pix) {
      if (o.rotPix) { g.textAlign = 'center'; g.fillStyle = '#0F3D3E'; g.font = '800 40px Figtree, system-ui, sans-serif'; g.fillText(o.rotPix, W / 2, y + 10); g.textAlign = 'left'; y += 40; }
      var qc = qrCanvas(o.pix, 440); g.fillStyle = '#fff'; g.fillRect((W - 480) / 2, y, 480, 480); g.drawImage(qc, (W - 440) / 2, y + 20, 440, 440); y += 530;
      g.textAlign = 'center'; g.fillStyle = '#1A2628'; g.font = '600 30px Figtree, system-ui, sans-serif';
      g.fillText('Aponte a câmera do app do banco no QR Code', W / 2, y); y += 42;
      g.fillText('ou use o Pix copia e cola da mensagem', W / 2, y); g.textAlign = 'left'; y += 20;
    }
    var H = y + 50 + 70, out = document.createElement('canvas'); out.width = W; out.height = H;
    var go = out.getContext('2d'); go.drawImage(cv, 0, 0);
    go.fillStyle = '#0F3D3E'; go.fillRect(0, H - 70, W, 70);
    go.fillStyle = '#BFE3DE'; go.font = '600 26px Figtree, system-ui, sans-serif'; go.textAlign = 'center';
    go.fillText('Feito com o app Micro no Controle · micronocontrole.com/app', W / 2, H - 26);
    return out;
  }
  function compartilharImagem(cv, nome, texto) {
    cv.toBlob(function (blob) {
      var f = new File([blob], nome, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        navigator.share({ files: [f], text: texto }).catch(function () {});
      } else {
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        toast('Imagem salva. Anexe no WhatsApp.');
      }
    }, 'image/png');
  }

  /* ================= folha (bottom sheet) ================= */
  function abrirFolha(html, montar) {
    fecharFolha();
    var v = document.createElement('div'); v.className = 'veu';
    v.innerHTML = '<div class="folha" role="dialog" aria-modal="true"><div class="pega"></div><button class="fechar" data-fechar>Fechar ✕</button>' + html + '</div>';
    v.addEventListener('click', function (e) { if (e.target === v || e.target.closest('[data-fechar]')) fecharFolha(); });
    document.body.appendChild(v); document.body.style.overflow = 'hidden';
    var f = $('.folha', v);
    if (montar) montar(f);
    var foco = $('[autofocus]', f); if (foco) setTimeout(function () { foco.focus(); }, 60);
    return f;
  }
  function fecharFolha() { var v = $('.veu'); if (v) v.remove(); document.body.style.overflow = ''; }
  function confirmar(titulo, texto, rotulo, acao, perigo) {
    abrirFolha('<h1>' + esc(titulo) + '</h1><p class="muted" style="margin-top:6px">' + esc(texto) + '</p><div class="linhaBtns"><button class="btn linha" data-fechar>Cancelar</button><button class="btn ' + (perigo ? 'verm' : '') + '" id="okConf">' + esc(rotulo) + '</button></div>',
      function (f) { $('#okConf', f).onclick = function () { fecharFolha(); acao(); }; });
  }

  /* ================= navegação ================= */
  function abas() {
    var s = E.neg.setor;
    var t2 = { h: '#/fiado', i: '📒', t: 'Quem deve' };
    var t3 = { h: '#/agenda', i: '📅', t: 'Agenda' };
    if (s === 'construcao') t3 = { h: '#/orcamentos', i: '📝', t: 'Orçamentos' };
    if (s === 'alimentacao') t3 = { h: '#/ifood', i: '🛵', t: 'iFood' };
    if (s === 'roupas') t3 = { h: '#/maquininha', i: '💳', t: 'Maquininha' };
    return [{ h: '#/inicio', i: '🏠', t: 'Início' }, t2, null, t3, { h: '#/mais', i: '☰', t: 'Mais' }];
  }
  function desenharBarra(rota) {
    var b = $('#barra'); b.hidden = false;
    b.innerHTML = '<div class="in">' + abas().map(function (a) {
      if (!a) return '<div class="mais"><button id="btnMais" aria-label="Lançar venda ou despesa">+</button></div>';
      var on = ('#/' + rota) === a.h ? ' on' : '';
      return '<a href="' + a.h + '" class="' + on + '"><span class="i">' + a.i + '</span>' + a.t + '</a>';
    }).join('') + '</div>';
    $('#btnMais').onclick = function () { abrirLancar({}); };
  }
  function topo(titulo, sub, voltar) {
    return '<header class="topo">' + (voltar ? '<a class="voltar" href="' + voltar + '">‹ Voltar</a>' : '') +
      '<div class="marca">' + esc(titulo) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</div></header>';
  }
  var ROTAS = {};
  function rotear() {
    if (!E.cfg.onboard) { $('#barra').hidden = true; onboarding(0); return; }
    var h = location.hash.replace(/^#\/?/, '') || 'inicio';
    var partes = h.split('/'), nome = partes[0], arg = partes[1];
    var fn = ROTAS[nome] || ROTAS.inicio;
    fecharFolha();
    desenharBarra(nome);
    var out = fn(arg);
    $('#app').innerHTML = out.html;
    if (out.montar) out.montar($('#app'));
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', rotear);
  function ir(h) { if (location.hash === h) rotear(); else location.hash = h; }

  /* ================= onboarding (momento "uau") ================= */
  var OB = {};
  function onboarding(passo) {
    var app = $('#app'), html = '<div class="onb"><div class="passos">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (i <= passo ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    if (passo === 0) {
      html += '<h1>Seu negócio no controle, pelo celular.</h1><p class="muted">Caixa, fiado, cobrança por Pix no WhatsApp e o limite do MEI. Seus dados ficam só neste aparelho.</p>' +
        '<label class="campo"><span>Nome do seu negócio</span><input class="inp" id="obNome" autocomplete="organization" placeholder="Ex.: Salão da Ana" value="' + esc(E.neg.nome) + '"></label>' +
        '<p style="font-weight:600;font-size:14.5px;margin-top:18px">Com o que você trabalha?</p><div class="setores">' +
        Object.keys(SETORES).map(function (k) { var s = SETORES[k]; return '<button data-set="' + k + '" class="' + (E.neg.setor === k ? 'on' : '') + '"><span class="i">' + s.i + '</span>' + s.nome + '</button>'; }).join('') + '</div>' +
        '<p style="font-weight:600;font-size:14.5px;margin-top:18px">Você é MEI?</p><div class="seg" style="margin-top:8px"><button data-mei="1" class="' + (E.neg.mei ? 'on' : '') + '">Sou MEI</button><button data-mei="0" class="' + (!E.neg.mei ? 'on' : '') + '">Não sou / ainda não</button></div>' +
        '<div class="fim"><button class="btn cheio" id="obSeg">Continuar</button></div>';
    } else if (passo === 1) {
      var p = E.neg.pix;
      html += '<h1>Qual é a sua chave Pix?</h1><p class="muted">Com ela o app cria a cobrança com o valor certinho, pronta para mandar no WhatsApp. O dinheiro cai direto na sua conta, o app não toca nele.</p>' +
        '<p style="font-weight:600;font-size:14.5px;margin-top:16px">Tipo de chave</p><div class="chips" style="margin-top:8px">' +
        [['celular', 'Celular'], ['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['email', 'E-mail'], ['aleatoria', 'Aleatória']].map(function (t) { return '<button class="chip ' + (p.tipo === t[0] ? 'on' : '') + '" data-tipo="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<label class="campo"><span>Chave</span><input class="inp" id="obChave" value="' + esc(p.chave) + '" placeholder="Digite sua chave" autocomplete="off"></label><p class="peq" id="obErro" style="color:var(--red);margin-top:6px"></p>' +
        '<label class="campo"><span>Cidade (aparece no Pix)</span><input class="inp" id="obCidade" value="' + esc(p.cidade) + '" placeholder="Ex.: Brasília"></label>' +
        '<div class="fim"><button class="btn cheio" id="obSeg">Continuar</button><button class="btn linha cheio" style="margin-top:10px" id="obPula">Pular por agora</button></div>';
    } else if (passo === 2) {
      html += '<h1>Tem alguém te devendo hoje?</h1><p class="muted">Coloque o nome e o valor. Em segundos você vê a cobrança pronta para mandar.</p>' +
        '<label class="campo"><span>Nome do cliente</span><input class="inp" id="obCli" placeholder="Ex.: Maria" autocomplete="off"></label>' +
        '<label class="campo"><span>Quanto ele te deve</span><input class="inp" id="obVal" inputmode="decimal" placeholder="Ex.: 50,00"></label>' +
        '<label class="campo"><span>WhatsApp dele (opcional)</span><input class="inp" id="obFone" inputmode="tel" placeholder="(61) 99999-9999"></label>' +
        '<div class="fim"><button class="btn cheio mint" id="obSeg">Criar a cobrança</button><button class="btn linha cheio" style="margin-top:10px" id="obPula">Ninguém me deve, pular</button></div>';
    } else {
      var c = OB.cli, v = OB.val;
      html += '<h1>Pronto! Sua cobrança 👇</h1><p class="muted">Mande para ' + esc(primeiroNome(c.nome)) + ' no WhatsApp. Faça o teste mandando para você mesmo e cole o Pix no app do seu banco: o valor já aparece certinho.</p>' +
        '<div id="obCobr"></div><div class="fim"><button class="btn cheio" id="obFim">Entrar no app</button></div>';
    }
    html += '</div>';
    app.innerHTML = html;
    window.scrollTo(0, 0);

    if (passo === 0) {
      $$('[data-set]').forEach(function (b) { b.onclick = function () { E.neg.setor = b.dataset.set; $$('[data-set]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      $$('[data-mei]').forEach(function (b) { b.onclick = function () { E.neg.mei = b.dataset.mei === '1'; $$('[data-mei]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      $('#obSeg').onclick = function () {
        var n = $('#obNome').value.trim();
        if (!n) { $('#obNome').focus(); toast('Escreva o nome do seu negócio.'); return; }
        if (!E.neg.setor) { toast('Escolha com o que você trabalha.'); return; }
        E.neg.nome = n; if (!E.neg.pix.nome) E.neg.pix.nome = n;
        E.neg.usaIfood = E.neg.setor === 'alimentacao';
        salvar(); onboarding(1);
      };
    } else if (passo === 1) {
      $$('[data-tipo]').forEach(function (b) { b.onclick = function () { E.neg.pix.tipo = b.dataset.tipo; $$('[data-tipo]').forEach(function (x) { x.classList.toggle('on', x === b); }); $('#obChave').inputMode = { celular: 'tel', cpf: 'numeric', cnpj: 'numeric', email: 'email', aleatoria: 'text' }[b.dataset.tipo]; }; });
      $('#obSeg').onclick = function () {
        var p = E.neg.pix; p.chave = $('#obChave').value.trim(); p.cidade = $('#obCidade').value.trim();
        if (!p.tipo) { $('#obErro').textContent = 'Escolha o tipo da chave.'; return; }
        var er = Pix.validarChave(p.chave, p.tipo); if (er) { $('#obErro').textContent = er; return; }
        if (!p.cidade) { $('#obErro').textContent = 'Escreva sua cidade.'; return; }
        salvar(); onboarding(2);
      };
      $('#obPula').onclick = function () { onboarding(2); };
    } else if (passo === 2) {
      $('#obSeg').onclick = function () {
        var nome = $('#obCli').value.trim(), v = num($('#obVal').value);
        if (!nome) { toast('Escreva o nome do cliente.'); return; }
        if (!(v > 0)) { toast('Escreva o valor.'); return; }
        var c = acharOuCriarCliente(nome, $('#obFone').value.trim());
        E.mov.push({ id: uid(), data: hoje(), tipo: 'antigo', valor: arred(v), cli: c.id, venc: hoje(), desc: 'Saldo que já devia' });
        OB.cli = c; OB.val = arred(v); salvar(); onboarding(3);
      };
      $('#obPula').onclick = terminarOnboarding;
    } else {
      painelCobranca($('#obCobr'), OB.cli, OB.val);
      $('#obFim').onclick = terminarOnboarding;
    }
  }
  function terminarOnboarding() { E.cfg.onboard = true; salvar(); track('AppAtivado', { setor: E.neg.setor }); location.hash = '#/inicio'; rotear(); }

  /* ================= cobrança ================= */
  function msgCobranca(c, valor, venc) {
    var s = 'Oi, ' + primeiroNome(c.nome) + '! Tudo bem?' + (E.neg.dono ? ' Aqui é ' + primeiroNome(E.neg.dono) + '.' : '') +
      ' Passando para lembrar do seu acerto de ' + brl(valor) + (E.neg.nome ? ' com ' + E.neg.nome : '') + (venc && venc < hoje() ? ', que venceu em ' + dm(venc) : '') + '.';
    if (pixPronto()) s += ' Para facilitar, deixo o Pix copia e cola com o valor certinho logo abaixo. É só copiar e colar no app do banco.';
    s += ' Qualquer coisa me chama. Obrigado!';
    return s;
  }
  function painelCobranca(alvo, c, valor) {
    var s = saldoCliente(c.id), venc = s.venc;
    var msg = msgCobranca(c, valor, venc), code = pixPronto() ? codigoPix(valor, 'COB' + Date.now().toString(36).toUpperCase(), 'Acerto ' + primeiroNome(c.nome)) : '';
    var txt = code ? msg + '\n\n' + code : msg;
    alvo.innerHTML = '<div class="card" style="margin-top:14px">' +
      '<p class="muted peq">Cobrança para <b style="color:var(--ink)">' + esc(c.nome) + '</b></p><div class="big" style="font-family:var(--display);font-weight:800;font-size:34px">' + brl(valor) + '</div>' +
      (code ? '<canvas class="qr" id="qrC"></canvas><div class="pixbox" id="pixC">' + esc(code) + '</div>' :
        '<div class="aviso">Cadastre sua chave Pix em <a href="#/ajustes">Ajustes</a> para a cobrança ir com o Pix e o QR Code.</div>') +
      '<p class="peq muted" style="margin-top:12px">Mensagem:</p><p class="peq" style="margin-top:4px;white-space:pre-wrap">' + esc(msg) + '</p>' +
      '<a class="btn wa cheio" style="margin-top:14px" target="_blank" rel="noopener" id="waC" href="' + esc(linkWa(c.fone, txt)) + '">Mandar no WhatsApp' + (c.fone ? '' : ' (escolher contato)') + '</a>' +
      '<div class="linhaBtns">' + (code ? '<button class="btn claro peq" id="cpC">Copiar Pix</button>' : '') + '<button class="btn claro peq" id="imgC">Mandar como imagem</button></div></div>';
    if (code) {
      var cv = qrCanvas(code, 440), alvoCv = $('#qrC', alvo); alvoCv.width = cv.width; alvoCv.height = cv.height; alvoCv.getContext('2d').drawImage(cv, 0, 0);
      $('#cpC', alvo).onclick = function () { copiar(code, 'Pix copiado! Cole no WhatsApp.'); };
    }
    $('#waC', alvo).addEventListener('click', function () { c.ultimaCobranca = hoje(); salvar(); track('CobrancaWhatsApp'); });
    $('#imgC', alvo).onclick = function () {
      var img = cartaoImagem({ titulo: 'Lembrete de pagamento', para: c.nome, total: valor, rotTotal: venc && venc < hoje() ? 'Valor em aberto (venceu ' + dm(venc) + ')' : 'Valor em aberto', pix: code });
      compartilharImagem(img, 'cobranca-' + primeiroNome(c.nome).toLowerCase() + '.png', code ? 'Pix copia e cola:\n' + code : msg);
    };
  }
  function abrirCobrar(c, valor) {
    var f = abrirFolha('<h1>Cobrar ' + esc(primeiroNome(c.nome)) + '</h1><div class="seg" style="margin-top:12px" id="tipoVal"></div><div id="cobrAlvo"></div>');
    var s = saldoCliente(c.id);
    var opts = [];
    if (s.vencido > 0 && s.vencido < s.total) opts.push(['Só o vencido', s.vencido]);
    opts.push(['Tudo que deve', s.total]);
    if (valor && opts.every(function (o) { return o[1] !== valor; })) opts.unshift(['Este valor', valor]);
    var seg = $('#tipoVal', f);
    if (opts.length > 1) {
      seg.innerHTML = opts.map(function (o, i) { return '<button data-i="' + i + '" class="' + (i === 0 ? 'on' : '') + '">' + o[0] + '<br><small>' + brl(o[1]) + '</small></button>'; }).join('');
      $$('button', seg).forEach(function (b) { b.onclick = function () { $$('button', seg).forEach(function (x) { x.classList.toggle('on', x === b); }); painelCobranca($('#cobrAlvo', f), c, opts[+b.dataset.i][1]); }; });
    } else seg.remove();
    painelCobranca($('#cobrAlvo', f), c, opts[0][1]);
  }

  /* ================= lançar (venda / despesa / retirada) ================= */
  function abrirLancar(o) {
    var m = o.editar ? JSON.parse(JSON.stringify(o.editar)) : { id: uid(), data: hoje(), tipo: o.tipo || 'venda', valor: 0, forma: o.forma || '', nat: natPadrao(), nf: false, cli: o.cli || null, venc: '', desc: '', cat: '' };
    if (m.tipo === 'receb') { abrirReceber(cliente(m.cli), m); return; }
    var c = m.cli ? cliente(m.cli) : null;
    var formas = ['dinheiro', 'pix', 'debito', 'credito'].concat(E.neg.usaIfood || E.neg.setor === 'alimentacao' ? ['ifood'] : []).concat(['fiado']);
    var html = '<h1>' + (o.editar ? 'Editar lançamento' : 'Lançar') + '</h1>' +
      (m.tipo === 'antigo' ? '<p class="muted">Dívida antiga de ' + esc(c ? c.nome : '') + '</p>' :
      '<div class="seg" style="margin-top:12px" id="lTipo"><button data-t="venda">💰 Venda</button><button data-t="despesa">🧾 Despesa</button><button data-t="retirada">🏠 Pra casa</button></div>') +
      '<input class="inp valor" id="lValor" inputmode="decimal" placeholder="R$ 0,00" autocomplete="off" ' + (o.editar ? '' : 'autofocus') + ' value="' + (m.valor ? Motor.fmtBR(m.valor) : '') + '">' +
      '<div id="lCorpo"></div>' +
      '<label class="campo"><span id="lDescRot">Descrição (opcional)</span><input class="inp" id="lDesc" value="' + esc(m.desc) + '" autocomplete="off"></label>' +
      '<label class="campo"><span>Data</span><input class="inp" type="date" id="lData" value="' + m.data + '"></label>' +
      '<button class="btn cheio" style="margin-top:18px" id="lSalvar">Salvar</button>' +
      (o.editar ? '<button class="btn verm cheio" style="margin-top:10px" id="lExcluir">Excluir lançamento</button>' : '');
    var f = abrirFolha(html);
    function corpo() {
      $$('#lTipo button', f).forEach(function (b) { b.classList.toggle('on', b.dataset.t === m.tipo); });
      var h = '';
      if (m.tipo === 'venda') {
        h += '<p style="font-weight:600;font-size:14.5px;margin-top:16px">Como recebeu?</p><div class="chips" style="margin-top:8px">' +
          formas.map(function (k) { return '<button class="chip ' + (m.forma === k ? 'on' : '') + '" data-f="' + k + '">' + FORMAS[k] + '</button>'; }).join('') + '</div>';
        if (m.forma === 'fiado') {
          h += '<label class="campo"><span>Cliente</span><input class="inp" id="lCli" list="lCliL" value="' + esc(c ? c.nome : '') + '" placeholder="Nome de quem vai pagar depois" autocomplete="off"></label>' +
            '<datalist id="lCliL">' + E.cli.map(function (x) { return '<option value="' + esc(x.nome) + '">'; }).join('') + '</datalist>' +
            '<label class="campo"><span>WhatsApp (opcional)</span><input class="inp" id="lFone" inputmode="tel" value="' + esc(c ? c.fone : '') + '" placeholder="(61) 99999-9999"></label>' +
            '<label class="campo"><span>Vai pagar até</span><input class="inp" type="date" id="lVenc" value="' + (m.venc || somaDias(hoje(), 15)) + '"></label>';
        }
        if (pedeNatureza()) h += '<p style="font-weight:600;font-size:14.5px;margin-top:16px">Tipo de venda (para o relatório do MEI)</p><div class="chips" style="margin-top:8px">' +
          Object.keys(NAT).map(function (k) { return '<button class="chip ' + (m.nat === k ? 'on' : '') + '" data-n="' + k + '">' + NAT[k] + '</button>'; }).join('') + '</div>';
        h += '<label class="check"><input type="checkbox" id="lNf" ' + (m.nf ? 'checked' : '') + '> Emiti nota fiscal desta venda</label>';
      } else if (m.tipo === 'despesa') {
        h += '<p style="font-weight:600;font-size:14.5px;margin-top:16px">Com o quê?</p><div class="chips" style="margin-top:8px">' +
          Object.keys(CATS).map(function (k) { return '<button class="chip ' + (m.cat === k ? 'on' : '') + '" data-c="' + k + '">' + CATS[k] + '</button>'; }).join('') + '</div>';
      } else if (m.tipo === 'retirada') {
        h += '<div class="dica">Dinheiro do negócio que foi para casa: mercado, contas pessoais, seu "salário". Separar isso mostra quanto o negócio dá de verdade.</div>';
      }
      $('#lCorpo', f).innerHTML = h;
      $('#lDescRot', f).textContent = m.tipo === 'venda' ? 'O que vendeu (opcional)' : m.tipo === 'despesa' ? 'Descrição (opcional)' : 'Para quê (opcional)';
      $$('[data-f]', f).forEach(function (b) { b.onclick = function () { lerCampos(); m.forma = b.dataset.f; corpo(); if (m.forma === 'fiado') { var ci = $('#lCli', f); if (ci && !ci.value) ci.focus(); } }; });
      $$('[data-n]', f).forEach(function (b) { b.onclick = function () { m.nat = b.dataset.n; $$('[data-n]', f).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      $$('[data-c]', f).forEach(function (b) { b.onclick = function () { m.cat = b.dataset.c; $$('[data-c]', f).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    }
    var cliNome = c ? c.nome : '', cliFone = c ? c.fone : '';
    function lerCampos() {
      var ci = $('#lCli', f); if (ci) { cliNome = ci.value; cliFone = $('#lFone', f).value; m.venc = $('#lVenc', f).value; }
      var nf = $('#lNf', f); if (nf) m.nf = nf.checked;
    }
    $$('#lTipo button', f).forEach(function (b) { b.onclick = function () { lerCampos(); m.tipo = b.dataset.t; corpo(); }; });
    corpo();
    if (c && m.forma === 'fiado') { cliNome = c.nome; }
    $('#lSalvar', f).onclick = function () {
      lerCampos();
      m.valor = arred(num($('#lValor', f).value));
      m.desc = $('#lDesc', f).value.trim(); m.data = $('#lData', f).value || hoje();
      if (!(m.valor > 0)) { toast('Digite o valor.'); $('#lValor', f).focus(); return; }
      if (m.tipo === 'venda' && !m.forma) { toast('Escolha como recebeu.'); return; }
      if (m.tipo === 'venda' && m.forma === 'fiado') {
        var nm = $('#lCli', f) ? $('#lCli', f).value.trim() : cliNome;
        if (!nm) { toast('Escreva o nome do cliente.'); return; }
        var cc = acharOuCriarCliente(nm, $('#lFone', f) ? $('#lFone', f).value.trim() : '');
        if ($('#lFone', f) && $('#lFone', f).value.trim()) cc.fone = $('#lFone', f).value.trim();
        m.cli = cc.id; if (!m.venc) m.venc = somaDias(m.data, 15);
      } else if (m.tipo !== 'antigo') { m.cli = m.tipo === 'venda' && m.cli && m.forma === 'fiado' ? m.cli : null; m.venc = ''; }
      if (m.tipo !== 'venda') { m.forma = ''; m.nf = false; }
      if (m.tipo !== 'despesa') m.cat = '';
      if (o.editar) { E.mov = E.mov.map(function (x) { return x.id === m.id ? m : x; }); }
      else E.mov.push(m);
      salvar(); fecharFolha();
      toast(m.tipo === 'venda' ? 'Venda lançada ✓' : m.tipo === 'despesa' ? 'Despesa lançada ✓' : 'Lançado ✓');
      rotear();
    };
    if (o.editar) $('#lExcluir', f).onclick = function () {
      confirmar('Excluir este lançamento?', brl(m.valor) + ' em ' + dma(m.data) + '. Não dá para desfazer.', 'Excluir', function () {
        E.mov = E.mov.filter(function (x) { return x.id !== m.id; }); salvar(); toast('Excluído'); rotear();
      }, true);
    };
  }

  function abrirReceber(c, editar) {
    var s = saldoCliente(c.id);
    var m = editar ? JSON.parse(JSON.stringify(editar)) : { id: uid(), data: hoje(), tipo: 'receb', valor: s.total, forma: 'pix', cli: c.id, desc: '' };
    var f = abrirFolha('<h1>' + (editar ? 'Editar recebimento' : 'Recebi de ' + esc(primeiroNome(c.nome))) + '</h1><p class="muted">Deve hoje: <b>' + brl(s.total) + '</b></p>' +
      '<input class="inp valor" id="rValor" inputmode="decimal" value="' + (m.valor ? Motor.fmtBR(m.valor) : '') + '">' +
      '<div class="chips" style="margin-top:14px">' + ['pix', 'dinheiro', 'debito', 'credito'].map(function (k) { return '<button class="chip ' + (m.forma === k ? 'on' : '') + '" data-f="' + k + '">' + FORMAS[k] + '</button>'; }).join('') + '</div>' +
      '<label class="campo"><span>Data</span><input class="inp" type="date" id="rData" value="' + m.data + '"></label>' +
      '<div class="dica">Recebimento de fiado não conta de novo no faturamento do MEI: a venda já contou no dia em que foi feita.</div>' +
      '<button class="btn cheio" style="margin-top:16px" id="rOk">Confirmar recebimento</button>' + (editar ? '<button class="btn verm cheio" style="margin-top:10px" id="rDel">Excluir</button>' : ''));
    $$('[data-f]', f).forEach(function (b) { b.onclick = function () { m.forma = b.dataset.f; $$('[data-f]', f).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('#rOk', f).onclick = function () {
      m.valor = arred(num($('#rValor', f).value)); m.data = $('#rData', f).value || hoje();
      if (!(m.valor > 0)) { toast('Digite o valor.'); return; }
      if (editar) E.mov = E.mov.map(function (x) { return x.id === m.id ? m : x; }); else E.mov.push(m);
      salvar(); fecharFolha(); toast('Recebimento registrado ✓'); rotear();
    };
    if (editar) $('#rDel', f).onclick = function () { E.mov = E.mov.filter(function (x) { return x.id !== m.id; }); salvar(); fecharFolha(); toast('Excluído'); rotear(); };
  }

  /* ================= telas ================= */
  ROTAS.inicio = function () {
    var ym = ymDe(hoje()), t = totaisMes(ym), dev = devedores(), totDev = 0, totVenc = 0, qVenc = 0;
    dev.forEach(function (d) { totDev += d.s.total; if (d.s.vencido > 0) { totVenc += d.s.vencido; qVenc++; } });
    var alertas = [];
    if (!pixPronto()) alertas.push({ c: 'mt', i: '⚡', b: 'Cadastre sua chave Pix', s: 'Para cobrar com valor certinho em 1 toque.', h: '#/ajustes' });
    if (qVenc) alertas.push({ c: 'vm', i: '⏰', b: brl(totVenc) + ' de fiado vencido', s: qVenc + (qVenc > 1 ? ' clientes' : ' cliente') + ' · toque para cobrar', h: '#/fiado' });
    var dia = new Date().getDate(), compet = ymSoma(ym, -1);
    if (E.neg.mei && !E.das[compet]) {
      if (ymDe(E.cfg.criado) === ym && dia > 20) alertas.push({ c: 'mt', i: '🧾', b: 'Já pagou o DAS de ' + mesNome(compet) + '?', s: 'Venceu dia 20. Toque e marque, ou pague no app MEI.', h: '#/mei' });
      else if (dia <= 20) alertas.push({ c: dia >= 15 ? 'am' : 'mt', i: '🧾', b: 'DAS de ' + mesNome(compet) + ' vence dia 20', s: 'Já pagou? Toque e marque.', h: '#/mei' });
      else alertas.push({ c: 'vm', i: '🧾', b: 'DAS de ' + mesNome(compet) + ' venceu dia 20', s: 'Pague no app MEI (com juros pequenos) e marque aqui.', h: '#/mei' });
    }
    var ano = new Date().getFullYear(), rec = receitaAno(ano), lim = limiteAno(ano), pct = rec / lim * 100;
    if (E.neg.mei && pct >= 70) alertas.push({ c: pct >= 100 ? 'vm' : 'am', i: '📈', b: 'Você já usou ' + Math.round(pct) + '% do limite do MEI', s: brl(rec) + ' de ' + brl(lim) + ' em ' + ano, h: '#/mei' });
    var hojeAg = E.ag.filter(function (a) { return a.data === hoje() && a.status === 'marcado'; });
    if (hojeAg.length) alertas.push({ c: 'mt', i: '📅', b: hojeAg.length + (hojeAg.length > 1 ? ' horários hoje' : ' horário hoje'), s: 'Primeiro às ' + hojeAg.sort(function (a, b) { return a.hora < b.hora ? -1 : 1; })[0].hora + ' · lembrar no WhatsApp', h: '#/agenda' });
    var ultBk = E.cfg.ultimoBackup;
    if (E.mov.length >= 10 && (!ultBk || somaDias(ultBk, 7) <= hoje())) alertas.push({ c: 'am', i: '💾', b: 'Faça o backup da semana', s: 'Se o celular quebrar, você não perde nada.', h: '#/backup' });
    var confMes = function (tipo) { return E.conf.some(function (x) { return x.tipo === tipo && ymDe(x.data) === ym; }); };
    if ((E.neg.usaIfood || E.neg.setor === 'alimentacao') && !confMes('ifood')) alertas.push({ c: 'mt', i: '🛵', b: 'O iFood te cobrou certo?', s: 'Suba o relatório e o app confere pedido a pedido.', h: '#/ifood' });
    else if (/roupas|beleza|alimentacao/.test(E.neg.setor) && !confMes('maquininha')) alertas.push({ c: 'mt', i: '💳', b: 'A maquininha cobrou a taxa certa?', s: 'Confira o extrato do mês em 1 minuto.', h: '#/maquininha' });

    var ult = E.mov.slice().sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; }).slice(0, 6);
    var html = topo(E.neg.nome || 'Micro no Controle', 'Hoje, ' + DIAS[new Date().getDay()] + ' ' + dm(hoje())) + '<main>' +
      '<div class="card hero"><div class="lbl">Vendas em ' + mesNome(ym) + '</div><div class="big">' + brl(t.vendas) + '</div>' +
      '<div class="kpis"><div><b>' + brl(t.despesas) + '</b><span>Despesas</span></div><div><b>' + brl(t.vendas - t.despesas) + '</b><span>Sobrou</span></div><div><b>' + brl(t.retiradas) + '</b><span>Pra casa</span></div></div>' +
      '<p style="margin-top:12px;font-size:14px;color:#BFE3DE">Hoje: <b style="color:#fff">' + brl(t.hoje) + '</b> em vendas' + (totDev ? ' · Na rua (fiado): <b style="color:#fff">' + brl(totDev) + '</b>' : '') + '</p></div>' +
      '<div class="linhaBtns"><button class="btn mint" id="iVenda">+ Venda</button><button class="btn claro" id="iDesp">+ Despesa</button></div>' +
      alertas.slice(0, 5).map(function (a) { return '<a class="alerta ' + a.c + '" href="' + a.h + '" style="text-decoration:none;color:inherit"><span class="ic">' + a.i + '</span><span class="tx"><b>' + esc(a.b) + '</b><span>' + esc(a.s) + '</span></span><span>›</span></a>'; }).join('') +
      '<h2>Últimos lançamentos</h2>' + listaMov(ult, 'Nada lançado ainda. Toque em <b>+</b> para lançar sua primeira venda.') +
      (E.mov.length > 6 ? '<a class="btn linha cheio" style="margin-top:10px" href="#/lancamentos">Ver todos</a>' : '') +
      '<p class="rodape">Seus dados ficam só neste celular · <a href="#/backup">backup</a></p></main>';
    return { html: html, montar: function (el) {
      $('#iVenda', el).onclick = function () { abrirLancar({ tipo: 'venda' }); };
      $('#iDesp', el).onclick = function () { abrirLancar({ tipo: 'despesa' }); };
      ligarMov(el);
    } };
  };

  function descMov(m) {
    var c = m.cli ? cliente(m.cli) : null;
    if (m.tipo === 'venda') return (m.desc || 'Venda') + ' · ' + FORMAS[m.forma] + (c ? ' · ' + c.nome : '');
    if (m.tipo === 'despesa') return (m.desc || CATS[m.cat] || 'Despesa');
    if (m.tipo === 'retirada') return (m.desc || 'Retirada para casa');
    if (m.tipo === 'receb') return 'Recebi de ' + (c ? c.nome : '') + ' · ' + (FORMAS[m.forma] || '');
    if (m.tipo === 'antigo') return 'Dívida antiga · ' + (c ? c.nome : '');
    return m.desc || '';
  }
  function listaMov(lista, vazio) {
    if (!lista.length) return '<div class="lista"><div class="vazio"><span class="ic">🧾</span>' + vazio + '</div></div>';
    return '<div class="lista">' + lista.map(function (m) {
      var ic = { venda: m.forma === 'fiado' ? '📒' : '💰', despesa: '🧾', retirada: '🏠', receb: '✅', antigo: '📒' }[m.tipo] || '•';
      var cls = m.tipo === 'venda' ? 'mais' : m.tipo === 'despesa' || m.tipo === 'retirada' ? 'menos' : 'neutro';
      var sinal = m.tipo === 'despesa' || m.tipo === 'retirada' ? '-' : m.tipo === 'venda' ? '+' : '';
      return '<button class="item" data-mov="' + m.id + '"><span class="av" style="background:#fff;border:1px solid var(--line)">' + ic + '</span><span class="meio"><b>' + esc(descMov(m)) + '</b><span>' + diaRel(m.data) + (m.nf ? ' · com nota' : '') + '</span></span><span class="val ' + cls + '">' + sinal + brl(m.valor).replace('-', '') + '</span></button>';
    }).join('') + '</div>';
  }
  function ligarMov(el) {
    $$('[data-mov]', el).forEach(function (b) { b.onclick = function () { var m = E.mov.filter(function (x) { return x.id === b.dataset.mov; })[0]; if (m) abrirLancar({ editar: m }); }; });
  }

  ROTAS.lancamentos = function (ym) {
    ym = ym || ymDe(hoje());
    var t = totaisMes(ym), lista = E.mov.filter(function (m) { return ymDe(m.data) === ym; }).sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
    var html = topo('Lançamentos', mesNome(ym), '#/inicio') + '<main>' +
      '<div class="linhaBtns" style="margin-top:0"><a class="btn linha peq" href="#/lancamentos/' + ymSoma(ym, -1) + '">‹ ' + mesNome(ymSoma(ym, -1)) + '</a>' + (ym < ymDe(hoje()) ? '<a class="btn linha peq" href="#/lancamentos/' + ymSoma(ym, 1) + '">' + mesNome(ymSoma(ym, 1)) + ' ›</a>' : '') + '</div>' +
      '<div class="card" style="margin-top:12px"><table class="t"><tr><td>Vendas</td><td class="n"><b>' + brl(t.vendas) + '</b></td></tr><tr><td>Despesas</td><td class="n">' + brl(t.despesas) + '</td></tr><tr><td>Sobrou no negócio</td><td class="n"><b>' + brl(t.vendas - t.despesas) + '</b></td></tr><tr><td>Tirou pra casa</td><td class="n">' + brl(t.retiradas) + '</td></tr><tr><td>Fiado recebido</td><td class="n">' + brl(t.recebido) + '</td></tr></table></div>' +
      '<h2>' + lista.length + ' lançamentos</h2>' + listaMov(lista, 'Nenhum lançamento neste mês.') + '</main>';
    return { html: html, montar: ligarMov };
  };

  ROTAS.fiado = function () {
    var dev = devedores(), tot = 0, venc = 0;
    dev.forEach(function (d) { tot += d.s.total; venc += d.s.vencido; });
    var outros = E.cli.filter(function (c) { return saldoCliente(c.id).total <= 0; });
    var html = topo('Quem me deve', 'Fiado, crediário e contas a receber') + '<main>' +
      '<div class="card hero"><div class="lbl">Total na rua</div><div class="big">' + brl(tot) + '</div>' + (venc > 0 ? '<p style="color:#FFD9A0;font-weight:600">' + brl(venc) + ' já venceu</p>' : '<p style="color:#BFE3DE">Nada vencido 👏</p>') + '</div>' +
      '<div class="linhaBtns"><button class="btn mint" id="fNovo">+ Vendi fiado</button><button class="btn claro" id="fCli">+ Cliente</button></div>' +
      '<h2>Devendo</h2>' +
      (dev.length ? '<div class="lista">' + dev.map(function (d) {
        return '<div class="item"><a href="#/cliente/' + d.c.id + '" style="display:flex;gap:12px;align-items:center;flex:1;min-width:0;text-decoration:none;color:inherit"><span class="av">' + esc(iniciais(d.c.nome)) + '</span><span class="meio"><b>' + esc(d.c.nome) + '</b><span>' +
          (d.s.vencido > 0 ? '<span class="tag vm">venceu ' + dm(d.s.venc) + '</span>' : 'vence ' + dm(d.s.venc)) + (d.c.ultimaCobranca ? ' · cobrado ' + diaRel(d.c.ultimaCobranca) : '') + '</span></span><span class="val">' + brl(d.s.total) + '</span></a>' +
          '<button class="btn wa peq" data-cob="' + d.c.id + '" aria-label="Cobrar ' + esc(d.c.nome) + '">Cobrar</button></div>';
      }).join('') + '</div>' : '<div class="lista"><div class="vazio"><span class="ic">🎉</span>Ninguém te deve agora.</div></div>') +
      (outros.length ? '<h2>Outros clientes</h2><div class="lista">' + outros.map(function (c) { return '<a class="item" href="#/cliente/' + c.id + '" style="text-decoration:none;color:inherit"><span class="av">' + esc(iniciais(c.nome)) + '</span><span class="meio"><b>' + esc(c.nome) + '</b><span>' + esc(c.fone || 'sem WhatsApp') + '</span></span><span>›</span></a>'; }).join('') + '</div>' : '') +
      '</main>';
    return { html: html, montar: function (el) {
      $('#fNovo', el).onclick = function () { abrirLancar({ tipo: 'venda', forma: 'fiado' }); };
      $('#fCli', el).onclick = function () { abrirNovoCliente(); };
      $$('[data-cob]', el).forEach(function (b) { b.onclick = function () { abrirCobrar(cliente(b.dataset.cob)); }; });
    } };
  };

  function abrirNovoCliente(c) {
    var f = abrirFolha('<h1>' + (c ? 'Editar cliente' : 'Novo cliente') + '</h1>' +
      '<label class="campo"><span>Nome</span><input class="inp" id="cNome" value="' + esc(c ? c.nome : '') + '" autofocus autocomplete="off"></label>' +
      '<label class="campo"><span>WhatsApp</span><input class="inp" id="cFone" inputmode="tel" value="' + esc(c ? c.fone : '') + '" placeholder="(61) 99999-9999"></label>' +
      (c ? '' : '<label class="campo"><span>Já te deve algo de antes? (opcional)</span><input class="inp" id="cAnt" inputmode="decimal" placeholder="R$ 0,00"></label><p class="peq muted" style="margin-top:6px">Dívida antiga não conta como venda de hoje no limite do MEI.</p>') +
      '<button class="btn cheio" style="margin-top:16px" id="cOk">Salvar</button>' + (c ? '<button class="btn verm cheio" style="margin-top:10px" id="cDel">Excluir cliente</button>' : ''));
    $('#cOk', f).onclick = function () {
      var n = $('#cNome', f).value.trim(); if (!n) { toast('Escreva o nome.'); return; }
      if (c) { c.nome = n; c.fone = $('#cFone', f).value.trim(); }
      else {
        var nc = acharOuCriarCliente(n, $('#cFone', f).value.trim());
        var ant = num($('#cAnt', f).value);
        if (ant > 0) E.mov.push({ id: uid(), data: hoje(), tipo: 'antigo', valor: arred(ant), cli: nc.id, venc: hoje(), desc: 'Saldo que já devia' });
      }
      salvar(); fecharFolha(); toast('Cliente salvo ✓'); rotear();
    };
    if (c) $('#cDel', f).onclick = function () {
      var s = saldoCliente(c.id);
      confirmar('Excluir ' + c.nome + '?', s.total > 0 ? 'Ele ainda deve ' + brl(s.total) + '. As vendas continuam no seu caixa, mas o fiado dele some.' : 'O histórico de vendas continua no seu caixa.', 'Excluir', function () {
        E.cli = E.cli.filter(function (x) { return x.id !== c.id; });
        E.mov = E.mov.filter(function (m) { return !(m.cli === c.id && (m.tipo === 'antigo' || m.tipo === 'receb')); }).map(function (m) { if (m.cli === c.id) { m.forma = m.forma === 'fiado' ? 'dinheiro' : m.forma; m.cli = null; } return m; });
        salvar(); location.hash = '#/fiado';
      }, true);
    };
  }

  ROTAS.cliente = function (id) {
    var c = cliente(id); if (!c) return ROTAS.fiado();
    var s = saldoCliente(id), hist = E.mov.filter(function (m) { return m.cli === id; }).sort(function (a, b) { return a.data < b.data ? 1 : -1; });
    var html = topo(c.nome, c.fone || 'sem WhatsApp cadastrado', '#/fiado') + '<main>' +
      '<div class="card"><p class="muted peq">Deve hoje</p><div style="font-family:var(--display);font-weight:800;font-size:36px">' + brl(s.total) + '</div>' +
      (s.vencido > 0 ? '<span class="tag vm">' + brl(s.vencido) + ' vencido desde ' + dm(s.venc) + '</span>' : s.total > 0 ? '<span class="tag">vence ' + dm(s.venc) + '</span>' : '<span class="tag">em dia</span>') +
      (s.credito > 0 ? '<p class="peq" style="margin-top:8px">Tem ' + brl(s.credito) + ' de crédito (pagou a mais).</p>' : '') +
      '<div class="linhaBtns">' + (s.total > 0 ? '<button class="btn wa" id="clCob">Cobrar no WhatsApp</button><button class="btn mint" id="clRec">Recebi</button>' : '') + '</div>' +
      '<div class="linhaBtns"><button class="btn claro peq" id="clFiado">+ Vendi fiado</button><button class="btn linha peq" id="clEd">Editar</button></div></div>' +
      '<h2>Histórico</h2>' + listaMov(hist, 'Sem lançamentos.') + '</main>';
    return { html: html, montar: function (el) {
      if (s.total > 0) { $('#clCob', el).onclick = function () { abrirCobrar(c); }; $('#clRec', el).onclick = function () { abrirReceber(c); }; }
      $('#clFiado', el).onclick = function () { abrirLancar({ tipo: 'venda', forma: 'fiado', cli: c.id }); };
      $('#clEd', el).onclick = function () { abrirNovoCliente(c); };
      ligarMov(el);
    } };
  };

  /* ---------- agenda (secretária) ---------- */
  ROTAS.agenda = function () {
    var h = hoje(), ag = E.ag.slice().sort(function (a, b) { return (a.data + a.hora) < (b.data + b.hora) ? -1 : 1; });
    var futuros = ag.filter(function (a) { return a.data >= h && a.status === 'marcado'; });
    var pend = ag.filter(function (a) { return a.data < h && a.status === 'marcado'; });
    var feitos = ag.filter(function (a) { return a.status !== 'marcado'; }).slice(-8).reverse();
    var grupos = {};
    futuros.forEach(function (a) { (grupos[a.data] = grupos[a.data] || []).push(a); });
    function cartao(a) {
      return '<div class="card"><div style="display:flex;justify-content:space-between;gap:10px"><div><b style="font-size:18px">' + esc(a.hora || '--:--') + ' · ' + esc(a.cliNome) + '</b><p class="muted peq">' + esc(a.serv || 'Atendimento') + (a.valor ? ' · ' + brl(a.valor) : '') + (a.sinal ? ' · sinal ' + brl(a.sinal) + (a.sinalPago ? ' ✓ recebido' : ' (a receber)') : '') + '</p></div>' +
        (a.lembrado ? '<span class="tag">lembrado</span>' : '') + '</div>' +
        '<div class="linhaBtns"><button class="btn wa peq" data-lem="' + a.id + '">Lembrar</button>' + (a.sinal && !a.sinalPago ? '<button class="btn claro peq" data-sin="' + a.id + '">Sinal</button>' : '') +
        '<button class="btn mint peq" data-ok="' + a.id + '">Atendido</button><button class="btn linha peq" data-ed="' + a.id + '">⋯</button></div></div>';
    }
    var html = topo('Agenda', 'Seus horários e lembretes') + '<main>' +
      '<button class="btn mint cheio" id="agNovo">+ Marcar horário</button>' +
      (pend.length ? '<h2>Ficou em aberto</h2>' + pend.map(cartao).join('') : '') +
      (futuros.length ? Object.keys(grupos).map(function (d) { return '<h2 style="text-transform:capitalize">' + diaRel(d) + '</h2>' + grupos[d].map(cartao).join(''); }).join('') :
        '<div class="lista" style="margin-top:14px"><div class="vazio"><span class="ic">📅</span>Nenhum horário marcado.<br>Marque e mande o lembrete no WhatsApp com 1 toque — menos gente falta.</div></div>') +
      (feitos.length ? '<h2>Últimos atendimentos</h2><div class="lista">' + feitos.map(function (a) { return '<div class="item"><span class="meio"><b>' + esc(a.cliNome) + ' · ' + esc(a.serv || '') + '</b><span>' + dma(a.data) + ' ' + esc(a.hora || '') + '</span></span><span class="tag ' + (a.status === 'faltou' ? 'vm' : a.status === 'cancelado' ? 'am' : '') + '">' + a.status + '</span></div>'; }).join('') + '</div>' : '') +
      '</main>';
    return { html: html, montar: function (el) {
      $('#agNovo', el).onclick = function () { abrirHorario(); };
      function ach(id) { return E.ag.filter(function (x) { return x.id === id; })[0]; }
      $$('[data-lem]', el).forEach(function (b) { b.onclick = function () {
        var a = ach(b.dataset.lem);
        var msg = 'Oi, ' + primeiroNome(a.cliNome) + '!' + (E.neg.dono ? ' Aqui é ' + primeiroNome(E.neg.dono) + '.' : '') + ' Passando para lembrar do seu horário ' + (E.neg.nome ? 'em ' + E.neg.nome + ' ' : '') + (a.data === hoje() ? 'hoje' : a.data === somaDias(hoje(), 1) ? 'amanhã' : 'no dia ' + dm(a.data)) + (a.hora ? ' às ' + a.hora : '') + (a.serv ? ' (' + a.serv + ')' : '') + '. Posso confirmar? Se precisar remarcar, é só me avisar 😊';
        a.lembrado = true; salvar(); window.open(linkWa(a.fone, msg), '_blank'); rotear();
      }; });
      $$('[data-sin]', el).forEach(function (b) { b.onclick = function () { abrirSinal(ach(b.dataset.sin)); }; });
      $$('[data-ok]', el).forEach(function (b) { b.onclick = function () { abrirAtendido(ach(b.dataset.ok)); }; });
      $$('[data-ed]', el).forEach(function (b) { b.onclick = function () { abrirHorario(ach(b.dataset.ed)); }; });
    } };
  };
  function abrirHorario(a) {
    var novo = !a;
    a = a ? JSON.parse(JSON.stringify(a)) : { id: uid(), data: hoje(), hora: '', cliNome: '', fone: '', serv: '', valor: 0, sinal: 0, sinalPago: false, status: 'marcado', lembrado: false };
    var f = abrirFolha('<h1>' + (novo ? 'Marcar horário' : 'Editar horário') + '</h1>' +
      '<label class="campo"><span>Cliente</span><input class="inp" id="hCli" list="hCliL" value="' + esc(a.cliNome) + '" autocomplete="off" ' + (novo ? 'autofocus' : '') + '></label><datalist id="hCliL">' + E.cli.map(function (x) { return '<option value="' + esc(x.nome) + '">'; }).join('') + '</datalist>' +
      '<label class="campo"><span>WhatsApp</span><input class="inp" id="hFone" inputmode="tel" value="' + esc(a.fone) + '" placeholder="(61) 99999-9999"></label>' +
      '<div class="grade"><label class="campo"><span>Dia</span><input class="inp" type="date" id="hData" value="' + a.data + '"></label><label class="campo"><span>Hora</span><input class="inp" type="time" id="hHora" value="' + esc(a.hora) + '"></label></div>' +
      '<label class="campo"><span>Serviço</span><input class="inp" id="hServ" value="' + esc(a.serv) + '" placeholder="Ex.: Escova, manicure, visita técnica"></label>' +
      '<div class="grade"><label class="campo"><span>Valor (R$)</span><input class="inp" id="hVal" inputmode="decimal" value="' + (a.valor ? Motor.fmtBR(a.valor) : '') + '"></label><label class="campo"><span>Sinal (R$, opcional)</span><input class="inp" id="hSin" inputmode="decimal" value="' + (a.sinal ? Motor.fmtBR(a.sinal) : '') + '"></label></div>' +
      '<button class="btn cheio" style="margin-top:16px" id="hOk">Salvar</button>' +
      (novo ? '' : '<div class="linhaBtns"><button class="btn linha peq" id="hFal">Faltou</button><button class="btn linha peq" id="hCan">Cancelou</button><button class="btn verm peq" id="hDel">Excluir</button></div>'));
    $('#hCli', f).addEventListener('change', function () { var c = E.cli.filter(function (x) { return x.nome.toLowerCase() === $('#hCli', f).value.trim().toLowerCase(); })[0]; if (c && c.fone && !$('#hFone', f).value) $('#hFone', f).value = c.fone; });
    $('#hOk', f).onclick = function () {
      a.cliNome = $('#hCli', f).value.trim(); a.fone = $('#hFone', f).value.trim(); a.data = $('#hData', f).value || hoje(); a.hora = $('#hHora', f).value; a.serv = $('#hServ', f).value.trim();
      a.valor = arred(num($('#hVal', f).value)); a.sinal = arred(num($('#hSin', f).value));
      if (!a.cliNome) { toast('Escreva o nome do cliente.'); return; }
      var c = acharOuCriarCliente(a.cliNome, a.fone); a.cli = c.id; if (a.fone) c.fone = a.fone; else a.fone = c.fone || '';
      if (novo) E.ag.push(a); else E.ag = E.ag.map(function (x) { return x.id === a.id ? a : x; });
      salvar(); fecharFolha(); toast('Horário salvo ✓'); rotear();
    };
    if (!novo) {
      function st(s) {
        a.status = s; E.ag = E.ag.map(function (x) { return x.id === a.id ? a : x; });
        if (a.sinalPago && a.sinal > 0 && (s === 'faltou' || s === 'cancelado')) E.mov.push({ id: uid(), data: hoje(), tipo: 'venda', valor: a.sinal, forma: 'pix', nat: natPadrao(), nf: false, cli: null, venc: '', desc: 'Sinal retido (' + s + ') · ' + a.cliNome, cat: '' });
        salvar(); fecharFolha(); if (a.sinalPago && a.sinal > 0 && (s === 'faltou' || s === 'cancelado')) toast('O sinal ficou como venda. Se devolveu, apague em Lançamentos.'); rotear();
      }
      $('#hFal', f).onclick = function () { st('faltou'); };
      $('#hCan', f).onclick = function () { st('cancelado'); };
      $('#hDel', f).onclick = function () { E.ag = E.ag.filter(function (x) { return x.id !== a.id; }); salvar(); fecharFolha(); rotear(); };
    }
  }
  function abrirSinal(a) {
    var c = { nome: a.cliNome, fone: a.fone };
    var code = pixPronto() ? codigoPix(a.sinal, 'SIN' + a.id.toUpperCase().slice(0, 20), 'Sinal ' + (a.serv || '')) : '';
    var msg = 'Oi, ' + primeiroNome(a.cliNome) + '! Para garantir seu horário ' + (a.data === hoje() ? 'de hoje' : 'do dia ' + dm(a.data)) + (a.hora ? ' às ' + a.hora : '') + ', o sinal é de ' + brl(a.sinal) + (a.valor ? ' (abatido do total de ' + brl(a.valor) + ')' : '') + '.' + (code ? ' Segue o Pix copia e cola com o valor certinho:' : '');
    var txt = code ? msg + '\n\n' + code : msg;
    var f = abrirFolha('<h1>Pedir sinal</h1><div class="card" style="margin-top:12px"><div style="font-family:var(--display);font-weight:800;font-size:32px">' + brl(a.sinal) + '</div>' +
      (code ? '<canvas class="qr" id="sq"></canvas><div class="pixbox">' + esc(code) + '</div>' : '<div class="aviso">Cadastre sua chave Pix em <a href="#/ajustes">Ajustes</a>.</div>') +
      '<a class="btn wa cheio" style="margin-top:12px" target="_blank" rel="noopener" href="' + esc(linkWa(c.fone, txt)) + '">Mandar no WhatsApp</a>' +
      '<button class="btn mint cheio" style="margin-top:10px" id="sPago">O sinal caiu ✓</button></div>');
    if (code) { var cv = qrCanvas(code, 400), q = $('#sq', f); q.width = cv.width; q.height = cv.height; q.getContext('2d').drawImage(cv, 0, 0); }
    $('#sPago', f).onclick = function () {
      a.sinalPago = true; a.sinalData = hoje();
      E.ag = E.ag.map(function (x) { return x.id === a.id ? a : x; });
      salvar(); fecharFolha(); toast('Sinal anotado ✓ Vira venda quando você concluir o atendimento.'); rotear();
    };
  }
  function abrirAtendido(a) {
    var sin = a.sinalPago ? a.sinal : 0, resta = arred(Math.max(0, (a.valor || 0) - sin)), forma = 'pix';
    var f = abrirFolha('<h1>Atendido ✓</h1><p class="muted">' + esc(a.cliNome) + (a.serv ? ' · ' + esc(a.serv) : '') + (sin ? ' · sinal de ' + brl(sin) + ' já recebido (entra na venda agora)' : '') + '</p>' +
      '<label class="campo"><span>Quanto recebeu agora</span><input class="inp valor" id="atV" inputmode="decimal" value="' + (resta ? Motor.fmtBR(resta) : '') + '"></label>' +
      '<div class="chips" style="margin-top:12px">' + ['pix', 'dinheiro', 'debito', 'credito', 'fiado'].map(function (k) { return '<button class="chip ' + (k === forma ? 'on' : '') + '" data-f="' + k + '">' + FORMAS[k] + '</button>'; }).join('') + '</div>' +
      '<button class="btn cheio" style="margin-top:16px" id="atOk">Lançar venda e concluir</button><button class="btn linha cheio" style="margin-top:10px" id="atSem">Concluir sem lançar</button>');
    $$('[data-f]', f).forEach(function (b) { b.onclick = function () { forma = b.dataset.f; $$('[data-f]', f).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    function concluir() { a.status = 'feito'; E.ag = E.ag.map(function (x) { return x.id === a.id ? a : x; }); }
    $('#atOk', f).onclick = function () {
      var v = arred(num($('#atV', f).value)), c = acharOuCriarCliente(a.cliNome, a.fone), desc = (a.serv || 'Atendimento') + ' · ' + a.cliNome;
      if (forma === 'fiado') {
        if (sin) E.mov.push({ id: uid(), data: hoje(), tipo: 'venda', valor: sin, forma: 'pix', nat: natPadrao(), nf: false, cli: null, venc: '', desc: 'Sinal · ' + desc, cat: '' });
        if (v > 0) E.mov.push({ id: uid(), data: hoje(), tipo: 'venda', valor: v, forma: 'fiado', nat: natPadrao(), nf: false, cli: c.id, venc: somaDias(hoje(), 15), desc: desc, cat: '' });
      } else if (v + sin > 0) {
        E.mov.push({ id: uid(), data: hoje(), tipo: 'venda', valor: arred(v + sin), forma: forma, nat: natPadrao(), nf: false, cli: null, venc: '', desc: desc + (sin ? ' (com sinal de ' + brl(sin) + ')' : ''), cat: '' });
      }
      concluir(); salvar(); fecharFolha(); toast('Atendimento concluído ✓'); rotear();
    };
    $('#atSem', f).onclick = function () { concluir(); salvar(); fecharFolha(); rotear(); };
  }

  /* ---------- orçamentos ---------- */
  ROTAS.orcamentos = function () {
    var lista = E.orc.slice().reverse();
    var html = topo('Orçamentos', 'Mande bonito no WhatsApp e cobre o sinal') + '<main><button class="btn mint cheio" id="oNovo">+ Novo orçamento</button>' +
      (lista.length ? '<div class="lista" style="margin-top:14px">' + lista.map(function (o) {
        var tot = o.itens.reduce(function (s, i) { return s + i.v; }, 0);
        return '<button class="item" data-o="' + o.id + '"><span class="av">' + esc(iniciais(o.cliNome)) + '</span><span class="meio"><b>Nº ' + o.num + ' · ' + esc(o.cliNome) + '</b><span>' + dma(o.data) + ' · <span class="tag ' + (o.status === 'recusado' ? 'vm' : o.status === 'aberto' ? 'am' : '') + '">' + o.status + '</span></span></span><span class="val">' + brl(tot) + '</span></button>';
      }).join('') + '</div>' : '<div class="lista" style="margin-top:14px"><div class="vazio"><span class="ic">📝</span>Nenhum orçamento ainda.<br>Faça um em 1 minuto e mande como imagem no WhatsApp.</div></div>') + '</main>';
    return { html: html, montar: function (el) {
      $('#oNovo', el).onclick = function () { abrirOrcamento(); };
      $$('[data-o]', el).forEach(function (b) { b.onclick = function () { verOrcamento(E.orc.filter(function (x) { return x.id === b.dataset.o; })[0]); }; });
    } };
  };
  function abrirOrcamento(o) {
    var novo = !o;
    o = o ? JSON.parse(JSON.stringify(o)) : { id: uid(), num: (E.cfg.orcNum || 0) + 1, data: hoje(), cliNome: '', fone: '', itens: [{ d: '', v: 0 }], obs: '', validade: 7, sinalPct: 0, status: 'aberto' };
    function linhas() {
      return o.itens.map(function (it, i) { return '<div style="display:grid;grid-template-columns:1fr 120px 36px;gap:8px;margin-top:8px"><input class="inp" data-d="' + i + '" placeholder="Serviço ou material" value="' + esc(it.d) + '"><input class="inp" data-v="' + i + '" inputmode="decimal" placeholder="R$" value="' + (it.v ? Motor.fmtBR(it.v) : '') + '"><button class="btn linha peq" data-x="' + i + '" aria-label="Tirar item" style="padding:0">✕</button></div>'; }).join('');
    }
    var f = abrirFolha('<h1>' + (novo ? 'Novo orçamento' : 'Editar orçamento') + '</h1>' +
      '<label class="campo"><span>Cliente</span><input class="inp" id="oCli" list="oCliL" value="' + esc(o.cliNome) + '" autocomplete="off"></label><datalist id="oCliL">' + E.cli.map(function (x) { return '<option value="' + esc(x.nome) + '">'; }).join('') + '</datalist>' +
      '<label class="campo"><span>WhatsApp</span><input class="inp" id="oFone" inputmode="tel" value="' + esc(o.fone) + '"></label>' +
      '<p style="font-weight:600;font-size:14.5px;margin-top:14px">Itens</p><div id="oItens">' + linhas() + '</div><button class="btn claro peq" style="margin-top:8px" id="oMais">+ Item</button>' +
      '<p style="margin-top:12px;font-weight:700">Total: <span id="oTot"></span></p>' +
      '<label class="campo"><span>Observações (prazo, forma de pagamento…)</span><textarea class="inp" id="oObs" placeholder="Ex.: Prazo de 5 dias úteis. Material incluso.">' + esc(o.obs) + '</textarea></label>' +
      '<div class="grade"><label class="campo"><span>Validade (dias)</span><input class="inp" id="oVal" inputmode="numeric" value="' + o.validade + '"></label><label class="campo"><span>Sinal para começar</span><select class="inp" id="oSin">' + [0, 30, 50, 100].map(function (p) { return '<option value="' + p + '" ' + (o.sinalPct === p ? 'selected' : '') + '>' + (p ? p + '%' : 'Sem sinal') + '</option>'; }).join('') + '</select></label></div>' +
      '<button class="btn cheio" style="margin-top:16px" id="oOk">Salvar e enviar</button>');
    function ler() {
      $$('[data-d]', f).forEach(function (x) { o.itens[+x.dataset.d].d = x.value; });
      $$('[data-v]', f).forEach(function (x) { o.itens[+x.dataset.v].v = arred(num(x.value)); });
      $('#oTot', f).textContent = brl(o.itens.reduce(function (s, i) { return s + i.v; }, 0));
    }
    function ligar() {
      $$('[data-x]', f).forEach(function (b) { b.onclick = function () { ler(); o.itens.splice(+b.dataset.x, 1); if (!o.itens.length) o.itens.push({ d: '', v: 0 }); $('#oItens', f).innerHTML = linhas(); ligar(); ler(); }; });
      $$('[data-v],[data-d]', f).forEach(function (x) { x.oninput = ler; });
    }
    ligar(); ler();
    $('#oMais', f).onclick = function () { ler(); o.itens.push({ d: '', v: 0 }); $('#oItens', f).innerHTML = linhas(); ligar(); ler(); var u = $$('[data-d]', f).pop(); if (u) u.focus(); };
    $('#oOk', f).onclick = function () {
      ler(); o.cliNome = $('#oCli', f).value.trim(); o.fone = $('#oFone', f).value.trim(); o.obs = $('#oObs', f).value.trim();
      o.validade = parseInt($('#oVal', f).value, 10) || 7; o.sinalPct = +$('#oSin', f).value;
      o.itens = o.itens.filter(function (i) { return i.d.trim() || i.v > 0; });
      if (!o.cliNome) { toast('Escreva o nome do cliente.'); return; }
      if (!o.itens.length) { o.itens = [{ d: '', v: 0 }]; toast('Coloque pelo menos um item.'); return; }
      var c = acharOuCriarCliente(o.cliNome, o.fone); o.cli = c.id; if (o.fone) c.fone = o.fone; else o.fone = c.fone || '';
      if (novo) { E.orc.push(o); E.cfg.orcNum = o.num; } else E.orc = E.orc.map(function (x) { return x.id === o.id ? o : x; });
      salvar(); fecharFolha(); verOrcamento(o);
    };
  }
  function textoOrc(o, code) {
    var tot = o.itens.reduce(function (s, i) { return s + i.v; }, 0), sinal = arred(tot * o.sinalPct / 100);
    var t = 'Olá, ' + primeiroNome(o.cliNome) + '! Segue o orçamento nº ' + o.num + (E.neg.nome ? ' (' + E.neg.nome + ')' : '') + ':\n\n' +
      o.itens.map(function (i) { return '• ' + (i.d || 'Item') + ': ' + brl(i.v); }).join('\n') + '\n\n*Total: ' + brl(tot) + '*' +
      (o.obs ? '\n' + o.obs : '') + '\nVálido até ' + dm(somaDias(o.data, o.validade)) + '.';
    if (sinal > 0) t += '\n\nPara começar, o sinal é de ' + brl(sinal) + ' (' + o.sinalPct + '%).' + (code ? ' Pix copia e cola:\n' + code : '');
    return t;
  }
  function verOrcamento(o) {
    var tot = o.itens.reduce(function (s, i) { return s + i.v; }, 0), sinal = arred(tot * o.sinalPct / 100);
    var code = sinal > 0 && pixPronto() ? codigoPix(sinal, 'ORC' + o.num, 'Sinal orcamento ' + o.num) : '';
    var txt = textoOrc(o, code);
    var f = abrirFolha('<h1>Orçamento nº ' + o.num + '</h1><p class="muted">' + esc(o.cliNome) + ' · ' + brl(tot) + ' · <span class="tag ' + (o.status === 'aberto' ? 'am' : o.status === 'recusado' || o.status === 'cancelado' ? 'vm' : '') + '">' + ({ aberto: 'enviado', aprovado: 'em andamento', concluido: 'concluído', recusado: 'recusado', cancelado: 'cancelado' }[o.status] || o.status) + '</span></p>' +
      '<div class="pixbox" style="white-space:pre-wrap;font-family:var(--body);font-size:14.5px;color:var(--ink)">' + esc(txt) + '</div>' +
      '<a class="btn wa cheio" style="margin-top:12px" target="_blank" rel="noopener" href="' + esc(linkWa(o.fone, txt)) + '">Mandar texto no WhatsApp</a>' +
      '<button class="btn claro cheio" style="margin-top:10px" id="ovImg">Mandar como imagem</button>' +
      (o.status === 'aberto' ? '<div class="linhaBtns"><button class="btn mint" id="ovAp">Cliente aprovou</button><button class="btn linha" id="ovRe">Recusou</button></div>' : '') +
      (o.status === 'aprovado' ? '<div class="linhaBtns">' + (sinal > 0 && !o.sinalPago ? '<button class="btn claro" id="ovSin">O sinal caiu</button>' : '') + '<button class="btn mint" id="ovFim">Serviço concluído</button></div><button class="btn linha cheio" style="margin-top:10px" id="ovCan">Cliente desistiu</button>' : '') +
      '<button class="btn linha cheio" style="margin-top:10px" id="ovEd">Editar</button>');
    $('#ovImg', f).onclick = function () {
      var img = cartaoImagem({ titulo: 'Orçamento nº ' + o.num + ' · válido até ' + dm(somaDias(o.data, o.validade)), para: o.cliNome, linhas: o.itens.map(function (i) { return [i.d || 'Item', brl(i.v)]; }), total: tot, rotTotal: 'Total', nota: o.obs + (sinal > 0 ? ' Sinal para começar: ' + brl(sinal) + '.' : ''), pix: code, rotPix: code ? 'Pix do sinal: ' + brl(sinal) : '' });
      compartilharImagem(img, 'orcamento-' + o.num + '.png', code ? 'Pix do sinal:\n' + code : '');
    };
    $('#ovEd', f).onclick = function () { abrirOrcamento(o); };
    if (o.status === 'aprovado') {
      if ($('#ovSin', f)) $('#ovSin', f).onclick = function () { o.sinalPago = sinal; E.orc = E.orc.map(function (x) { return x.id === o.id ? o : x; }); salvar(); fecharFolha(); toast('Sinal anotado ✓'); rotear(); };
      $('#ovCan', f).onclick = function () {
        confirmar('Cliente desistiu?', o.sinalPago ? 'Se você ficou com o sinal de ' + brl(o.sinalPago) + ', ele entra como venda. Se devolveu, apague depois em Lançamentos.' : 'O orçamento fica como cancelado.', 'Confirmar', function () {
          if (o.sinalPago) E.mov.push({ id: uid(), data: hoje(), tipo: 'venda', valor: o.sinalPago, forma: 'pix', nat: natPadrao(), nf: false, cli: null, venc: '', desc: 'Sinal retido · orçamento nº ' + o.num, cat: '' });
          o.status = 'cancelado'; E.orc = E.orc.map(function (x) { return x.id === o.id ? o : x; }); salvar(); rotear();
        });
      };
      $('#ovFim', f).onclick = function () {
        var g = abrirFolha('<h1>Serviço concluído ✓</h1><p class="muted">Vou lançar a venda de ' + brl(tot) + ' para ' + esc(o.cliNome) + ' hoje.</p>' +
          '<label class="campo"><span>Quanto já recebeu (sinal e pagamentos)</span><input class="inp" id="fimR" inputmode="decimal" value="' + Motor.fmtBR(o.sinalPago || 0) + '"></label>' +
          '<label class="campo"><span>O restante vai pagar até</span><input class="inp" type="date" id="fimV" value="' + hoje() + '"></label>' +
          '<button class="btn cheio" style="margin-top:16px" id="fimOk">Lançar venda</button>');
        $('#fimOk', g).onclick = function () {
          var rec = arred(Math.min(tot, num($('#fimR', g).value))), c = acharOuCriarCliente(o.cliNome, o.fone);
          E.mov.push({ id: uid(), data: hoje(), tipo: 'venda', valor: arred(tot), forma: 'fiado', nat: natPadrao(), nf: false, cli: c.id, venc: $('#fimV', g).value || hoje(), desc: 'Orçamento nº ' + o.num, cat: '' });
          if (rec > 0) E.mov.push({ id: uid(), data: hoje(), tipo: 'receb', valor: rec, forma: 'pix', cli: c.id, desc: 'Já recebido · orçamento nº ' + o.num });
          o.status = 'concluido'; E.orc = E.orc.map(function (x) { return x.id === o.id ? o : x; });
          salvar(); fecharFolha(); toast(tot - rec > 0 ? 'Venda lançada. Falta receber ' + brl(tot - rec) : 'Venda lançada e quitada ✓'); rotear();
        };
      };
    }
    if (o.status === 'aberto') {
      $('#ovRe', f).onclick = function () { o.status = 'recusado'; salvar(); fecharFolha(); rotear(); };
      $('#ovAp', f).onclick = function () {
        var g = abrirFolha('<h1>Aprovado! 🎉</h1><p class="muted">O orçamento fica "em andamento". Ele vira venda quando você marcar o serviço como concluído — é assim que conta para o MEI.</p>' +
          (sinal > 0 ? '<label class="check"><input type="checkbox" id="apS"> O sinal de ' + brl(sinal) + ' já caiu</label>' : '') +
          '<button class="btn cheio" style="margin-top:16px" id="apOk">Confirmar</button>');
        $('#apOk', g).onclick = function () {
          o.status = 'aprovado'; o.sinalPago = !!(sinal > 0 && $('#apS', g) && $('#apS', g).checked) ? sinal : 0;
          E.orc = E.orc.map(function (x) { return x.id === o.id ? o : x; });
          salvar(); fecharFolha(); toast('Orçamento aprovado ✓'); rotear();
        };
      };
    }
  }

  /* ---------- Mais ---------- */
  ROTAS.mais = function () {
    var f = [
      ['#/agenda', '📅', 'Agenda', 'Horários, lembrete e sinal por Pix'],
      ['#/orcamentos', '📝', 'Orçamentos', 'Bonito no WhatsApp, com sinal'],
      ['#/maquininha', '💳', 'Conferir maquininha', 'Acha taxa cobrada a mais'],
      ['#/ifood', '🛵', 'Conferir iFood', 'Comissão, taxas e mensalidade'],
      ['#/calculadora', '🧮', 'Quanto cobrar', 'Para receber limpo no cartão e no iFood'],
      ['#/mei', '🏛️', 'MEI: limite e DAS', 'Limite, DAS e relatório mensal'],
      ['#/lancamentos', '📋', 'Lançamentos', 'Tudo do mês, para editar'],
      ['#/backup', '💾', 'Backup', 'Salve no WhatsApp ou Drive'],
      ['#/ajustes', '⚙️', 'Ajustes', 'Negócio, Pix, taxas'],
      ['#/sobre', '💬', 'Ajuda e privacidade', 'Como o app cuida dos seus dados']
    ];
    var html = topo('Ferramentas', E.neg.nome) + '<main><div class="grade">' + f.map(function (x) { return '<a class="ferr" href="' + x[0] + '"><span class="i">' + x[1] + '</span><b>' + x[2] + '</b><span>' + x[3] + '</span></a>'; }).join('') + '</div>' +
      '<p class="rodape">Micro no Controle · soluções com sabedoria</p></main>';
    return { html: html };
  };

  /* ---------- conferência (maquininha e iFood) ---------- */
  var xlsxCarregando = null;
  function carregarXLSX() {
    if (window.XLSX) return Promise.resolve();
    if (xlsxCarregando) return xlsxCarregando;
    xlsxCarregando = new Promise(function (ok, erro) {
      var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = function () { ok(); }; s.onerror = function () { xlsxCarregando = null; erro(new Error('Sem internet para abrir Excel. Tente de novo ou exporte em CSV.')); };
      document.head.appendChild(s);
    });
    return xlsxCarregando;
  }
  // Lê o arquivo e devolve a primeira tabela que o detector reconhece
  function lerArquivo(file, detector) {
    var nome = (file.name || '').toLowerCase();
    if (/\.pdf$/.test(nome)) return Promise.reject(new Error('Esse arquivo é PDF. No portal, escolha exportar em Excel (XLSX) ou CSV.'));
    if (/\.(csv|txt)$/.test(nome)) {
      return file.arrayBuffer().then(function (buf) {
        var t = new TextDecoder('utf-8').decode(buf);
        if (t.indexOf('�') >= 0) t = new TextDecoder('windows-1252').decode(buf);
        var rows = Motor.lerCSV(t), d = detector(rows);
        if (!d.ok) throw new Error('Não reconheci as colunas desse arquivo.');
        return { rows: rows, det: d };
      });
    }
    return carregarXLSX().then(function () { return file.arrayBuffer(); }).then(function (buf) {
      var wb = XLSX.read(buf, { type: 'array', cellDates: true });
      for (var i = 0; i < wb.SheetNames.length; i++) {
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[i]], { header: 1, raw: true, defval: '' });
        var d = detector(rows); if (d.ok) return { rows: rows, det: d };
      }
      throw new Error('Não reconheci as colunas desse arquivo.');
    });
  }
  function areaArquivo(id, rot) {
    return '<label class="drop"><input type="file" id="' + id + '" accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"><b>📂 ' + rot + '</b><span class="muted peq">Excel (XLSX) ou CSV · o arquivo não sai do seu celular</span></label>';
  }
  function guardarConf(tipo, achado, ini, fim, qtd) {
    E.conf.push({ id: uid(), tipo: tipo, data: hoje(), achado: achado, periodo: (ini ? dm(iso(ini)) : '') + (fim ? ' a ' + dm(iso(fim)) : ''), qtd: qtd });
    salvar();
  }
  function historicoConf(tipo) {
    var h = E.conf.filter(function (x) { return x.tipo === tipo; }).slice(-5).reverse();
    if (!h.length) return '';
    return '<h2>Conferências anteriores</h2><div class="lista">' + h.map(function (x) { return '<div class="item"><span class="meio"><b>' + dma(x.data) + '</b><span>' + esc(x.periodo) + ' · ' + x.qtd + (tipo === 'ifood' ? ' pedidos' : ' vendas') + '</span></span><span class="val ' + (x.achado > 0 ? 'menos' : 'mais') + '">' + (x.achado > 0 ? brl(x.achado) : 'tudo certo') + '</span></div>'; }).join('') + '</div>';
  }

  ROTAS.maquininha = function () {
    var tx = E.neg.taxas, temContrato = ['debito', 'credito_vista', 'credito_2a6', 'credito_7a12'].some(function (k) { return num(tx[k]) > 0; });
    var html = topo('Conferir maquininha', 'A taxa cobrada bate com a combinada?') + '<main>' +
      '<p class="muted">Suba o extrato de vendas da sua maquininha (Cielo, Stone, Rede, PagBank, Mercado Pago, Getnet, Ton…). O app olha venda por venda e mostra quanto foi cobrado acima.</p>' +
      areaArquivo('mqArq', 'Escolher o extrato') +
      '<button class="btn linha cheio" style="margin-top:10px" id="mqEx">Testar com um extrato de exemplo</button>' +
      (temContrato ? '<p class="peq muted" style="margin-top:10px">Comparando com as suas taxas de <a href="#/ajustes">Ajustes</a>.</p>' : '<div class="dica">Dica: coloque as taxas do seu contrato em <a href="#/ajustes">Ajustes</a>. Sem elas, o app usa a taxa mais comum do próprio extrato e acha as vendas fora do padrão.</div>') +
      '<details class="como"><summary>Como baixar o extrato?</summary><ul><li><b>Cielo:</b> site ou app Cielo › Vendas › Exportar (Excel).</li><li><b>Stone / Ton:</b> portal › Extrato de vendas › Exportar.</li><li><b>Rede:</b> portal userede › Vendas › Exportar Excel.</li><li><b>PagBank:</b> Extrato de vendas › Exportar CSV.</li><li><b>Mercado Pago:</b> Relatórios › Vendas › Baixar.</li></ul><p style="margin-top:8px">Se só tiver no computador, mande o arquivo para o seu WhatsApp e abra daqui.</p></details>' +
      '<div id="mqRes"></div>' + historicoConf('maquininha') + '</main>';
    return { html: html, montar: function (el) {
      function rodar(rows, det, exemplo) {
        var v = Motor.vendas(rows, det);
        var contratos = {}; Object.keys(tx).forEach(function (k) { var n = num(tx[k]); if (n > 0) contratos[k] = n; });
        var a = Motor.auditar(v.vendas, exemplo ? {} : contratos);
        if (!exemplo) guardarConf('maquininha', a.totalAcima, a.inicio, a.fim, a.qtd);
        track('ConferiuMaquininha', { achado: a.totalAcima });
        $('#mqRes', el).innerHTML = '<div class="card" style="margin-top:16px">' + (exemplo ? '<span class="tag am">exemplo fictício</span>' : '') +
          '<p class="muted" style="margin-top:6px">' + a.qtd + ' vendas · ' + (a.inicio ? dm(iso(a.inicio)) + ' a ' + dm(iso(a.fim)) : '') + ' · taxa média ' + a.taxaMedia.toFixed(2).replace('.', ',') + '%</p>' +
          (a.totalAcima > 0 ? '<p style="margin-top:8px;font-weight:600">Cobrado acima do combinado:</p><div class="achado">' + brl(a.totalAcima) + '</div><p class="muted">em ' + a.acima.length + ' vendas' + (a.anualAcima ? ' · no ritmo de ' + brl(a.anualAcima) + ' por ano' : '') + '</p>' :
            '<p class="achado" style="color:var(--green);font-size:30px">Tudo certo ✓</p><p class="muted">Nenhuma venda com taxa acima da referência.</p>') +
          '<table class="t" style="margin-top:12px"><tr><th>Tipo</th><th class="n">Referência</th><th class="n">A mais</th></tr>' + a.grupos.map(function (g) { return '<tr><td>' + g.nome + '<br><span class="muted peq">' + g.qtd + ' vendas · média ' + g.media.toFixed(2).replace('.', ',') + '%</span></td><td class="n">' + (g.ref != null ? g.ref.toFixed(2).replace('.', ',') + '%' : '—') + '<br><span class="muted peq">' + (g.fonte === 'contrato' ? 'seu contrato' : 'padrão do extrato') + '</span></td><td class="n">' + brl(g.acimaValor) + '</td></tr>'; }).join('') + '</table>' +
          (a.acima.length ? '<details class="como"><summary>Ver as vendas cobradas a mais (' + a.acima.length + ')</summary><table class="t">' + a.acima.slice(0, 80).map(function (x) { return '<tr><td>' + (x.venda.data ? dm(iso(x.venda.data)) : '') + ' · ' + esc(x.venda.bandeira) + '<br><span class="muted peq">' + brl(x.venda.bruto) + ' a ' + x.venda.taxa.toFixed(2).replace('.', ',') + '% (ref. ' + x.ref.toFixed(2).replace('.', ',') + '%)</span></td><td class="n">' + brl(x.dif) + '</td></tr>'; }).join('') + '</table></details>' +
            '<div class="dica"><b>O que fazer:</b> ligue ou abra chamado na sua maquininha com esta lista, peça a correção da taxa e o estorno da diferença. Taxa promocional que acabou é o motivo mais comum.</div>' : '') +
          '</div>';
        $('#mqRes', el).scrollIntoView({ behavior: 'smooth' });
      }
      $('#mqEx', el).onclick = function () { var rows = Motor.exemplo(); rodar(rows, Motor.detectar(rows), true); };
      $('#mqArq', el).onchange = function (e) {
        var file = e.target.files[0]; if (!file) return;
        $('#mqRes', el).innerHTML = '<p class="muted" style="margin-top:14px">Lendo o arquivo…</p>';
        lerArquivo(file, Motor.detectar).then(function (r) { rodar(r.rows, r.det, false); }).catch(function (err) {
          $('#mqRes', el).innerHTML = '<div class="aviso">' + esc(err.message) + ' Confira se é o extrato de <b>vendas</b> (com valor bruto e taxa ou valor líquido). Se continuar, mande o arquivo para micronocontrole@gmail.com que a gente ajusta o leitor.</div>';
        });
        e.target.value = '';
      };
    } };
  };

  ROTAS.ifood = function () {
    var cfg = E.neg.ifood, pl = IFood.PLANOS;
    var html = topo('Conferir iFood', 'Comissão, taxas, mensalidade e cancelamentos') + '<main>' +
      '<p class="muted">Suba o relatório financeiro do Portal do Parceiro. O app confere pedido a pedido se a comissão e a taxa de pagamento bateram com o seu plano, e acha mensalidade em dobro e descontos estranhos.</p>' +
      '<p style="font-weight:600;font-size:14.5px;margin-top:14px">Seu plano</p><div class="chips" style="margin-top:8px" id="ifPl">' +
      [['basico', 'Básico (entrega própria)'], ['entrega', 'Entrega (entregador iFood)'], ['outro', 'Outro / contrato próprio']].map(function (p) { return '<button class="chip ' + (cfg.plano === p[0] ? 'on' : '') + '" data-p="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
      '<div class="grade"><label class="campo"><span>Comissão (%)</span><input class="inp" id="ifCom" inputmode="decimal"></label><label class="campo"><span>Taxa de pagamento online (%)</span><input class="inp" id="ifTx" inputmode="decimal"></label></div>' +
      '<p class="peq muted" style="margin-top:6px">Valores públicos de out/2026: Básico 12% + 3,2%; Entrega 23% + 3,5%; mensalidade a partir de R$ 1.800/mês em vendas. Se o seu contrato for diferente, corrija aqui.</p>' +
      areaArquivo('ifArq', 'Escolher o relatório do iFood') +
      '<button class="btn linha cheio" style="margin-top:10px" id="ifEx">Testar com um relatório de exemplo</button>' +
      '<details class="como"><summary>Como baixar o relatório?</summary><ol><li>Entre no <b>Portal do Parceiro</b> (portal.ifood.com.br), de preferência no computador.</li><li>Vá em <b>Financeiro</b> e abra o relatório de <b>conciliação</b> ou o <b>extrato</b> do período.</li><li>Clique em <b>Exportar / Baixar</b> em Excel ou CSV.</li><li>Abra o arquivo aqui (pode mandar para o seu WhatsApp e abrir pelo celular).</li></ol></details>' +
      '<div id="ifRes"></div>' + historicoConf('ifood') + '</main>';
    return { html: html, montar: function (el) {
      function preencher() {
        var p = pl[cfg.plano];
        $('#ifCom', el).value = cfg.comissao !== '' ? cfg.comissao : p ? String(p.comissao).replace('.', ',') : '';
        $('#ifTx', el).value = cfg.taxaPag !== '' ? cfg.taxaPag : p ? String(p.taxaPag).replace('.', ',') : '';
      }
      preencher();
      $$('#ifPl [data-p]', el).forEach(function (b) { b.onclick = function () { cfg.plano = b.dataset.p; cfg.comissao = ''; cfg.taxaPag = ''; $$('#ifPl [data-p]', el).forEach(function (x) { x.classList.toggle('on', x === b); }); preencher(); salvar(); }; });
      $('#ifCom', el).onchange = function () { cfg.comissao = this.value; salvar(); };
      $('#ifTx', el).onchange = function () { cfg.taxaPag = this.value; salvar(); };
      function rodar(rows, det, exemplo) {
        var lido = IFood.ler(rows, det);
        var r = IFood.conferir(lido, { comissao: num($('#ifCom', el).value), taxaPag: num($('#ifTx', el).value) });
        var s = r.somas;
        if (!exemplo) guardarConf('ifood', r.totalAchado, r.inicio, r.fim, s.pedidos);
        track('ConferiuIfood', { achado: r.totalAchado });
        var linhas = [['Vendas (itens)', s.bruto], ['Comissão', -s.comissao], ['Taxa de pagamento online', -s.taxaPag], ['Promoções bancadas pela loja', -s.promoLoja], ['Mensalidade', -s.mensalidade], ['Anúncios', -s.anuncios], ['Entregas cobradas', -s.entregaCobrada], ['Cancelamentos descontados', -s.cancelamentos], ['Antecipação', -s.antecipacao], ['Outros descontos', -s.outros]].filter(function (x, i) { return i === 0 || x[1] !== 0; });
        $('#ifRes', el).innerHTML = '<div class="card" style="margin-top:16px">' + (exemplo ? '<span class="tag am">exemplo fictício</span>' : '') +
          '<p class="muted" style="margin-top:6px">' + s.pedidos + ' pedidos' + (s.cancelados ? ' + ' + s.cancelados + ' cancelados' : '') + (r.inicio ? ' · ' + dm(iso(r.inicio)) + ' a ' + dm(iso(r.fim)) : '') + '</p>' +
          (r.totalAchado > 0 ? '<p style="margin-top:8px;font-weight:600">Cobrado a mais (para pedir de volta):</p><div class="achado">' + brl(r.totalAchado) + '</div>' : '<p class="achado" style="color:var(--green);font-size:30px">Nada cobrado a mais ✓</p>') +
          '<div class="alerta mt"><span class="ic">💡</span><span class="tx"><b>De cada R$ 100 vendidos no iFood, sobraram ' + brl(r.sobraDe100 || 0) + '</b><span>Desconto total de ' + r.efetivo.toFixed(1).replace('.', ',') + '% sobre os itens.</span></span></div>' +
          '<table class="t" style="margin-top:12px">' + linhas.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + brl(x[1]) + '</td></tr>'; }).join('') + '</table>' +
          '<p class="peq muted" style="margin-top:8px">Referência: comissão ' + (r.refCom != null ? String(r.refCom).replace('.', ',') + '%' : '—') + ' (' + (r.fonteCom === 'contrato' ? 'seu plano' : 'padrão do relatório') + ') · taxa ' + (r.refTx != null ? String(r.refTx).replace('.', ',') + '%' : '—') + '</p>' +
          (r.achados.length ? '<details class="como" open><summary>O que foi cobrado a mais (' + r.achados.length + ')</summary><table class="t">' + r.achados.slice(0, 80).map(function (x) { return '<tr><td>' + esc(x.tipo) + '<br><span class="muted peq">' + (x.pedido !== '—' ? 'Pedido ' + esc(x.pedido) + ' · ' : '') + (x.data ? dm(iso(x.data)) : x.mes || '') + (x.cobrado ? ' · ' + x.cobrado.toFixed(2).replace('.', ',') + '%' : '') + '</span></td><td class="n">' + brl(x.dif) + '</td></tr>'; }).join('') + '</table></details>' : '') +
          (r.conferir.length ? '<details class="como"><summary>Para conferir com calma (' + r.conferir.length + ')</summary><table class="t">' + r.conferir.slice(0, 60).map(function (x) { return '<tr><td>' + esc(x.tipo) + '<br><span class="muted peq">' + (x.pedido && x.pedido !== '—' ? 'Pedido ' + esc(x.pedido) + ' · ' : '') + esc(x.desc || x.mes || '') + '</span></td><td class="n">' + brl(x.valor) + '</td></tr>'; }).join('') + '</table></details>' : '') +
          (r.achados.length || r.conferir.length ? '<div class="dica"><b>O que fazer:</b> no Portal do Parceiro, abra um chamado em Ajuda com o número de cada pedido e a linha do relatório. Cancelamento por erro do cliente ou do entregador pode ser contestado em até 7 dias.</div>' : '') +
          '</div>';
        $('#ifRes', el).scrollIntoView({ behavior: 'smooth' });
      }
      $('#ifEx', el).onclick = function () { var rows = IFood.exemplo(); rodar(rows, IFood.detectar(rows), true); };
      $('#ifArq', el).onchange = function (e) {
        var file = e.target.files[0]; if (!file) return;
        $('#ifRes', el).innerHTML = '<p class="muted" style="margin-top:14px">Lendo o relatório…</p>';
        lerArquivo(file, IFood.detectar).then(function (r) { rodar(r.rows, r.det, false); }).catch(function (err) {
          $('#ifRes', el).innerHTML = '<div class="aviso">' + esc(err.message) + ' Use o relatório financeiro (conciliação ou extrato) do Portal do Parceiro. Se não funcionar, mande para micronocontrole@gmail.com <b>apagando dados de clientes</b>, que a gente ajusta o leitor.</div>';
        });
        e.target.value = '';
      };
    } };
  };

  /* ---------- calculadora ---------- */
  ROTAS.calculadora = function () {
    var tx = E.neg.taxas, cfgI = E.neg.ifood, pl = IFood.PLANOS[cfgI.plano] || IFood.PLANOS.basico;
    var mods = [['debito', 'Débito', 1.99], ['credito_vista', 'Crédito à vista', 4.98], ['credito_2a6', 'Crédito 2 a 6x', 9.9], ['credito_7a12', 'Crédito 7 a 12x', 15.9]];
    var html = topo('Quanto cobrar', 'Para receber o valor limpo') + '<main>' +
      '<label class="campo"><span>Quero receber limpo</span><input class="inp valor" id="caV" inputmode="decimal" placeholder="R$ 0,00" autofocus></label>' +
      '<h2>Na maquininha</h2><div class="lista">' + mods.map(function (m) { var t = num(tx[m[0]]); return '<div class="item"><span class="meio"><b>' + m[1] + '</b><span>taxa <input class="inp" data-t="' + m[0] + '" inputmode="decimal" style="width:76px;min-height:34px;padding:4px 8px;font-size:15px;display:inline-block" value="' + String(t > 0 ? t : m[2]).replace('.', ',') + '">%' + (t > 0 ? '' : ' <span class="tag am">exemplo</span>') + '</span></span><span class="val" data-r="' + m[0] + '">—</span></div>'; }).join('') + '</div>' +
      '<p class="peq muted" style="margin-top:8px">No parcelado, use a taxa total que a maquininha desconta quando você repassa os juros (veja no app dela). As taxas ficam salvas quando você muda.</p>' +
      '<h2>No iFood</h2><div class="lista"><div class="item"><span class="meio"><b>Preço no cardápio</b><span>' + esc(pl.nome) + ' · ' + String(num(cfgI.comissao) || pl.comissao).replace('.', ',') + '% + ' + String(num(cfgI.taxaPag) || pl.taxaPag).replace('.', ',') + '%</span></span><span class="val" id="caIf">—</span></div></div>' +
      '<div class="dica" style="margin-top:14px">Conta usada: preço = valor limpo ÷ (1 − taxa). Ex.: para receber R$ 100 com 4,98% de taxa, cobre R$ 105,24.</div></main>';
    return { html: html, montar: function (el) {
      function calc() {
        var v = num($('#caV', el).value);
        mods.forEach(function (m) { var t = num($('[data-t="' + m[0] + '"]', el).value); $('[data-r="' + m[0] + '"]', el).textContent = v > 0 && t < 100 ? brl(Math.ceil(v / (1 - t / 100) * 100) / 100) : '—'; });
        var ti = (num(cfgI.comissao) || pl.comissao) + (num(cfgI.taxaPag) || pl.taxaPag);
        $('#caIf', el).textContent = v > 0 ? brl(Math.ceil(v / (1 - ti / 100) * 100) / 100) : '—';
      }
      $('#caV', el).oninput = calc;
      $$('[data-t]', el).forEach(function (i) { i.oninput = calc; i.onchange = function () { E.neg.taxas[i.dataset.t] = i.value; salvar(); }; });
    } };
  };

  /* ---------- MEI ---------- */
  ROTAS.mei = function () {
    var ano = new Date().getFullYear(), rec = receitaAno(ano), lim = limiteAno(ano), pct = rec / lim * 100;
    var mesesRest = 12 - new Date().getMonth(), sobra = Math.max(0, lim - rec);
    var compet = ymSoma(ymDe(hoje()), -1), ult6 = [];
    for (var i = 1; i <= 6; i++) ult6.push(ymSoma(ymDe(hoje()), -i));
    var anoAnt = ano - 1, recAnt = receitaAno(anoAnt), recAntCI = 0, recAntS = 0;
    E.mov.forEach(function (m) { if (m.tipo === 'venda' && +m.data.slice(0, 4) === anoAnt) { if (m.nat === 'servico') recAntS += m.valor; else recAntCI += m.valor; } });
    var html = topo('MEI', 'Limite, DAS e relatórios', '#/mais') + '<main>' +
      (!E.neg.mei ? '<div class="aviso">Você marcou que não é MEI. O limite e o DAS são do MEI; o relatório mensal serve para qualquer pequeno negócio. <a href="#/ajustes">Mudar</a></div>' : '') +
      '<div class="card"><p class="muted peq">Faturamento de ' + ano + ' (valor cheio das vendas, no dia da venda)</p><div style="font-family:var(--display);font-weight:800;font-size:32px">' + brl(rec) + '</div>' +
      '<div class="barraProg ' + (pct >= 100 ? 'vm' : pct >= 80 ? 'am' : '') + '"><i style="width:' + Math.min(100, pct).toFixed(1) + '%"></i></div>' +
      '<p class="peq"><b>' + pct.toFixed(0) + '%</b> do limite de ' + brl(lim) + (E.neg.abertura && +E.neg.abertura.slice(0, 4) === ano ? ' (proporcional: abriu em ' + MESES[+E.neg.abertura.slice(5, 7) - 1] + ')' : '') + '</p>' +
      (pct < 100 ? '<p class="peq muted" style="margin-top:4px">Ainda pode faturar ' + brl(sobra) + ' este ano, cerca de ' + brl(sobra / mesesRest) + ' por mês até dezembro.</p>' :
        '<div class="aviso">Passou do limite. Até 20% acima (' + brl(lim * 1.2) + '): você sai do MEI em janeiro do ano que vem e paga um DAS a mais sobre o excesso. Acima de 20%: o desenquadramento volta para o começo do ano. Fale com um contador.</div>') +
      '<p class="peq muted" style="margin-top:8px">Limite: R$ 81 mil em 2026, R$ 110 mil em 2027 e R$ 140 mil a partir de 2028 (Lei Complementar 238/2026). Conferido em 29/10/2026.' + (num(E.neg.limite) > 0 ? ' Você definiu um limite próprio em Ajustes.' : '') + '</p></div>' +
      '<h2>DAS (vence todo dia 20)</h2><div class="lista">' + ult6.map(function (ym) { var pago = !!E.das[ym]; return '<div class="item"><span class="meio"><b style="text-transform:capitalize">' + mesNome(ym) + '</b><span>vence 20/' + ymSoma(ym, 1).slice(5, 7) + '</span></span><button class="btn peq ' + (pago ? 'claro' : 'linha') + '" data-das="' + ym + '">' + (pago ? '✓ Pago' : 'Marcar pago') + '</button></div>'; }).join('') + '</div>' +
      '<p class="peq muted" style="margin-top:8px">Pague pelo app MEI (gov.br) ou no Portal do Simples Nacional (PGMEI). Se cair em fim de semana ou feriado, vale o próximo dia útil.</p>' +
      '<h2>Relatório Mensal das Receitas Brutas</h2><p class="muted peq">O MEI deve preencher todo mês e guardar junto com as notas. O app monta com o que você lançou.</p>' +
      '<div class="linhaBtns"><select class="inp" id="rmMes" style="flex:1">' + [ymDe(hoje())].concat(ult6).map(function (ym) { return '<option value="' + ym + '"' + (ym === compet ? ' selected' : '') + '>' + mesNome(ym) + '</option>'; }).join('') + '</select><button class="btn" id="rmVer">Gerar</button></div>' +
      '<h2>Declaração anual (DASN-SIMEI)</h2><div class="card"><p class="peq muted">Para entregar até 31 de maio de ' + ano + ', sobre ' + anoAnt + ':</p>' +
      '<table class="t"><tr><td>Receita bruta total de ' + anoAnt + '</td><td class="n"><b>' + brl(recAnt) + '</b></td></tr><tr><td>Comércio e indústria</td><td class="n">' + brl(recAntCI) + '</td></tr><tr><td>Serviços</td><td class="n">' + brl(recAntS) + '</td></tr></table>' +
      (recAnt === 0 ? '<p class="peq muted" style="margin-top:8px">Sem lançamentos de ' + anoAnt + ' no app. Use seus registros do ano passado.</p>' : '') + '</div>' +
      '<p class="peq muted" style="margin-top:14px">O app ajuda a organizar, mas não substitui um contador. Na dúvida, confirme no Portal do Empreendedor (gov.br/mei).</p></main>';
    return { html: html, montar: function (el) {
      $$('[data-das]', el).forEach(function (b) { b.onclick = function () { var k = b.dataset.das; if (E.das[k]) delete E.das[k]; else E.das[k] = hoje(); salvar(); rotear(); }; });
      $('#rmVer', el).onclick = function () { relatorioMensal($('#rmMes', el).value); };
    } };
  };
  function relatorioMensal(ym) {
    var r = receitasMes(ym), p = ym.split('-');
    var linha = function (rot, v) { return '<tr><td>' + rot + '</td><td class="n">' + brl(v) + '</td></tr>'; };
    var bloco = function (tit, x, n) { return '<tr><th colspan="2">' + n + ' – ' + tit + '</th></tr>' + linha('Com dispensa de emissão de documento fiscal (sem nota)', x[0]) + linha('Com documento fiscal emitido (com nota)', x[1]) + linha('<b>Total</b>', x[0] + x[1]); };
    var total = r.comercio[0] + r.comercio[1] + r.industria[0] + r.industria[1] + r.servico[0] + r.servico[1];
    var html = '<h3>RELATÓRIO MENSAL DAS RECEITAS BRUTAS</h3><table><tr><td>CNPJ: ' + esc(E.neg.cnpj || '__________________') + '</td></tr><tr><td>Empreendedor individual: ' + esc(E.neg.dono || E.neg.nome || '') + '</td></tr><tr><td>Período de apuração: ' + MESES[+p[1] - 1] + ' de ' + p[0] + '</td></tr></table>' +
      '<table>' + bloco('Receita bruta mensal – revenda de mercadorias (comércio)', r.comercio, 'I') + bloco('Receita bruta mensal – venda de produtos industrializados (indústria)', r.industria, 'II') + bloco('Receita bruta mensal – prestação de serviços', r.servico, 'III') +
      '<tr><th>IV – Total geral das receitas brutas no mês (I + II + III)</th><td class="n"><b>' + brl(total) + '</b></td></tr></table>' +
      '<p style="margin-top:14px">LOCAL E DATA: ______________________, ____/____/______</p><p style="margin-top:28px">ASSINATURA DO EMPRESÁRIO: _______________________________________</p>' +
      '<p style="margin-top:14px;font-size:11px">Encontram-se anexados a este relatório os documentos fiscais comprobatórios das entradas de mercadorias e serviços tomados referentes ao período, e as notas fiscais emitidas.</p>';
    var f = abrirFolha('<h1>Relatório de ' + mesNome(ym) + '</h1><div class="card" style="margin-top:12px;overflow:auto"><div style="font-size:13.5px">' + html.replace(/<h3>.*?<\/h3>/, '') + '</div></div>' +
      (E.neg.cnpj ? '' : '<div class="aviso">Coloque seu CNPJ em <a href="#/ajustes">Ajustes</a> para sair no relatório.</div>') +
      '<button class="btn cheio" style="margin-top:14px" id="rmImp">Imprimir ou salvar PDF</button>');
    $('#rmImp', f).onclick = function () {
      $('#impressao').innerHTML = html; document.body.classList.add('imprimindo');
      setTimeout(function () { window.print(); setTimeout(function () { document.body.classList.remove('imprimindo'); }, 400); }, 50);
    };
  }

  /* ---------- backup ---------- */
  function nomeBackup() { return 'micro-no-controle-backup-' + hoje() + '.json'; }
  ROTAS.backup = function () {
    var ult = E.cfg.ultimoBackup;
    var html = topo('Backup', 'Para não perder nada', '#/mais') + '<main>' +
      '<div class="card"><p>Seus dados ficam <b>só neste celular</b>. Se ele quebrar, for roubado ou você limpar o navegador, eles somem. Por isso, uma vez por semana, salve uma cópia.</p>' +
      '<p class="peq muted" style="margin-top:8px">Último backup: <b>' + (ult ? dma(ult) : 'nunca') + '</b> · ' + E.mov.length + ' lançamentos, ' + E.cli.length + ' clientes</p>' +
      '<button class="btn mint cheio" style="margin-top:14px" id="bkSalvar">Salvar backup agora</button>' +
      '<p class="peq muted" style="margin-top:8px">Dica: mande o arquivo para você mesmo no WhatsApp ou salve no Google Drive.</p></div>' +
      '<h2>Trocou de celular?</h2><div class="card"><p class="peq">Abra o app no celular novo e escolha o último arquivo de backup. Tudo volta como estava.</p>' +
      '<label class="drop"><input type="file" id="bkArq" accept=".json,application/json"><b>📂 Restaurar de um arquivo</b><span class="muted peq">substitui os dados deste aparelho</span></label></div>' +
      '<h2>Zona de cuidado</h2><button class="btn verm cheio" id="bkApagar">Apagar todos os dados deste aparelho</button></main>';
    return { html: html, montar: function (el) {
      $('#bkSalvar', el).onclick = function () {
        var blob = new Blob([JSON.stringify(E)], { type: 'application/json' }), nome = nomeBackup();
        var file = new File([blob], nome, { type: 'application/json' });
        function marcar() { E.cfg.ultimoBackup = hoje(); salvar(); rotear(); toast('Backup salvo ✓'); }
        if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: 'Backup Micro no Controle' }).then(marcar).catch(function () {});
        else { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); marcar(); }
      };
      $('#bkArq', el).onchange = function (e) {
        var file = e.target.files[0]; if (!file) return;
        file.text().then(function (t) {
          var x = JSON.parse(t);
          if (!x || !x.neg || !Array.isArray(x.mov)) throw new Error('arquivo');
          confirmar('Restaurar backup?', 'Backup de ' + (x.neg.nome || 'negócio') + ' com ' + x.mov.length + ' lançamentos. Os dados atuais deste aparelho serão substituídos.', 'Restaurar', function () {
            E = completar(x); E.cfg.onboard = true; salvar(); toast('Backup restaurado ✓'); ir('#/inicio');
          });
        }).catch(function () { toast('Esse arquivo não é um backup do Micro no Controle.'); });
        e.target.value = '';
      };
      $('#bkApagar', el).onclick = function () {
        var f = abrirFolha('<h1>Apagar tudo?</h1><p class="muted">Isso apaga lançamentos, clientes, agenda e ajustes deste aparelho. Faça um backup antes. Para confirmar, escreva <b>APAGAR</b>.</p><input class="inp" id="apg" style="margin-top:12px" autocomplete="off"><button class="btn verm cheio" style="margin-top:12px" id="apgOk">Apagar tudo</button>');
        $('#apgOk', f).onclick = function () { if ($('#apg', f).value.trim().toUpperCase() !== 'APAGAR') { toast('Escreva APAGAR para confirmar.'); return; } E = novoEstado(); salvar(); fecharFolha(); location.hash = ''; rotear(); };
      };
    } };
  };

  /* ---------- ajustes ---------- */
  ROTAS.ajustes = function () {
    var n = E.neg, p = n.pix, t = n.taxas;
    function inp(id, rot, val, extra) { return '<label class="campo"><span>' + rot + '</span><input class="inp" id="' + id + '" value="' + esc(val) + '" ' + (extra || '') + '></label>'; }
    var html = topo('Ajustes', 'Salva sozinho quando você muda', '#/mais') + '<main>' +
      '<h2 style="margin-top:4px">Seu negócio</h2><div class="card">' + inp('aNome', 'Nome do negócio', n.nome) + inp('aDono', 'Seu nome (aparece nas mensagens)', n.dono) +
      '<label class="campo"><span>Setor</span><select class="inp" id="aSetor">' + Object.keys(SETORES).map(function (k) { return '<option value="' + k + '"' + (n.setor === k ? ' selected' : '') + '>' + SETORES[k].nome + '</option>'; }).join('') + '</select></label>' +
      '<label class="campo"><span>O que você vende (para o relatório do MEI)</span><select class="inp" id="aAtiv"><option value="">Automático pelo setor (' + NAT[(SETORES[n.setor] || SETORES.outro).nat] + ')</option>' + Object.keys(NAT).map(function (k) { return '<option value="' + k + '"' + (n.atividade === k ? ' selected' : '') + '>Só ' + NAT[k] + '</option>'; }).join('') + '<option value="ambos"' + (n.atividade === 'ambos' ? ' selected' : '') + '>Mais de um tipo (pergunta em cada venda)</option></select></label>' +
      '<label class="check"><input type="checkbox" id="aIfood" ' + (n.usaIfood ? 'checked' : '') + '> Vendo pelo iFood</label></div>' +
      '<h2>MEI</h2><div class="card"><label class="check" style="margin-top:0"><input type="checkbox" id="aMei" ' + (n.mei ? 'checked' : '') + '> Sou MEI</label>' + inp('aCnpj', 'CNPJ (opcional, sai no relatório mensal)', n.cnpj, 'inputmode="numeric"') +
      '<label class="campo"><span>Data de abertura do MEI (se abriu este ano, o limite é proporcional)</span><input class="inp" type="date" id="aAb" value="' + esc(n.abertura) + '"></label>' + inp('aLim', 'Limite anual próprio (deixe vazio para usar o da lei)', n.limite, 'inputmode="decimal" placeholder="Automático"') + '</div>' +
      '<h2>Pix para cobranças</h2><div class="card"><label class="campo" style="margin-top:0"><span>Tipo de chave</span><select class="inp" id="aPt"><option value="">Escolha…</option>' + [['celular', 'Celular'], ['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['email', 'E-mail'], ['aleatoria', 'Aleatória']].map(function (x) { return '<option value="' + x[0] + '"' + (p.tipo === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      inp('aPc', 'Chave', p.chave, 'autocomplete="off"') + '<p class="peq" id="aPe" style="color:var(--red);margin-top:6px"></p>' + inp('aPn', 'Nome do recebedor (como no banco)', p.nome) + inp('aPci', 'Cidade', p.cidade) +
      '<button class="btn claro peq" style="margin-top:12px" id="aPteste">Testar: gerar Pix de R$ 0,01</button><div id="aPres"></div></div>' +
      '<h2>Taxas da sua maquininha (%)</h2><div class="card"><p class="peq muted">Pegue no contrato ou no app da maquininha. Servem para conferir o extrato e para a calculadora.</p><div class="grade">' +
      inp('tDeb', 'Débito', t.debito, 'inputmode="decimal" placeholder="Ex.: 1,37"') + inp('tCv', 'Crédito à vista', t.credito_vista, 'inputmode="decimal" placeholder="Ex.: 3,15"') +
      inp('tC26', 'Parcelado 2 a 6x', t.credito_2a6, 'inputmode="decimal"') + inp('tC712', 'Parcelado 7 a 12x', t.credito_7a12, 'inputmode="decimal"') + '</div></div>' +
      '<p class="rodape">Micro no Controle · versão 1.0</p></main>';
    return { html: html, montar: function (el) {
      var mapa = { aNome: function (v) { n.nome = v; }, aDono: function (v) { n.dono = v; }, aSetor: function (v) { n.setor = v; }, aAtiv: function (v) { n.atividade = v; }, aCnpj: function (v) { n.cnpj = v; }, aAb: function (v) { n.abertura = v; }, aLim: function (v) { n.limite = v; },
        aPt: function (v) { p.tipo = v; }, aPc: function (v) { p.chave = v.trim(); }, aPn: function (v) { p.nome = v; }, aPci: function (v) { p.cidade = v; },
        tDeb: function (v) { t.debito = v; }, tCv: function (v) { t.credito_vista = v; }, tC26: function (v) { t.credito_2a6 = v; }, tC712: function (v) { t.credito_7a12 = v; } };
      Object.keys(mapa).forEach(function (id) { var x = $('#' + id, el); x.onchange = function () { mapa[id](x.value); salvar(); validarPix(); toast('Salvo ✓'); if (id === 'aSetor') desenharBarra('ajustes'); }; });
      $('#aMei', el).onchange = function () { n.mei = this.checked; salvar(); toast('Salvo ✓'); };
      $('#aIfood', el).onchange = function () { n.usaIfood = this.checked; salvar(); toast('Salvo ✓'); };
      function validarPix() { $('#aPe', el).textContent = p.tipo || p.chave ? Pix.validarChave(p.chave, p.tipo) : ''; }
      validarPix();
      $('#aPteste', el).onclick = function () {
        if (!pixPronto()) { toast('Confira o tipo e a chave Pix.'); return; }
        var code = codigoPix(0.01, 'TESTE', 'Teste');
        $('#aPres', el).innerHTML = '<canvas class="qr" id="aPq"></canvas><div class="pixbox">' + esc(code) + '</div><button class="btn claro peq" style="margin-top:8px" id="aPcp">Copiar</button><p class="peq muted" style="margin-top:6px">Cole no app do seu banco: deve aparecer o seu nome e R$ 0,01.</p>';
        var cv = qrCanvas(code, 400), q = $('#aPq', el); q.width = cv.width; q.height = cv.height; q.getContext('2d').drawImage(cv, 0, 0);
        $('#aPcp', el).onclick = function () { copiar(code, 'Pix de teste copiado'); };
      };
    } };
  };

  ROTAS.sobre = function () {
    var html = topo('Ajuda e privacidade', '', '#/mais') + '<main><div class="card">' +
      '<h2 style="margin-top:0">Seus dados são seus</h2><p>Tudo o que você lança fica guardado <b>só neste aparelho</b>. Não temos servidor com os seus dados, não vemos suas vendas e nem seus clientes. Os extratos que você confere são lidos no próprio celular e não são enviados para ninguém.</p>' +
      '<p style="margin-top:10px">O app não mexe no seu dinheiro: o Pix vai direto para a sua conta.</p>' +
      '<h2>Como instalar na tela inicial</h2><p><b>Android (Chrome):</b> menu ⋮ › "Adicionar à tela inicial" ou "Instalar app".<br><b>iPhone (Safari):</b> botão compartilhar › "Adicionar à Tela de Início".</p>' +
      '<h2>Dúvidas ou ideias</h2><p>Escreva para <a href="mailto:micronocontrole@gmail.com">micronocontrole@gmail.com</a>.</p>' +
      '<p class="peq muted" style="margin-top:14px">O app ajuda a organizar e conferir, mas não é contador nem consultoria financeira. <a href="/privacidade/">Política de privacidade</a>.</p></div></main>';
    return { html: html };
  };

  /* ================= início ================= */
  abrirDB().then(lerEstado).then(function (x) {
    E = completar(x);
    rotear();
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  // para testes automáticos
  window.__MNC = { cartao: cartaoImagem, codigoPix: codigoPix, estado: function () { return E; }, saldoCliente: saldoCliente, receitasMes: receitasMes, limiteAno: limiteAno };
})();

/* Micro no Controle — módulos da plataforma
   Contas a pagar, "Vai faltar dinheiro?", extrato do banco (separar e conciliar),
   estoque e contagem, devolução de nota (NF-e) e biblioteca.
   Tudo roda no aparelho: nenhum arquivo ou dado sai do celular. */
(function () {
  'use strict';
  var K = window.MNCK;
  if (!K) return;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = K.esc, brl = K.brl, num = K.num, arred = K.arred, uid = K.uid, hoje = K.hoje, iso = K.iso, deISO = K.deISO,
    somaDias = K.somaDias, dm = K.dm, dma = K.dma, diaRel = K.diaRel, ymDe = K.ymDe, ymSoma = K.ymSoma, mesNome = K.mesNome,
    topo = K.topo, abrirFolha = K.abrirFolha, fecharFolha = K.fecharFolha, confirmar = K.confirmar, toast = K.toast,
    copiar = K.copiar, salvar = K.salvar, rotear = K.rotear, R = K.ROTAS, track = K.track;
  function E() { return K.E(); }
  function pct(n) { return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',') + '%'; }
  function n2(v, d) { return (+v || 0).toFixed(d == null ? 2 : d).replace('.', ','); }
  function qtdFmt(q) { q = arred(+q || 0); return (Math.round(q) === q ? String(q) : n2(q, 3).replace(/0+$/, '').replace(/,$/, '')); }
  function somaMes(s, n) { var d = deISO(s), dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); var ult = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(dia, ult)); return iso(d); }
  function normal(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function inp(id, rot, val, extra) { return '<label class="campo"><span>' + rot + '</span><input class="inp" id="' + id + '" value="' + esc(val == null ? '' : val) + '" ' + (extra || '') + '></label>'; }
  function valIn(v) { return v ? n2(v) : ''; }
  function lerArquivoTexto(file) {
    return file.arrayBuffer().then(function (buf) {
      var t = new TextDecoder('utf-8').decode(buf);
      if (t.indexOf('�') >= 0) t = new TextDecoder('windows-1252').decode(buf);
      return t;
    });
  }
  // Lê CSV/TXT/XLSX e devolve as linhas de todas as abas (CSV = 1 aba)
  function lerPlanilha(file) {
    var nome = (file.name || '').toLowerCase();
    if (/\.(csv|txt)$/.test(nome)) return lerArquivoTexto(file).then(function (t) { return [Motor.lerCSV(t)]; });
    return K.carregarXLSX().then(function () { return file.arrayBuffer(); }).then(function (buf) {
      var wb = XLSX.read(buf, { type: 'array', cellDates: true });
      return wb.SheetNames.map(function (n) { return XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); });
    });
  }
  function baixarTexto(nome, texto, tipo) {
    var blob = new Blob([texto], { type: tipo || 'text/plain' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function imprimir(html) {
    $('#impressao').innerHTML = html; document.body.classList.add('imprimindo');
    setTimeout(function () { window.print(); setTimeout(function () { document.body.classList.remove('imprimindo'); }, 400); }, 50);
  }

  /* =====================================================================
     1. CONTAS A PAGAR
     ===================================================================== */
  var REC = { nao: 'Só uma vez', mensal: 'Todo mês', semanal: 'Toda semana' };
  function contasAbertas() { return E().contas.filter(function (c) { return !c.pago; }).sort(function (a, b) { return a.venc < b.venc ? -1 : a.venc > b.venc ? 1 : 0; }); }
  function abrirConta(c) {
    var nova = !c;
    c = c ? JSON.parse(JSON.stringify(c)) : { id: uid(), desc: '', valor: 0, venc: somaDias(hoje(), 7), cat: 'contas', rec: 'nao', pago: null, obs: '' };
    var html = '<h1>' + (nova ? 'Nova conta a pagar' : 'Editar conta') + '</h1>' +
      '<input class="inp valor" id="cValor" inputmode="decimal" placeholder="R$ 0,00" autocomplete="off" ' + (nova ? 'autofocus' : '') + ' value="' + valIn(c.valor) + '">' +
      inp('cDesc', 'O que é (ex.: aluguel, fornecedor de carne, luz)', c.desc, 'autocomplete="off"') +
      inp('cVenc', 'Vence em', c.venc, 'type="date"') +
      '<p style="font-weight:600;font-size:14.5px;margin-top:16px">Repete?</p><div class="chips" style="margin-top:8px" id="cRec">' + Object.keys(REC).map(function (k) { return '<button class="chip ' + (c.rec === k ? 'on' : '') + '" data-r="' + k + '">' + REC[k] + '</button>'; }).join('') + '</div>' +
      '<p style="font-weight:600;font-size:14.5px;margin-top:16px">Tipo de despesa</p><div class="chips" style="margin-top:8px" id="cCat">' + Object.keys(K.CATS).map(function (k) { return '<button class="chip ' + (c.cat === k ? 'on' : '') + '" data-c="' + k + '">' + K.CATS[k] + '</button>'; }).join('') + '</div>' +
      inp('cObs', 'Observação (opcional: código de barras, chave Pix do fornecedor…)', c.obs, 'autocomplete="off"') +
      '<button class="btn cheio" style="margin-top:18px" id="cSalvar">Salvar</button>' +
      (nova ? '' : '<button class="btn verm cheio" style="margin-top:10px" id="cExcluir">Excluir conta</button>');
    var f = abrirFolha(html);
    $$('[data-r]', f).forEach(function (b) { b.onclick = function () { c.rec = b.dataset.r; $$('[data-r]', f).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $$('[data-c]', f).forEach(function (b) { b.onclick = function () { c.cat = b.dataset.c; $$('[data-c]', f).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('#cSalvar', f).onclick = function () {
      c.valor = arred(num($('#cValor', f).value)); c.desc = $('#cDesc', f).value.trim(); c.venc = $('#cVenc', f).value || hoje(); c.obs = $('#cObs', f).value.trim();
      if (!(c.valor > 0)) { toast('Digite o valor.'); return; }
      if (!c.desc) { toast('Escreva o que é a conta.'); return; }
      var lista = E().contas, i = lista.findIndex(function (x) { return x.id === c.id; });
      if (i >= 0) lista[i] = c; else lista.push(c);
      salvar(); fecharFolha(); rotear(); toast('Conta salva ✓');
    };
    if ($('#cExcluir', f)) $('#cExcluir', f).onclick = function () { E().contas = E().contas.filter(function (x) { return x.id !== c.id; }); salvar(); fecharFolha(); rotear(); toast('Conta excluída'); };
  }
  function pagarConta(c) {
    var f = abrirFolha('<h1>Paguei: ' + esc(c.desc) + '</h1><p class="muted">Vira uma despesa nos seus lançamentos' + (c.rec !== 'nao' ? ' e a próxima já fica agendada' : '') + '.</p>' +
      '<input class="inp valor" id="pValor" inputmode="decimal" value="' + valIn(c.valor) + '">' + inp('pData', 'Data do pagamento', hoje(), 'type="date"') +
      '<button class="btn mint cheio" style="margin-top:16px" id="pOk">Confirmar pagamento</button>');
    $('#pOk', f).onclick = function () {
      var v = arred(num($('#pValor', f).value)), d = $('#pData', f).value || hoje();
      if (!(v > 0)) { toast('Digite o valor pago.'); return; }
      c.pago = d; c.valorPago = v;
      E().mov.push({ id: uid(), data: d, tipo: 'despesa', valor: v, forma: '', nat: K.natPadrao(), nf: false, cli: null, venc: '', desc: c.desc, cat: c.cat, conta: c.id });
      if (c.rec !== 'nao') E().contas.push({ id: uid(), desc: c.desc, valor: c.valor, venc: c.rec === 'mensal' ? somaMes(c.venc, 1) : somaDias(c.venc, 7), cat: c.cat, rec: c.rec, pago: null, obs: c.obs });
      salvar(); fecharFolha(); rotear(); toast('Pagamento lançado ✓'); track('ContaPaga');
    };
  }
  R.contas = function () {
    var h = hoje(), ab = contasAbertas(), atras = ab.filter(function (c) { return c.venc < h; }), sem = ab.filter(function (c) { return c.venc >= h && c.venc <= somaDias(h, 7); }),
      depois = ab.filter(function (c) { return c.venc > somaDias(h, 7); });
    var t30 = ab.filter(function (c) { return c.venc <= somaDias(h, 30); }).reduce(function (s, c) { return s + c.valor; }, 0), tAt = atras.reduce(function (s, c) { return s + c.valor; }, 0);
    var pagas = E().contas.filter(function (c) { return c.pago && ymDe(c.pago) === ymDe(h); }).sort(function (a, b) { return a.pago < b.pago ? 1 : -1; });
    function lista(ls, vazio) {
      if (!ls.length) return vazio ? '<div class="lista"><div class="vazio">' + vazio + '</div></div>' : '';
      return '<div class="lista">' + ls.map(function (c) {
        var tag = c.venc < h ? '<span class="tag vm">venceu ' + dm(c.venc) + '</span>' : c.venc === h ? '<span class="tag am">vence hoje</span>' : 'vence ' + diaRel(c.venc);
        return '<div class="item"><button class="meio" data-ed="' + c.id + '" style="background:none;border:0;text-align:left;font:inherit;color:inherit;padding:0;cursor:pointer"><b>' + esc(c.desc) + '</b><span>' + tag + (c.rec !== 'nao' ? ' · ' + REC[c.rec].toLowerCase() : '') + '</span></button><span class="val">' + brl(c.valor) + '</span><button class="btn peq claro" data-pg="' + c.id + '">Paguei</button></div>';
      }).join('') + '</div>';
    }
    var html = topo('Contas a pagar', 'Nada de juros por esquecimento', '#/mais') + '<main>' +
      '<div class="card hero"><div class="lbl">A pagar nos próximos 30 dias</div><div class="big">' + brl(t30) + '</div>' + (tAt > 0 ? '<p style="color:#FFD9A0;font-weight:600">' + brl(tAt) + ' já venceu</p>' : '<p style="color:#BFE3DE">Nada atrasado 👏</p>') + '</div>' +
      '<div class="linhaBtns"><button class="btn mint" id="cNova">+ Conta a pagar</button><a class="btn claro" href="#/caixa">Vai faltar dinheiro?</a></div>' +
      (atras.length ? '<h2>Atrasadas</h2>' + lista(atras) : '') +
      '<h2>Próximos 7 dias</h2>' + lista(sem, 'Nada vencendo esta semana.') +
      (depois.length ? '<h2>Mais para frente</h2>' + lista(depois) : '') +
      (pagas.length ? '<h2>Pagas em ' + mesNome(ymDe(h)) + '</h2><div class="lista">' + pagas.map(function (c) { return '<div class="item"><span class="meio"><b>' + esc(c.desc) + '</b><span>pago ' + diaRel(c.pago) + '</span></span><span class="val menos">' + brl(c.valorPago || c.valor) + '</span></div>'; }).join('') + '</div>' : '') +
      '<p class="peq muted" style="margin-top:14px">Dica: cadastre as contas fixas (aluguel, luz, internet, ajudante) como "todo mês". O app lembra e já agenda a próxima quando você marca "Paguei".</p></main>';
    return { html: html, montar: function (el) {
      $('#cNova', el).onclick = function () { abrirConta(); };
      $$('[data-ed]', el).forEach(function (b) { b.onclick = function () { abrirConta(E().contas.filter(function (c) { return c.id === b.dataset.ed; })[0]); }; });
      $$('[data-pg]', el).forEach(function (b) { b.onclick = function () { pagarConta(E().contas.filter(function (c) { return c.id === b.dataset.pg; })[0]); }; });
    } };
  };

  /* =====================================================================
     2. VAI FALTAR DINHEIRO? (projeção de caixa)
     ===================================================================== */
  function mediaDiaria() {
    // média dos últimos 30 dias: entradas que caem no caixa (vendas não fiado + fiado recebido) menos despesas do dia a dia não cadastradas como conta
    var h = hoje(), ini = somaDias(h, -30), ent = 0, sai = 0;
    E().mov.forEach(function (m) {
      if (m.data < ini || m.data >= h) return;
      if (m.tipo === 'venda' && m.forma !== 'fiado') ent += m.valor;
      else if (m.tipo === 'receb') ent += m.valor;
      else if (m.tipo === 'despesa' && !m.conta) sai += m.valor;
    });
    // dias de histórico de verdade (do 1º lançamento da janela até hoje), mínimo 7 para não inflar a média de quem começou agora
    var prim = h; E().mov.forEach(function (m) { if (m.data >= ini && m.data < prim) prim = m.data; });
    var dias = Math.min(30, Math.max(7, Math.round((deISO(h) - deISO(prim)) / 864e5)));
    return { ent: ent / dias, sai: sai / dias, dias: dias };
  }
  function projetar(dias) {
    var x = E().caixa, h = hoje(), saldo = num(x.saldo), ev = [];
    // contas a pagar (com as repetições dentro do período)
    contasAbertas().forEach(function (c) {
      var v = c.venc < h ? h : c.venc, lim = somaDias(h, dias), n = 0, d = c.venc;
      ev.push({ data: v, valor: -c.valor, desc: c.desc + (c.venc < h ? ' (atrasada)' : ''), tipo: 'conta' });
      if (c.rec !== 'nao') { while (n < 120) { d = c.rec === 'mensal' ? somaMes(d, 1) : somaDias(d, 7); if (d > lim) break; if (d > h) ev.push({ data: d, valor: -c.valor, desc: c.desc, tipo: 'conta' }); n++; } }
    });
    // DAS do MEI (dia 20) se o valor estiver preenchido
    var das = num(x.das);
    if (E().neg.mei && das > 0) { for (var i = 0; i <= Math.ceil(dias / 28); i++) { var ym = ymSoma(ymDe(h), i), d20 = ym + '-20'; if (d20 >= h && d20 <= somaDias(h, dias) && !E().das[ymSoma(ym, -1)]) ev.push({ data: d20, valor: -das, desc: 'DAS do MEI', tipo: 'das' }); } }
    // fiado a receber: no vencimento; o vencido entra em 7 dias, se cobrar
    K.devedores().forEach(function (d) {
      if (d.s.vencido > 0) ev.push({ data: somaDias(h, 7), valor: d.s.vencido, desc: 'Fiado vencido de ' + d.c.nome + ' (se cobrar)', tipo: 'fiado' });
      var resto = arred(d.s.total - d.s.vencido); if (resto > 0) ev.push({ data: d.s.venc && d.s.venc >= h ? d.s.venc : somaDias(h, 15), valor: resto, desc: 'Fiado de ' + d.c.nome, tipo: 'fiado' });
    });
    var med = mediaDiaria(), usarMedia = x.contarVendas !== false && E().mov.length > 0;
    var dia = [], s = saldo, minimo = { v: saldo, d: h }, aperto = null;
    for (var k = 0; k <= dias; k++) {
      var dd = somaDias(h, k), mov = 0;
      ev.forEach(function (e) { if (e.data === dd) mov += e.valor; });
      if (usarMedia && k > 0) mov += med.ent - med.sai;
      s = arred(s + mov); dia.push({ d: dd, s: s });
      if (s < minimo.v) minimo = { v: s, d: dd };
      if (s < 0 && !aperto) aperto = { d: dd, v: s };
    }
    return { saldo: saldo, ev: ev.sort(function (a, b) { return a.data < b.data ? -1 : 1; }), dia: dia, minimo: minimo, aperto: aperto, med: med, usarMedia: usarMedia };
  }
  function graficoCaixa(p) {
    var W = 640, H = 200, padL = 8, padB = 22, vals = p.dia.map(function (x) { return x.s; }), mx = Math.max.apply(null, vals.concat([0])), mn = Math.min.apply(null, vals.concat([0]));
    if (mx === mn) mx = mn + 1;
    var X = function (i) { return padL + i * (W - padL * 2) / (p.dia.length - 1); }, Y = function (v) { return 8 + (mx - v) * (H - padB - 8) / (mx - mn); };
    var pts = p.dia.map(function (x, i) { return X(i).toFixed(1) + ',' + Y(x.s).toFixed(1); }).join(' ');
    var zero = Y(0), area = 'M' + X(0) + ',' + zero + ' L' + pts.split(' ').join(' L') + ' L' + X(p.dia.length - 1) + ',' + zero + ' Z';
    var marcas = [0, 15, 30, 45, 60].filter(function (i) { return i < p.dia.length; }).map(function (i) { return '<text x="' + X(i) + '" y="' + (H - 6) + '" font-size="12" fill="#58686B" text-anchor="' + (i === 0 ? 'start' : i === p.dia.length - 1 ? 'end' : 'middle') + '">' + (i === 0 ? 'hoje' : dm(p.dia[i].d)) + '</text>'; }).join('');
    var ap = p.aperto ? (function () { var i = p.dia.findIndex(function (x) { return x.d === p.aperto.d; }); return '<line x1="' + X(i) + '" x2="' + X(i) + '" y1="8" y2="' + (H - padB) + '" stroke="#C0392B" stroke-dasharray="4 4"/><circle cx="' + X(i) + '" cy="' + Y(p.aperto.v) + '" r="5" fill="#C0392B"/>'; })() : '';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Saldo previsto dia a dia" style="display:block">' +
      '<defs><clipPath id="cpPos"><rect x="0" y="0" width="' + W + '" height="' + zero + '"/></clipPath><clipPath id="cpNeg"><rect x="0" y="' + zero + '" width="' + W + '" height="' + (H - zero) + '"/></clipPath></defs>' +
      '<path d="' + area + '" fill="#2EC4B6" fill-opacity=".22" clip-path="url(#cpPos)"/><path d="' + area + '" fill="#C0392B" fill-opacity=".2" clip-path="url(#cpNeg)"/>' +
      '<line x1="0" x2="' + W + '" y1="' + zero + '" y2="' + zero + '" stroke="#9AA9A7" stroke-width="1"/>' +
      '<polyline points="' + pts + '" fill="none" stroke="#0F3D3E" stroke-width="2.5" stroke-linejoin="round"/>' + ap + marcas + '</svg>';
  }
  R.caixa = function () {
    var x = E().caixa, temSaldo = x.saldo !== '' && x.saldo != null;
    var html = topo('Vai faltar dinheiro?', 'O caixa dos próximos 60 dias', '#/mais') + '<main>' +
      '<div class="card"><p class="peq muted">Quanto você tem hoje, somando o dinheiro do caixa e a conta do negócio?</p>' +
      '<input class="inp valor" id="xSaldo" inputmode="decimal" placeholder="R$ 0,00" value="' + (temSaldo ? n2(num(x.saldo)) : '') + '">' +
      (E().neg.mei ? inp('xDas', 'Valor do seu DAS por mês (opcional, está no app MEI)', x.das ? n2(num(x.das)) : '', 'inputmode="decimal" placeholder="Ex.: 80,90"') : '') +
      '<label class="check"><input type="checkbox" id="xMedia" ' + (x.contarVendas !== false ? 'checked' : '') + '> Contar com as vendas do dia a dia (média dos últimos 30 dias)</label>' +
      '<button class="btn cheio" style="margin-top:12px" id="xVer">Ver previsão</button></div><div id="xRes"></div></main>';
    return { html: html, montar: function (el) {
      function mostrar() {
        var p = projetar(60), med = p.med, r = $('#xRes', el);
        var cab = p.aperto ?
          '<div class="card" style="border:2px solid var(--red);margin-top:16px"><p style="font-weight:700;color:var(--red)">⚠️ Dia do aperto: ' + diaRel(p.aperto.d) + '</p><div class="achado" style="color:var(--red)">' + brl(p.aperto.v) + '</div><p class="muted">é quanto vai faltar nesse dia se nada mudar. O ponto mais baixo é ' + brl(p.minimo.v) + ' em ' + dm(p.minimo.d) + '.</p></div>' :
          '<div class="card" style="border:2px solid var(--green);margin-top:16px"><p style="font-weight:700;color:var(--green)">✓ Não falta dinheiro nos próximos 60 dias</p><p class="muted">O ponto mais baixo do caixa é ' + brl(p.minimo.v) + ' em ' + dm(p.minimo.d) + '.</p></div>';
        var dicas = [];
        if (p.aperto) {
          var venc = K.devedores().reduce(function (s, d) { return s + d.s.vencido; }, 0);
          if (venc > 0) dicas.push('Cobre o fiado vencido: <b>' + brl(venc) + '</b> na rua. <a href="#/fiado">Cobrar agora</a>');
          var grandes = p.ev.filter(function (e) { return e.valor < 0 && e.data >= somaDias(p.aperto.d, -3) && e.data <= p.aperto.d; }).sort(function (a, b) { return a.valor - b.valor; }).slice(0, 2);
          grandes.forEach(function (e) { dicas.push('Negocie a data de <b>' + esc(e.desc) + '</b> (' + brl(-e.valor) + ', ' + dm(e.data) + ') para depois do dia ' + dm(somaDias(p.aperto.d, 7)) + '.'); });
          dicas.push('Segure compras que não são urgentes até ' + dm(p.aperto.d) + '.');
          dicas.push('Faça uma promoção rápida para vender mais antes do dia do aperto.');
        }
        r.innerHTML = cab + '<div class="card" style="margin-top:12px">' + graficoCaixa(p) + '<p class="peq muted" style="margin-top:6px">Saldo previsto dia a dia' + (p.usarMedia ? ' · inclui ' + brl(med.ent - med.sai) + ' por dia da média de vendas menos gastos do dia a dia' : '') + '.</p></div>' +
          (dicas.length ? '<h2>O que fazer</h2><div class="card"><ul style="padding-left:18px;display:grid;gap:8px">' + dicas.map(function (d) { return '<li>' + d + '</li>'; }).join('') + '</ul></div>' : '') +
          '<h2>O que entra e sai</h2>' + (p.ev.length ? '<div class="lista">' + p.ev.slice(0, 40).map(function (e) { return '<div class="item"><span class="meio"><b>' + esc(e.desc) + '</b><span>' + diaRel(e.data) + '</span></span><span class="val ' + (e.valor < 0 ? 'menos' : 'mais') + '">' + (e.valor < 0 ? '-' : '+') + brl(Math.abs(e.valor)) + '</span></div>'; }).join('') + '</div>' :
          '<div class="lista"><div class="vazio">Cadastre as <a href="#/contas">contas a pagar</a> para a previsão ficar certeira.</div></div>') +
          '<p class="peq muted" style="margin-top:12px">É uma estimativa: quanto mais contas e vendas você lança, mais certa fica.</p>';
        track('PrevisaoCaixa', { aperto: !!p.aperto });
      }
      $('#xVer', el).onclick = function () {
        var x = E().caixa; x.saldo = String(num($('#xSaldo', el).value)); x.data = hoje(); if ($('#xDas', el)) x.das = String(num($('#xDas', el).value)); x.contarVendas = $('#xMedia', el).checked;
        salvar(); mostrar();
      };
      if (temSaldo) mostrar();
    } };
  };

  window.MNCX = window.MNCX || {};
  window.MNCX._partes = ['contas', 'caixa'];

  /* =====================================================================
     3. EXTRATO DO BANCO: importar, separar pessoal × negócio, conciliar
     ===================================================================== */
  var CLS = { neg: 'Negócio', pes: 'Pessoal', ign: 'Ignorar' };
  var PREFIXOS = /^(transferencia|transf|pix|ted|doc|tev|enviad[ao]|recebid[ao]|enviada pelo pix|recebida pelo pix|pelo pix|compra|no debito|debito|credito|pagamento|pagto|pgto|de boleto|boleto|deposito|saque|tarifa|estorno|cartao|visa|master|elo|aut|em|de|da|do|para|-)\b\s*/;
  function chaveDesc(d) {
    var s = normal(d).replace(/\b\d[\d ]*\b/g, ' ').replace(/\s+/g, ' ').trim(), ant;
    do { ant = s; s = s.replace(PREFIXOS, ''); } while (s !== ant && s);
    return s.split(' ').filter(function (w) { return w.length > 1; }).slice(0, 3).join(' ') || normal(d).slice(0, 24);
  }
  var SUG_NEG = /\b(stone|cielo|rede|getnet|pagseguro|pagbank|sumup|infinitepay|mercado ?pago|ifood|rappi|aiqfome|99food|das|simples nacional|pgmei|receita federal|sefaz|atacad|assai|atacadao|makro|fornecedor|distribuidora|embalage)\w*/;
  var SUG_PES = /\b(netflix|spotify|disney|hbo|globoplay|deezer|prime video|amazon prime|youtube|academia|smart ?fit|bluefit|farmacia|drogaria|droga ?raia|drogasil|pague menos|escola|faculdade|colegio|unimed|hapvida|amil|bradesco saude|plano de saude|cinema|ingresso|salao de beleza|pet ?shop)\w*/;
  function sugerir(t) {
    var n = normal(t.desc), r = E().extrato.regras[chaveDesc(t.desc)];
    if (r) return r;
    if (/\b(aplicacao|resgate|rendimento|cdb|poupanca|transferencia entre contas|mesma titularidade)\b/.test(n)) return 'ign';
    if (SUG_NEG.test(n)) return (/ifood/.test(n) && t.valor < 0) ? 'pes' : 'neg';
    if (SUG_PES.test(n)) return 'pes';
    return null;
  }
  // Detecta colunas de extrato em CSV/XLSX
  function detectarExtrato(rows) {
    for (var i = 0; i < Math.min(rows.length, 25); i++) {
      var cab = (rows[i] || []).map(function (c) { return normal(c); }), m = {};
      cab.forEach(function (c, j) {
        if (m.data == null && /^(data|dt|date)\b/.test(c) && !/venc/.test(c)) m.data = j;
        else if (m.desc == null && /(descri|histor|lancamento|memo|estabelec|detalhe|titulo|nome)/.test(c)) m.desc = j;
        else if (m.valor == null && /^(valor|montante|quantia|amount|valor r)/.test(c) && !/saldo/.test(c)) m.valor = j;
        else if (m.cred == null && /(credito|entrada|receita)/.test(c) && !/saldo/.test(c)) m.cred = j;
        else if (m.deb == null && /(debito|saida|despesa)/.test(c) && !/saldo/.test(c)) m.deb = j;
        else if (m.tipo == null && /^(tipo|d c|c d|natureza)$/.test(c)) m.tipo = j;
      });
      if (m.desc == null) cab.forEach(function (c, j) { if (m.desc == null && /identif/.test(c)) m.desc = j; });
      if (m.data != null && m.desc != null && (m.valor != null || m.cred != null || m.deb != null)) { m.linha = i; return m; }
    }
    return null;
  }
  function linhasExtrato(rows, m) {
    var out = [];
    for (var i = m.linha + 1; i < rows.length; i++) {
      var r = rows[i] || [], d = Motor.data(r[m.data]); if (!d) continue;
      var v;
      if (m.valor != null) {
        v = Motor.numero(r[m.valor]);
        if (m.tipo != null) { var tp = normal(r[m.tipo]); if (/^(d|deb|saida)/.test(tp) && v > 0) v = -v; }
      } else {
        var c = Motor.numero(r[m.cred]), db = Motor.numero(r[m.deb]);
        v = (isNaN(c) ? 0 : Math.abs(c)) - (isNaN(db) ? 0 : Math.abs(db));
      }
      if (isNaN(v) || !v) continue;
      var desc = String(r[m.desc] || '').trim();
      if (/^saldo/i.test(normal(desc))) continue;
      out.push({ data: iso(d), desc: desc || 'Sem descrição', valor: arred(v) });
    }
    return out;
  }
  function lerOFX(t) {
    var out = [], re = /<STMTTRN>([\s\S]*?)(<\/STMTTRN>|(?=<STMTTRN>)|<\/BANKTRANLIST>)/gi, m;
    function tag(b, n) { var x = new RegExp('<' + n + '>([^<\\r\\n]*)', 'i').exec(b); return x ? x[1].trim() : ''; }
    while ((m = re.exec(t))) {
      var b = m[1], dt = tag(b, 'DTPOSTED'), v = Motor.numero(tag(b, 'TRNAMT').replace(',', '.'));
      if (!dt || isNaN(v)) continue;
      out.push({ data: dt.slice(0, 4) + '-' + dt.slice(4, 6) + '-' + dt.slice(6, 8), desc: tag(b, 'MEMO') || tag(b, 'NAME') || 'Sem descrição', valor: arred(v), fitid: tag(b, 'FITID') });
    }
    return out;
  }
  function importarExtrato(file) {
    var nome = (file.name || '').toLowerCase();
    if (/\.pdf$/.test(nome)) return Promise.reject(new Error('PDF ainda não dá para ler aqui. No app do banco, exporte o extrato em OFX, CSV ou Excel (quase todos têm essa opção).'));
    if (/\.(ofx|qfx)$/.test(nome)) return lerArquivoTexto(file).then(function (t) { var l = lerOFX(t); if (!l.length) throw new Error('Não achei lançamentos nesse OFX.'); return l; });
    return lerPlanilha(file).then(function (abas) {
      for (var i = 0; i < abas.length; i++) { var m = detectarExtrato(abas[i]); if (m) { var l = linhasExtrato(abas[i], m); if (l.length) return l; } }
      throw new Error('Não reconheci as colunas (preciso de data, descrição e valor).');
    });
  }
  function juntarExtrato(lista) {
    // Pula o que já foi importado antes, mas mantém lançamentos iguais dentro do mesmo arquivo (ex.: dois pagamentos de mesmo valor no dia)
    var ex = E().extrato, ja = {}, novos = 0, chave = function (t) { return t.fitid || (t.data + '|' + t.valor + '|' + normal(t.desc)); };
    ex.trans.forEach(function (t) { var k = chave(t); ja[k] = (ja[k] || 0) + 1; });
    lista.forEach(function (t) {
      var k = chave(t); if (ja[k]) { ja[k]--; return; }
      t.id = uid(); t.cls = null; t.sug = sugerir(t);
      var r = ex.regras[chaveDesc(t.desc)]; if (r) { t.cls = r; t.sug = null; }
      ex.trans.push(t); novos++;
    });
    ex.trans.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
    salvar(); return novos;
  }
  function classificar(t, cls, todos) {
    var ex = E().extrato, k = chaveDesc(t.desc), n = 0;
    if (todos) { ex.regras[k] = cls; ex.trans.forEach(function (x) { if (!x.cls && chaveDesc(x.desc) === k && (x.valor > 0) === (t.valor > 0)) { x.cls = cls; x.sug = null; n++; } }); }
    if (t.cls !== cls) { t.cls = cls; t.sug = null; if (!todos) n++; }
    salvar(); return n;
  }
  function exemploExtrato() {
    var h = hoje(), d = function (n) { return somaDias(h, -n); };
    return [
      { data: d(1), desc: 'Pix recebido - MARIA SOUZA', valor: 80 }, { data: d(1), desc: 'Compra no débito - FARMACIA SAO JOAO', valor: -46.9 },
      { data: d(2), desc: 'STONE PAGAMENTOS - liquido de vendas', valor: 612.4 }, { data: d(3), desc: 'Pix enviado - DISTRIBUIDORA BOA VISTA LTDA', valor: -389 },
      { data: d(4), desc: 'NETFLIX.COM', valor: -44.9 }, { data: d(5), desc: 'Pix recebido - JOAO PEREIRA', valor: 35 }, { data: d(6), desc: 'Pagamento de boleto - ENEL ENERGIA', valor: -212.37 },
      { data: d(7), desc: 'Pix enviado - CONDOMINIO RESIDENCIAL', valor: -520 }, { data: d(8), desc: 'Pix recebido - ANA LIMA', valor: 120 }, { data: d(9), desc: 'DAS SIMPLES NACIONAL', valor: -81.9 },
      { data: d(10), desc: 'Compra no débito - ATACADAO', valor: -265.3 }, { data: d(11), desc: 'Pix enviado - SMART FIT', valor: -119.9 }, { data: d(12), desc: 'Pix recebido - MARIA SOUZA', valor: 60 }
    ];
  }
  function mesesExtrato() { var s = {}; E().extrato.trans.forEach(function (t) { s[ymDe(t.data)] = 1; }); return Object.keys(s).sort().reverse(); }
  // Conciliação: liga lançamentos do extrato aos lançamentos do app (1 para 1, valor igual, até N dias de diferença)
  function parear(trans, movs, dias) {
    var usados = {}, par = {};
    trans.forEach(function (t) {
      var melhor = null, dist = 99;
      movs.forEach(function (m) {
        if (usados[m.id] || Math.abs(Math.abs(t.valor) - m.valor) > 0.01) return;
        var dd = Math.abs((deISO(t.data) - deISO(m.data)) / 864e5); if (dd <= dias && dd < dist) { melhor = m; dist = dd; }
      });
      if (melhor) { usados[melhor.id] = 1; par[t.id] = melhor.id; }
    });
    return { par: par, usados: usados };
  }
  function conciliar(ym) {
    var ex = E().extrato.trans.filter(function (t) { return ymDe(t.data) === ym; });
    if (!ex.length) return null;
    var ini = ex[ex.length - 1].data, fim = ex[0].data;
    var movs = E().mov.filter(function (m) { return m.data >= somaDias(ini, -2) && m.data <= somaDias(fim, 2); });
    var entradasNeg = ex.filter(function (t) { return t.valor > 0 && t.cls === 'neg'; });
    var vendasPix = movs.filter(function (m) { return (m.tipo === 'venda' && m.forma === 'pix') || (m.tipo === 'receb' && m.forma === 'pix'); });
    var pe = parear(entradasNeg, vendasPix, 1);
    var pixSemVenda = entradasNeg.filter(function (t) { return !pe.par[t.id] && !t.lanc && !SUG_NEG.test(normal(t.desc)); });
    var vendaSemPix = vendasPix.filter(function (m) { return !pe.usados[m.id] && m.data >= ini && m.data <= fim; });
    var saidasNeg = ex.filter(function (t) { return t.valor < 0 && t.cls === 'neg' && !t.lanc; });
    var desp = movs.filter(function (m) { return m.tipo === 'despesa'; });
    var ps = parear(saidasNeg, desp, 3), saidaSemDesp = saidasNeg.filter(function (t) { return !ps.par[t.id]; });
    var pesNaoLanc = ex.filter(function (t) { return t.valor < 0 && t.cls === 'pes' && !t.lanc; });
    var retiradas = movs.filter(function (m) { return m.tipo === 'retirada'; }), pr = parear(pesNaoLanc, retiradas, 3);
    pesNaoLanc = pesNaoLanc.filter(function (t) { return !pr.par[t.id]; });
    return { ini: ini, fim: fim, pixSemVenda: pixSemVenda, vendaSemPix: vendaSemPix, saidaSemDesp: saidaSemDesp, pesNaoLanc: pesNaoLanc };
  }
  function catDe(desc) {
    var n = normal(desc);
    if (/\b(das|simples|pgmei|receita federal|sefaz|imposto)/.test(n)) return 'impostos';
    if (/\b(aluguel|condominio|imobiliaria)/.test(n)) return 'aluguel';
    if (/\b(enel|cemig|copel|light|celesc|coelba|cpfl|energia|luz|agua|saneamento|caesb|sabesp|internet|claro|vivo|tim|oi |telefone)/.test(n)) return 'contas';
    if (/\b(posto|combustivel|gasolina|uber|99|estacionamento|pedagio)/.test(n)) return 'transporte';
    if (/\b(stone|cielo|rede|getnet|pagseguro|pagbank|sumup|tarifa|taxa)/.test(n)) return 'maquina';
    if (/\b(atacad|assai|makro|distribuidora|fornecedor|embalage|mercado|hortifruti)/.test(n)) return 'mercadoria';
    return 'outros';
  }
  function lancarDoExtrato(lista, tipo) {
    lista.forEach(function (t) {
      var m = { id: uid(), data: t.data, tipo: tipo, valor: Math.abs(t.valor), forma: tipo === 'venda' ? 'pix' : '', nat: K.natPadrao(), nf: false, cli: null, venc: '', desc: t.desc.slice(0, 60), cat: tipo === 'despesa' ? catDe(t.desc) : '', extrato: t.id };
      E().mov.push(m); t.lanc = m.id;
    });
    salvar();
  }
  R.extrato = function (arg) {
    var ex = E().extrato, meses = mesesExtrato(), ym = arg && /^\d{4}-\d{2}$/.test(arg) ? arg : (meses[0] || ymDe(hoje()));
    var doMes = ex.trans.filter(function (t) { return ymDe(t.data) === ym; });
    var sep = doMes.filter(function (t) { return !t.cls; }), neg = doMes.filter(function (t) { return t.cls === 'neg'; }), pes = doMes.filter(function (t) { return t.cls === 'pes'; });
    var entN = neg.filter(function (t) { return t.valor > 0; }).reduce(function (s, t) { return s + t.valor; }, 0), saiN = -neg.filter(function (t) { return t.valor < 0; }).reduce(function (s, t) { return s + t.valor; }, 0);
    var saiP = -pes.filter(function (t) { return t.valor < 0; }).reduce(function (s, t) { return s + t.valor; }, 0);
    function linha(t) {
      var b = function (c, r) { return '<button class="chip peq ' + (t.cls === c ? 'on' : '') + (t.sug === c && !t.cls ? ' sug' : '') + '" data-cl="' + c + '" data-t="' + t.id + '">' + r + '</button>'; };
      return '<div class="item" style="flex-wrap:wrap"><span class="meio"><b>' + esc(t.desc) + '</b><span>' + diaRel(t.data) + (t.sug && !t.cls ? ' · sugestão: ' + CLS[t.sug].toLowerCase() : '') + (t.lanc ? ' · lançado no app' : '') + '</span></span><span class="val ' + (t.valor > 0 ? 'mais' : 'menos') + '">' + (t.valor > 0 ? '+' : '-') + brl(Math.abs(t.valor)) + '</span>' +
        '<div class="chips" style="width:100%;margin-top:6px">' + b('neg', '🏪 Negócio') + b('pes', '🏠 Pessoal') + b('ign', 'Ignorar') + '</div></div>';
    }
    var html = topo('Extrato do banco', 'Separe o pessoal do negócio e confira as vendas', '#/mais') + '<main>' +
      '<p class="muted">Exporte o extrato no app do banco (OFX, CSV ou Excel) e escolha aqui. O arquivo é lido no seu celular e não vai para ninguém.</p>' +
      '<label class="drop"><input type="file" id="eArq" accept=".ofx,.qfx,.csv,.txt,.xlsx,.xls"><b>📂 Importar extrato</b><span class="muted peq">OFX, CSV ou Excel · Nubank, Inter, Itaú, BB, Caixa, Bradesco, Santander, C6…</span></label>' +
      (ex.trans.length ? '' : '<button class="btn linha cheio" style="margin-top:10px" id="eEx">Testar com um extrato de exemplo</button>') +
      '<details class="como"><summary>Como exportar o extrato?</summary><ul><li><b>Nubank:</b> no app, Extrato › ícone de compartilhar › exportar (CSV), ou pelo e-mail mensal.</li><li><b>Inter, C6, Itaú, Bradesco, Santander, BB, Caixa:</b> Extrato › Exportar ou Salvar como OFX/Excel. No computador (internet banking) quase sempre tem "OFX".</li></ul></details>' +
      '<div id="eMsg"></div>' +
      (ex.trans.some(function (t) { return t.ex; }) ? '<div class="alerta am" style="margin-top:12px"><span class="ic">👀</span><span class="tx"><b>Você está vendo um extrato de exemplo</b><span>Os lançamentos são fictícios. Mexa à vontade e apague quando for usar o seu.</span></span></div><button class="btn linha cheio peq" id="eSairEx">Apagar o exemplo</button>' : '') +
      (ex.trans.length ? ('<div class="linhaBtns" style="margin-top:14px">' + (meses.indexOf(ymSoma(ym, -1)) >= 0 ? '<a class="btn linha peq" href="#/extrato/' + ymSoma(ym, -1) + '">‹ ' + mesNome(ymSoma(ym, -1)) + '</a>' : '') + (meses.indexOf(ymSoma(ym, 1)) >= 0 ? '<a class="btn linha peq" href="#/extrato/' + ymSoma(ym, 1) + '">' + mesNome(ymSoma(ym, 1)) + ' ›</a>' : '') + '</div>' +
        '<div class="card hero" style="margin-top:12px"><div class="lbl">Resultado do negócio em ' + mesNome(ym) + ' (pelo banco)</div><div class="big">' + brl(entN - saiN) + '</div>' +
        '<div class="kpis"><div><b>' + brl(entN) + '</b><span>Entrou</span></div><div><b>' + brl(saiN) + '</b><span>Saiu</span></div><div><b>' + brl(saiP) + '</b><span>Gasto pessoal</span></div></div>' +
        (saiP > 0 ? '<p style="margin-top:10px;font-size:14px;color:#BFE3DE">Saíram <b style="color:#fff">' + brl(saiP) + '</b> da conta para a vida pessoal. É dinheiro que o negócio te pagou.</p>' : '') + '</div>' +
        '<div id="eConc"></div>' +
        '<h2>A separar (' + sep.length + ')</h2>' + (sep.length ? (sep.some(function (t) { return t.sug; }) ? '<button class="btn claro peq" id="eSug" style="margin-bottom:8px">Aceitar as sugestões</button>' : '') + '<div class="lista">' + sep.map(linha).join('') + '</div>' : '<div class="lista"><div class="vazio">Tudo separado 👏</div></div>') +
        (neg.length ? '<details class="como" open><summary>Negócio (' + neg.length + ')</summary><div class="lista">' + neg.map(linha).join('') + '</div></details>' : '') +
        (pes.length ? '<details class="como"><summary>Pessoal (' + pes.length + ')</summary><div class="lista">' + pes.map(linha).join('') + '</div></details>' : '') +
        '<button class="btn linha cheio" style="margin-top:16px" id="eLimpar">Apagar extratos importados</button>') : '') +
      '<p class="peq muted" style="margin-top:14px">Quando você separa um lançamento, o app aprende e separa sozinho os parecidos nos próximos extratos.</p></main>';
    return { html: html, montar: function (el) {
      function aposImportar(lista) {
        var n = juntarExtrato(lista); track('ExtratoImportado', { n: n });
        toast(n ? n + ' lançamentos importados' : 'Esses lançamentos já estavam aqui');
        var ms = mesesExtrato(); K.ir('#/extrato/' + (ms[0] || ''));
      }
      $('#eArq', el).onchange = function (e) {
        var file = e.target.files[0]; if (!file) return;
        $('#eMsg', el).innerHTML = '<p class="muted" style="margin-top:10px">Lendo o extrato…</p>';
        importarExtrato(file).then(aposImportar).catch(function (err) { $('#eMsg', el).innerHTML = '<div class="aviso">' + esc(err.message) + ' Se continuar, mande o arquivo (sem dados sensíveis) para micronocontrole@gmail.com que a gente ajusta o leitor.</div>'; });
        e.target.value = '';
      };
      if ($('#eEx', el)) $('#eEx', el).onclick = function () { aposImportar(exemploExtrato().map(function (t) { t.ex = true; return t; })); };
      if ($('#eSairEx', el)) $('#eSairEx', el).onclick = function () { ex.trans = ex.trans.filter(function (t) { return !t.ex; }); E().mov = E().mov.filter(function (m) { return !m.extrato || ex.trans.some(function (t) { return t.id === m.extrato; }); }); salvar(); rotear(); toast('Exemplo apagado'); };
      if ($('#eSug', el)) $('#eSug', el).onclick = function () { var n = 0; doMes.forEach(function (t) { if (!t.cls && t.sug) { classificar(t, t.sug, true); n++; } }); toast(n + ' separados ✓'); rotear(); };
      $$('[data-cl]', el).forEach(function (b) { b.onclick = function () {
        var t = ex.trans.filter(function (x) { return x.id === b.dataset.t; })[0]; if (!t) return;
        var n = classificar(t, b.dataset.cl, true); toast(n > 1 ? n + ' parecidos separados juntos ✓' : 'Separado ✓'); rotear();
      }; });
      if ($('#eLimpar', el)) $('#eLimpar', el).onclick = function () { confirmar('Apagar extratos?', 'Apaga os lançamentos importados do banco (o que você aprendeu a separar continua guardado). Seus lançamentos do app não mudam.', 'Apagar', function () { ex.trans = []; salvar(); rotear(); }, true); };
      var c = $('#eConc', el); if (!c) return;
      var cc = conciliar(ym); if (!cc) return;
      var blocos = [];
      if (cc.pixSemVenda.length) blocos.push('<div class="alerta am"><span class="ic">💰</span><span class="tx"><b>' + cc.pixSemVenda.length + ' entradas do negócio sem venda lançada (' + brl(cc.pixSemVenda.reduce(function (s, t) { return s + t.valor; }, 0)) + ')</b><span>Vendas que você esqueceu de lançar? Elas contam para o limite do MEI.</span></span></div><button class="btn claro cheio peq" id="cPix">Lançar como vendas no Pix</button>');
      if (cc.vendaSemPix.length) blocos.push('<div class="alerta vm"><span class="ic">⚠️</span><span class="tx"><b>' + cc.vendaSemPix.length + ' vendas no Pix lançadas que não caíram no banco</b><span>' + cc.vendaSemPix.slice(0, 4).map(function (m) { return brl(m.valor) + ' em ' + dm(m.data); }).join(' · ') + '. Confira: pode ser Pix agendado, conta errada ou comprovante falso.</span></span></div>');
      if (cc.saidaSemDesp.length) blocos.push('<div class="alerta mt"><span class="ic">🧾</span><span class="tx"><b>' + cc.saidaSemDesp.length + ' saídas do negócio sem despesa lançada (' + brl(-cc.saidaSemDesp.reduce(function (s, t) { return s + t.valor; }, 0)) + ')</b><span>Lance de uma vez, já com o tipo de despesa.</span></span></div><button class="btn claro cheio peq" id="cDesp">Lançar como despesas</button>');
      if (cc.pesNaoLanc.length) blocos.push('<div class="alerta mt"><span class="ic">🏠</span><span class="tx"><b>' + cc.pesNaoLanc.length + ' gastos pessoais pagos pela conta (' + brl(-cc.pesNaoLanc.reduce(function (s, t) { return s + t.valor; }, 0)) + ')</b><span>Lance como "pra casa" para o lucro do negócio ficar certo.</span></span></div><button class="btn claro cheio peq" id="cPes">Lançar como "pra casa"</button>');
      if (!blocos.length) blocos.push('<div class="alerta mt"><span class="ic">✅</span><span class="tx"><b>Extrato e app batendo</b><span>Nada pendente no que já foi separado.</span></span></div>');
      c.innerHTML = '<h2>Conferência com o app</h2>' + blocos.join('');
      if ($('#cPix', c)) $('#cPix', c).onclick = function () { lancarDoExtrato(cc.pixSemVenda, 'venda'); toast(cc.pixSemVenda.length + ' vendas lançadas ✓'); rotear(); };
      if ($('#cDesp', c)) $('#cDesp', c).onclick = function () { lancarDoExtrato(cc.saidaSemDesp, 'despesa'); toast(cc.saidaSemDesp.length + ' despesas lançadas ✓'); rotear(); };
      if ($('#cPes', c)) $('#cPes', c).onclick = function () { lancarDoExtrato(cc.pesNaoLanc, 'retirada'); toast('Lançado como "pra casa" ✓'); rotear(); };
    } };
  };

  /* =====================================================================
     4. ESTOQUE E CONTAGEM DE MERCADORIA
     ===================================================================== */
  var UN = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'm', 'par'];
  function prod(id) { return E().estoque.prod.filter(function (p) { return p.id === id; })[0]; }
  function margem(p) { return p.preco > 0 ? (p.preco - p.custo) / p.preco * 100 : null; }
  function movEstoque(p, tipo, qtd, custo, obs, data) {
    var es = E().estoque; qtd = +qtd || 0; if (!qtd) return;
    if (tipo === 'entrada') {
      var novoCusto = custo > 0 ? custo : p.custo, tot = Math.max(0, p.qtd) + qtd;
      p.custo = tot > 0 ? arred((Math.max(0, p.qtd) * p.custo + qtd * novoCusto) / tot) : novoCusto; // custo médio
      p.qtd = arred(p.qtd + qtd);
    } else if (tipo === 'ajuste') p.qtd = arred(p.qtd + qtd);
    else p.qtd = arred(p.qtd - qtd);
    es.mov.push({ id: uid(), prod: p.id, tipo: tipo, qtd: qtd, custo: custo || p.custo, data: data || hoje(), obs: obs || '' });
  }
  function abrirProduto(p) {
    var novo = !p;
    p = p ? JSON.parse(JSON.stringify(p)) : { id: uid(), nome: '', un: 'un', custo: 0, preco: 0, qtd: 0, min: 0, cod: '' };
    var f = abrirFolha('<h1>' + (novo ? 'Novo produto' : 'Editar produto') + '</h1>' +
      inp('pNome', 'Nome', p.nome, 'autocomplete="off" ' + (novo ? 'autofocus' : '')) +
      '<label class="campo"><span>Unidade</span><select class="inp" id="pUn">' + UN.map(function (u) { return '<option' + (p.un === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></label>' +
      '<div class="grade">' + inp('pCusto', 'Custo (quanto paga)', valIn(p.custo), 'inputmode="decimal"') + inp('pPreco', 'Preço de venda', valIn(p.preco), 'inputmode="decimal"') +
      (novo ? inp('pQtd', 'Quantidade que tem hoje', '', 'inputmode="decimal"') : '') + inp('pMin', 'Avisar quando ficar abaixo de', p.min ? qtdFmt(p.min) : '', 'inputmode="decimal"') + '</div>' +
      inp('pCod', 'Código (opcional)', p.cod, 'autocomplete="off"') +
      '<button class="btn cheio" style="margin-top:16px" id="pSalvar">Salvar</button>' + (novo ? '' : '<button class="btn verm cheio" style="margin-top:10px" id="pExc">Excluir produto</button>'));
    $('#pSalvar', f).onclick = function () {
      p.nome = $('#pNome', f).value.trim(); p.un = $('#pUn', f).value; p.custo = arred(num($('#pCusto', f).value)); p.preco = arred(num($('#pPreco', f).value)); p.min = num($('#pMin', f).value); p.cod = $('#pCod', f).value.trim();
      if (!p.nome) { toast('Escreva o nome.'); return; }
      var es = E().estoque, i = es.prod.findIndex(function (x) { return x.id === p.id; });
      if (i >= 0) { es.prod[i].nome = p.nome; es.prod[i].un = p.un; es.prod[i].custo = p.custo; es.prod[i].preco = p.preco; es.prod[i].min = p.min; es.prod[i].cod = p.cod; }
      else { var q = num($('#pQtd', f).value); p.qtd = 0; es.prod.push(p); if (q) movEstoque(p, 'ajuste', q, p.custo, 'Estoque inicial'); }
      salvar(); fecharFolha(); rotear(); toast('Produto salvo ✓');
    };
    if ($('#pExc', f)) $('#pExc', f).onclick = function () { confirmar('Excluir ' + p.nome + '?', 'O histórico de entradas e saídas dele também sai.', 'Excluir', function () { var es = E().estoque; es.prod = es.prod.filter(function (x) { return x.id !== p.id; }); es.mov = es.mov.filter(function (m) { return m.prod !== p.id; }); salvar(); rotear(); }, true); };
  }
  function abrirMovimento(p, tipo) {
    var tit = { entrada: 'Chegou mercadoria', saida: 'Saiu (venda ou uso)', perda: 'Perda (venceu, quebrou, sumiu)' }[tipo];
    var f = abrirFolha('<h1>' + tit + '</h1><p class="muted">' + esc(p.nome) + ' · tem ' + qtdFmt(p.qtd) + ' ' + p.un + '</p>' +
      inp('mQtd', 'Quantidade (' + p.un + ')', '', 'inputmode="decimal" autofocus') +
      (tipo === 'entrada' ? inp('mCusto', 'Custo por ' + p.un + ' nesta compra', valIn(p.custo), 'inputmode="decimal"') + '<label class="check"><input type="checkbox" id="mDesp"> Lançar também como despesa de mercadoria</label>' : '') +
      (tipo === 'saida' && p.preco > 0 ? '<label class="check"><input type="checkbox" id="mVenda"> Lançar também como venda (' + brl(p.preco) + ' cada)</label>' : '') +
      inp('mObs', 'Observação (opcional)', '', 'autocomplete="off"') + '<button class="btn cheio" style="margin-top:16px" id="mOk">Confirmar</button>');
    $('#mOk', f).onclick = function () {
      var q = num($('#mQtd', f).value); if (!(q > 0)) { toast('Digite a quantidade.'); return; }
      var custo = $('#mCusto', f) ? arred(num($('#mCusto', f).value)) : p.custo;
      movEstoque(p, tipo, q, custo, $('#mObs', f).value.trim());
      if ($('#mDesp', f) && $('#mDesp', f).checked) E().mov.push({ id: uid(), data: hoje(), tipo: 'despesa', valor: arred(q * custo), forma: '', nat: K.natPadrao(), nf: false, cli: null, venc: '', desc: 'Compra: ' + p.nome, cat: 'mercadoria' });
      salvar(); fecharFolha();
      if ($('#mVenda', f) && $('#mVenda', f).checked) { K.abrirLancar({ tipo: 'venda' }); setTimeout(function () { var v = $('#lValor'), d = $('#lDesc'); if (v) v.value = n2(q * p.preco); if (d) d.value = qtdFmt(q) + ' ' + p.un + ' ' + p.nome; }, 30); }
      else { rotear(); toast('Estoque atualizado ✓'); }
    };
  }
  function abrirListaProdutos() {
    var f = abrirFolha('<h1>Cadastrar vários de uma vez</h1><p class="muted">Um produto por linha: <b>nome; quantidade; custo; preço</b>. Pode colar de uma planilha.</p>' +
      '<textarea class="inp" id="lpTxt" rows="8" style="margin-top:10px;font-family:monospace;font-size:14px" placeholder="Coca-Cola lata; 48; 2,90; 6,00&#10;Pão de queijo (kg); 5; 18; 45"></textarea>' +
      '<button class="btn cheio" style="margin-top:12px" id="lpOk">Cadastrar</button>');
    $('#lpOk', f).onclick = function () {
      var n = 0;
      $('#lpTxt', f).value.split(/\r?\n/).forEach(function (l) {
        var c = l.split(/[;\t]/).map(function (x) { return x.trim(); }); if (!c[0]) return;
        var p = { id: uid(), nome: c[0], un: 'un', custo: arred(num(c[2])), preco: arred(num(c[3])), qtd: 0, min: 0, cod: '' };
        E().estoque.prod.push(p); if (num(c[1])) movEstoque(p, 'ajuste', num(c[1]), p.custo, 'Estoque inicial'); n++;
      });
      salvar(); fecharFolha(); rotear(); toast(n + ' produtos cadastrados ✓');
    };
  }
  R.estoque = function () {
    var es = E().estoque, ps = es.prod.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt'); });
    var valor = ps.reduce(function (s, p) { return s + Math.max(0, p.qtd) * p.custo; }, 0), baixo = ps.filter(function (p) { return p.min > 0 && p.qtd <= p.min; });
    var ult = es.cont.length ? es.cont[es.cont.length - 1] : null;
    var html = topo('Estoque', 'Mercadoria, custo e contagem', '#/mais') + '<main>' +
      '<div class="card hero"><div class="lbl">Valor em estoque (pelo custo)</div><div class="big">' + brl(valor) + '</div>' +
      '<p style="color:#BFE3DE;margin-top:6px">' + ps.length + ' produtos' + (baixo.length ? ' · <b style="color:#FFD9A0">' + baixo.length + ' acabando</b>' : '') + (ult ? ' · última contagem ' + dm(ult.data) : '') + '</p></div>' +
      '<div class="linhaBtns"><button class="btn mint" id="sNovo">+ Produto</button><a class="btn claro" href="#/contagem">Fazer contagem</a></div>' +
      (ps.length ? '' : '<button class="btn linha cheio" style="margin-top:10px" id="sLista">Cadastrar vários de uma vez</button>') +
      (baixo.length ? '<div class="alerta am" style="margin-top:12px"><span class="ic">📦</span><span class="tx"><b>Hora de comprar</b><span>' + baixo.map(function (p) { return esc(p.nome) + ' (' + qtdFmt(p.qtd) + ' ' + p.un + ')'; }).join(' · ') + '</span></span></div>' : '') +
      '<h2>Produtos</h2>' + (ps.length ? '<div class="lista">' + ps.map(function (p) {
        var mg = margem(p);
        return '<div class="item" style="flex-wrap:wrap"><button class="meio" data-pe="' + p.id + '" style="background:none;border:0;text-align:left;font:inherit;color:inherit;padding:0;cursor:pointer"><b>' + esc(p.nome) + '</b><span>custo ' + brl(p.custo) + (p.preco ? ' · vende ' + brl(p.preco) : '') + (mg != null ? ' · margem ' + pct(mg) : '') + '</span></button>' +
          '<span class="val ' + (p.min > 0 && p.qtd <= p.min ? 'menos' : '') + '">' + qtdFmt(p.qtd) + ' ' + p.un + '</span>' +
          '<div class="chips" style="width:100%;margin-top:6px"><button class="chip peq" data-pm="entrada" data-p="' + p.id + '">+ Chegou</button><button class="chip peq" data-pm="saida" data-p="' + p.id + '">− Saiu</button><button class="chip peq" data-pm="perda" data-p="' + p.id + '">Perda</button></div></div>';
      }).join('') + '</div>' : '<div class="lista"><div class="vazio"><span class="ic">📦</span>Cadastre o que você vende ou usa: mercadoria, insumo, material.</div></div>') +
      (ps.some(function (p) { var m = margem(p); return m != null && m < 20; }) ? '<div class="dica">Produtos com margem abaixo de 20% quase não deixam lucro depois das taxas e despesas. Veja quanto cobrar na <a href="#/calculadora">calculadora</a>.</div>' : '') +
      (es.cont.length ? '<h2>Contagens anteriores</h2><div class="lista">' + es.cont.slice(-6).reverse().map(function (c) { return '<div class="item"><span class="meio"><b>' + dma(c.data) + '</b><span>' + c.itens.length + ' produtos contados</span></span><span class="val ' + (c.difValor < 0 ? 'menos' : c.difValor > 0 ? 'mais' : '') + '">' + (c.difValor ? (c.difValor > 0 ? '+' : '') + brl(c.difValor) : 'bateu ✓') + '</span></div>'; }).join('') + '</div>' : '') +
      '</main>';
    return { html: html, montar: function (el) {
      $('#sNovo', el).onclick = function () { abrirProduto(); };
      if ($('#sLista', el)) $('#sLista', el).onclick = abrirListaProdutos;
      $$('[data-pe]', el).forEach(function (b) { b.onclick = function () { abrirProduto(prod(b.dataset.pe)); }; });
      $$('[data-pm]', el).forEach(function (b) { b.onclick = function () { abrirMovimento(prod(b.dataset.p), b.dataset.pm); }; });
    } };
  };
  R.contagem = function () {
    var ps = E().estoque.prod.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt'); });
    var html = topo('Contagem', 'Conte o que tem na prateleira', '#/estoque') + '<main>' +
      (ps.length ? '<p class="muted">Digite quanto você contou de cada produto. Deixe em branco o que não contou. O app mostra a diferença em quantidade e em dinheiro.</p>' +
        '<input class="inp" id="kBusca" placeholder="Buscar produto…" style="margin-top:10px" autocomplete="off">' +
        '<div class="lista" style="margin-top:10px">' + ps.map(function (p) { return '<div class="item" data-nome="' + esc(normal(p.nome)) + '"><span class="meio"><b>' + esc(p.nome) + '</b><span>no app: ' + qtdFmt(p.qtd) + ' ' + p.un + '</span></span><input class="inp" data-k="' + p.id + '" inputmode="decimal" placeholder="contei" style="width:96px;text-align:right"><span class="peq" data-kd="' + p.id + '" style="width:92px;text-align:right"></span></div>'; }).join('') + '</div>' +
        '<div class="card" style="margin-top:14px" id="kRes"><p class="muted">Diferença total: <b id="kTot">R$ 0,00</b> em <b id="kQ">0</b> produtos contados</p></div>' +
        '<button class="btn mint cheio" style="margin-top:12px" id="kOk">Confirmar contagem e ajustar estoque</button>' :
        '<div class="lista"><div class="vazio">Cadastre os produtos no <a href="#/estoque">estoque</a> antes de contar.</div></div>') + '</main>';
    return { html: html, montar: function (el) {
      if (!ps.length) return;
      function calc() {
        var tot = 0, q = 0;
        $$('[data-k]', el).forEach(function (i) {
          var p = prod(i.dataset.k), out = $('[data-kd="' + p.id + '"]', el);
          if (i.value.trim() === '') { out.innerHTML = ''; return; }
          var d = arred(num(i.value) - p.qtd), v = arred(d * p.custo); tot += v; q++;
          out.innerHTML = d === 0 ? '<span style="color:var(--green)">bateu ✓</span>' : '<span style="color:' + (d < 0 ? 'var(--red)' : 'var(--green)') + '">' + (d > 0 ? '+' : '') + qtdFmt(d) + '<br>' + (v > 0 ? '+' : '') + brl(v) + '</span>';
        });
        $('#kTot', el).textContent = (tot > 0 ? '+' : '') + brl(tot); $('#kTot', el).style.color = tot < 0 ? 'var(--red)' : ''; $('#kQ', el).textContent = q;
      }
      $$('[data-k]', el).forEach(function (i) { i.oninput = calc; });
      $('#kBusca', el).oninput = function () { var b = normal(this.value); $$('[data-nome]', el).forEach(function (r) { r.style.display = !b || r.dataset.nome.indexOf(b) >= 0 ? '' : 'none'; }); };
      $('#kOk', el).onclick = function () {
        var itens = [], dif = 0;
        $$('[data-k]', el).forEach(function (i) { if (i.value.trim() === '') return; var p = prod(i.dataset.k), c = num(i.value), d = arred(c - p.qtd); itens.push({ prod: p.id, nome: p.nome, sistema: p.qtd, contado: c, dif: d, valor: arred(d * p.custo) }); dif += d * p.custo; if (d) movEstoque(p, 'ajuste', d, p.custo, 'Contagem'); });
        if (!itens.length) { toast('Digite pelo menos uma quantidade.'); return; }
        E().estoque.cont.push({ id: uid(), data: hoje(), itens: itens, difValor: arred(dif) }); salvar(); track('ContagemEstoque', { itens: itens.length });
        var faltas = itens.filter(function (x) { return x.dif < 0; }).sort(function (a, b) { return a.valor - b.valor; });
        var mostrar = function () { abrirFolha('<h1>Contagem salva ✓</h1><div class="achado" style="color:' + (dif < 0 ? 'var(--red)' : 'var(--green)') + '">' + (dif > 0 ? '+' : '') + brl(dif) + '</div><p class="muted">de diferença em ' + itens.length + ' produtos. O estoque do app foi ajustado para o que você contou.</p>' +
          (faltas.length ? '<h2>O que mais faltou</h2><table class="t">' + faltas.slice(0, 8).map(function (x) { return '<tr><td>' + esc(x.nome) + '</td><td class="n">' + qtdFmt(x.dif) + '</td><td class="n">' + brl(x.valor) + '</td></tr>'; }).join('') + '</table><div class="dica">Falta frequente no mesmo produto pode ser venda sem lançar, perda não anotada, erro de entrega do fornecedor ou furto. Conte de novo na próxima semana para comparar.</div>' : '') +
          '<button class="btn cheio" style="margin-top:14px" data-fechar>Ok</button>'); };
        var aoTrocar = function () { window.removeEventListener('hashchange', aoTrocar); setTimeout(mostrar, 40); };
        window.addEventListener('hashchange', aoTrocar); location.hash = '#/estoque';
      };
    } };
  };

  /* =====================================================================
     5. DEVOLUÇÃO DE NOTA (a partir do XML da NF-e)
     Monta o "espelho" da nota de devolução para conferir antes de emitir.
     ===================================================================== */
  function tagTxt(el, nome) { if (!el) return ''; var x = el.getElementsByTagName(nome)[0]; return x ? x.textContent.trim() : ''; }
  function tagNum(el, nome) { var t = tagTxt(el, nome); return t ? parseFloat(t) : 0; }
  function lerNFe(texto) {
    var doc = new DOMParser().parseFromString(texto, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Esse arquivo não é um XML válido.');
    var inf = doc.getElementsByTagName('infNFe')[0]; if (!inf) throw new Error('Não achei uma NF-e nesse XML. Use o XML da nota (o arquivo .xml que vem por e-mail ou fica no portal).');
    var ide = inf.getElementsByTagName('ide')[0], emit = inf.getElementsByTagName('emit')[0], dest = inf.getElementsByTagName('dest')[0];
    var chave = tagTxt(doc, 'chNFe') || (inf.getAttribute('Id') || '').replace(/^NFe/, '');
    var itens = Array.prototype.map.call(inf.getElementsByTagName('det'), function (d) {
      var p = d.getElementsByTagName('prod')[0], imp = d.getElementsByTagName('imposto')[0], icms = imp ? imp.getElementsByTagName('ICMS')[0] : null, g = icms ? icms.firstElementChild : null, ipi = imp ? imp.getElementsByTagName('IPI')[0] : null;
      return { n: d.getAttribute('nItem'), cod: tagTxt(p, 'cProd'), nome: tagTxt(p, 'xProd'), ncm: tagTxt(p, 'NCM'), cfop: tagTxt(p, 'CFOP'), un: tagTxt(p, 'uCom'), q: tagNum(p, 'qCom'), vUn: tagNum(p, 'vUnCom'),
        vProd: tagNum(p, 'vProd'), vFrete: tagNum(p, 'vFrete'), vSeg: tagNum(p, 'vSeg'), vDesc: tagNum(p, 'vDesc'), vOutro: tagNum(p, 'vOutro'),
        cst: g ? (tagTxt(g, 'CST') ? 'CST ' + tagTxt(g, 'orig') + tagTxt(g, 'CST') : 'CSOSN ' + tagTxt(g, 'CSOSN')) : '', vBC: tagNum(g, 'vBC'), pICMS: tagNum(g, 'pICMS'), vICMS: tagNum(g, 'vICMS'),
        vBCST: tagNum(g, 'vBCST'), vST: tagNum(g, 'vICMSST'), vIPI: ipi ? tagNum(ipi, 'vIPI') : 0 };
    });
    var tot = inf.getElementsByTagName('ICMSTot')[0];
    return { chave: chave, num: tagTxt(ide, 'nNF'), serie: tagTxt(ide, 'serie'), data: (tagTxt(ide, 'dhEmi') || tagTxt(ide, 'dEmi')).slice(0, 10), natOp: tagTxt(ide, 'natOp'),
      emit: { doc: tagTxt(emit, 'CNPJ') || tagTxt(emit, 'CPF'), nome: tagTxt(emit, 'xNome'), uf: tagTxt(emit, 'UF'), ie: tagTxt(emit, 'IE'), crt: tagTxt(emit, 'CRT') },
      dest: { doc: tagTxt(dest, 'CNPJ') || tagTxt(dest, 'CPF'), nome: tagTxt(dest, 'xNome'), uf: tagTxt(dest, 'UF'), ie: tagTxt(dest, 'IE') },
      itens: itens, vNF: tot ? tagNum(tot, 'vNF') : 0 };
  }
  // Sugestão de CFOP da devolução a partir do CFOP do item na nota original
  function cfopDevolucao(cfop, lado, mesmaUF, industria) {
    var fim = String(cfop).slice(1), ini;
    if (lado === 'compra') { // eu devolvo ao fornecedor: nota de saída
      ini = mesmaUF ? '5' : '6';
      var mapC = { '101': industria ? '201' : '202', '102': industria ? '201' : '202', '401': industria ? '410' : '411', '403': industria ? '410' : '411', '405': industria ? '410' : '411', '551': '553' };
      return mapC[fim] ? ini + '.' + mapC[fim] : null;
    }
    ini = mesmaUF ? '1' : '2'; // cliente devolveu: nota de entrada
    var mapV = { '101': '201', '102': '202', '401': '410', '403': '411', '405': '411' };
    return mapV[fim] ? ini + '.' + mapV[fim] : null;
  }
  var NOME_CFOP = { '201': 'Devolução de compra para industrialização', '202': 'Devolução de compra para comercialização', '410': 'Devolução de compra para industrialização com ST', '411': 'Devolução de compra para comercialização com ST', '553': 'Devolução de compra de bem para o ativo imobilizado' };
  var NOME_CFOP_E = { '201': 'Devolução de venda de produção do estabelecimento', '202': 'Devolução de venda de mercadoria adquirida de terceiros', '410': 'Devolução de venda de produção do estabelecimento com ST', '411': 'Devolução de venda de mercadoria adquirida com ST' };
  function calcDevolucao(nf, qtds) {
    var t = { vProd: 0, vDesc: 0, vFrete: 0, vSeg: 0, vOutro: 0, vBC: 0, vICMS: 0, vBCST: 0, vST: 0, vIPI: 0 }, linhas = [];
    nf.itens.forEach(function (it, i) {
      var q = Math.min(it.q, Math.max(0, +qtds[i] || 0)); if (!q) return;
      var f = it.q ? q / it.q : 0, l = { it: it, q: q, f: f };
      Object.keys(t).forEach(function (k) { l[k] = arred((it[k] || 0) * f); t[k] = arred(t[k] + l[k]); });
      linhas.push(l);
    });
    t.vNF = arred(t.vProd - t.vDesc + t.vFrete + t.vSeg + t.vOutro + t.vST + t.vIPI);
    return { linhas: linhas, t: t, total: linhas.length && linhas.every(function (l) { return l.f === 1; }) && linhas.length === nf.itens.length };
  }
  R.devolucao = function () {
    var html = topo('Devolução de nota', 'Calcule a devolução a partir da nota original', '#/mais') + '<main>' +
      '<p class="muted">Escolha o <b>XML</b> da nota original (o arquivo .xml que vem por e-mail com a nota, ou que você baixa no portal da Sefaz). O app separa os itens, calcula os valores da devolução na proporção certa e sugere o CFOP.</p>' +
      '<label class="drop"><input type="file" id="dArq" accept=".xml,text/xml,application/xml"><b>📂 Escolher o XML da NF-e</b><span class="muted peq">o arquivo é lido só no seu celular</span></label>' +
      '<div class="aviso" style="margin-top:12px">Isto é um <b>rascunho para conferência</b>. A nota de devolução é emitida no seu emissor (Sefaz ou sistema). Regras de ICMS e de ST mudam por estado e por regime: confirme com o seu contador antes de emitir.</div>' +
      '<div id="dRes"></div></main>';
    return { html: html, montar: function (el) {
      $('#dArq', el).onchange = function (e) {
        var file = e.target.files[0]; if (!file) return;
        lerArquivoTexto(file).then(lerNFe).then(function (nf) { mostrar(nf); track('DevolucaoNota'); }).catch(function (err) { $('#dRes', el).innerHTML = '<div class="aviso" style="margin-top:12px">' + esc(err.message) + '</div>'; });
        e.target.value = '';
      };
      function mostrar(nf) {
        var meu = (K.E().neg.cnpj || '').replace(/\D/g, ''), lado = meu && meu === nf.dest.doc ? 'compra' : meu && meu === nf.emit.doc ? 'venda' : 'compra';
        var r = $('#dRes', el);
        r.innerHTML = '<div class="card" style="margin-top:14px"><p class="peq muted">Nota original</p><b>NF-e nº ' + esc(nf.num) + ' · série ' + esc(nf.serie) + ' · ' + dma(nf.data) + '</b>' +
          '<p class="peq" style="margin-top:6px">Emitente: ' + esc(nf.emit.nome) + ' (' + esc(nf.emit.uf) + ')<br>Destinatário: ' + esc(nf.dest.nome) + ' (' + esc(nf.dest.uf) + ')<br>Valor da nota: <b>' + brl(nf.vNF) + '</b></p>' +
          '<p class="peq muted" style="margin-top:6px;word-break:break-all">Chave: ' + esc(nf.chave) + '</p></div>' +
          '<h2>Quem está devolvendo?</h2><div class="seg" id="dLado"><button data-l="compra">Eu comprei e vou devolver</button><button data-l="venda">Meu cliente me devolveu</button></div>' +
          '<h2>Itens e quantidades a devolver</h2><div class="linhaBtns" style="margin-top:0"><button class="btn linha peq" id="dTudo">Devolver tudo</button><button class="btn linha peq" id="dNada">Zerar</button></div>' +
          '<div class="lista" style="margin-top:8px">' + nf.itens.map(function (it, i) { return '<div class="item"><span class="meio"><b>' + esc(it.nome) + '</b><span>' + qtdFmt(it.q) + ' ' + esc(it.un) + ' × ' + brl(it.vUn) + ' · CFOP ' + esc(it.cfop) + '</span></span><input class="inp" data-dq="' + i + '" inputmode="decimal" value="' + qtdFmt(it.q) + '" style="width:90px;text-align:right"></div>'; }).join('') + '</div>' +
          '<div id="dCalc"></div>';
        function lerQtds() { return $$('[data-dq]', r).map(function (i) { return num(i.value); }); }
        function calc() {
          $$('#dLado button', r).forEach(function (b) { b.classList.toggle('on', b.dataset.l === lado); });
          var d = calcDevolucao(nf, lerQtds()), out = $('#dCalc', r);
          if (!d.linhas.length) { out.innerHTML = '<p class="muted" style="margin-top:12px">Digite a quantidade de pelo menos um item.</p>'; return; }
          var mesmaUF = nf.emit.uf === nf.dest.uf, ind = K.natPadrao() === 'industria';
          var cfops = {}; d.linhas.forEach(function (l) { l.cfop = cfopDevolucao(l.it.cfop, lado, mesmaUF, ind); if (l.cfop) cfops[l.cfop] = 1; });
          var nomes = lado === 'compra' ? NOME_CFOP : NOME_CFOP_E, natOp = Object.keys(cfops).length === 1 ? (nomes[Object.keys(cfops)[0].slice(2)] || 'Devolução') : 'Devolução de mercadoria';
          var quem = lado === 'compra' ? nf.emit : nf.dest;
          var info = 'Devolução ' + (d.total ? 'total' : 'parcial') + ' referente à NF-e nº ' + nf.num + ', série ' + nf.serie + ', de ' + dma(nf.data) + ', chave de acesso ' + nf.chave + '. Motivo: __________.';
          var linhaT = function (rot, v) { return v ? '<tr><td>' + rot + '</td><td class="n">' + brl(v) + '</td></tr>' : ''; };
          out.innerHTML = '<h2>Espelho da nota de devolução</h2><div class="card">' +
            '<table class="t"><tr><td>Tipo da nota</td><td class="n">' + (lado === 'compra' ? 'Saída' : 'Entrada') + '</td></tr><tr><td>Finalidade</td><td class="n">4 – Devolução</td></tr><tr><td>Natureza da operação</td><td class="n">' + esc(natOp) + '</td></tr>' +
            '<tr><td>' + (lado === 'compra' ? 'Destinatário (quem recebe de volta)' : 'Remetente (quem devolveu)') + '</td><td class="n quebra">' + esc(quem.nome) + '<br><span class="peq muted">' + esc(quem.doc) + ' · ' + esc(quem.uf) + '</span></td></tr>' +
            '<tr><td>Nota referenciada (chave)</td><td class="n peq quebra">' + esc(nf.chave) + '</td></tr></table>' +
            '<h3 style="margin-top:14px;font-size:17px">Itens</h3><table class="t itens"><tr><th>Item</th><th class="n">Qtd</th><th class="n">Valor</th><th class="n">CFOP</th></tr>' + d.linhas.map(function (l) {
              return '<tr><td>' + esc(l.it.nome) + '<br><span class="peq muted">' + esc(l.it.cst) + (l.vICMS ? ' · ICMS ' + brl(l.vICMS) : '') + (l.vST ? ' · ST ' + brl(l.vST) : '') + (l.vIPI ? ' · IPI ' + brl(l.vIPI) : '') + '</span></td><td class="n">' + qtdFmt(l.q) + '</td><td class="n">' + brl(l.vProd) + '</td><td class="n">' + (l.cfop || '<span class="peq">confirme</span>') + '</td></tr>';
            }).join('') + '</table>' +
            '<h3 style="margin-top:14px;font-size:17px">Totais</h3><table class="t">' + linhaT('Produtos', d.t.vProd) + linhaT('(−) Desconto', d.t.vDesc) + linhaT('Frete', d.t.vFrete) + linhaT('Seguro', d.t.vSeg) + linhaT('Outras despesas', d.t.vOutro) +
            linhaT('Base do ICMS', d.t.vBC) + linhaT('ICMS', d.t.vICMS) + linhaT('Base do ICMS-ST', d.t.vBCST) + linhaT('ICMS-ST', d.t.vST) + linhaT('IPI (no campo IPI devolvido)', d.t.vIPI) +
            '<tr><td><b>Total da nota de devolução</b></td><td class="n"><b>' + brl(d.t.vNF) + '</b></td></tr></table>' +
            '<p class="peq quebra" style="margin-top:12px"><b>Informações complementares:</b><br>' + esc(info) + '</p></div>' +
            (Object.keys(cfops).length < d.linhas.length ? '<div class="aviso">Algum item tem um CFOP original fora do padrão de venda (ex.: remessa, bonificação, industrialização por encomenda). Nesses casos a devolução tem CFOP próprio: confirme com o seu contador.</div>' : '') +
            (lado === 'venda' && nf.dest.ie && !/isento/i.test(nf.dest.ie) ? '<div class="dica">Seu cliente tem inscrição estadual: normalmente é <b>ele</b> quem emite a nota de devolução. Mande este espelho para ele conferir os valores.</div>' : '') +
            '<div class="linhaBtns"><button class="btn claro" id="dCopiar">Copiar resumo</button><button class="btn" id="dImp">Imprimir ou PDF</button></div>';
          $('#dCopiar', out).onclick = function () {
            var txt = 'ESPELHO DA NOTA DE DEVOLUÇÃO\nNota original: NF-e ' + nf.num + '/' + nf.serie + ' de ' + dma(nf.data) + ' – chave ' + nf.chave + '\nNatureza: ' + natOp + ' · Finalidade 4 (devolução)\n' +
              d.linhas.map(function (l) { return '- ' + l.it.nome + ': ' + qtdFmt(l.q) + ' ' + l.it.un + ' = ' + brl(l.vProd) + ' · CFOP ' + (l.cfop || 'confirmar') + (l.vICMS ? ' · ICMS ' + brl(l.vICMS) : '') + (l.vST ? ' · ST ' + brl(l.vST) : '') + (l.vIPI ? ' · IPI ' + brl(l.vIPI) : ''); }).join('\n') +
              '\nTotal da nota: ' + brl(d.t.vNF) + '\nInformações complementares: ' + info;
            copiar(txt, 'Resumo copiado');
          };
          $('#dImp', out).onclick = function () { imprimir('<h3>ESPELHO DA NOTA DE DEVOLUÇÃO (rascunho para conferência)</h3>' + out.querySelector('.card').innerHTML); };
        }
        $$('#dLado button', r).forEach(function (b) { b.onclick = function () { lado = b.dataset.l; calc(); }; });
        $$('[data-dq]', r).forEach(function (i) { i.oninput = calc; });
        $('#dTudo', r).onclick = function () { $$('[data-dq]', r).forEach(function (i, k) { i.value = qtdFmt(nf.itens[k].q); }); calc(); };
        $('#dNada', r).onclick = function () { $$('[data-dq]', r).forEach(function (i) { i.value = ''; }); calc(); };
        calc(); r.scrollIntoView({ behavior: 'smooth' });
      }
    } };
  };

  /* =====================================================================
     6. BIBLIOTECA, MENU DA PLATAFORMA E ALERTAS DO INÍCIO
     ===================================================================== */
  /* =====================================================================
     7. RELATÓRIO DA CONFERÊNCIA (maquininha × vendas do app × banco × taxa)
     Quem acha a diferença é a conta, com regras fixas (não é "palpite" da IA).
     Cada achado sai pronto: o que aconteceu, possíveis causas, o que fazer e,
     quando faz sentido, a mensagem para mandar à maquininha.
     ===================================================================== */
  var ADQ = /\b(stone|cielo|rede|getnet|pagseguro|pag seguro|pagbank|sumup|infinitepay|infinite pay|mercado ?pago|ton|safrapay|vero|sipag|sicredi|cabal|granito|banrisul vero)\b/;
  var NOME_G = { debito: 'débito', credito: 'crédito', pix: 'Pix na maquininha', voucher: 'vale-refeição' };
  function grupoMod(m) { return m === 'debito' || m === 'pre_pago' ? 'debito' : m === 'pix' ? 'pix' : m === 'voucher' ? 'voucher' : 'credito'; }
  function distDias(a, b) { return Math.abs(Math.round((deISO(a) - deISO(b)) / 864e5)); }
  function hhmm(v) {
    if (v instanceof Date && !isNaN(v) && (v.getHours() || v.getMinutes())) return ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2);
    if (typeof v === 'number' && v > 0 && v < 1) { var m = Math.round(v * 1440); return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); }
    if (typeof v === 'number' && v > 20000) { var f = v % 1; return f ? hhmm(f) : ''; }
    var x = String(v == null ? '' : v).match(/(\d{1,2}):(\d{2})/);
    return x ? ('0' + x[1]).slice(-2) + ':' + x[2] : '';
  }
  // Colunas que o leitor da maquininha não usa, mas a conferência precisa
  function colunasExtras(cab) {
    var m = { aut: -1, hora: -1, pag: -1 };
    cab.map(normal).forEach(function (h, j) {
      if (m.pag < 0 && /(previs|data (do |de |da )?(pagamento|credito|recebimento|liquidacao|vencimento)|pago em|recebido em|data pagto)/.test(h)) m.pag = j;
      else if (m.hora < 0 && /^(hora|horario)/.test(h)) m.hora = j;
      else if (m.aut < 0 && /(nsu|autoriz|cod(igo)? (da )?(venda|transacao)|id (da )?transacao|^tid$|^doc)/.test(h)) m.aut = j;
    });
    return m;
  }
  function lerMaquininha(rows, det) {
    var v = Motor.vendas(rows, det), x = colunasExtras(det.cabecalho), mp = det.mapa;
    var lista = v.vendas.filter(function (s) { return s.data; }).map(function (s) {
      var L = rows[s.linha - 1] || [];
      s.dia = iso(s.data);
      s.hora = x.hora >= 0 ? hhmm(L[x.hora]) : hhmm(L[mp.data]);
      s.aut = x.aut >= 0 ? String(L[x.aut] == null ? '' : L[x.aut]).trim() : '';
      var pg = x.pag >= 0 ? Motor.data(L[x.pag]) : null; s.pag = pg ? iso(pg) : null;
      var lq = mp.liquido >= 0 ? Math.abs(Motor.numero(L[mp.liquido])) : NaN;
      s.liq = arred(isNaN(lq) ? s.bruto - s.desconto : lq);
      s.g = grupoMod(s.mod);
      s.info = (s.hora ? s.hora + ' · ' : '') + (s.bandeira !== '—' ? s.bandeira + ' ' : '') + NOME_G[s.g] + (s.aut ? ' · NSU/aut. ' + s.aut : '');
      return s;
    });
    return { vendas: lista, temPag: x.pag >= 0 };
  }
  function soma(l, f) { return arred(l.reduce(function (s, x) { return s + (f ? f(x) : x.valor); }, 0)); }
  function subconjunto(cands, alvo, max) {
    cands = cands.slice().sort(function (a, b) { return b.bruto - a.bruto; }).slice(0, 40);
    var n = cands.length, i, j, k;
    for (i = 0; i < n; i++) if (Math.abs(cands[i].bruto - alvo) <= 0.05) return [cands[i]];
    if (max < 2) return null;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) if (Math.abs(cands[i].bruto + cands[j].bruto - alvo) <= 0.05) return [cands[i], cands[j]];
    if (max < 3) return null;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) for (k = j + 1; k < n; k++) if (Math.abs(cands[i].bruto + cands[j].bruto + cands[k].bruto - alvo) <= 0.05) return [cands[i], cands[j], cands[k]];
    return null;
  }

  // Vendas do app no cartão × vendas da maquininha, dia a dia
  function compararVendas(vm, movs, ini, fim) {
    var TOL = 0.05, J = 3, G = {}, ach = [], dias = {};
    function cel(d, g) { var k = d + '|' + g; return G[k] || (G[k] = { d: d, g: g, app: 0, maq: 0, vendas: [], movs: [] }); }
    vm.forEach(function (s) { if (s.g === 'debito' || s.g === 'credito') { var c = cel(s.dia, s.g); c.maq += s.bruto; c.vendas.push(s); } });
    movs.forEach(function (m) { var c = cel(m.data, m.forma); c.app += m.valor; c.movs.push(m); });
    var L = Object.keys(G).map(function (k) { var c = G[k]; c.res = arred(c.app - c.maq); return c; })
      .filter(function (c) { return c.d >= ini && c.d <= fim; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    var diasOk = 0, diasTot = {};
    L.forEach(function (c) { diasTot[c.d] = 1; });
    function outroDia(lista, rot) {
      lista.forEach(function (a) {
        if (Math.abs(a.res) <= TOL) return;
        var melhor = null;
        lista.forEach(function (b) {
          if (b === a || Math.abs(b.res) <= TOL) return;
          var x = distDias(a.d, b.d); if (x && x <= J && Math.abs(a.res + b.res) <= TOL && (!melhor || x < melhor.x)) melhor = { b: b, x: x };
        });
        if (!melhor) return;
        var pos = a.res > 0 ? a : melhor.b, neg = a.res > 0 ? melhor.b : a;
        ach.push({ tipo: 'outroDia', valor: pos.res, d: neg.d, d2: pos.d, g: rot || NOME_G[pos.g] });
        a.res = 0; melhor.b.res = 0;
      });
    }
    ['debito', 'credito'].forEach(function (g) { outroDia(L.filter(function (c) { return c.g === g; })); });
    L.forEach(function (c) { (dias[c.d] = dias[c.d] || { d: c.d })[c.g] = c; });
    Object.keys(dias).forEach(function (d) {
      var x = dias[d];
      if (x.debito && x.credito && Math.abs(x.debito.res) > TOL && Math.abs(x.debito.res + x.credito.res) <= TOL) {
        ach.push({ tipo: 'trocado', valor: Math.abs(x.debito.res), d: d, comoApp: x.debito.res > 0 ? 'débito' : 'crédito', comoMaq: x.debito.res > 0 ? 'crédito' : 'débito' });
        x.debito.res = 0; x.credito.res = 0;
      }
    });
    var N = Object.keys(dias).sort().map(function (d) {
      var x = dias[d], cs = [x.debito, x.credito].filter(Boolean);
      return { d: d, res: arred(cs.reduce(function (s, c) { return s + c.res; }, 0)), vendas: [].concat.apply([], cs.map(function (c) { return c.vendas; })), movs: [].concat.apply([], cs.map(function (c) { return c.movs; })) };
    });
    outroDia(N, 'cartão');
    var sobras = [];
    N.forEach(function (n) {
      if (Math.abs(n.res) <= TOL) { diasOk++; return; }
      if (n.res > 0) {
        var iguais = n.movs.filter(function (m) { return Math.abs(m.valor - n.res) <= TOL; });
        var dup = iguais.length && n.movs.filter(function (m) { return Math.abs(m.valor - iguais[0].valor) <= 0.01; }).length > 1;
        sobras.push({ tipo: 'soApp', valor: n.res, d: n.d, movs: iguais, dup: dup });
      } else {
        var comb = subconjunto(n.vendas, -n.res, 3);
        sobras.push({ tipo: 'soMaq', valor: -n.res, d: n.d, vendas: comb, maiores: comb ? null : n.vendas.slice().sort(function (a, b) { return b.bruto - a.bruto; }).slice(0, 3) });
      }
    });
    // pareamento aproximado: provável venda de outro dia lançada com valor um pouco diferente
    sobras.forEach(function (a) {
      if (a.tipo !== 'soApp' || a.valor < 20) return;
      sobras.forEach(function (b) {
        if (b.tipo !== 'soMaq' || b.prov || a.prov) return;
        var x = distDias(a.d, b.d);
        if (x <= J && Math.abs(a.valor - b.valor) <= 0.06 * Math.max(a.valor, b.valor)) { a.prov = b; b.prov = a; }
      });
    });
    return { ach: ach.concat(sobras), dias: Object.keys(diasTot).length, diasOk: diasOk };
  }

  // O que a maquininha disse que ia pagar × o que caiu no banco, por dia de pagamento
  function compararBanco(vm, trans) {
    var cred = trans.filter(function (t) { return t.valor > 0 && ADQ.test(normal(t.desc)); });
    if (!cred.length || !trans.length) return null;
    var datas = trans.map(function (t) { return t.data; }).sort(), bi = datas[0], bf = datas[datas.length - 1];
    var esp = {}, rec = {}, det = {};
    vm.forEach(function (s) { if (s.pag && s.pag >= bi && s.pag <= bf) { esp[s.pag] = (esp[s.pag] || 0) + s.liq; } });
    var pags = Object.keys(esp).sort(); if (!pags.length) return null;
    var pi = pags[0], pf = pags[pags.length - 1];
    cred.forEach(function (t) { if (t.data >= pi && t.data <= somaDias(pf, 3)) { rec[t.data] = (rec[t.data] || 0) + t.valor; (det[t.data] = det[t.data] || []).push(t); } });
    var D = {}; Object.keys(esp).concat(Object.keys(rec)).forEach(function (d) { D[d] = { d: d, esp: arred(esp[d] || 0), rec: arred(rec[d] || 0) }; });
    var L = Object.keys(D).sort().map(function (d) { var x = D[d]; x.res = arred(x.rec - x.esp); return x; });
    // pagamento que caiu no dia útil seguinte (fim de semana e feriado)
    L.forEach(function (a) {
      if (a.res >= -0.05) return;
      L.forEach(function (b) { if (a.res < -0.05 && b.res > 0.05 && b.d > a.d && distDias(a.d, b.d) <= 4 && Math.abs(a.res + b.res) <= 0.05) { a.res = 0; b.res = 0; } });
    });
    var falta = L.filter(function (x) { return x.res < -0.05; }), sobra = L.filter(function (x) { return x.res > 0.05; });
    return { pi: pi, pf: pf, esperado: soma(L, function (x) { return x.esp; }), recebido: soma(L, function (x) { return x.rec; }), falta: falta, sobra: sobra, totalFalta: -soma(falta, function (x) { return x.res; }), totalSobra: soma(sobra, function (x) { return x.res; }) };
  }

  // Taxa cobrada × combinada, com detecção de "taxa promocional que acabou"
  function analisarTaxa(vm, contratos) {
    var a = Motor.auditar(vm, contratos), por = {};
    a.acima.forEach(function (x) { (por[x.venda.mod] = por[x.venda.mod] || []).push(x); });
    var grupos = Object.keys(por).map(function (mod) {
      var l = por[mod], g = a.grupos.filter(function (y) { return y.mod === mod; })[0];
      var desde = l.map(function (x) { return iso(x.venda.data); }).sort()[0];
      var todasDepois = vm.filter(function (s) { return s.mod === mod && s.dia >= desde; });
      var mudou = todasDepois.length >= 3 && l.length >= todasDepois.length * 0.9 && vm.some(function (s) { return s.mod === mod && s.dia < desde; });
      var taxas = l.map(function (x) { return x.venda.taxa; }).sort(function (p, q) { return p - q; });
      return { mod: mod, nome: Motor.MODS[mod], qtd: l.length, valor: arred(l.reduce(function (s, x) { return s + x.dif; }, 0)), ref: g.ref, fonte: g.fonte, cobrada: taxas[Math.floor(taxas.length / 2)], desde: desde, mudou: mudou, lista: l };
    }).sort(function (p, q) { return q.valor - p.valor; });
    return { a: a, grupos: grupos };
  }

  function pctBR(n) { return (+n).toFixed(2).replace('.', ',') + '%'; }
  function montarRelatorio(dados) {
    var vm = dados.vendas, ini = vm.reduce(function (m, s) { return !m || s.dia < m ? s.dia : m; }, null), fim = vm.reduce(function (m, s) { return !m || s.dia > m ? s.dia : m; }, null);
    var nome = dados.negocio || 'meu negócio', itens = [], ok = [], avisos = [];
    var cartao = vm.filter(function (s) { return s.g === 'debito' || s.g === 'credito'; });
    // 1) taxa
    var tx = analisarTaxa(vm, dados.contratos);
    tx.grupos.forEach(function (g) {
      var lista = g.lista.slice().sort(function (p, q) { return p.venda.dia < q.venda.dia ? -1 : 1; });
      var msg = 'Olá! Sou cliente (' + nome + '). Conferindo meu extrato de vendas de ' + dm(ini) + ' a ' + dm(fim) + ', encontrei ' + g.qtd + ' vendas no ' + g.nome.toLowerCase() + ' cobradas a ' + pctBR(g.cobrada) + ', mas a minha taxa ' + (g.fonte === 'contrato' ? 'combinada' : 'de sempre') + ' é ' + pctBR(g.ref) + '. A diferença soma ' + brl(g.valor) + '.\n\nPeço, por favor, a correção da taxa e o estorno da diferença.\n\nVendas:\n' +
        lista.slice(0, 25).map(function (x) { return '- ' + dm(x.venda.dia) + (x.venda.hora ? ' ' + x.venda.hora : '') + ': ' + brl(x.venda.bruto) + ' a ' + pctBR(x.venda.taxa) + (x.venda.aut ? ' (NSU/aut. ' + x.venda.aut + ')' : ''); }).join('\n') + (lista.length > 25 ? '\n- e mais ' + (lista.length - 25) + ' vendas' : '') + '\n\nObrigado!';
      itens.push({ tipo: 'taxa', grav: 2, valor: g.valor, titulo: 'Taxa do ' + g.nome.toLowerCase() + ' acima do ' + (g.fonte === 'contrato' ? 'combinado' : 'normal'),
        texto: g.mudou ? 'A partir de <b>' + dm(g.desde) + '</b>, as vendas no ' + g.nome.toLowerCase() + ' passaram a ser cobradas a <b>' + pctBR(g.cobrada) + '</b>. ' + (g.fonte === 'contrato' ? 'A sua taxa combinada é' : 'Antes, a taxa era') + ' <b>' + pctBR(g.ref) + '</b>. Foram ' + g.qtd + ' vendas e <b>' + brl(g.valor) + '</b> a mais.'
          : g.qtd + ' vendas no ' + g.nome.toLowerCase() + ' foram cobradas acima de <b>' + pctBR(g.ref) + '</b> (' + (g.fonte === 'contrato' ? 'sua taxa combinada' : 'a taxa mais comum do seu extrato') + '). A maioria a <b>' + pctBR(g.cobrada) + '</b>. Diferença: <b>' + brl(g.valor) + '</b>.',
        causas: g.mudou ? ['A taxa promocional do contrato acabou (é o motivo mais comum).', 'A maquininha mudou o plano sem avisar.'] : ['Vendas com outra bandeira ou outro tipo de cartão (empresarial, internacional).', 'Antecipação cobrada junto na taxa.', 'Erro de cadastro da maquininha.'],
        fazer: g.fonte === 'contrato' ? 'Mande a mensagem abaixo para a central da maquininha (chat ou WhatsApp oficial) e peça o estorno. Guarde o número do protocolo.' : 'Confira no contrato qual é a sua taxa. Se for a menor, mande a mensagem abaixo e peça o estorno; se a promoção acabou, negocie ou compare com outras maquininhas.',
        msg: msg, detalhe: lista.slice(0, 40).map(function (x) { return [dm(x.venda.dia) + ' ' + x.venda.hora, esc(x.venda.bandeira), brl(x.venda.bruto) + ' a ' + pctBR(x.venda.taxa), brl(x.dif)]; }) });
    });
    if (!tx.grupos.length && vm.length) ok.push('Taxas: todas as ' + vm.length + ' vendas dentro da taxa ' + (Object.keys(dados.contratos || {}).length ? 'combinada' : 'de sempre') + ' (média ' + pctBR(tx.a.taxaMedia) + ').');
    if (!Object.keys(dados.contratos || {}).length) avisos.push('Coloque as taxas do seu contrato em Ajustes. Sem elas, o app compara com a taxa mais comum do próprio extrato e pode não perceber uma taxa errada desde o começo.');

    // 2) vendas do app × maquininha
    var movs = dados.movs.filter(function (m) { return m.tipo === 'venda' && (m.forma === 'debito' || m.forma === 'credito') && m.data >= ini && m.data <= fim; });
    var semVendasApp = !movs.length && cartao.length;
    if (cartao.length && movs.length) {
      var cv = compararVendas(cartao, movs, ini, fim);
      cv.ach.forEach(function (a) {
        if (a.tipo === 'outroDia') itens.push({ tipo: a.tipo, grav: 0, valor: a.valor, titulo: 'Venda lançada no dia errado', texto: brl(a.valor) + ' no ' + a.g + ' passaram na maquininha em <b>' + dm(a.d) + '</b>, mas foram lançados no app em <b>' + dm(a.d2) + '</b>. Não falta dinheiro; só a data está diferente.', causas: ['Venda feita depois da meia-noite ou lançada no dia seguinte.'], fazer: 'Se quiser o relatório do mês exato, corrija a data em Lançamentos.' });
        else if (a.tipo === 'trocado') itens.push({ tipo: a.tipo, grav: 0, valor: a.valor, titulo: 'Débito e crédito trocados', texto: 'Em <b>' + dm(a.d) + '</b>, ' + brl(a.valor) + ' foram lançados no app como <b>' + a.comoApp + '</b>, mas passaram na maquininha como <b>' + a.comoMaq + '</b>. O total do dia bate.', causas: ['Escolha errada na hora de lançar ou de passar o cartão.'], fazer: 'Só ajuste se quiser saber certinho quanto paga de taxa em cada tipo. A taxa do crédito é maior.' });
        else if (a.tipo === 'soMaq') itens.push({ tipo: a.tipo, grav: 1, valor: a.valor, d: a.d, vendas: a.vendas, titulo: 'Passou na maquininha e não está no app', texto: 'Em <b>' + dm(a.d) + '</b>, a maquininha registrou <b>' + brl(a.valor) + '</b> a mais do que você lançou.' + (a.vendas ? ' É ' + (a.vendas.length > 1 ? 'a soma destas vendas' : 'esta venda') + ': ' + a.vendas.map(function (s) { return '<b>' + brl(s.bruto) + '</b> (' + esc(s.info) + ')'; }).join(', ') + '.' : (a.maiores && a.maiores.length ? ' Maiores vendas do dia: ' + a.maiores.map(function (s) { return brl(s.bruto) + ' (' + esc(s.info) + ')'; }).join(', ') + '.' : '')) + (a.prov ? ' <i>Pode ser a venda de ' + brl(a.prov.valor) + ' lançada no app em ' + dm(a.prov.d) + '.</i>' : ''), causas: ['Venda esquecida no app.', 'Venda lançada como dinheiro ou Pix, mas passou no cartão.'], fazer: 'Confira e, se a venda for sua, lance no app. Vendas esquecidas deixam o lucro e o limite do MEI errados.', lancar: a.vendas ? a.vendas.map(function (s) { return { data: s.dia, valor: s.bruto, forma: s.g, desc: 'Venda ' + NOME_G[s.g] + (s.hora ? ' ' + s.hora : '') + ' (conferência)' }; }) : [{ data: a.d, valor: a.valor, forma: 'credito', desc: 'Vendas no cartão (conferência)' }] });
        else if (a.tipo === 'soApp') itens.push({ tipo: a.tipo, grav: 2, valor: a.valor, d: a.d, movs: a.movs, titulo: a.dup ? 'Venda lançada duas vezes' : 'Lançado como cartão, mas não passou na maquininha', texto: 'Em <b>' + dm(a.d) + '</b>, você lançou <b>' + brl(a.valor) + '</b> no cartão a mais do que a maquininha registrou.' + (a.movs.length ? ' Lançamento: ' + a.movs.slice(0, 2).map(function (m) { return brl(m.valor) + (m.desc ? ' "' + esc(m.desc) + '"' : ''); }).join(', ') + '.' : '') + (a.prov ? ' <i>Pode ser a venda de ' + brl(a.prov.valor) + ' que passou na maquininha em ' + dm(a.prov.d) + '.</i>' : ''), causas: a.dup ? ['A mesma venda lançada duas vezes.'] : ['A venda foi paga em dinheiro ou Pix e marcada como cartão.', 'Passou em outra maquininha (de outra empresa ou de um sócio).', 'A venda foi negada ou cancelada na máquina e o cliente não pagou de outro jeito.'], fazer: a.dup ? 'Apague a repetida em Lançamentos.' : 'Pergunte a quem vendeu. Se o cliente não pagou, é dinheiro a cobrar; se foi outra forma de pagamento, corrija o lançamento.' });
      });
      if (cv.diasOk) ok.push('Vendas no cartão: o total do app bate com a maquininha em ' + cv.diasOk + ' de ' + Object.keys(cartao.reduce(function (o, s) { o[s.dia] = 1; return o; }, {})).length + ' dias (contando os que só mudaram de dia ou de tipo).');
    }

    // 3) banco
    var bc = null;
    if (!dados.temPag) avisos.push('O seu arquivo não tem a data de pagamento das vendas, então não deu para conferir o que caiu no banco. Na maquininha, baixe o relatório de "recebimentos" ou "pagamentos" (ele traz essa data).');
    else if (!dados.trans.length) avisos.push('Importe o extrato do banco em "Extrato do banco" para o app conferir se o dinheiro da maquininha caiu certinho.');
    else {
      bc = compararBanco(vm, dados.trans);
      if (!bc) avisos.push('Não achei no extrato do banco os créditos da maquininha nas datas de pagamento deste relatório. Confira se o extrato é do mesmo período e da conta onde a maquininha deposita.');
      else {
        if (bc.falta.length) {
          var msgB = 'Olá! Sou cliente (' + nome + '). Conferindo os pagamentos de ' + dm(bc.pi) + ' a ' + dm(bc.pf) + ', estes dias caíram com valor menor do que o previsto no meu extrato de vendas:\n\n' +
            bc.falta.map(function (x) { return '- ' + dm(x.d) + ': previsto ' + brl(x.esp) + ', caiu ' + brl(x.rec) + ' (diferença ' + brl(-x.res) + ')'; }).join('\n') + '\n\nPodem me enviar o detalhamento dos descontos desses dias (aluguel, antecipação, cancelamento ou contestação)?\n\nObrigado!';
          itens.push({ tipo: 'banco', grav: 2, valor: bc.totalFalta, titulo: 'Caiu menos no banco do que a maquininha prometeu', texto: 'Em ' + bc.falta.length + (bc.falta.length > 1 ? ' dias' : ' dia') + ', o valor que entrou na conta foi menor que o líquido previsto: ' + bc.falta.slice(0, 4).map(function (x) { return '<b>' + dm(x.d) + '</b>: previsto ' + brl(x.esp) + ', caiu ' + brl(x.rec); }).join('; ') + '. Total: <b>' + brl(bc.totalFalta) + '</b>.', causas: ['Aluguel ou mensalidade da maquininha descontado do repasse.', 'Venda cancelada ou contestada pelo cliente (chargeback).', 'Parte do dinheiro foi para outra conta ou ficou na conta da maquininha.'], fazer: 'Abra o app da maquininha, veja o detalhe do pagamento desse dia e, se não entender o desconto, mande a mensagem abaixo.', msg: msgB });
        } else ok.push('Banco: tudo o que a maquininha prometeu pagar entre ' + dm(bc.pi) + ' e ' + dm(bc.pf) + ' caiu na conta (' + brl(bc.recebido) + ').');
        if (bc.totalSobra > 0.05) itens.push({ tipo: 'bancoMais', grav: 0, valor: bc.totalSobra, titulo: 'Entrou mais do que o previsto', texto: 'Caíram ' + brl(bc.totalSobra) + ' da maquininha além do previsto neste relatório. Normalmente são vendas de antes de ' + dm(ini) + ' (o crédito demora 30 dias) e não é problema.', causas: ['Pagamento de vendas do mês anterior.'], fazer: 'Nada a fazer. Para conferir também essas, suba o relatório do mês anterior.' });
      }
    }
    var sev = itens.filter(function (x) { return x.grav > 0; });
    itens.sort(function (p, q) { return q.grav - p.grav || q.valor - p.valor; });
    return { ini: ini, fim: fim, qtd: vm.length, bruto: soma(vm, function (s) { return s.bruto; }), taxas: soma(vm, function (s) { return s.desconto; }), taxaMedia: tx.a.taxaMedia,
      itens: itens, ok: ok, avisos: avisos, semVendasApp: semVendasApp, emJogo: soma(sev, function (x) { return x.valor; }), aRecuperar: soma(itens.filter(function (x) { return x.tipo === 'taxa' || x.tipo === 'banco'; }), function (x) { return x.valor; }) };
  }

  // Exemplo fictício: maquininha + vendas do app + extrato, com erros plantados
  function exemploConferencia() {
    var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var h = hoje(), base = somaDias(h, -34), linhas = [['Relatório de vendas (dados fictícios)'], [], ['Data da venda', 'Hora', 'Bandeira', 'Forma de pagamento', 'Parcelas', 'Valor bruto', 'Taxa', 'Valor líquido', 'Data prevista de pagamento', 'NSU', 'Status']];
    var bands = ['Visa', 'Mastercard', 'Elo', 'Visa', 'Mastercard'], nsu = 50210, movs = [], porDia = {}, liqPag = {};
    function util(d) { var x = deISO(d).getDay(); return x === 6 ? somaDias(d, 2) : x === 0 ? somaDias(d, 1) : d; }
    for (var i = 0; i < 26; i++) {
      var d = somaDias(base, i), n = 3 + Math.floor(rnd() * 4);
      for (var k = 0; k < n; k++) {
        var deb = rnd() < 0.55, taxa = deb ? (i >= 15 ? 1.99 : 1.37) : 3.15;
        var v = Math.round((15 + rnd() * (deb ? 120 : 260)) * 100) / 100;
        if (i === 8 && k === 0) v = 87.5;
        if (i === 11 && k === 0) { v = 45; deb = false; taxa = 3.15; }
        var t = Math.round(v * taxa) / 100, lq = Math.round((v - t) * 100) / 100, hr = ('0' + (9 + Math.floor(rnd() * 11))).slice(-2) + ':' + ('0' + Math.floor(rnd() * 60)).slice(-2);
        var pg = util(somaDias(d, 1));
        linhas.push([dma(d), hr, bands[Math.floor(rnd() * bands.length)], deb ? 'Débito' : 'Crédito à vista', '1', Motor.fmtBR(v), Motor.fmtBR(t), Motor.fmtBR(lq), dma(pg), String(nsu++), 'Aprovada']);
        liqPag[pg] = (liqPag[pg] || 0) + lq;
        var dLanc = i === 4 && deb ? somaDias(d, 1) : d, forma = deb ? 'debito' : 'credito';
        if (i === 13 && !deb && k < 2) forma = 'debito';
        if (i === 11 && k === 0) movs.push({ id: uid(), tipo: 'venda', data: d, forma: 'credito', valor: 45, desc: 'Mesa 4' });
        else if (!(i === 8 && k === 0)) { var key = dLanc + '|' + forma; porDia[key] = (porDia[key] || 0) + v; }
      }
    }
    Object.keys(porDia).forEach(function (k) { var p = k.split('|'); movs.push({ id: uid(), tipo: 'venda', data: p[0], forma: p[1], valor: arred(porDia[k]), desc: 'Vendas no ' + (p[1] === 'debito' ? 'débito' : 'crédito') }); });
    movs.push({ id: uid(), tipo: 'venda', data: somaDias(base, 11), forma: 'credito', valor: 45, desc: 'Mesa 4' });
    var trans = [], pags = Object.keys(liqPag).sort();
    pags.forEach(function (p, j) { trans.push({ id: uid(), data: p, desc: 'CIELO S.A. - CRED VENDAS', valor: arred(liqPag[p] - (j === 6 ? 89.9 : 0)) }); });
    trans.push({ id: uid(), data: somaDias(base, 3), desc: 'Pix enviado - DISTRIBUIDORA EXEMPLO', valor: -230 });
    return { rows: linhas, movs: movs, trans: trans, contratos: { debito: 1.37, credito_vista: 3.15 } };
  }

  function htmlRelatorio(r, exemplo) {
    var cor = { 2: 'vm', 1: 'am', 0: '' }, rot = { 2: 'Prioridade', 1: 'Conferir', 0: 'Só para saber' };
    var topoR = '<div class="card hero" style="margin-top:16px">' + (exemplo ? '<span class="tag am">exemplo fictício</span>' : '') +
      '<div class="lbl" style="margin-top:6px">Conferência de ' + dm(r.ini) + ' a ' + dm(r.fim) + '</div>' +
      (r.emJogo > 0 ? '<div class="big">' + brl(r.emJogo) + '</div><p style="font-size:14px;color:#BFE3DE">em diferenças para conferir' + (r.aRecuperar > 0 ? '. Destes, <b style="color:#fff">' + brl(r.aRecuperar) + '</b> são cobranças da maquininha para questionar' : '') + '.</p>' : '<div class="big">Tudo batendo ✓</div>') +
      '<div class="kpis"><div><b>' + brl(r.bruto) + '</b><span>Vendido na maquininha</span></div><div><b>' + brl(r.taxas) + '</b><span>Taxas (' + pctBR(r.taxaMedia) + ')</span></div><div><b>' + r.itens.filter(function (x) { return x.grav > 0; }).length + '</b><span>Pontos a ver</span></div></div></div>';
    var semApp = r.semVendasApp ? '<div class="alerta am"><span class="ic">📲</span><span class="tx"><b>Você não lança as vendas do cartão no app</b><span>Traga as vendas da maquininha para o app (um lançamento por dia e tipo). Aí o seu lucro, o limite do MEI e a conferência ficam completos.</span></span></div><button class="btn claro cheio peq" id="cfTrazer">Trazer as vendas da maquininha para o app</button>' : '';
    var achados = r.itens.map(function (x, i) {
      return '<div class="card ach" style="margin-top:12px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><span><span class="tag ' + cor[x.grav] + '">' + rot[x.grav] + '</span><b style="display:block;margin-top:6px;font-size:16px">' + x.titulo + '</b></span><b style="white-space:nowrap;font-size:16px">' + brl(x.valor) + '</b></div>' +
        '<p style="margin-top:8px;font-size:14.5px">' + x.texto + '</p>' +
        '<p class="peq" style="margin-top:8px"><b>Possíveis causas:</b> ' + x.causas.join(' ') + '</p>' +
        '<p class="peq" style="margin-top:6px"><b>O que fazer:</b> ' + x.fazer + '</p>' +
        (x.detalhe ? '<details class="como"><summary>Ver as vendas (' + x.detalhe.length + ')</summary><table class="t">' + x.detalhe.map(function (l) { return '<tr><td>' + l[0] + ' · ' + l[1] + '<br><span class="muted peq">' + l[2] + '</span></td><td class="n">' + l[3] + '</td></tr>'; }).join('') + '</table></details>' : '') +
        (x.msg ? '<details class="como"><summary>Ver a mensagem pronta</summary><pre style="white-space:pre-wrap;font-family:inherit;font-size:13.5px;margin-top:8px">' + esc(x.msg) + '</pre></details>' : '') +
        '<div class="linhaBtns">' + (x.msg ? '<button class="btn claro peq" data-msg="' + i + '">Copiar mensagem</button>' : '') + (x.lancar ? '<button class="btn claro peq" data-lanc="' + i + '">Lançar no app</button>' : '') + '</div></div>';
    }).join('');
    return topoR + semApp +
      (r.itens.length ? '<h2>O que encontramos</h2>' + achados : '') +
      (r.ok.length ? '<h2>O que está certo</h2><div class="lista">' + r.ok.map(function (t) { return '<div class="item"><span class="av" style="background:var(--green-soft)">✓</span><span class="meio"><span style="color:var(--ink)">' + t + '</span></span></div>'; }).join('') + '</div>' : '') +
      (r.avisos.length ? '<h2>Para a conferência ficar completa</h2>' + r.avisos.map(function (t) { return '<div class="dica">' + t + '</div>'; }).join('') : '') +
      '<div class="linhaBtns" style="margin-top:16px"><button class="btn linha peq" id="cfImp">Imprimir ou salvar PDF</button><button class="btn linha peq" id="cfWa">Mandar resumo no WhatsApp</button></div>' +
      '<p class="peq muted" style="margin-top:12px">A conferência compara os arquivos com regras fixas e aponta diferenças de dinheiro. Ela não é contabilidade nem cálculo de imposto. Na dúvida, confirme com a maquininha ou com o seu contador.</p>';
  }
  function textoResumo(r, nome) {
    return 'Conferência ' + (nome ? '- ' + nome + ' ' : '') + '(' + dm(r.ini) + ' a ' + dm(r.fim) + ')\n' +
      'Vendido na maquininha: ' + brl(r.bruto) + ' | Taxas: ' + brl(r.taxas) + ' (' + pctBR(r.taxaMedia) + ')\n\n' +
      (r.itens.length ? r.itens.map(function (x) { return '- ' + x.titulo + ': ' + brl(x.valor) + '\n  ' + x.texto.replace(/<[^>]+>/g, ''); }).join('\n') : 'Tudo batendo.') +
      (r.ok.length ? '\n\nCerto:\n' + r.ok.map(function (t) { return '- ' + t; }).join('\n') : '') + '\n\nFeito com o Micro no Controle';
  }
  function impressaoRelatorio(r, nome) {
    return '<h3>Relatório da conferência' + (nome ? ' · ' + esc(nome) : '') + '<br>' + dma(r.ini) + ' a ' + dma(r.fim) + '</h3>' +
      '<table><tr><td>Vendido na maquininha</td><td class="n">' + brl(r.bruto) + '</td></tr><tr><td>Taxas pagas (' + pctBR(r.taxaMedia) + ')</td><td class="n">' + brl(r.taxas) + '</td></tr><tr><td>Diferenças para conferir</td><td class="n">' + brl(r.emJogo) + '</td></tr></table>' +
      r.itens.map(function (x) { return '<p style="margin-top:14px"><b>' + x.titulo + ' · ' + brl(x.valor) + '</b><br>' + x.texto + '<br><i>Possíveis causas:</i> ' + x.causas.join(' ') + '<br><i>O que fazer:</i> ' + x.fazer + '</p>'; }).join('') +
      (r.ok.length ? '<p style="margin-top:14px"><b>O que está certo</b><br>' + r.ok.join('<br>') + '</p>' : '') +
      '<p style="margin-top:18px;font-size:11px">Micro no Controle · conferência por regras fixas; não é contabilidade nem cálculo de imposto.</p>';
  }

  R.conferencia = function () {
    var tx = E().neg.taxas || {};
    var html = topo('Relatório da conferência', 'Maquininha, vendas e banco: onde está a diferença', '#/mais') + '<main>' +
      '<p class="muted">Suba o relatório de vendas da maquininha. O app confere com as vendas que você lançou, com o extrato do banco e com a sua taxa, e entrega um relatório pronto: o que aconteceu, por quê e o que fazer.</p>' +
      '<label class="drop"><input type="file" id="cfArq" accept=".csv,.txt,.xlsx,.xls"><b>📂 Escolher o relatório da maquininha</b><span class="muted peq">Excel (XLSX) ou CSV · o arquivo não sai do seu celular</span></label>' +
      '<button class="btn linha cheio" style="margin-top:10px" id="cfEx">Ver um relatório de exemplo</button>' +
      '<details class="como"><summary>O que o app confere</summary><ul><li><b>Taxa:</b> se cobraram acima do combinado (e desde quando).</li><li><b>Vendas:</b> o que passou na maquininha e não está no app, o que foi lançado e não passou, venda repetida, dia ou tipo trocado.</li><li><b>Banco:</b> se o que a maquininha prometeu pagar caiu na conta (precisa do extrato importado em "Extrato do banco").</li></ul></details>' +
      '<div id="cfRes"></div></main>';
    return { html: html, montar: function (el) {
      var atual = null;
      function rodar(rows, det, ex) {
        var lm = lerMaquininha(rows, det);
        if (!lm.vendas.length) throw new Error('Não achei vendas com data nesse arquivo.');
        var contratos = {};
        if (ex) contratos = ex.contratos; else Object.keys(tx).forEach(function (k) { var n = num(tx[k]); if (n > 0) contratos[k] = n; });
        var dados = { vendas: lm.vendas, temPag: lm.temPag, contratos: contratos, movs: ex ? ex.movs : E().mov, trans: ex ? ex.trans : E().extrato.trans.filter(function (t) { return !t.ex; }), negocio: E().neg.nome };
        var r = montarRelatorio(dados); atual = { r: r, lm: lm, ex: !!ex };
        if (!ex) { E().conf.push({ id: uid(), tipo: 'conferencia', data: hoje(), achado: r.emJogo, periodo: dm(r.ini) + ' a ' + dm(r.fim), qtd: r.qtd }); salvar(); }
        track('RelatorioConferencia', { achados: r.itens.length, ex: !!ex });
        var c = $('#cfRes', el); c.innerHTML = htmlRelatorio(r, !!ex); ligar(c); c.scrollIntoView({ behavior: 'smooth' });
      }
      function ligar(c) {
        var r = atual.r;
        $$('[data-msg]', c).forEach(function (b) { b.onclick = function () { copiar(r.itens[+b.dataset.msg].msg, 'Mensagem copiada. Cole no chat da maquininha.'); }; });
        $$('[data-lanc]', c).forEach(function (b) { b.onclick = function () {
          if (atual.ex) { toast('No exemplo, nada é lançado. Com o seu arquivo, a venda entra no app.'); return; }
          r.itens[+b.dataset.lanc].lancar.forEach(function (v) { E().mov.push({ id: uid(), data: v.data, tipo: 'venda', valor: v.valor, forma: v.forma, nat: K.natPadrao(), nf: false, cli: null, venc: '', desc: v.desc, cat: '' }); });
          salvar(); b.disabled = true; b.textContent = 'Lançado ✓'; toast('Venda lançada no app ✓');
        }; });
        if ($('#cfTrazer', c)) $('#cfTrazer', c).onclick = function () {
          if (atual.ex) { toast('No exemplo, nada é lançado.'); return; }
          var t = {}; atual.lm.vendas.forEach(function (s) { if (s.g === 'debito' || s.g === 'credito') { var k = s.dia + '|' + s.g; t[k] = (t[k] || 0) + s.bruto; } });
          Object.keys(t).forEach(function (k) { var p = k.split('|'); E().mov.push({ id: uid(), data: p[0], tipo: 'venda', valor: arred(t[k]), forma: p[1], nat: K.natPadrao(), nf: false, cli: null, venc: '', desc: 'Vendas no ' + NOME_G[p[1]] + ' (maquininha)', cat: '' }); });
          salvar(); toast(Object.keys(t).length + ' lançamentos criados ✓'); $('#cfTrazer', c).disabled = true;
        };
        $('#cfImp', c).onclick = function () { imprimir(impressaoRelatorio(r, E().neg.nome)); };
        $('#cfWa', c).onclick = function () { window.open(K.linkWa('', textoResumo(r, E().neg.nome)), '_blank'); };
      }
      function erro(err) { $('#cfRes', el).innerHTML = '<div class="aviso">' + esc(err.message) + ' Confira se é o relatório de <b>vendas</b> (com valor bruto e taxa ou valor líquido). Se continuar, mande o arquivo (sem dados sensíveis) para micronocontrole@gmail.com que a gente ajusta o leitor.</div>'; }
      $('#cfEx', el).onclick = function () { var ex = exemploConferencia(); try { rodar(ex.rows, Motor.detectar(ex.rows), ex); } catch (e) { erro(e); } };
      $('#cfArq', el).onchange = function (e) {
        var file = e.target.files[0]; if (!file) return;
        $('#cfRes', el).innerHTML = '<p class="muted" style="margin-top:14px">Conferindo…</p>';
        lerPlanilha(file).then(function (abas) {
          for (var i = 0; i < abas.length; i++) { var d = Motor.detectar(abas[i]); if (d.ok) return rodar(abas[i], d, null); }
          throw new Error('Não reconheci as colunas desse arquivo.');
        }).catch(erro);
        e.target.value = '';
      };
    } };
  };

  R.biblioteca = function () {
    var it = function (h, i, t, s, ext) { return '<a class="item" href="' + h + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + ' style="text-decoration:none;color:inherit"><span class="av" style="background:#fff;border:1px solid var(--line)">' + i + '</span><span class="meio"><b>' + t + '</b><span>' + s + '</span></span><span>›</span></a>'; };
    var html = topo('Biblioteca', 'Materiais e ferramentas grátis', '#/mais') + '<main>' +
      '<h2 style="margin-top:4px">Para baixar</h2><div class="lista">' +
      it('/planilha-gratis/arquivo/kit-lite-gratis-micro-no-controle.zip', '📦', 'Kit Lite grátis', 'Fechamento de caixa, conferência de cartões, sangria e recibo (.zip)') +
      it('/planilha-gratis/arquivo/planilha-fechamento-de-caixa-gratis.xlsx', '📊', 'Planilha de fechamento de caixa', 'Excel, 30 dias') +
      it('https://pay.hotmart.com/K108084778Q?src=app-biblioteca', '⭐', 'Pacote Completo do Pequeno Negócio', '9 planilhas, modelos, Planner 2027 e guias', true) + '</div>' +
      '<h2>Calculadoras no site</h2><div class="lista">' +
      it('/ferramentas/taxa-da-maquininha/', '💳', 'Taxa da maquininha', 'Quanto você paga de verdade') +
      it('/ferramentas/fechamento-de-caixa/', '🧮', 'Fechamento de caixa', 'Bateu ou faltou?') +
      it('/ferramentas/das-mei/', '🏛️', 'DAS do MEI', 'Quanto e quando pagar') +
      it('/ferramentas/imposto-simples-nacional/', '📑', 'Imposto do Simples Nacional', 'Para quem já passou do MEI') +
      it('/ferramentas/lucro-e-ponto-de-equilibrio/', '📈', 'Lucro e ponto de equilíbrio', 'Quanto precisa vender por mês') +
      it('/diagnostico/', '🩺', 'Diagnóstico do caixa', '8 perguntas e uma nota de 0 a 100') + '</div>' +
      '<h2>Sem tempo para fazer sozinho?</h2><div class="lista">' + it('/resolve/?src=app-biblioteca', '🤝', 'Micro no Controle Resolve', 'A gente organiza o seu financeiro pelo WhatsApp') + '</div></main>';
    return { html: html };
  };

  R.mais = function () {
    var g = [
      ['Vender e receber', [['#/agendaonline', '🔗', 'Link de agendamento', 'Cliente marca sozinho, você aceita'], ['#/acompanhar', '📍', 'Acompanhe seu pedido', 'Cliente vê cada etapa pelo link'], ['#/fiado', '📒', 'Quem me deve', 'Fiado e cobrança no Pix'], ['#/agenda', '📅', 'Agenda', 'Horários, lembrete e sinal'], ['#/orcamentos', '📝', 'Orçamentos', 'Bonito no WhatsApp, com sinal'], ['#/calculadora', '🧮', 'Quanto cobrar', 'Preço certo no cartão e no iFood']]],
      ['Pagar e planejar', [['#/contas', '🗓️', 'Contas a pagar', 'Vencimentos e contas fixas'], ['#/caixa', '🔮', 'Vai faltar dinheiro?', 'O dia do aperto, antes de chegar']]],
      ['Banco e conferências', [['#/conferencia', '📑', 'Relatório da conferência', 'Onde está a diferença e o que fazer'], ['#/extrato', '🏦', 'Extrato do banco', 'Separe pessoal × negócio e confira'], ['#/maquininha', '💳', 'Conferir maquininha', 'Acha taxa cobrada a mais'], ['#/ifood', '🛵', 'Conferir iFood', 'Comissão, taxas e mensalidade']]],
      ['Mercadoria e notas', [['#/estoque', '📦', 'Estoque', 'Produtos, custo e margem'], ['#/contagem', '🔢', 'Contagem', 'Conte e veja o que faltou'], ['#/devolucao', '↩️', 'Devolução de nota', 'Calcule a partir do XML']]],
      ['MEI e relatórios', [['#/mei', '🏛️', 'MEI: limite e DAS', 'Limite, DAS e relatório mensal'], ['#/lancamentos', '📋', 'Lançamentos', 'Tudo do mês, para editar']]],
      ['Ajuda', [['#/biblioteca', '📚', 'Biblioteca', 'Planilhas e calculadoras grátis'], ['/resolve/?src=app', '🤝', 'Fazemos por você', 'A gente organiza seu financeiro'], ['#/backup', '💾', 'Backup', 'Salve no WhatsApp ou Drive'], ['#/ajustes', '⚙️', 'Ajustes', 'Negócio, Pix, taxas'], ['#/sobre', '💬', 'Ajuda e privacidade', 'Como o app cuida dos seus dados']]]
    ];
    var html = topo('Tudo do seu negócio', E().neg.nome) + '<main>' + g.map(function (s) {
      return '<h2>' + s[0] + '</h2><div class="grade">' + s[1].map(function (x) { return '<a class="ferr" href="' + x[0] + '"><span class="i">' + x[1] + '</span><b>' + x[2] + '</b><span>' + x[3] + '</span></a>'; }).join('') + '</div>';
    }).join('') + '<p class="rodape">Micro no Controle · soluções com sabedoria</p></main>';
    return { html: html };
  };

  window.MNCX = window.MNCX || {};
  window.MNCX.alertas = function (al) {
    var h = hoje(), ab = contasAbertas(), atr = ab.filter(function (c) { return c.venc < h; }), hj = ab.filter(function (c) { return c.venc === h; });
    if (atr.length) al.unshift({ c: 'vm', i: '🗓️', b: atr.length + (atr.length > 1 ? ' contas atrasadas' : ' conta atrasada') + ' · ' + brl(atr.reduce(function (s, c) { return s + c.valor; }, 0)), s: 'Pague logo para não pagar juros.', h: '#/contas' });
    if (hj.length) al.unshift({ c: 'am', i: '🗓️', b: (hj.length > 1 ? hj.length + ' contas vencem hoje' : hj[0].desc + ' vence hoje'), s: brl(hj.reduce(function (s, c) { return s + c.valor; }, 0)) + ' · toque para marcar pago', h: '#/contas' });
    var x = E().caixa;
    if (x.saldo !== '' && x.saldo != null && ab.length) { var p = projetar(30); if (p.aperto) al.unshift({ c: 'vm', i: '🔮', b: 'Pode faltar dinheiro dia ' + dm(p.aperto.d), s: 'Faltariam ' + brl(-p.aperto.v) + '. Veja o que fazer.', h: '#/caixa' }); }
    var es = E().estoque.prod.filter(function (p) { return p.min > 0 && p.qtd <= p.min; });
    if (es.length) al.push({ c: 'am', i: '📦', b: es.length + (es.length > 1 ? ' produtos acabando' : ' produto acabando'), s: es.slice(0, 3).map(function (p) { return p.nome; }).join(', '), h: '#/estoque' });
  };
  window.MNCX._testes = { chaveDesc: chaveDesc, detectarExtrato: detectarExtrato, linhasExtrato: linhasExtrato, lerOFX: lerOFX, lerNFe: lerNFe, calcDevolucao: calcDevolucao, cfopDevolucao: cfopDevolucao, projetar: projetar, conciliar: conciliar, sugerir: sugerir, lerMaquininha: lerMaquininha, montarRelatorio: montarRelatorio, exemploConferencia: exemploConferencia, compararVendas: compararVendas, compararBanco: compararBanco };
})();

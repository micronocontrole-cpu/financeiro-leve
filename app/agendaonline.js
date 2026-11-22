/* Micro no Controle — Link de agendamento (agenda online)
   O cliente abre micronocontrole.com/agendar/?n=SEU-LINK, escolhe serviço e horário
   livre, e o pedido chega aqui na hora. O negócio aceita ou recusa com um toque.
   A trava contra dois no mesmo horário fica no banco (Supabase). */
(function () {
  'use strict';
  var K = window.MNCK, N = window.MNCNuvem;
  if (!K || !N) return;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = K.esc, brl = K.brl, num = K.num, uid = K.uid, hoje = K.hoje, somaDias = K.somaDias, dm = K.dm, diaRel = K.diaRel,
    topo = K.topo, abrirFolha = K.abrirFolha, fecharFolha = K.fecharFolha, confirmar = K.confirmar, toast = K.toast, copiar = K.copiar,
    salvar = K.salvar, rotear = K.rotear, R = K.ROTAS, track = K.track;
  function E() { return K.E(); }
  var SITE = 'https://micronocontrole.com';
  var DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var MIN = { 30: '30 min', 60: '1 hora', 120: '2 horas', 240: '4 horas', 720: '12 horas' };
  var cache = { neg: null, serv: [], exp: [], hor: [], carregado: 0 }, canal = null;

  function cfg() { var x = E(); if (!x.nuvem) x.nuvem = { slug: '', negocio: '', pend: 0 }; return x.nuvem; }
  function linkPublico(slug) { return SITE + '/agendar/?n=' + slug; }
  function slugDe(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'meu-negocio'; }
  function soDig(s) { return String(s || '').replace(/\D/g, ''); }
  function hm(t) { return String(t || '').slice(0, 5); }
  function minDe(t) { var p = hm(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function erroTxt(e) {
    var m = (e && (e.message || e.error_description)) || String(e);
    if (/fetch|network|internet/i.test(m)) return 'Sem internet agora. Tente de novo em instantes.';
    if (/anonymous/i.test(m)) return 'O login ainda não está liberado no Supabase (ative "Allow anonymous sign-ins").';
    return m;
  }

  // ---------- conexão ----------
  function cliente() { return N.carregar(false); }
  function sessao() {
    return cliente().then(function (sb) {
      return sb.auth.getSession().then(function (r) {
        if (r.data && r.data.session) return sb;
        return sb.auth.signInAnonymously().then(function (x) { if (x.error) throw x.error; return sb; });
      });
    });
  }
  function q(p) { return p.then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function carregarTudo() {
    return sessao().then(function (sb) {
      return q(sb.from('negocios').select('*').maybeSingle()).then(function (neg) {
        cache.neg = neg;
        if (!neg) return null;
        var c = cfg(); c.slug = neg.slug; c.negocio = neg.id; salvar();
        var ini = new Date(Date.now() - 864e5), fim = new Date(Date.now() + 60 * 864e5);
        return Promise.all([
          q(sb.from('servicos').select('*').order('ordem').order('nome')),
          q(sb.from('expediente').select('*').order('dia_semana').order('inicio')),
          q(sb.from('horarios').select('*').filter('periodo', 'ov', N.periodo(ini, fim)))
        ]).then(function (r) {
          cache.serv = r[0]; cache.exp = r[1];
          cache.hor = r[2].map(function (h) { var p = N.lerPeriodo(h.periodo); h.ini = p.ini; h.fim = p.fim; return h; })
            .sort(function (a, b) { return a.ini - b.ini; });
          cache.carregado = Date.now();
          return neg;
        });
      });
    });
  }
  function pendentes() { var a = Date.now(); return cache.hor.filter(function (h) { return h.status === 'pendente' && (!h.expira_em || new Date(h.expira_em) > a); }); }

  // ---------- sincronização com a agenda do celular ----------
  var MAPA = { marcado: 'confirmado', feito: 'atendido', cancelado: 'cancelado', faltou: 'faltou' };
  function minutosDoServico(nome) {
    var s = cache.serv.filter(function (x) { return x.nome.toLowerCase() === String(nome || '').trim().toLowerCase(); })[0];
    return s ? s.minutos : 30;
  }
  function agDaNuvem(h) {
    var l = N.local(h.ini);
    return { id: uid(), data: l.data, hora: l.hora, cliNome: h.cliente_nome || 'Cliente', fone: h.cliente_fone || '', serv: h.servico_nome || '', valor: +h.preco || 0, sinal: 0, sinalPago: false, status: 'marcado', lembrado: false, nuvem: h.id };
  }
  function sincronizar() {
    if (!cfg().negocio) return Promise.resolve();
    return carregarTudo().then(function (neg) {
      if (!neg) return;
      return cliente().then(function (sb) {
        var x = E(), ag = x.ag, mudou = false, tarefas = [], porId = {}, porLocal = {};
        cache.hor.forEach(function (h) { porId[h.id] = h; if (h.local_id) porLocal[h.local_id] = h; });
        // 1) confirmados da nuvem que ainda não estão no celular
        cache.hor.forEach(function (h) {
          if (h.status === 'confirmado' && h.origem === 'link' && !ag.some(function (a) { return a.nuvem === h.id; })) { ag.push(agDaNuvem(h)); mudou = true; }
          // cliente cancelou pelo link
          if (h.status === 'cancelado' && h.origem === 'link') ag.forEach(function (a) { if (a.nuvem === h.id && a.status === 'marcado') { a.status = 'cancelado'; mudou = true; toast((a.cliNome || 'Cliente') + ' cancelou ' + dm(a.data) + ' ' + a.hora); } });
        });
        // 2) o que está no celular vai para a nuvem (para o link não oferecer horário ocupado)
        var h0 = hoje();
        ag.forEach(function (a) {
          var nv = a.nuvem ? porId[a.nuvem] : porLocal[a.id];
          var st = MAPA[a.status] || 'confirmado';
          if (!nv) {
            if (a.nuvem || a.status !== 'marcado' || !a.hora || a.data < h0) return;
            var ini = new Date(N.instante(a.data, a.hora)), fim = new Date(+ini + minutosDoServico(a.serv) * 6e4);
            tarefas.push(sb.from('horarios').insert({ negocio: neg.id, periodo: N.periodo(ini, fim), status: 'confirmado', cliente_nome: a.cliNome || null, cliente_fone: soDig(a.fone).slice(0, 13) || null, servico_nome: (a.serv || '').slice(0, 60) || null, preco: a.valor || null, origem: 'app', local_id: a.id }).select().single()
              .then(function (r) { if (r.error) { if (r.error.code === '23P01') { a.conflito = true; mudou = true; } return; } a.nuvem = r.data.id; a.conflito = false; mudou = true; }));
            return;
          }
          if (!a.nuvem) { a.nuvem = nv.id; mudou = true; }
          var l = N.local(nv.ini), dif = {};
          if (st !== nv.status && !(nv.status === 'cancelado' && a.status === 'marcado')) dif.status = st;
          if (a.status === 'marcado' && a.hora && (l.data !== a.data || l.hora !== a.hora)) {
            var i2 = new Date(N.instante(a.data, a.hora)); dif.periodo = N.periodo(i2, new Date(+i2 + (nv.fim - nv.ini)));
          }
          if (Object.keys(dif).length) tarefas.push(sb.from('horarios').update(dif).eq('id', nv.id).then(function (r) { a.conflito = !!(r.error && r.error.code === '23P01'); mudou = true; }));
        });
        // 3) apagado no celular -> libera na nuvem
        cache.hor.forEach(function (h) {
          if (h.origem === 'app' && h.local_id && h.status === 'confirmado' && !ag.some(function (a) { return a.id === h.local_id || a.nuvem === h.id; }))
            tarefas.push(sb.from('horarios').update({ status: 'cancelado' }).eq('id', h.id));
        });
        return Promise.all(tarefas).then(function () {
          cfg().pend = pendentes().length;
          if (mudou || tarefas.length) salvar();
        });
      });
    });
  }

  // ---------- aviso de pedido novo (tempo real) ----------
  function bip() {
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      var c = new C(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination);
      o.frequency.value = 880; g.gain.setValueAtTime(0.25, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
      o.start(); o.stop(c.currentTime + 0.6);
    } catch (e) {}
  }
  function avisar(h) {
    var p = N.lerPeriodo(h.periodo), l = p ? N.local(p.ini) : null;
    var txt = (h.cliente_nome || 'Cliente') + ' · ' + (h.servico_nome || 'horário') + (l ? ' · ' + diaRel(l.data) + ' ' + l.hora : '');
    var titulo = h.status === 'pendente' ? 'Novo pedido de horário' : 'Novo horário marcado';
    toast(titulo + ': ' + txt);
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    bip();
    try {
      if (window.Notification && Notification.permission === 'granted' && document.hidden) {
        var mostrar = function (reg) { if (reg && reg.showNotification) reg.showNotification(titulo, { body: txt, icon: 'icone-192.png', tag: 'pedido-' + h.id }); else new Notification(titulo, { body: txt }); };
        if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(mostrar, function () { mostrar(null); }); else mostrar(null);
      }
    } catch (e) {}
  }
  function ouvir() {
    var c = cfg(); if (!c.negocio || canal) return;
    sessao().then(function (sb) {
      canal = sb.channel('horarios-' + c.negocio)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios', filter: 'negocio=eq.' + c.negocio }, function (ev) {
          var antes = assinatura();
          sincronizar().then(function () { conferirNovos(); if (antes !== assinatura() && naTelaQueMostra()) rotear(); });
        }).subscribe();
    }).catch(function () { canal = null; });
  }

  // Plano B do aviso (se o tempo real cair): compara os pedidos a cada sincronização
  var vistos = null;
  function assinatura() { return cache.hor.map(function (h) { return h.id + h.status; }).join(',') + '|' + (cache.neg ? cache.neg.atualizado_em || '' : ''); }
  function conferirNovos() {
    var ids = {}, novos = [];
    cache.hor.forEach(function (h) { if (h.origem === 'link' && (h.status === 'pendente' || h.status === 'confirmado')) { ids[h.id] = 1; if (vistos && !vistos[h.id]) novos.push(h); } });
    vistos = ids;
    novos.forEach(avisar);
    return novos.length;
  }

  // ---------- ações ----------
  function responder(h, aceitar) {
    return cliente().then(function (sb) {
      return q(sb.from('horarios').update(aceitar ? { status: 'confirmado', expira_em: null } : { status: 'recusado' }).eq('id', h.id).select().single());
    }).then(function () { return sincronizar(); }).then(function () {
      track(aceitar ? 'PedidoAceito' : 'PedidoRecusado');
      var l = N.local(h.ini), neg = cache.neg;
      var msg = aceitar ? 'Olá, ' + (h.cliente_nome || '') + '! Seu horário está confirmado: ' + (h.servico_nome || '') + ', ' + diaRel(l.data) + ' (' + dm(l.data) + ') às ' + l.hora + '. Até lá! — ' + neg.nome
        : 'Olá, ' + (h.cliente_nome || '') + '! Infelizmente não consigo atender ' + diaRel(l.data) + ' às ' + l.hora + '. Quer ver outro horário? ' + linkPublico(neg.slug);
      rotear();
      abrirFolha('<h1>' + (aceitar ? 'Horário confirmado ✓' : 'Pedido recusado') + '</h1><p class="muted" style="margin-top:6px">' + (aceitar ? 'Já está na sua agenda. ' : '') + 'O cliente vê a resposta na página. Se quiser, avise também pelo WhatsApp:</p>' +
        '<div class="card" style="margin-top:12px;font-size:15px">' + esc(msg) + '</div>' +
        (h.cliente_fone ? '<a class="btn wa cheio" style="margin-top:14px" target="_blank" rel="noopener" href="' + K.linkWa(h.cliente_fone, msg) + '">Avisar no WhatsApp</a>' : '') +
        '<button class="btn linha cheio" style="margin-top:10px" data-fechar>Fechar</button>');
    }).catch(function (e) { toast(erroTxt(e)); });
  }
  function bloquear() {
    abrirFolha('<h1>Bloquear horário</h1><p class="muted">Almoço, compromisso, folga… O link não oferece esse horário.</p>' +
      '<label class="campo"><span>Dia</span><input class="inp" type="date" id="bDia" value="' + hoje() + '"></label>' +
      '<div class="grade"><label class="campo"><span>De</span><input class="inp" type="time" id="bIni" value="12:00"></label><label class="campo"><span>Até</span><input class="inp" type="time" id="bFim" value="13:00"></label></div>' +
      '<label class="campo"><span>Motivo (só você vê)</span><input class="inp" id="bObs" placeholder="Ex.: dentista"></label>' +
      '<button class="btn cheio" style="margin-top:16px" id="bOk">Bloquear</button>', function (f) {
      $('#bOk', f).onclick = function () {
        var d = $('#bDia', f).value, i = $('#bIni', f).value, fm = $('#bFim', f).value;
        if (!d || !i || !fm || fm <= i) { toast('Confira o dia e os horários'); return; }
        cliente().then(function (sb) {
          return sb.from('horarios').insert({ negocio: cfg().negocio, periodo: N.periodo(N.instante(d, i), N.instante(d, fm)), status: 'bloqueio', obs: $('#bObs', f).value.trim().slice(0, 300) || null, origem: 'app' });
        }).then(function (r) {
          if (r.error) { toast(r.error.code === '23P01' ? 'Já tem horário marcado nesse intervalo' : erroTxt(r.error)); return; }
          fecharFolha(); toast('Horário bloqueado'); return carregarTudo().then(rotear);
        }).catch(function (e) { toast(erroTxt(e)); });
      };
    });
  }
  function editarServico(s) {
    var novo = !s; s = s || { nome: '', minutos: 30, preco: null };
    abrirFolha('<h1>' + (novo ? 'Novo serviço' : 'Editar serviço') + '</h1>' +
      '<label class="campo"><span>Nome</span><input class="inp" id="sNome" value="' + esc(s.nome) + '" placeholder="Ex.: Corte + barba"></label>' +
      '<div class="grade"><label class="campo"><span>Duração (minutos)</span><input class="inp" id="sMin" inputmode="numeric" value="' + s.minutos + '"></label><label class="campo"><span>Preço (R$, opcional)</span><input class="inp" id="sPre" inputmode="decimal" value="' + (s.preco ? String(s.preco).replace('.', ',') : '') + '"></label></div>' +
      '<button class="btn cheio" style="margin-top:16px" id="sOk">Salvar</button>' + (novo ? '' : '<button class="btn linha cheio" style="margin-top:10px" id="sDel">Tirar do link</button>'), function (f) {
      $('#sOk', f).onclick = function () {
        var nome = $('#sNome', f).value.trim(), min = parseInt($('#sMin', f).value, 10), pre = num($('#sPre', f).value);
        if (!nome) { toast('Dê um nome ao serviço'); return; }
        if (!(min >= 5 && min <= 600)) { toast('Duração entre 5 e 600 minutos'); return; }
        var dados = { nome: nome.slice(0, 60), minutos: min, preco: pre > 0 ? pre : null, ativo: true };
        cliente().then(function (sb) {
          return novo ? sb.from('servicos').insert(Object.assign({ negocio: cfg().negocio, ordem: cache.serv.length }, dados)) : sb.from('servicos').update(dados).eq('id', s.id);
        }).then(function (r) { if (r.error) throw r.error; fecharFolha(); return carregarTudo().then(rotear); }).catch(function (e) { toast(erroTxt(e)); });
      };
      if ($('#sDel', f)) $('#sDel', f).onclick = function () {
        cliente().then(function (sb) { return sb.from('servicos').update({ ativo: false }).eq('id', s.id); })
          .then(function () { fecharFolha(); return carregarTudo().then(rotear); }).catch(function (e) { toast(erroTxt(e)); });
      };
    });
  }
  function editarExpediente() {
    var por = {}; cache.exp.forEach(function (e) { (por[e.dia_semana] = por[e.dia_semana] || []).push(e); });
    function linha(d) {
      var l = por[d] || [], a = l[0], b = l[1];
      return '<div class="card" style="margin-top:10px;padding:12px"><label style="display:flex;gap:10px;align-items:center;font-weight:700"><input type="checkbox" data-dia="' + d + '" ' + (l.length ? 'checked' : '') + ' style="width:22px;height:22px"> ' + DIAS[d] + '</label>' +
        '<div class="grade" style="margin-top:8px"><input class="inp" type="time" data-ai="' + d + '" value="' + (a ? hm(a.inicio) : '09:00') + '"><input class="inp" type="time" data-af="' + d + '" value="' + (a ? hm(a.fim) : '12:00') + '"></div>' +
        '<div class="grade" style="margin-top:6px"><input class="inp" type="time" data-bi="' + d + '" value="' + (b ? hm(b.inicio) : (a ? '' : '13:00')) + '"><input class="inp" type="time" data-bf="' + d + '" value="' + (b ? hm(b.fim) : (a ? '' : '19:00')) + '"></div></div>';
    }
    abrirFolha('<h1>Dias e horários de atendimento</h1><p class="muted">Primeira linha: manhã. Segunda: tarde (deixe em branco se atende direto). O link só oferece horários dentro disso.</p>' +
      [1, 2, 3, 4, 5, 6, 0].map(linha).join('') + '<button class="btn cheio" style="margin-top:16px" id="xOk">Salvar</button>', function (f) {
      $('#xOk', f).onclick = function () {
        var novos = [], erro = '';
        $$('[data-dia]', f).forEach(function (c) {
          if (!c.checked) return; var d = +c.dataset.dia;
          [['ai', 'af'], ['bi', 'bf']].forEach(function (p) {
            var i = $('[data-' + p[0] + '="' + d + '"]', f).value, fm = $('[data-' + p[1] + '="' + d + '"]', f).value;
            if (!i && !fm) return;
            if (!i || !fm || fm <= i) { erro = 'Confira os horários de ' + DIAS[d]; return; }
            novos.push({ negocio: cfg().negocio, dia_semana: d, inicio: i, fim: fm });
          });
        });
        if (erro) { toast(erro); return; }
        cliente().then(function (sb) {
          return q(sb.from('expediente').delete().eq('negocio', cfg().negocio)).then(function () { return novos.length ? q(sb.from('expediente').insert(novos)) : null; });
        }).then(function () { fecharFolha(); toast('Horários salvos'); return carregarTudo().then(rotear); }).catch(function (e) { toast(erroTxt(e)); });
      };
    });
  }
  function salvarNeg(dif) {
    return cliente().then(function (sb) { return q(sb.from('negocios').update(dif).eq('id', cfg().negocio).select().single()); })
      .then(function (n) { cache.neg = n; toast('Salvo'); rotear(); }).catch(function (e) { toast(erroTxt(e)); });
  }
  var PADRAO = {
    beleza: [['Corte', 30, 35], ['Barba', 20, 25], ['Corte + barba', 50, 55], ['Manicure', 40, 30], ['Pé e mão', 80, 55]],
    servicos: [['Atendimento', 60, null]], construcao: [['Visita técnica', 60, null]]
  };
  function criar(nome, slug, wa) {
    return sessao().then(function (sb) {
      return q(sb.from('negocios').insert({ nome: nome, slug: slug, whatsapp: soDig(wa).slice(0, 13) || null }).select().single()).then(function (n) {
        var lista = (PADRAO[E().neg.setor] || PADRAO.servicos).map(function (s, i) { return { negocio: n.id, nome: s[0], minutos: s[1], preco: s[2], ordem: i }; });
        var exp = []; [1, 2, 3, 4, 5, 6].forEach(function (d) { exp.push({ negocio: n.id, dia_semana: d, inicio: '09:00', fim: '12:00' }, { negocio: n.id, dia_semana: d, inicio: '13:00', fim: '19:00' }); });
        return Promise.all([q(sb.from('servicos').insert(lista)), q(sb.from('expediente').insert(exp))]).then(function () { return n; });
      });
    });
  }

  // ---------- tela ----------
  function telaInicial() {
    var c = cfg(), nome = E().neg.nome || '';
    return topo('Link de agendamento', 'Seu cliente marca sozinho', '#/mais') + '<main>' +
      '<div class="card hero"><div class="lbl">Como funciona</div><p style="margin-top:6px;font-size:15.5px;color:#fff">Você ganha um link para pôr na bio do Instagram e no WhatsApp. O cliente abre, escolhe o serviço e um <b>horário livre</b> e pede. O seu celular avisa e você <b>aceita ou recusa</b> com um toque.</p>' +
      '<p style="margin-top:8px;font-size:14px;color:#BFE3DE">Ele não precisa instalar nada. Horário ocupado nem aparece, e dois clientes nunca pegam o mesmo horário.</p></div>' +
      '<h2>Criar o seu link</h2>' +
      '<label class="campo"><span>Nome que o cliente vê</span><input class="inp" id="oNome" value="' + esc(nome) + '" placeholder="Ex.: Barbearia do Zé"></label>' +
      '<label class="campo"><span>Seu link</span><div style="display:flex;align-items:center;gap:6px"><span class="muted peq" style="white-space:nowrap">…/agendar/?n=</span><input class="inp" id="oSlug" value="' + esc(slugDe(nome)) + '" autocapitalize="none" autocomplete="off"></div></label>' +
      '<label class="campo"><span>WhatsApp do negócio (aparece para o cliente depois da resposta)</span><input class="inp" id="oWa" inputmode="tel" placeholder="(61) 99999-9999"></label>' +
      '<button class="btn mint cheio" style="margin-top:16px" id="oCriar">Criar meu link</button><div id="oMsg"></div>' +
      '<p class="peq muted" style="margin-top:12px">Para o link funcionar, a sua agenda passa a ser guardada também na nuvem (com segurança, só você acessa). O resto do app continua só no seu celular.</p></main>';
  }
  function cartaoPedido(h) {
    var l = N.local(h.ini), falta = h.expira_em ? Math.max(0, Math.round((new Date(h.expira_em) - Date.now()) / 6e4)) : null;
    return '<div class="card" style="border:2px solid var(--yellow)"><div style="display:flex;justify-content:space-between;gap:10px"><div><b style="font-size:18px">' + diaRel(l.data) + ' · ' + l.hora + '</b>' +
      '<p style="margin-top:2px"><b>' + esc(h.cliente_nome || '') + '</b> · ' + esc(h.servico_nome || '') + (h.preco ? ' · ' + brl(h.preco) : '') + '</p>' +
      (h.obs ? '<p class="muted peq">"' + esc(h.obs) + '"</p>' : '') + '</div><span class="tag am" style="flex:none;align-self:flex-start;white-space:nowrap;height:auto">' + (falta != null ? 'responda em ' + (falta >= 60 ? Math.floor(falta / 60) + 'h' + (falta % 60 ? ('0' + falta % 60).slice(-2) : '') : falta + ' min') : 'aguardando') + '</span></div>' +
      '<div class="linhaBtns"><button class="btn mint peq" data-aceitar="' + h.id + '">Aceitar</button><button class="btn linha peq" data-recusar="' + h.id + '">Recusar</button>' +
      (h.cliente_fone ? '<a class="btn wa peq" target="_blank" rel="noopener" href="' + K.linkWa(h.cliente_fone, 'Olá, ' + (h.cliente_nome || '') + '! Sobre o seu pedido de horário:') + '">WhatsApp</a>' : '') + '</div></div>';
  }
  function telaPainel() {
    var neg = cache.neg, link = linkPublico(neg.slug), pend = pendentes(), agora = Date.now();
    var prox = cache.hor.filter(function (h) { return (h.status === 'confirmado' || h.status === 'bloqueio') && h.fim > agora; }).slice(0, 40);
    var dias = {}; prox.forEach(function (h) { var d = N.local(h.ini).data; (dias[d] = dias[d] || []).push(h); });
    var conflitos = E().ag.filter(function (a) { return a.conflito && a.status === 'marcado'; });
    var porDia = {}; cache.exp.forEach(function (e) { (porDia[e.dia_semana] = porDia[e.dia_semana] || []).push(hm(e.inicio) + '–' + hm(e.fim)); });
    var ativos = cache.serv.filter(function (s) { return s.ativo; });
    var avisoNotif = window.Notification && Notification.permission === 'default';
    return topo('Link de agendamento', neg.nome, '#/mais') + '<main>' +
      (neg.ativo ? '' : '<div class="alerta vm"><span class="ic">⏸️</span><span class="tx"><b>Link pausado</b><span>Ninguém consegue pedir horário agora.</span></span></div>') +
      '<div class="card hero"><div class="lbl">Seu link</div><div style="font-weight:700;font-size:16px;word-break:break-all;margin:4px 0 10px">' + esc(link.replace('https://', '')) + '</div>' +
      '<div class="linhaBtns" style="margin-top:0"><button class="btn mint peq" id="lCopiar">Copiar</button><a class="btn wa peq" target="_blank" rel="noopener" href="' + K.linkWa('', 'Agora você pode marcar seu horário comigo direto por aqui, a qualquer hora: ' + link) + '">Divulgar</a><a class="btn linha peq" style="background:#fff" target="_blank" rel="noopener" href="' + link + '">Ver página</a></div></div>' +
      (avisoNotif ? '<div class="alerta am"><span class="ic">🔔</span><span class="tx"><b>Ative o aviso de pedido</b><span>O celular apita quando chegar pedido (com o app aberto ou em segundo plano).</span></span></div><button class="btn claro cheio peq" id="lNotif">Ativar aviso</button>' : '') +
      (conflitos.length ? '<div class="alerta vm"><span class="ic">⚠️</span><span class="tx"><b>' + conflitos.length + ' horário(s) da sua agenda batem com outro</b><span>' + conflitos.map(function (a) { return esc(a.cliNome) + ' ' + dm(a.data) + ' ' + a.hora; }).join(', ') + '. Ajuste na Agenda.</span></span></div>' : '') +
      '<h2>Pedidos aguardando (' + pend.length + ')</h2>' + (pend.length ? pend.map(cartaoPedido).join('') : '<div class="lista"><div class="vazio">Nenhum pedido esperando resposta.</div></div>') +
      '<h2>Próximos horários</h2>' + (prox.length ? Object.keys(dias).map(function (d) {
        return '<p style="font-weight:700;margin:12px 0 6px;text-transform:capitalize">' + diaRel(d) + '</p><div class="lista">' + dias[d].map(function (h) {
          var l = N.local(h.ini), lf = N.local(h.fim);
          return '<div class="item"><span class="av" style="background:' + (h.status === 'bloqueio' ? 'var(--red-soft)' : 'var(--green-soft)') + '">' + (h.status === 'bloqueio' ? '⛔' : '✅') + '</span><span class="meio"><b>' + l.hora + '–' + lf.hora + ' · ' + esc(h.status === 'bloqueio' ? 'Bloqueado' : (h.cliente_nome || 'Cliente')) + '</b><span>' + esc(h.status === 'bloqueio' ? (h.obs || '') : (h.servico_nome || '')) + (h.origem === 'link' ? ' · pelo link' : '') + '</span></span>' +
            (h.status === 'bloqueio' ? '<button class="btn linha peq" data-desb="' + h.id + '">Liberar</button>' : '') + '</div>';
        }).join('') + '</div>';
      }).join('') : '<div class="lista"><div class="vazio">Nada marcado nos próximos dias.</div></div>') +
      '<button class="btn linha cheio" style="margin-top:12px" id="lBloq">Bloquear um horário</button>' +
      '<h2>Serviços no link</h2><div class="lista">' + (ativos.length ? ativos.map(function (s) { return '<button class="item" data-serv="' + s.id + '"><span class="meio"><b>' + esc(s.nome) + '</b><span>' + s.minutos + ' min' + (s.preco ? ' · ' + brl(s.preco) : '') + '</span></span><span>›</span></button>'; }).join('') : '<div class="vazio">Nenhum serviço. Sem serviço, o cliente não consegue pedir.</div>') + '</div>' +
      '<button class="btn linha cheio" style="margin-top:10px" id="lServ">+ Adicionar serviço</button>' +
      '<h2>Dias e horários</h2><div class="lista"><button class="item" id="lExp"><span class="meio"><b>' + ([1, 2, 3, 4, 5, 6, 0].filter(function (d) { return porDia[d]; }).map(function (d) { return DIAS[d].slice(0, 3); }).join(', ') || 'Nenhum dia') + '</b><span>' + ([1, 2, 3, 4, 5, 6, 0].filter(function (d) { return porDia[d]; }).slice(0, 1).map(function (d) { return porDia[d].join(' e '); })[0] || 'Toque para definir') + '</span></span><span>›</span></button></div>' +
      '<h2>Como o link funciona</h2>' +
      '<div class="card"><label style="display:flex;gap:12px;align-items:flex-start"><input type="checkbox" id="lAuto" ' + (neg.aceitar_auto ? 'checked' : '') + ' style="width:22px;height:22px;margin-top:3px"><span><b>Aceitar sozinho</b><br><span class="muted peq">Horário livre já entra confirmado, e o celular só avisa. Desligado: você aprova cada pedido.</span></span></label>' +
      '<label class="campo"><span>Tempo para você responder (o horário fica segurado)</span><select class="inp" id="lEsp">' + Object.keys(MIN).map(function (k) { return '<option value="' + k + '"' + (+k === neg.espera_resposta ? ' selected' : '') + '>' + MIN[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="campo"><span>Antecedência mínima</span><select class="inp" id="lAnt">' + [[0, 'Pode ser para agora'], [30, '30 min'], [60, '1 hora'], [120, '2 horas'], [1440, '1 dia']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === neg.antecedencia ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="campo"><span>Até quantos dias à frente</span><select class="inp" id="lDias">' + [7, 15, 30, 60].map(function (o) { return '<option value="' + o + '"' + (o === neg.dias_a_frente ? ' selected' : '') + '>' + o + ' dias</option>'; }).join('') + '</select></label>' +
      '<label class="campo"><span>Intervalo entre horários</span><select class="inp" id="lPasso">' + [10, 15, 20, 30, 60].map(function (o) { return '<option value="' + o + '"' + (o === neg.passo ? ' selected' : '') + '>de ' + o + ' em ' + o + ' min</option>'; }).join('') + '</select></label>' +
      '<label class="campo"><span>WhatsApp do negócio</span><input class="inp" id="lWa" inputmode="tel" value="' + esc(neg.whatsapp || '') + '"></label>' +
      '<button class="btn cheio" style="margin-top:14px" id="lSalvar">Salvar ajustes</button>' +
      '<button class="btn linha cheio" style="margin-top:10px" id="lPausa">' + (neg.ativo ? 'Pausar o link' : 'Reativar o link') + '</button></div>' +
      '<p class="peq muted" style="margin-top:14px">Dica: horários que você marca na Agenda do app também bloqueiam o link (quando o celular tem internet). Os dados ficam no Brasil (São Paulo) e cada negócio só acessa os seus.</p></main>';
  }

  R.agendaonline = function () {
    if (!cfg().negocio) {
      return { html: telaInicial(), montar: function (el) {
        $('#oNome', el).oninput = function () { if (!$('#oSlug', el).dataset.mexeu) $('#oSlug', el).value = slugDe(this.value); };
        $('#oSlug', el).oninput = function () { this.dataset.mexeu = 1; };
        $('#oCriar', el).onclick = function () {
          var nome = $('#oNome', el).value.trim(), slug = slugDe($('#oSlug', el).value), wa = $('#oWa', el).value;
          if (nome.length < 2) { toast('Escreva o nome do negócio'); return; }
          if (slug.length < 3) { toast('O link precisa de pelo menos 3 letras'); return; }
          var b = this; b.disabled = true; b.textContent = 'Criando…';
          criar(nome, slug, wa).then(function (n) {
            var c = cfg(); c.slug = n.slug; c.negocio = n.id; salvar(); track('LinkAgendamentoCriado');
            return carregarTudo().then(function () { ouvir(); return sincronizar(); }).then(rotear);
          }).catch(function (e) {
            b.disabled = false; b.textContent = 'Criar meu link';
            var dup = e && e.code === '23505';
            $('#oMsg', el).innerHTML = '<div class="aviso" style="margin-top:10px">' + (dup ? 'Esse link já é de outra pessoa. Tente outro, por exemplo <b>' + esc(slug + '-' + (E().neg.pix && E().neg.pix.cidade ? slugDe(E().neg.pix.cidade) : 'df')) + '</b>.' : esc(erroTxt(e))) + '</div>';
            if (dup) { var c2 = cfg(); c2.slug = ''; c2.negocio = ''; }
          });
        };
        // já tem negócio na nuvem (ex.: limpou o app mas a sessão continuou)
        sessao().then(carregarTudo).then(function (n) { if (n) rotear(); }).catch(function () {});
      } };
    }
    if (!cache.neg || Date.now() - cache.carregado > 15000) {
      return { html: topo('Link de agendamento', '', '#/mais') + '<main><p class="muted" style="margin-top:20px">Carregando…</p><div id="lErro"></div></main>', montar: function (el) {
        sincronizar().then(function () {
          if (!cache.neg) { var c = cfg(); c.negocio = ''; c.slug = ''; salvar(); }
          cache.carregado = cache.carregado || Date.now(); ouvir(); rotear();
        }).catch(function (e) { $('#lErro', el).innerHTML = '<div class="aviso">' + esc(erroTxt(e)) + '</div><button class="btn linha cheio" style="margin-top:10px" id="lRecarregar">Tentar de novo</button>'; var br = $('#lRecarregar', el); if (br) br.onclick = function () { location.reload(); }; });
      } };
    }
    return { html: telaPainel(), montar: function (el) {
      var neg = cache.neg;
      if (Date.now() - cache.carregado > 3000) { var sig = assinatura(); sincronizar().then(function () { conferirNovos(); if (location.hash === '#/agendaonline' && sig !== assinatura() && !document.querySelector('.veu')) rotear(); }).catch(function () {}); }
      $('#lCopiar', el).onclick = function () { copiar(linkPublico(neg.slug), 'Link copiado'); };
      if ($('#lNotif', el)) $('#lNotif', el).onclick = function () { Notification.requestPermission().then(function () { rotear(); }); };
      $$('[data-aceitar]', el).forEach(function (b) { b.onclick = function () { b.disabled = true; responder(cache.hor.filter(function (h) { return h.id === b.dataset.aceitar; })[0], true); }; });
      $$('[data-recusar]', el).forEach(function (b) { b.onclick = function () { var h = cache.hor.filter(function (x) { return x.id === b.dataset.recusar; })[0]; confirmar('Recusar o pedido?', 'O horário volta a ficar livre e o cliente vê que foi recusado.', 'Recusar', function () { responder(h, false); }, true); }; });
      $$('[data-desb]', el).forEach(function (b) { b.onclick = function () { cliente().then(function (sb) { return sb.from('horarios').update({ status: 'cancelado' }).eq('id', b.dataset.desb); }).then(function () { return carregarTudo(); }).then(rotear).catch(function (e) { toast(erroTxt(e)); }); }; });
      $('#lBloq', el).onclick = bloquear;
      $('#lServ', el).onclick = function () { editarServico(null); };
      $$('[data-serv]', el).forEach(function (b) { b.onclick = function () { editarServico(cache.serv.filter(function (s) { return s.id === b.dataset.serv; })[0]); }; });
      $('#lExp', el).onclick = editarExpediente;
      $('#lSalvar', el).onclick = function () {
        salvarNeg({ aceitar_auto: $('#lAuto', el).checked, espera_resposta: +$('#lEsp', el).value, antecedencia: +$('#lAnt', el).value, dias_a_frente: +$('#lDias', el).value, passo: +$('#lPasso', el).value, whatsapp: soDig($('#lWa', el).value).slice(0, 13) || null });
      };
      $('#lPausa', el).onclick = function () { salvarNeg({ ativo: !neg.ativo }); };
    } };
  };

  // aviso na tela inicial
  var alertasAntes = window.MNCX && window.MNCX.alertas;
  window.MNCX = window.MNCX || {};
  window.MNCX.alertas = function (al) {
    if (alertasAntes) alertasAntes(al);
    var c = cfg();
    if (c.negocio && c.pend > 0) al.unshift({ c: 'am', i: '🔗', b: c.pend + (c.pend > 1 ? ' pedidos de horário' : ' pedido de horário') + ' esperando você', s: 'Toque para aceitar ou recusar.', h: '#/agendaonline' });
  };
  window.MNCX.agendaOnline = { sincronizar: sincronizar, slugDe: slugDe, cache: cache };

  // ao abrir o app (e a cada 2 minutos), sincroniza e fica ouvindo pedidos
  function naTelaQueMostra() { return !location.hash || /^#\/(agendaonline|agenda|inicio)?$/.test(location.hash); }
  function iniciar() {
    if (!K.E() || !cfg().negocio || !navigator.onLine) return;
    var antes = assinatura();
    sincronizar().then(function () { ouvir(); conferirNovos(); if (antes !== assinatura() && naTelaQueMostra() && !document.querySelector('.veu')) rotear(); }).catch(function () {});
  }
  setTimeout(iniciar, 1500);
  setInterval(iniciar, 60000);
  window.addEventListener('online', iniciar);
  var adiar = null;
  function logo() { clearTimeout(adiar); adiar = setTimeout(iniciar, 2000); }
  window.addEventListener('hashchange', logo);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) logo(); });
})();

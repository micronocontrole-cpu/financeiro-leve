/* Micro no Controle — Acompanhe seu pedido/serviço
   O negócio cria um acompanhamento (pedido, conserto, encomenda), manda o link pelo
   WhatsApp e vai avançando as etapas com um toque. O cliente abre o link e vê onde está,
   sem precisar perguntar "e aí, já ficou pronto?".
   Banco: supabase/002_acompanhar.sql. Página do cliente: /acompanhar/?t=TOKEN */
(function () {
  'use strict';
  var MODELOS = {
    entrega: { nome: 'Pedido para entregar', i: '🛵', etapas: ['Pedido recebido', 'Em preparo', 'Saiu para entrega', 'Entregue'] },
    retirada: { nome: 'Pedido para retirar', i: '🛍️', etapas: ['Pedido recebido', 'Em preparo', 'Pronto para retirar', 'Retirado'] },
    conserto: { nome: 'Conserto ou serviço', i: '🔧', etapas: ['Recebido', 'Em análise', 'Orçamento enviado', 'Em andamento', 'Pronto', 'Entregue'] },
    encomenda: { nome: 'Encomenda', i: '🎂', etapas: ['Encomenda anotada', 'Em produção', 'Pronta', 'Entregue'] },
    obra: { nome: 'Obra ou instalação', i: '🛠️', etapas: ['Visita feita', 'Orçamento aprovado', 'Material comprado', 'Em execução', 'Concluído'] }
  };
  var PADRAO = { alimentacao: 'entrega', construcao: 'obra', servicos: 'conserto', roupas: 'retirada', beleza: 'encomenda', outro: 'retirada' };
  function primeiro(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  // mensagens puras (testáveis)
  function msgLink(a, link, neg) {
    return 'Oi' + (a.cliente_nome ? ', ' + primeiro(a.cliente_nome) : '') + '! ' + (neg && neg.nome ? neg.nome + ' aqui 👋 ' : '') +
      'Você pode acompanhar ' + (a.titulo ? '"' + a.titulo + '"' : 'seu pedido') + ' por este link, ele mostra cada etapa na hora:\n' + link;
  }
  function msgEtapa(a, link) {
    var et = a.etapas[a.etapa], ult = a.etapa === a.etapas.length - 1;
    return 'Oi' + (a.cliente_nome ? ', ' + primeiro(a.cliente_nome) : '') + '! Atualização ' + (a.titulo ? 'de "' + a.titulo + '"' : 'do seu pedido') + ': *' + et + '*' + (ult ? ' ✅ Obrigado pela confiança!' : '.') + (link && !ult ? '\nAcompanhe: ' + link : '');
  }
  var api = { MODELOS: MODELOS, msgLink: msgLink, msgEtapa: msgEtapa };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  var K = window.MNCK, N = window.MNCNuvem; if (!K || !N) return;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = K.esc, toast = K.toast, R = K.ROTAS;
  function E() { return K.E(); }
  var SITE = 'https://micronocontrole.com';
  function linkDe(a) { return SITE + '/acompanhar/?t=' + a.token; }
  function q(p) { return p.then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function soDig(s) { return String(s || '').replace(/\D/g, ''); }
  function slugDe(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'meu-negocio'; }
  function erroTxt(e) {
    var m = (e && (e.message || e.error_description)) || String(e);
    if (/fetch|network|internet/i.test(m)) return 'Sem internet agora. Tente de novo em instantes.';
    if (/anonymous/i.test(m)) return 'O login ainda não está liberado no Supabase (ative "Allow anonymous sign-ins").';
    if (/acompanhamentos/.test(m) && /exist|schema cache/i.test(m)) return 'Falta rodar o 002_acompanhar.sql no Supabase.';
    return m;
  }
  function sessao() {
    return N.carregar(false).then(function (sb) {
      return sb.auth.getSession().then(function (r) {
        if (r.data && r.data.session) return sb;
        return sb.auth.signInAnonymously().then(function (x) { if (x.error) throw x.error; return sb; });
      });
    });
  }
  // o acompanhamento precisa de um "negócio" na nuvem (o mesmo do link de agendamento)
  function negocio(sb) {
    return q(sb.from('negocios').select('id,nome,slug,whatsapp').maybeSingle()).then(function (n) {
      if (n) return n;
      var x = E(), nome = (x.neg.nome || 'Meu negócio').slice(0, 80);
      if (nome.length < 2) nome = 'Meu negócio';
      var slug = slugDe(nome) + '-' + Math.random().toString(36).slice(2, 6);
      return q(sb.from('negocios').insert({ nome: nome, slug: slug, whatsapp: soDig(x.neg.fone || '').slice(0, 13) || null }).select('id,nome,slug,whatsapp').single()).then(function (n2) {
        if (!x.nuvem) x.nuvem = { slug: '', negocio: '', pend: 0 };
        x.nuvem.slug = n2.slug; x.nuvem.negocio = n2.id; K.salvar(); return n2;
      });
    });
  }
  var cache = { lista: null, neg: null, erro: '' };
  function carregar() {
    return sessao().then(function (sb) {
      return negocio(sb).then(function (n) {
        cache.neg = n;
        return q(sb.from('acompanhamentos').select('*').order('atualizado_em', { ascending: false }).limit(60)).then(function (l) { cache.lista = l; cache.erro = ''; return l; });
      });
    }).catch(function (e) { cache.erro = erroTxt(e); throw e; });
  }
  function atualizar(a, dif) {
    return sessao().then(function (sb) { return q(sb.from('acompanhamentos').update(dif).eq('id', a.id).select().single()); })
      .then(function (n) { Object.assign(a, n); return a; });
  }
  function abrirWa(fone, txt) { window.open(K.linkWa(fone, txt), '_blank'); }

  function cartao(a) {
    var n = a.etapas.length, pct = Math.round(a.etapa / (n - 1) * 100), prox = a.etapas[a.etapa + 1];
    return '<div class="card" style="margin-top:10px' + (a.encerrado ? ';opacity:.6' : '') + '"><div style="display:flex;justify-content:space-between;gap:10px"><div style="min-width:0"><b style="font-size:17px">' + esc(a.titulo) + '</b>' +
      '<p class="muted peq">' + esc(a.cliente_nome || 'Sem nome') + ' · ' + esc(a.etapas[a.etapa]) + '</p></div><span class="tag" style="flex:none;align-self:flex-start;height:auto;white-space:nowrap">' + (a.etapa + 1) + '/' + n + '</span></div>' +
      '<div style="height:8px;border-radius:99px;background:var(--line);margin:10px 0 4px;overflow:hidden"><i style="display:block;height:100%;width:' + pct + '%;background:var(--mint)"></i></div>' +
      (a.encerrado ? '' : '<div class="linhaBtns">' + (prox ? '<button class="btn mint peq" data-av="' + a.id + '">→ ' + esc(prox) + '</button>' : '<button class="btn mint peq" data-fim="' + a.id + '">Encerrar</button>') +
        '<button class="btn wa peq" data-wa="' + a.id + '">Mandar link</button><button class="btn linha peq" data-mais="' + a.id + '">⋯</button></div>') + '</div>';
  }
  R.acompanhar = function () {
    var html = K.topo('Acompanhe seu pedido', 'O cliente vê cada etapa pelo link', '#/mais') + '<main>' +
      '<button class="btn mint cheio" id="acNovo">+ Novo acompanhamento</button>' +
      '<div class="dica" style="margin-top:12px">Quem fica sem notícia é quem mais reclama no Google. Mande o link e vá avançando as etapas: o cliente vê sozinho.</div>' +
      '<div id="acLista"><p class="muted" style="margin-top:18px">Carregando…</p></div></main>';
    return { html: html, montar: function (el) {
      $('#acNovo', el).onclick = function () { abrirNovo(); };
      function desenhar() {
        var box = $('#acLista', el); if (!box) return;
        if (cache.erro) { box.innerHTML = '<div class="aviso" style="margin-top:14px">' + esc(cache.erro) + '</div>'; return; }
        var l = cache.lista || [], abertos = l.filter(function (a) { return !a.encerrado; }), fechados = l.filter(function (a) { return a.encerrado; }).slice(0, 10);
        box.innerHTML = (abertos.length ? '<h2>Em andamento</h2>' + abertos.map(cartao).join('') : '<div class="lista" style="margin-top:14px"><div class="vazio"><span class="ic">📍</span>Nenhum acompanhamento aberto.<br>Crie um quando receber um pedido, uma encomenda ou um conserto.</div></div>') +
          (fechados.length ? '<h2>Encerrados</h2>' + fechados.map(cartao).join('') : '');
        $$('[data-av]', box).forEach(function (b) { b.onclick = function () { avancar(ach(b.dataset.av)); }; });
        $$('[data-fim]', box).forEach(function (b) { b.onclick = function () { b.disabled = true; atualizar(ach(b.dataset.fim), { encerrado: true }).then(desenhar).catch(function (e) { toast(erroTxt(e)); b.disabled = false; }); }; });
        $$('[data-wa]', box).forEach(function (b) { b.onclick = function () { var a = ach(b.dataset.wa); abrirWa(a.fone || '', msgLink(a, linkDe(a), cache.neg)); }; });
        $$('[data-mais]', box).forEach(function (b) { b.onclick = function () { abrirMais(ach(b.dataset.mais), desenhar); }; });
      }
      function ach(id) { return (cache.lista || []).filter(function (x) { return x.id === id; })[0]; }
      function avancar(a) {
        var antes = a.etapa;
        atualizar(a, { etapa: a.etapa + 1 }).then(function () {
          desenhar(); K.track('AcompanharEtapa', { etapa: a.etapa });
          var f = K.abrirFolha('<h1>' + esc(a.etapas[a.etapa]) + ' ✓</h1><p class="muted">O link já mostra a etapa nova. Quer avisar ' + esc(primeiro(a.cliente_nome) || 'o cliente') + ' agora?</p>' +
            '<button class="btn wa cheio" style="margin-top:14px" id="acAvisa">Avisar no WhatsApp</button><button class="btn linha cheio" style="margin-top:10px" id="acNao">Não precisa</button>' +
            '<button class="btn linha cheio peq" style="margin-top:10px" id="acVolta">Desfazer (voltar para "' + esc(a.etapas[antes]) + '")</button>');
          $('#acAvisa', f).onclick = function () { abrirWa(a.fone || '', msgEtapa(a, linkDe(a))); K.fecharFolha(); };
          $('#acNao', f).onclick = function () { K.fecharFolha(); };
          $('#acVolta', f).onclick = function () { atualizar(a, { etapa: antes }).then(function () { K.fecharFolha(); desenhar(); }); };
        }).catch(function (e) { toast(erroTxt(e)); });
      }
      if (cache.lista) desenhar();
      carregar().then(desenhar).catch(desenhar);
      R.acompanhar._desenhar = desenhar;
    } };
  };
  function abrirNovo() {
    var x = E(), mod = PADRAO[x.neg.setor] || 'retirada';
    var f = K.abrirFolha('<h1>Novo acompanhamento</h1>' +
      '<p style="font-weight:600;font-size:14.5px;margin-top:12px">O que é?</p><div class="chips" style="margin-top:8px">' +
      Object.keys(MODELOS).map(function (k) { return '<button class="chip ' + (k === mod ? 'on' : '') + '" data-mod="' + k + '">' + MODELOS[k].i + ' ' + MODELOS[k].nome + '</button>'; }).join('') + '</div>' +
      '<p class="peq muted" id="acEt" style="margin-top:8px"></p>' +
      '<label class="campo"><span>Descrição curta</span><input class="inp" id="acTit" maxlength="80" placeholder="Ex.: 2 marmitas + refri · Troca de tela · Bolo de 2 kg"></label>' +
      '<label class="campo"><span>Cliente</span><input class="inp" id="acCli" list="acCliL" maxlength="60" autocomplete="off"></label><datalist id="acCliL">' + x.cli.map(function (c) { return '<option value="' + esc(c.nome) + '">'; }).join('') + '</datalist>' +
      '<label class="campo"><span>WhatsApp do cliente</span><input class="inp" id="acFone" inputmode="tel" placeholder="(61) 99999-9999"></label>' +
      '<label class="campo"><span>Previsão (opcional)</span><input class="inp" type="datetime-local" id="acPrev"></label>' +
      '<label class="campo"><span>Recado para o cliente (opcional)</span><input class="inp" id="acRec" maxlength="200" placeholder="Ex.: Peça chega na quinta"></label>' +
      '<button class="btn mint cheio" style="margin-top:16px" id="acOk">Criar e mandar o link</button>');
    function etapas() { $('#acEt', f).textContent = 'Etapas: ' + MODELOS[mod].etapas.join(' → '); }
    etapas();
    $$('[data-mod]', f).forEach(function (b) { b.onclick = function () { mod = b.dataset.mod; $$('[data-mod]', f).forEach(function (y) { y.classList.toggle('on', y === b); }); etapas(); }; });
    $('#acCli', f).addEventListener('change', function () { var c = x.cli.filter(function (y) { return y.nome.toLowerCase() === $('#acCli', f).value.trim().toLowerCase(); })[0]; if (c && c.fone && !$('#acFone', f).value) $('#acFone', f).value = c.fone; });
    $('#acOk', f).onclick = function () {
      var bt = this, tit = $('#acTit', f).value.trim(), cli = $('#acCli', f).value.trim(), fone = $('#acFone', f).value.trim(), pv = $('#acPrev', f).value, rec = $('#acRec', f).value.trim();
      if (!tit) { toast('Escreva o que é (ex.: Troca de tela).'); return; }
      bt.disabled = true; bt.textContent = 'Criando…';
      sessao().then(function (sb) {
        return negocio(sb).then(function (n) {
          cache.neg = n;
          return q(sb.from('acompanhamentos').insert({ negocio: n.id, titulo: tit, cliente_nome: cli || null, etapas: MODELOS[mod].etapas, previsao: pv ? N.instante(pv.slice(0, 10), pv.slice(11, 16)) : null, recado: rec || null, local_id: K.uid() }).select().single());
        });
      }).then(function (a) {
        a.fone = fone; (cache.lista = cache.lista || []).unshift(a);
        if (cli) { var c = null; x.cli.forEach(function (y) { if (y.nome.toLowerCase() === cli.toLowerCase()) c = y; }); if (!c) { c = { id: K.uid(), nome: cli, fone: fone, criado: K.hoje() }; x.cli.push(c); } else if (fone && !c.fone) c.fone = fone; }
        guardarFone(a.id, fone); K.salvar(); K.track('AcompanharNovo', { modelo: mod });
        K.fecharFolha(); if (R.acompanhar._desenhar) R.acompanhar._desenhar();
        var f2 = K.abrirFolha('<h1>Link pronto ✓</h1><p class="muted">Mande para ' + esc(primeiro(cli) || 'o cliente') + '. Cada vez que você avançar uma etapa, o link mostra sozinho.</p>' +
          '<div class="pixbox" style="margin-top:12px">' + esc(linkDe(a)) + '</div>' +
          '<button class="btn wa cheio" style="margin-top:12px" id="l1">Mandar no WhatsApp</button><button class="btn linha cheio" style="margin-top:10px" id="l2">Copiar link</button>');
        $('#l1', f2).onclick = function () { abrirWa(fone, msgLink(a, linkDe(a), cache.neg)); };
        $('#l2', f2).onclick = function () { K.copiar(linkDe(a)); };
      }).catch(function (e) { bt.disabled = false; bt.textContent = 'Criar e mandar o link'; toast(erroTxt(e)); });
    };
  }
  // o WhatsApp do cliente fica só no celular (não vai para a nuvem)
  function guardarFone(id, fone) { var x = E(); x.acompFone = x.acompFone || {}; if (fone) x.acompFone[id] = fone; }
  var _carregar = carregar;
  carregar = function () { return _carregar().then(function (l) { var m = E().acompFone || {}; l.forEach(function (a) { a.fone = m[a.id] || ''; }); return l; }); };
  function abrirMais(a, depois) {
    var f = K.abrirFolha('<h1>' + esc(a.titulo) + '</h1>' +
      '<p style="font-weight:600;font-size:14.5px;margin-top:12px">Etapa</p><div class="chips" style="margin-top:8px">' + a.etapas.map(function (e, i) { return '<button class="chip ' + (i === a.etapa ? 'on' : '') + '" data-e="' + i + '">' + esc(e) + '</button>'; }).join('') + '</div>' +
      '<label class="campo"><span>Recado para o cliente</span><input class="inp" id="mRec" maxlength="200" value="' + esc(a.recado || '') + '"></label>' +
      '<button class="btn cheio" style="margin-top:14px" id="mOk">Salvar</button>' +
      '<div class="linhaBtns"><button class="btn linha peq" id="mCp">Copiar link</button><button class="btn linha peq" id="mFim">' + (a.encerrado ? 'Reabrir' : 'Encerrar') + '</button><button class="btn verm peq" id="mDel">Excluir</button></div>');
    var et = a.etapa;
    $$('[data-e]', f).forEach(function (b) { b.onclick = function () { et = +b.dataset.e; $$('[data-e]', f).forEach(function (y) { y.classList.toggle('on', y === b); }); }; });
    function feito() { K.fecharFolha(); depois(); }
    $('#mOk', f).onclick = function () { atualizar(a, { etapa: et, recado: $('#mRec', f).value.trim() || null }).then(feito).catch(function (e) { toast(erroTxt(e)); }); };
    $('#mCp', f).onclick = function () { K.copiar(linkDe(a)); };
    $('#mFim', f).onclick = function () { atualizar(a, { encerrado: !a.encerrado }).then(feito).catch(function (e) { toast(erroTxt(e)); }); };
    $('#mDel', f).onclick = function () {
      K.confirmar('Excluir acompanhamento?', 'O link que o cliente recebeu para de funcionar.', 'Excluir', function () {
        sessao().then(function (sb) { return q(sb.from('acompanhamentos').delete().eq('id', a.id)); })
          .then(function () { cache.lista = cache.lista.filter(function (x) { return x.id !== a.id; }); depois(); }).catch(function (e) { toast(erroTxt(e)); });
      }, true);
    };
  }
  window.MNCX = window.MNCX || {};
  window.MNCX.acompanhar = { MODELOS: MODELOS };
})();

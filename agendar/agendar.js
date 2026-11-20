(function () {
  'use strict';
  var N = window.MNCNuvem, app = document.getElementById('app');
  var slug = (new URLSearchParams(location.search).get('n') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  var S = { pag: null, serv: null, dia: null, hora: null, livres: [] }, sb = null;
  var DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function brl(n) { return 'R$ ' + (+n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function dur(m) { return m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? ('0' + m % 60).slice(-2) : '') : m + ' min'; }
  function hojeSP() { return N.local(new Date()).data; }
  function somaDias(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function dow(d) { return new Date(d + 'T12:00:00Z').getUTCDay(); }
  function nomeDia(d) { var h = hojeSP(); if (d === h) return 'hoje'; if (d === somaDias(h, 1)) return 'amanhã'; return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][dow(d)] + ', ' + d.slice(8) + '/' + d.slice(5, 7); }
  function guardados() { try { return JSON.parse(localStorage.getItem('mnc-pedidos') || '[]'); } catch (e) { return []; } }
  function guardar(l) { try { localStorage.setItem('mnc-pedidos', JSON.stringify(l.slice(-10))); } catch (e) {} }
  function erro(msg) { app.innerHTML = '<div class="aviso erro" style="margin-top:20px">' + msg + '</div>'; }

  if (!slug) { document.getElementById('nome').textContent = 'Link incompleto'; erro('Esse link está incompleto. Peça o link certo para quem te mandou.'); return; }

  function rpc(fn, args) { return sb.rpc(fn, args).then(function (r) { if (r.error) throw r.error; return r.data; }); }

  function render() {
    var p = S.pag, h = hojeSP(), dias = [];
    for (var i = 0; i <= Math.min(p.dias_a_frente, 30); i++) { var d = somaDias(h, i); if (p.dias_semana.indexOf(dow(d)) >= 0) dias.push(d); }
    var meus = guardados().filter(function (x) { return x.slug === slug; });
    app.innerHTML = '<div id="meus"></div>' +
      '<h2><span class="n">1</span>Serviço</h2><div class="serv">' + (p.servicos.length ? p.servicos.map(function (s) {
        return '<button data-s="' + s.id + '" class="' + (S.serv && S.serv.id === s.id ? 'on' : '') + '"><b>' + esc(s.nome) + '</b><span>' + dur(s.minutos) + (s.preco ? ' · ' + brl(s.preco) : '') + '</span></button>';
      }).join('') : '<div class="vazio">Nenhum serviço disponível agora.</div>') + '</div>' +
      (S.serv ? '<h2><span class="n">2</span>Dia</h2><div class="dias">' + dias.map(function (d) {
        return '<button data-d="' + d + '" class="' + (S.dia === d ? 'on' : '') + '"><small>' + (d === h ? 'hoje' : DS[dow(d)]) + '</small><b>' + d.slice(8) + '</b><small>' + ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+d.slice(5, 7) - 1] + '</small></button>';
      }).join('') + '</div>' : '') +
      (S.dia ? '<h2><span class="n">3</span>Horário · <span style="font-weight:600;text-transform:none">' + nomeDia(S.dia) + '</span></h2><div id="horas"><div class="horas"><div class="esq"></div><div class="esq"></div><div class="esq"></div><div class="esq"></div></div></div>' : '') +
      (S.hora ? '<h2><span class="n">4</span>Seus dados</h2><div class="card"><p style="font-weight:700">' + esc(S.serv.nome) + ' · ' + nomeDia(S.dia) + ' às ' + N.local(S.hora).hora + '</p>' +
        '<label><span>Seu nome</span><input class="inp" id="fNome" autocomplete="name" maxlength="80"></label>' +
        '<label><span>Seu WhatsApp</span><input class="inp" id="fFone" inputmode="tel" autocomplete="tel" placeholder="(61) 99999-9999" maxlength="20"></label>' +
        '<label><span>Recado (opcional)</span><textarea class="inp" id="fObs" maxlength="300"></textarea></label>' +
        '<button class="btn" id="fOk">' + (p.aceitar_auto ? 'Marcar horário' : 'Pedir horário') + '</button>' +
        '<p class="muted peq" style="margin-top:10px">Seu nome e WhatsApp vão só para ' + esc(p.nome) + ', para confirmar o horário. <a href="../privacidade/" style="color:inherit">Privacidade</a></p><div id="fMsg"></div></div>' : '') +
      '<p class="rod">Agenda online feita com o <a href="../?src=agendar">Micro no Controle</a></p>';
    app.querySelectorAll('[data-s]').forEach(function (b) { b.onclick = function () { S.serv = p.servicos.filter(function (s) { return s.id === b.dataset.s; })[0]; S.hora = null; render(); rolar(S.dia ? '#horas' : '.dias'); }; });
    app.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { S.dia = b.dataset.d; S.hora = null; render(); rolar('#horas'); }; });
    if (S.dia) horas();
    if (S.hora) { document.getElementById('fOk').onclick = pedir; rolar('#fNome'); var g = guardados()[guardados().length - 1]; if (g && g.nome) { document.getElementById('fNome').value = g.nome; document.getElementById('fFone').value = g.fone || ''; } }
    if (meus.length) mostrarMeus(meus);
    var dd = app.querySelector('.dias button.on'); if (dd && dd.scrollIntoView) dd.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function rolar(sel) { setTimeout(function () { var e = app.querySelector(sel); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); }
  function desenharHoras() {
    var box = document.getElementById('horas'); if (!box) return;
    box.innerHTML = S.livres.length ? '<div class="horas">' + S.livres.map(function (x) { return '<button data-h="' + x.toISOString() + '" class="' + (S.hora && +S.hora === +x ? 'on' : '') + '">' + N.local(x).hora + '</button>'; }).join('') + '</div>'
      : '<div class="vazio">Sem horário livre nesse dia. Tente outro dia.</div>';
    box.querySelectorAll('[data-h]').forEach(function (b) { b.onclick = function () { S.hora = new Date(b.dataset.h); render(); }; });
  }
  function horas(forcar) {
    var alvo = S.dia, chave = S.dia + '|' + S.serv.id;
    if (!forcar && S.chave === chave) { desenharHoras(); return; }
    rpc('horarios_livres', { p_slug: slug, p_dia: S.dia, p_servico: S.serv.id }).then(function (l) {
      if (alvo !== S.dia) return;
      S.livres = (l || []).map(function (x) { return new Date(x); }); S.chave = chave;
      desenharHoras();
    }).catch(function () { var box = document.getElementById('horas'); if (box) box.innerHTML = '<div class="aviso erro">Não deu para ver os horários. Confira a internet e toque no dia de novo.</div>'; });
  }
  function pedir() {
    var nome = document.getElementById('fNome').value.trim(), fone = document.getElementById('fFone').value, obs = document.getElementById('fObs').value, msg = document.getElementById('fMsg'), b = this;
    if (nome.length < 2) { msg.innerHTML = '<div class="aviso erro">Escreva seu nome.</div>'; return; }
    var dig = fone.replace(/\D/g, ''); if (dig.length < 10 || dig.length > 13) { msg.innerHTML = '<div class="aviso erro">Confira o WhatsApp com DDD.</div>'; return; }
    b.disabled = true; b.textContent = 'Enviando…';
    rpc('pedir_horario', { p_slug: slug, p_servico: S.serv.id, p_inicio: S.hora.toISOString(), p_nome: nome, p_fone: fone, p_obs: obs }).then(function (r) {
      b.disabled = false; b.textContent = S.pag.aceitar_auto ? 'Marcar horário' : 'Pedir horário';
      if (r.ok) {
        var l = guardados(); l.push({ id: r.id, token: r.token, slug: slug, nome: nome, fone: fone }); guardar(l);
        S.hora = null; S.dia = null; S.chave = null; if (S.pag.servicos.length !== 1) S.serv = null; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
      }
      if (r.motivo === 'ocupado') {
        S.chave = null;
        msg.innerHTML = '<div class="aviso">Esse horário acabou de ser pego. ' + (r.sugestoes && r.sugestoes.length ? 'Tem estes livres:</div><div class="sug">' + r.sugestoes.map(function (x) { return '<button data-x="' + x + '">' + nomeDia(N.local(x).data) + ' ' + N.local(x).hora + '</button>'; }).join('') + '</div>' : 'Escolha outro dia.</div>');
        msg.querySelectorAll('[data-x]').forEach(function (bt) { bt.onclick = function () { var nn = document.getElementById('fNome').value, ff = document.getElementById('fFone').value, oo = document.getElementById('fObs').value; S.hora = new Date(bt.dataset.x); S.dia = N.local(S.hora).data; render(); document.getElementById('fNome').value = nn; document.getElementById('fFone').value = ff; document.getElementById('fObs').value = oo; }; });
        return;
      }
      msg.innerHTML = '<div class="aviso erro">' + ({ limite: 'Você já tem 3 pedidos esperando resposta. Aguarde a resposta antes de pedir outro.', nome: 'Confira seu nome.', fone: 'Confira o WhatsApp com DDD.', servico: 'Esse serviço não está mais disponível.', pagina: 'Essa agenda está pausada no momento.' }[r.motivo] || 'Não deu certo. Tente de novo.') + '</div>';
    }).catch(function () { b.disabled = false; b.textContent = 'Tentar de novo'; msg.innerHTML = '<div class="aviso erro">Sem conexão. Confira a internet e tente de novo.</div>'; });
  }
  var TXT = {
    pendente: ['⏳ Pedido enviado', 'Aguardando ' + '{n}' + ' confirmar. Esta página atualiza sozinha.', 'aviso'],
    confirmado: ['✅ Horário confirmado', 'Te esperamos!', 'ok'],
    recusado: ['Pedido não aceito', 'Esse horário não deu. Escolha outro abaixo.', 'erro'],
    expirado: ['Sem resposta a tempo', 'O pedido venceu. Escolha outro horário ou chame no WhatsApp.', 'erro'],
    cancelado: ['Cancelado', '', 'erro'], atendido: ['Atendido', 'Obrigado!', 'ok'], faltou: ['Não compareceu', '', 'erro']
  };
  var timer = null;
  function mostrarMeus(meus) {
    var box = document.getElementById('meus'); if (!box) return;
    Promise.all(meus.slice(-3).map(function (m) { return rpc('status_pedido', { p_id: m.id, p_token: m.token }).then(function (s) { return { m: m, s: s }; }, function () { return { m: m, s: null }; }); })).then(function (rs) {
      rs = rs.filter(function (x) { return x.s && new Date(x.s.inicio) > Date.now() - 3 * 36e5; });
      if (!document.getElementById('meus')) return;
      box.innerHTML = rs.map(function (x) {
        var t = TXT[x.s.status] || [x.s.status, '', 'aviso'], l = N.local(x.s.inicio);
        return '<div class="status ' + t[2] + '"><b>' + t[0] + '</b><span>' + esc(x.s.servico || '') + ' · ' + nomeDia(l.data) + ' às ' + l.hora + '</span><p class="peq muted" style="margin-top:4px">' + esc(t[1].replace('{n}', x.s.negocio)) + '</p>' +
          (x.s.whatsapp ? '<a class="btn wa" style="margin-top:10px" target="_blank" rel="noopener" href="https://wa.me/' + (x.s.whatsapp.length <= 11 ? '55' : '') + x.s.whatsapp + '?text=' + encodeURIComponent('Olá! Sobre meu horário de ' + nomeDia(l.data) + ' às ' + l.hora + ':') + '">Falar no WhatsApp</a>' : '') +
          ((x.s.status === 'pendente' || x.s.status === 'confirmado') ? '<button class="btn linha" data-c="' + x.m.id + '" style="margin-top:8px">Cancelar este horário</button>' : '') + '</div>';
      }).join('');
      box.querySelectorAll('[data-c]').forEach(function (b) { b.onclick = function () {
        if (!confirm('Cancelar este horário?')) return;
        var m = meus.filter(function (x) { return x.id === b.dataset.c; })[0];
        rpc('cancelar_pedido', { p_id: m.id, p_token: m.token }).then(function () { mostrarMeus(meus); });
      }; });
      clearTimeout(timer);
      if (rs.some(function (x) { return x.s.status === 'pendente'; })) timer = setTimeout(function () { mostrarMeus(meus); }, 15000);
    });
  }

  N.carregar(true).then(function (c) { sb = c; return rpc('pagina_publica', { p_slug: slug }); }).then(function (p) {
    if (!p) { document.getElementById('nome').textContent = 'Agenda não encontrada'; erro('Não achamos essa agenda. Confira o link com quem te mandou.'); return; }
    S.pag = p; document.getElementById('nome').textContent = p.nome; document.title = 'Marcar horário · ' + p.nome;
    if (p.servicos.length === 1) S.serv = p.servicos[0];
    render();
  }).catch(function () { document.getElementById('nome').textContent = 'Sem conexão'; erro('Não conseguimos carregar a agenda. Confira a internet e <a href="">tente de novo</a>.'); });
})();

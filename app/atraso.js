/* Micro no Controle — ⏰ Estou atrasado
   A espera sem notícia é a reclamação nº 1 nas avaliações do Google (pesquisa de nov/2026),
   e em beleza muita gente reclama de esperar MESMO com horário marcado.
   Aqui o dono escolhe quantos minutos está atrasado e avisa os próximos clientes do dia
   pelo WhatsApp, um toque por cliente, com a nova previsão de horário. */
(function () {
  'use strict';
  function somaMin(hora, min) {
    var p = String(hora || '').split(':'); if (p.length < 2) return '';
    var t = (+p[0]) * 60 + (+p[1]) + min; t = Math.max(0, Math.min(t, 23 * 60 + 59));
    return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + (t % 60)).slice(-2);
  }
  function primeiro(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  // mensagem pura (testável)
  function mensagem(a, min, neg) {
    var dono = primeiro(neg && neg.dono), nome = neg && neg.nome;
    return 'Oi, ' + primeiro(a.cliNome) + '!' + (dono ? ' Aqui é ' + dono + (nome ? ' (' + nome + ')' : '') + '.' : nome ? ' ' + nome + ' aqui.' : '') +
      ' Estou com uns ' + min + ' minutos de atraso hoje, desculpa 🙏 Seu horário das ' + a.hora + ' deve começar por volta das ' + somaMin(a.hora, min) + '.' +
      ' Se ficar ruim para você, me avisa que a gente remarca.';
  }
  var api = { somaMin: somaMin, mensagem: mensagem };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  var K = window.MNCK; if (!K) return;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function agora() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  // horários de hoje ainda por atender e que começam daqui a pouco ou depois
  function proximos() {
    var E = K.E(), h = K.hoje(), lim = somaMin(agora(), -10);
    return E.ag.filter(function (a) { return a.data === h && a.status === 'marcado' && a.hora && a.hora >= lim; })
      .sort(function (a, b) { return a.hora < b.hora ? -1 : 1; });
  }
  function abrir() {
    var min = 15, lista = proximos(), E = K.E();
    var f = K.abrirFolha('<h1>Estou atrasado</h1><p class="muted" style="margin-top:4px">Avise antes de o cliente chegar. Quem sabe do atraso espera sem reclamar.</p>' +
      '<p style="font-weight:600;font-size:14.5px;margin-top:16px">Quanto tempo?</p><div class="chips" style="margin-top:8px">' +
      [10, 15, 20, 30, 45, 60].map(function (m) { return '<button class="chip ' + (m === min ? 'on' : '') + '" data-m="' + m + '">' + (m === 60 ? '1 hora' : m + ' min') + '</button>'; }).join('') + '</div>' +
      '<div id="atLista"></div>');
    function desenhar() {
      var box = $('#atLista', f);
      if (!lista.length) { box.innerHTML = '<div class="lista" style="margin-top:14px"><div class="vazio"><span class="ic">🙂</span>Não tem mais ninguém marcado para hoje.</div></div>'; return; }
      box.innerHTML = '<p style="font-weight:600;font-size:14.5px;margin-top:18px">Avise um por um</p>' + lista.map(function (a) {
        var ok = a.atraso && a.atraso.dia === K.hoje();
        return '<div class="card" style="margin-top:10px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>' + K.esc(a.hora) + ' → ' + somaMin(a.hora, min) + ' · ' + K.esc(a.cliNome) + '</b>' +
          '<p class="muted peq">' + K.esc(a.serv || 'Atendimento') + (a.fone ? '' : ' · sem WhatsApp cadastrado') + '</p></div>' + (ok ? '<span class="tag" style="flex:none;height:auto;white-space:nowrap">avisado</span>' : '') + '</div>' +
          '<div class="linhaBtns">' + (a.fone ? '<button class="btn wa peq" data-av="' + a.id + '">Avisar no WhatsApp</button>' : '') + '<button class="btn linha peq" data-cp="' + a.id + '">Copiar mensagem</button></div></div>';
      }).join('') + '<label class="check" style="margin-top:14px"><input type="checkbox" id="atMover"> Mudar também os horários na agenda</label>' +
        '<button class="btn cheio" style="margin-top:12px" id="atFim">Pronto</button>';
      $$('[data-av]', box).forEach(function (b) { b.onclick = function () {
        var a = ach(b.dataset.av); marcar(a); window.open(K.linkWa(a.fone, mensagem(a, min, E.neg)), '_blank'); desenhar();
      }; });
      $$('[data-cp]', box).forEach(function (b) { b.onclick = function () { var a = ach(b.dataset.cp); K.copiar(mensagem(a, min, E.neg)); marcar(a); desenhar(); }; });
      $('#atFim', box).onclick = function () {
        var n = 0;
        if ($('#atMover', box).checked) lista.forEach(function (a) { a.hora = somaMin(a.hora, min); n++; });
        K.salvar(); K.fecharFolha(); K.rotear(); K.track('Atraso', { min: min, avisados: lista.filter(function (a) { return a.atraso && a.atraso.dia === K.hoje(); }).length });
        K.toast(n ? n + ' horário(s) passaram ' + min + ' min para frente ✓' : 'Feito ✓');
      };
    }
    function ach(id) { return lista.filter(function (x) { return x.id === id; })[0]; }
    function marcar(a) { a.atraso = { dia: K.hoje(), min: min }; K.salvar(); }
    $$('[data-m]', f).forEach(function (b) { b.onclick = function () { min = +b.dataset.m; $$('[data-m]', f).forEach(function (x) { x.classList.toggle('on', x === b); }); desenhar(); }; });
    desenhar();
  }
  window.MNCX = window.MNCX || {};
  window.MNCX.atraso = { abrir: abrir, quantos: function () { return proximos().length; } };
})();

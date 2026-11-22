(function () {
  'use strict';
  var N = window.MNCNuvem, sb = null;
  var token = (new URLSearchParams(location.search).get('t') || '').replace(/[^a-f0-9]/gi, '').slice(0, 40);
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function quando(iso) {
    var d = new Date(iso), l = N.local(d), hoje = N.local(new Date()).data, am = N.local(new Date(Date.now() + 864e5)).data;
    var p = l.data.split('-');
    return (l.data === hoje ? 'hoje' : l.data === am ? 'amanhã' : p[2] + '/' + p[1]) + ' às ' + l.hora;
  }
  function ha(iso) {
    var m = Math.round((Date.now() - new Date(iso)) / 6e4);
    return m < 1 ? 'agora há pouco' : m < 60 ? 'há ' + m + ' min' : m < 1440 ? 'há ' + Math.round(m / 60) + ' h' : 'em ' + quando(iso);
  }
  function erro(t) { $('#titulo').textContent = 'Link não encontrado'; $('#neg').textContent = ''; $('#m').innerHTML = '<div class="card"><p class="vazio">' + esc(t) + '</p></div>'; }
  var ultimo = '';
  function mostrar(a) {
    if (!a) { erro('Este link não existe mais ou já expirou. Fale com quem te mandou.'); return; }
    var chave = a.etapa + '|' + a.atualizado + '|' + a.encerrado; if (chave === ultimo) return; ultimo = chave;
    var fim = a.etapa === a.etapas.length - 1;
    document.title = a.etapas[a.etapa] + ' · ' + a.negocio;
    $('#titulo').textContent = a.titulo; $('#neg').textContent = a.negocio + (a.cliente ? ' · para ' + a.cliente : '');
    var wa = String(a.whatsapp || '').replace(/\D/g, ''); if (wa && wa.length <= 11) wa = '55' + wa;
    $('#m').innerHTML = '<div class="card"><p class="rot">' + (fim ? 'Concluído' : 'Agora') + '</p><p class="agora">' + esc(a.etapas[a.etapa]) + (fim ? ' ✅' : '') + '</p>' +
      '<ol>' + a.etapas.map(function (e, i) { var c = i < a.etapa || (fim && i === a.etapa) ? 'feito' : i === a.etapa ? 'atual' : ''; return '<li class="' + c + '"><i>' + (c === 'feito' ? '✓' : '') + '</i>' + esc(e) + '</li>'; }).join('') + '</ol></div>' +
      '<div class="info">' + (a.previsao && !fim ? '<div><b>Previsão</b>' + esc(quando(a.previsao)) + '</div>' : '') +
      (a.recado ? '<div class="recado"><b>Recado</b>' + esc(a.recado) + '</div>' : '') + '</div>' +
      (wa ? '<a class="btn" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent('Oi! Sobre "' + a.titulo + '"…') + '">Falar com ' + esc(a.negocio) + '</a>' : '') +
      '<p class="peq">Atualizado ' + esc(ha(a.atualizado)) + (fim ? '' : ' · esta página se atualiza sozinha') + '</p>';
  }
  function buscar() {
    return sb.rpc('ver_acompanhamento', { p_token: token }).then(function (r) { if (r.error) throw r.error; mostrar(r.data); });
  }
  if (token.length < 12) { erro('Link incompleto. Peça o link de novo para quem te mandou.'); return; }
  N.carregar(true).then(function (c) { sb = c; return buscar(); }).then(function () {
    setInterval(function () { if (!document.hidden) buscar().catch(function () {}); }, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) buscar().catch(function () {}); });
  }).catch(function () { erro('Sem internet para buscar agora. Tente de novo em instantes.'); });
})();

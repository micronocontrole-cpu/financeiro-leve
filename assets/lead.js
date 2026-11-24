/* Micro no Controle — envio dos formulários para /api/lead.
   Só mostra "recebido" quando o servidor confirma. Se falhar, mostra o caminho pelo WhatsApp.
   Também formata o WhatsApp enquanto a pessoa digita. */
(function (w, d) {
  var ZAP = 'https://wa.me/5561982254407?text=';
  function mascara(el) {
    if (!el || el._mnc) return; el._mnc = 1;
    el.addEventListener('input', function () {
      var v = el.value.replace(/\D/g, '');
      if (v.length > 11 && v.indexOf('55') === 0) v = v.slice(2);
      v = v.slice(0, 11);
      var f = v;
      if (v.length > 2) f = '(' + v.slice(0, 2) + ') ' + v.slice(2);
      if (v.length > 7) f = '(' + v.slice(0, 2) + ') ' + v.slice(2, v.length - 4) + '-' + v.slice(-4);
      el.value = f;
    });
  }
  function enviar(dados) {
    try { dados.origem = (dados.origem || '') + ' | ' + (w.MNC_ORIGEM ? w.MNC_ORIGEM() : 'desconhecida'); } catch (e) {}
    return fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(dados) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { j.status = r.status; return j; }); })
      .catch(function () { return { ok: false, rede: true }; });
  }
  function linkZap(nome) {
    return ZAP + encodeURIComponent('Oi! Sou ' + (nome || '') + ' e quero a conferência grátis do Micro no Controle.');
  }
  w.MNCLead = { enviar: enviar, mascara: mascara, linkZap: linkZap };
  d.addEventListener('DOMContentLoaded', function () {
    d.querySelectorAll('input[data-zap]').forEach(mascara);
  });
})(window, document);

/* Origem do visitante — Micro no Controle
   Guarda a PRIMEIRA origem da visita (utm_source / referência) e a reutiliza:
   - no formulário do Kit Lite (campo "Origem" da planilha de Leads)
   - nos links da Hotmart (parâmetros src e sck, que aparecem no relatório de vendas)
   Não usa cookies de terceiros nem guarda dados pessoais. */
(function () {
  var CHAVE = 'mnc_origem';
  function hostDe(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function detectar() {
    var p = new URLSearchParams(location.search);
    var src = (p.get('utm_source') || '').toLowerCase();
    var med = (p.get('utm_medium') || '').toLowerCase();
    var camp = (p.get('utm_campaign') || '').toLowerCase();
    if (p.get('fbclid') && !src) { src = 'meta'; med = med || 'pago'; }
    if (p.get('gclid') && !src) { src = 'google'; med = med || 'pago'; }
    if (!src) {
      var ref = hostDe(document.referrer);
      if (ref && ref !== location.hostname.replace(/^www\./, '')) {
        var mapa = {
          'instagram.com': 'instagram', 'l.instagram.com': 'instagram', 'facebook.com': 'facebook', 'l.facebook.com': 'facebook',
          'm.facebook.com': 'facebook', 'lm.facebook.com': 'facebook', 'tiktok.com': 'tiktok', 'youtube.com': 'youtube',
          'm.youtube.com': 'youtube', 'youtu.be': 'youtube', 'google.com': 'google', 'google.com.br': 'google', 'bing.com': 'bing',
          'linktr.ee': 'linktree', 'wa.me': 'whatsapp', 'web.whatsapp.com': 'whatsapp', 'pay.hotmart.com': 'hotmart'
        };
        src = mapa[ref] || ref;
        med = med || (src === 'google' || src === 'bing' ? 'busca' : 'referencia');
      }
    }
    if (!src) { src = 'direto'; }
    return {src: src.slice(0, 40), med: med.slice(0, 40), camp: camp.slice(0, 60), pagina: location.pathname, data: new Date().toISOString().slice(0, 10)};
  }
  var o = null;
  try { o = JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { o = null; }
  var atual = detectar();
  // a primeira origem "de verdade" vence; "direto" só é usado se não houver nada guardado
  if (!o || (o.src === 'direto' && atual.src !== 'direto')) {
    o = atual;
    try { localStorage.setItem(CHAVE, JSON.stringify(o)); } catch (e) {}
  }
  window.MNC_ORIGEM = function () {
    return o.src + (o.med ? '/' + o.med : '') + (o.camp ? '/' + o.camp : '') + ' | entrou em ' + o.pagina + ' | ' + o.data;
  };
  // marca os links de checkout da Hotmart com a origem
  function marcarLinks() {
    document.querySelectorAll('a[href*="pay.hotmart.com"]').forEach(function (a) {
      try {
        var u = new URL(a.href);
        u.searchParams.set('src', o.src);
        if (o.camp) u.searchParams.set('sck', o.camp);
        a.href = u.toString();
      } catch (e) {}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(marcarLinks, 0); });
  else setTimeout(marcarLinks, 0);
})();

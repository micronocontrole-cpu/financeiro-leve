/* Pixel da Meta — Micro no Controle (ID 1772922757093171)
   Só carrega depois que a pessoa aceita no aviso de cookies (LGPD).
   Antes disso, as chamadas fbq(...) das páginas ficam guardadas e só são enviadas se ela aceitar.
   A escolha fica no aparelho (localStorage 'mnc-cookies': 'sim' ou 'nao'). */
(function (w, d) {
  var CHAVE = 'mnc-cookies', ID = '1772922757093171', pendentes = [], carregado = false;
  function ler() { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function gravar(v) { try { localStorage.setItem(CHAVE, v); } catch (e) {} }

  function carregar() {
    if (carregado) return; carregado = true;
    !function(f,b,e,v,n,t,s){n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(w,d,'script','https://connect.facebook.net/en_US/fbevents.js');
    w.fbq('init', ID); w.fbq('track', 'PageView');
    pendentes.forEach(function (a) { w.fbq.apply(null, a); }); pendentes = [];
  }

  var escolha = ler();
  if (escolha === 'sim') carregar();
  else w.fbq = function () { if (escolha !== 'nao') pendentes.push([].slice.call(arguments)); };

  function aviso() {
    if (escolha === 'sim' || escolha === 'nao' || d.getElementById('mnc-cookies')) return;
    var css = d.createElement('style');
    css.textContent = '#mnc-cookies{position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:560px;margin:0 auto;background:#0E3B3C;color:#EAF6F4;border-radius:16px;padding:14px 16px;box-shadow:0 12px 32px rgba(0,0,0,.35);font:15px/1.45 system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center}' +
      '#mnc-cookies p{margin:0;flex:1 1 260px}#mnc-cookies a{color:#FFCF3A}' +
      '#mnc-cookies button{font:600 15px system-ui,sans-serif;border-radius:10px;padding:9px 14px;cursor:pointer;border:0}' +
      '#mnc-cookies .s{background:#22C3A6;color:#062B2B}#mnc-cookies .n{background:transparent;color:#EAF6F4;box-shadow:inset 0 0 0 1.5px rgba(234,246,244,.5)}' +
      '#mnc-cookies button:focus-visible{outline:3px solid #FFCF3A;outline-offset:2px}';
    d.head.appendChild(css);
    var b = d.createElement('div'); b.id = 'mnc-cookies'; b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Aviso de cookies');
    b.innerHTML = '<p>Podemos usar cookies da Meta para medir visitas e anúncios? Só ligamos se você aceitar. <a href="/privacidade/">Saiba mais</a></p>' +
      '<button type="button" class="n">Recusar</button><button type="button" class="s">Aceitar</button>';
    b.querySelector('.s').onclick = function () { escolha = 'sim'; gravar('sim'); b.remove(); carregar(); };
    b.querySelector('.n').onclick = function () { escolha = 'nao'; gravar('nao'); pendentes = []; b.remove(); };
    d.body.appendChild(b);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', aviso); else aviso();

  /* Clique em link da Hotmart que não foi marcado pela página: avisa início de compra. */
  d.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href*="pay.hotmart.com"]');
    if (a && !a.hasAttribute('data-hotmart')) { try { w.fbq('track', 'InitiateCheckout', { content_name: 'Plano Micro no Controle' }); } catch (e) {} }
  }, true);
})(window, document);

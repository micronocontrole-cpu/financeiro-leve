/* Pixel da Meta — Micro no Controle (ID 1772922757093171)
   PageView em toda página; InitiateCheckout ao clicar no link da Hotmart.
   O evento Lead é disparado pelo formulário do Kit Lite (index e planilha-gratis). */
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1772922757093171');
fbq('track', 'PageView');

document.addEventListener('click', function (ev) {
  var a = ev.target.closest && ev.target.closest('a[href*="pay.hotmart.com"]');
  if (a) { try { fbq('track', 'InitiateCheckout', { value: 67, currency: 'BRL', content_name: 'Pacote Completo do Pequeno Negócio' }); } catch (e) {} }
}, true);

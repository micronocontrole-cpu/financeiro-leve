/* Micro no Controle — conexão com a nuvem (Supabase).
   Só a URL e a chave PÚBLICA ficam aqui (são feitas para isso). A segurança dos
   dados fica no banco: cada negócio só acessa o que é seu (RLS).
   A biblioteca só é baixada quando alguém usa um recurso de nuvem. */
(function () {
  'use strict';
  var URL = 'https://vuwxwcuafazwnslbxaqk.supabase.co';
  var CHAVE = 'sb_publishable_4DKK36JnNpm9hWtZ1tLfuQ_6zE8jXpn';
  var LIB = '/app/vendor/supabase-2.117.3.js'; // cópia própria: não depende de CDN de terceiros
  var clientes = {}, lib = null;
  function carregarLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (lib) return lib;
    lib = new Promise(function (ok, erro) {
      var s = document.createElement('script'); s.src = LIB; s.async = true;
      s.onload = function () { ok(); };
      s.onerror = function () { lib = null; erro(new Error('Sem internet para conectar. Confira a conexão e tente de novo.')); };
      document.head.appendChild(s);
    });
    return lib;
  }
  // publico = true: página do cliente (sem login)
  function carregar(publico) {
    var k = publico ? 'pub' : 'app';
    if (clientes[k]) return Promise.resolve(clientes[k]);
    return carregarLib().then(function () {
      clientes[k] = window.supabase.createClient(URL, CHAVE, {
        auth: publico ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } : { persistSession: true, autoRefreshToken: true, storageKey: 'mnc-nuvem', detectSessionInUrl: false }
      });
      return clientes[k];
    });
  }
  // Datas: o Brasil não tem horário de verão desde 2019; Brasília = UTC-3 o ano todo
  var FUSO = 'America/Sao_Paulo';
  var fmt = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function local(d) {
    var p = {}; fmt.formatToParts(d instanceof Date ? d : new Date(d)).forEach(function (x) { p[x.type] = x.value; });
    return { data: p.year + '-' + p.month + '-' + p.day, hora: p.hour + ':' + p.minute };
  }
  function instante(data, hora) { return data + 'T' + (hora || '00:00') + ':00-03:00'; }
  // "[\"2026-11-19 12:00:00+00\",\"2026-11-19 12:30:00+00\")" -> {ini: Date, fim: Date}
  function lerPeriodo(p) {
    var m = String(p || '').match(/^[\[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/);
    if (!m) return null;
    function d(s) { s = s.trim().replace(' ', 'T'); if (/[+-]\d\d$/.test(s)) s += ':00'; return new Date(s); }
    return { ini: d(m[1]), fim: d(m[2]) };
  }
  function periodo(ini, fim) { return '[' + new Date(ini).toISOString() + ',' + new Date(fim).toISOString() + ')'; }
  window.MNCNuvem = { carregar: carregar, URL: URL, local: local, instante: instante, lerPeriodo: lerPeriodo, periodo: periodo, FUSO: FUSO };
})();

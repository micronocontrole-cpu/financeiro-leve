/* Micro no Controle — Meu plano
   Mostra o plano deste aparelho, os planos pagos e o campo do código de ativação.
   Fase 1: o cliente pede o plano pelo site, paga por Pix e recebe um código pelo WhatsApp.
   Banco: supabase/004_planos.sql. Outros módulos podem perguntar o plano com MNCPlano.atual(). */
(function () {
  'use strict';
  var PLANOS = [
    { id: 'gratis', nome: 'Grátis', preco: 'R$ 0', para: 'Para organizar o dia a dia',
      tem: ['App no celular, sem cadastro', 'Vendas, despesas e fiado com Pix', 'Contas a pagar e agenda', 'Conferência manual da maquininha'] },
    { id: 'essencial', nome: 'Essencial', preco: 'R$ 29,99/mês', para: 'Para o MEI que quer o caixa conferido',
      tem: ['Fechamento do mês com relatório', 'Dinheiro que ficou para trás e como cobrar', 'Alertas de vencimento, limite do MEI e DAS', 'Acervo de planilhas'] },
    { id: 'divulgacao', nome: 'Completo com acompanhamento', preco: 'R$ 49,90/mês', para: 'Caixa conferido, divulgação pronta e uma pessoa do seu lado',
      tem: ['Tudo do Essencial', 'Relatório revisado por uma pessoa', 'Atendimento pelo WhatsApp', 'Artes de promoção e cardápio', 'Google em dia: respostas e postagens'] }
  ];
  var NOME = { acompanhamento: 'Completo com acompanhamento' }; PLANOS.forEach(function (p) { NOME[p.id] = p.nome; });
  var MOTIVO = {
    formato: 'O código tem este formato: MNC-XXXX-XXXX-XXXX.',
    invalido: 'Código não encontrado. Confira as letras e os números.',
    usado: 'Esse código já foi usado em outro aparelho. Fale com a gente.',
    ja_usado_aqui: 'Esse código já está ativo neste aparelho.',
    sessao: 'Não foi possível conectar. Tente de novo.'
  };
  function normalizar(c) {
    var s = String(c || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (s.indexOf('MNC') === 0) s = s.slice(3);
    if (!/^[0-9A-F]{12}$/.test(s)) return null;
    return 'MNC-' + s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12);
  }
  var api = { PLANOS: PLANOS, normalizar: normalizar };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  var K = window.MNCK, N = window.MNCNuvem; if (!K || !N) return;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = K.esc, toast = K.toast, R = K.ROTAS;
  var CACHE = 'mnc-plano';
  function lerCache() { try { return JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { return null; } }
  function gravarCache(p) { try { localStorage.setItem(CACHE, JSON.stringify(p)); } catch (e) {} }
  function sessao() {
    return N.carregar(false).then(function (sb) {
      return sb.auth.getSession().then(function (r) {
        if (r.data && r.data.session) return sb;
        return sb.auth.signInAnonymously().then(function (x) { if (x.error) throw x.error; return sb; });
      });
    });
  }
  function erroTxt(e) {
    var m = (e && (e.message || e.error_description)) || String(e);
    if (/fetch|network|internet/i.test(m)) return 'Sem internet agora. Tente de novo em instantes.';
    if (/meu_plano|ativar_codigo/.test(m) && /exist|schema cache|function/i.test(m)) return 'Os planos ainda não foram ligados no servidor. Tente mais tarde.';
    return m;
  }
  function buscar() {
    return sessao().then(function (sb) { return sb.rpc('meu_plano'); }).then(function (r) {
      if (r.error) throw r.error; gravarCache(r.data); return r.data;
    });
  }
  // outros módulos: MNCPlano.atual() -> Promise do plano ('gratis' se não der para saber)
  window.MNCPlano = {
    PLANOS: PLANOS,
    atual: function () { return buscar().then(function (p) { return p.plano; }, function () { var c = lerCache(); return (c && c.plano) || 'gratis'; }); },
    cache: function () { var c = lerCache(); return (c && c.plano) || 'gratis'; }
  };

  function dataBR(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function cabecalho(p) {
    if (!p) return '<p class="sub" id="plStatus">Conferindo o seu plano…</p>';
    var txt = '<b>' + esc(NOME[p.plano] || 'Grátis') + '</b>';
    if (p.plano !== 'gratis' && p.valida_ate) txt += ' · ativo até ' + dataBR(p.valida_ate);
    if (p.fundador && p.plano !== 'gratis') txt += ' · preço de fundador';
    if (p.vencido) txt += '<br><span style="color:#b3402a">O plano ' + esc(NOME[p.plano_pago] || '') + ' venceu em ' + dataBR(p.valida_ate) + '. Renove para continuar.</span>';
    return '<p id="plStatus">Seu plano: ' + txt + '</p>';
  }
  function cartao(pl, atual) {
    var eh = atual === pl.id;
    return '<div class="card"' + (eh ? ' style="border:2px solid var(--mint)"' : '') + '><b style="font-size:17px">' + esc(pl.nome) + '</b> <span style="float:right;font-weight:700">' + esc(pl.preco) + '</span>' +
      '<p class="sub" style="margin:4px 0 8px">' + esc(pl.para) + '</p><ul style="margin:0 0 10px 18px;font-size:14.5px">' +
      pl.tem.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      (pl.id === 'gratis' ? (eh ? '<p class="sub">Você está neste plano.</p>' : '') :
        (eh ? '<p class="sub">✅ Você está neste plano.</p>' : (pl.id === 'essencial' ? '<a class="btn mint" style="width:100%" href="https://pay.hotmart.com/B108619350I" target="_blank" rel="noopener">Assinar o Essencial</a>' : '<a class="btn mint" style="width:100%" href="/?plano=' + encodeURIComponent(pl.nome) + '#conferencia">Quero o ' + esc(pl.nome) + '</a>'))) +
      '</div>';
  }
  R.plano = function () {
    var c = lerCache();
    var html = K.topo('Meu plano', null, '#/mais') + '<main>' +
      '<div class="card" id="plCab">' + cabecalho(c) + '</div>' +
      '<div class="card"><b>Tenho um código de ativação</b><p class="sub" style="margin:4px 0 8px">Depois do pagamento, a gente manda um código pelo WhatsApp.</p>' +
      '<label class="campo"><span>Código</span><input class="inp" id="plCod" autocomplete="off" autocapitalize="characters" placeholder="MNC-XXXX-XXXX-XXXX"></label>' +
      '<button class="btn" style="width:100%;margin-top:8px" id="plAtivar">Ativar</button></div>' +
      '<h2 style="margin:18px 0 8px;font-size:18px">Planos</h2><div id="plLista">' + PLANOS.map(function (p) { return cartao(p, (c && c.plano) || 'gratis'); }).join('') + '</div>' +
      '<p class="sub" style="margin-top:12px">Pagamento pela Hotmart (Pix, cartão ou boleto). Cancele quando quiser. Desistiu em até 7 dias? Devolvemos o valor. Veja os <a href="/termos/">termos</a>.</p>' +
      '<p class="rodape">Micro no Controle · soluções com sabedoria</p></main>';
    return {
      html: html,
      montar: function (el) {
        function desenhar(p) {
          $('#plCab', el).innerHTML = cabecalho(p);
          $('#plLista', el).innerHTML = PLANOS.map(function (x) { return cartao(x, p.plano); }).join('');
        }
        buscar().then(desenhar, function (e) {
          if (!c) $('#plCab', el).innerHTML = '<p>Seu plano: <b>Grátis</b></p><p class="sub">' + esc(erroTxt(e)) + '</p>';
        });
        $('#plAtivar', el).onclick = function () {
          var cod = normalizar($('#plCod', el).value);
          if (!cod) { toast(MOTIVO.formato); return; }
          var b = this; b.disabled = true; b.textContent = 'Ativando…';
          sessao().then(function (sb) { return sb.rpc('ativar_codigo', { p_codigo: cod }); }).then(function (r) {
            if (r.error) throw r.error;
            if (!r.data || !r.data.ok) { toast(MOTIVO[(r.data && r.data.motivo) || 'invalido'] || 'Não deu certo.'); return; }
            toast('Plano ' + (NOME[r.data.plano] || '') + ' ativo até ' + dataBR(r.data.valida_ate) + ' 🎉');
            $('#plCod', el).value = '';
            K.track && K.track('plano_ativado', { plano: r.data.plano });
            return buscar().then(desenhar);
          }).catch(function (e) { toast(erroTxt(e)); }).then(function () { b.disabled = false; b.textContent = 'Ativar'; });
        };
      }
    };
  };
})();

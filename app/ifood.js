/* Conferência do iFood — Micro no Controle
   Lê o relatório exportado do Portal do Parceiro (CSV/Excel já em linhas) em dois formatos:
   (A) um pedido por linha, com colunas de comissão/taxas; (B) um lançamento por linha (extrato).
   Confere comissão e taxa de pagamento de cada pedido, mensalidade, promoções e cancelamentos.
   Depende de Motor (auditoria-maquininha/motor.js) para ler números, datas e CSV. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../auditoria-maquininha/motor.js'));
  else root.IFood = factory(root.Motor);
})(this, function (Motor) {
  'use strict';
  var numero = Motor.numero, data = Motor.data;

  function sa(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function arred(n) { return n >= 0 ? Math.round(n * 100 + 1e-7) / 100 : -Math.round(-n * 100 + 1e-7) / 100; }

  // Planos (valores públicos citados em out/2026 — o usuário pode corrigir pelo contrato dele)
  var PLANOS = {
    basico: { nome: 'Plano Básico (entrega própria)', comissao: 12, taxaPag: 3.2, mensalidade: 110 },
    entrega: { nome: 'Plano Entrega (entregador iFood)', comissao: 23, taxaPag: 3.5, mensalidade: 150 }
  };
  var PISO_MENSALIDADE = 1800;

  var CHAVES = {
    pedido: ['id do pedido', 'numero do pedido', 'n do pedido', 'no do pedido', 'codigo do pedido', 'id pedido', 'pedido', 'order id', 'order'],
    data: ['data do pedido', 'data de criacao', 'data da venda', 'data de competencia', 'data da transacao', 'data do lancamento', 'data'],
    tipo: ['tipo de lancamento', 'tipo do lancamento', 'tipo lancamento', 'descricao do lancamento', 'lancamento', 'descricao', 'evento', 'tipo'],
    itens: ['valor dos itens', 'valor itens', 'total dos itens', 'subtotal', 'valor do pedido', 'valor bruto', 'total do pedido', 'valor total do pedido', 'valor total', 'gmv'],
    entrega: ['taxa de entrega', 'valor da entrega', 'frete'],
    servico: ['taxa de servico'],
    comissao: ['valor da comissao', 'comissao ifood', 'comissao'],
    comissaoPct: [],
    taxaPag: ['taxa de transacao', 'taxa transacao', 'taxa de pagamento online', 'taxa de pagamento', 'taxa pagamento', 'taxa de processamento'],
    promoLoja: ['incentivo promocional da loja', 'incentivo da loja', 'promocao da loja', 'promocao loja', 'desconto da loja', 'desconto loja', 'cupom da loja', 'promocao paga pela loja'],
    promoIfood: ['incentivo promocional do ifood', 'incentivo do ifood', 'incentivo ifood', 'promocao ifood', 'subsidio'],
    forma: ['forma de pagamento', 'meio de pagamento', 'tipo de pagamento', 'pagamento'],
    status: ['status do pedido', 'status', 'situacao'],
    liquido: ['valor liquido', 'valor do repasse', 'repasse', 'valor a receber', 'liquido'],
    valor: ['valor do lancamento', 'valor (r$)', 'valor']
  };
  var ORDEM_MAPA = ['pedido', 'promoLoja', 'promoIfood', 'comissaoPct', 'comissao', 'servico', 'taxaPag', 'entrega', 'liquido', 'itens', 'data', 'forma', 'status', 'tipo', 'valor'];

  function acharColuna(cab, nome, usadas) {
    if (nome === 'comissaoPct') {
      for (var j = 0; j < cab.length; j++) { var hj = sa(cab[j]); if (!usadas[j] && /comiss/.test(hj) && /%|percent/.test(hj)) return j; }
      return -1;
    }
    var lista = CHAVES[nome];
    for (var k = 0; k < lista.length; k++) {
      for (var i = 0; i < cab.length; i++) {
        if (usadas[i]) continue;
        var h = sa(cab[i]);
        if (!h || h.indexOf(lista[k]) < 0) continue;
        if (nome === 'pedido' && /status|data|valor|forma|tipo/.test(h)) continue;
        if (nome === 'itens' && /liquid|taxa|comiss|repasse|entrega|incentiv|promo|desconto/.test(h)) continue;
        if (nome === 'valor' && /liquid|taxa|comiss|repasse|entrega|incentiv|promo|desconto|itens|bruto/.test(h)) continue;
        if (nome === 'taxaPag' && /entrega|servico ao cliente/.test(h)) continue;
        if (nome === 'data' && /repasse|pagamento|prevista|credito/.test(h) && lista[k] === 'data') continue;
        if (nome === 'forma' && /taxa/.test(h)) continue;
        return i;
      }
    }
    return -1;
  }

  function mapear(cab) {
    var usadas = {}, mapa = {};
    ORDEM_MAPA.forEach(function (n) { var i = acharColuna(cab, n, usadas); mapa[n] = i; if (i >= 0) usadas[i] = true; });
    return mapa;
  }

  function detectar(linhas) {
    var melhor = { pontos: -1 };
    for (var r = 0; r < Math.min(linhas.length, 40); r++) {
      var cab = linhas[r].map(function (x) { return String(x == null ? '' : x); });
      var m = mapear(cab), p = 0, modo = null;
      var largo = m.itens >= 0 && (m.comissao >= 0 || m.comissaoPct >= 0);
      var longo = m.tipo >= 0 && (m.valor >= 0 || m.liquido >= 0);
      if (largo) { p = 10; modo = 'pedido'; }
      else if (longo) { p = 8; modo = 'extrato'; }
      if (m.pedido >= 0) p += 2;
      if (m.data >= 0) p += 1;
      if (m.taxaPag >= 0) p += 1;
      if (p > melhor.pontos) melhor = { pontos: p, linha: r, mapa: m, cabecalho: cab, modo: modo };
    }
    melhor.ok = !!melhor.modo;
    return melhor;
  }

  function cancelado(s) { return /cancel|estorn|recusad|rejeitad/.test(sa(s)); }
  function online(forma) {
    var f = sa(forma);
    if (!f) return true;               // sem a coluna: considera pago pelo app
    if (/entrega|na entrega|dinheiro|maquin|offline|direto/.test(f)) return false;
    return true;
  }

  function classificarLanc(desc) {
    var d = sa(desc);
    if (/mensalid|plano mensal|assinatura/.test(d)) return 'mensalidade';
    if (/cancel|estorn|reembols|contesta|chargeback|ressarc/.test(d)) return 'cancelamento';
    if (/comiss/.test(d)) return 'comissao';
    if (/transac|pagamento online|taxa de pagamento|processamento/.test(d)) return 'taxaPag';
    if (/antecip/.test(d)) return 'antecipacao';
    if (/anunci|destaque|marketing|ads|patrocin/.test(d)) return 'anuncios';
    if (/promo|incentiv|cupom|desconto|campanha/.test(d)) return 'promo';
    if (/entrega|logist|frete|entregador/.test(d)) return 'entrega';
    if (/venda|pedido|itens|faturamento|valor do pedido/.test(d)) return 'venda';
    if (/repasse|pagamento realizado|transferencia/.test(d)) return 'repasse';
    return 'outros';
  }

  function nv(L, i) { if (i < 0) return NaN; return numero(L[i]); }
  function abs0(n) { return isNaN(n) ? 0 : Math.abs(n); }

  // Converte o arquivo em pedidos + lançamentos avulsos
  function ler(linhas, det) {
    var m = det.mapa, pedidos = {}, ordem = [], avulsos = [], ignoradas = 0;
    function ped(id, d) {
      var k = id || ('linha' + ordem.length);
      if (!pedidos[k]) { pedidos[k] = { id: id || '—', data: d, base: 0, entrega: 0, comissao: 0, taxaPag: 0, promoLoja: 0, cancel: false, online: true, liquido: NaN, linhas: 0 }; ordem.push(k); }
      if (!pedidos[k].data && d) pedidos[k].data = d;
      return pedidos[k];
    }
    for (var r = det.linha + 1; r < linhas.length; r++) {
      var L = linhas[r]; if (!L || !L.length) continue;
      var id = m.pedido >= 0 ? String(L[m.pedido] == null ? '' : L[m.pedido]).trim() : '';
      var d = m.data >= 0 ? data(L[m.data]) : null;
      if (det.modo === 'pedido') {
        var base = nv(L, m.itens);
        if (!(base > 0)) { ignoradas++; continue; }
        var p = ped(id, d);
        p.base += base;
        p.entrega += abs0(nv(L, m.entrega)) + abs0(nv(L, m.servico));
        var com = nv(L, m.comissao);
        if (isNaN(com) && m.comissaoPct >= 0) com = base * numero(L[m.comissaoPct]) / 100;
        p.comissao += abs0(com);
        p.taxaPag += abs0(nv(L, m.taxaPag));
        p.promoLoja += abs0(nv(L, m.promoLoja));
        if (m.liquido >= 0) { var lq = nv(L, m.liquido); if (!isNaN(lq)) p.liquido = (isNaN(p.liquido) ? 0 : p.liquido) + lq; }
        if (m.status >= 0 && cancelado(L[m.status])) p.cancel = true;
        if (m.forma >= 0) p.online = online(L[m.forma]);
        p.linhas++;
      } else {
        var val = m.valor >= 0 ? nv(L, m.valor) : nv(L, m.liquido);
        if (isNaN(val) || val === 0) { ignoradas++; continue; }
        var tipo = classificarLanc(L[m.tipo]);
        var desc = String(L[m.tipo] || '').trim();
        if (m.status >= 0 && cancelado(L[m.status])) tipo = tipo === 'venda' ? 'cancelamento' : tipo;
        if (id && /venda|comissao|taxaPag|promo|cancelamento|entrega/.test(tipo)) {
          var q = ped(id, d);
          if (tipo === 'venda') q.base += val > 0 ? val : 0;
          else if (tipo === 'comissao') q.comissao += Math.abs(val);
          else if (tipo === 'taxaPag') q.taxaPag += Math.abs(val);
          else if (tipo === 'promo') { if (val < 0) q.promoLoja += Math.abs(val); }
          else if (tipo === 'entrega') { if (val < 0) avulsos.push({ tipo: 'entrega', valor: val, data: d, desc: desc, pedido: id }); }
          else if (tipo === 'cancelamento') { q.cancel = true; avulsos.push({ tipo: 'cancelamento', valor: val, data: d, desc: desc, pedido: id }); }
          if (m.forma >= 0) q.online = online(L[m.forma]);
          q.linhas++;
        } else {
          avulsos.push({ tipo: tipo, valor: val, data: d, desc: desc, pedido: id || '' });
        }
      }
    }
    var lista = ordem.map(function (k) { return pedidos[k]; }).filter(function (p) { return p.base > 0 || p.cancel; });
    return { pedidos: lista, avulsos: avulsos, ignoradas: ignoradas };
  }

  // Menor taxa que se repete (como na maquininha): se você já pagou essa taxa várias vezes, ela é a combinada
  function padrao(pcts) {
    var cont = {};
    pcts.forEach(function (t) { var k = (Math.round(t * 10) / 10).toFixed(1); cont[k] = (cont[k] || 0) + 1; });
    var corte = Math.max(2, Math.ceil(pcts.length * 0.15));
    var freq = Object.keys(cont).filter(function (k) { return cont[k] >= corte; }).map(Number).sort(function (a, b) { return a - b; });
    if (freq.length) return freq[0];
    var best = null, mx = 0; Object.keys(cont).forEach(function (k) { if (cont[k] > mx) { mx = cont[k]; best = +k; } });
    return best;
  }

  function mesDe(d) { return d ? d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) : '—'; }

  // contrato: { comissao: 12, taxaPag: 3.2 } (vazio = usa o padrão do próprio relatório)
  function conferir(lido, contrato, tol) {
    contrato = contrato || {}; tol = tol == null ? 0.1 : tol;
    var ok = lido.pedidos.filter(function (p) { return !p.cancel && p.base > 0; });
    var pctCom = [], pctTx = [];
    ok.forEach(function (p) {
      p.pctCom = p.base ? p.comissao / p.base * 100 : 0;
      var baseTx = p.base + p.entrega;
      p.pctTx = baseTx && p.online ? p.taxaPag / baseTx * 100 : 0;
      if (p.comissao > 0) pctCom.push(p.pctCom);
      if (p.taxaPag > 0) pctTx.push(p.pctTx);
    });
    var refCom = contrato.comissao > 0 ? +contrato.comissao : padrao(pctCom);
    var refTx = contrato.taxaPag > 0 ? +contrato.taxaPag : padrao(pctTx);
    var achados = [], total = 0;
    ok.forEach(function (p) {
      if (refCom != null && p.comissao > 0 && p.pctCom - refCom > tol) {
        var d1 = arred(p.comissao - p.base * refCom / 100);
        if (d1 >= 0.05) { achados.push({ tipo: 'Comissão acima', pedido: p.id, data: p.data, base: p.base, cobrado: p.pctCom, ref: refCom, dif: d1 }); total += d1; }
      }
      var bt = p.base + p.entrega;
      if (refTx != null && p.taxaPag > 0 && p.pctTx - refTx > tol) {
        var d2 = arred(p.taxaPag - bt * refTx / 100);
        if (d2 >= 0.05) { achados.push({ tipo: 'Taxa de pagamento acima', pedido: p.id, data: p.data, base: bt, cobrado: p.pctTx, ref: refTx, dif: d2 }); total += d2; }
      }
      if (!p.online && p.taxaPag > 0) {
        achados.push({ tipo: 'Taxa de pagamento online em pedido pago na entrega', pedido: p.id, data: p.data, base: bt, cobrado: p.pctTx, ref: 0, dif: arred(p.taxaPag) }); total += p.taxaPag;
      }
    });

    // Somas
    var s = { pedidos: ok.length, cancelados: lido.pedidos.length - ok.length, bruto: 0, entrega: 0, comissao: 0, taxaPag: 0, promoLoja: 0, mensalidade: 0, anuncios: 0, cancelamentos: 0, entregaCobrada: 0, antecipacao: 0, outros: 0 };
    var porMes = {};
    ok.forEach(function (p) {
      s.bruto += p.base; s.entrega += p.entrega; s.comissao += p.comissao; s.taxaPag += p.taxaPag; s.promoLoja += p.promoLoja;
      var mm = mesDe(p.data); (porMes[mm] = porMes[mm] || { bruto: 0, mensalidades: [] }).bruto += p.base;
    });
    var conferir = [];
    lido.avulsos.forEach(function (a) {
      var v = Math.abs(a.valor);
      if (a.tipo === 'mensalidade') { s.mensalidade += v; var mm = mesDe(a.data); (porMes[mm] = porMes[mm] || { bruto: 0, mensalidades: [] }).mensalidades.push(v); }
      else if (a.tipo === 'anuncios') s.anuncios += v;
      else if (a.tipo === 'cancelamento') { if (a.valor < 0) { s.cancelamentos += v; conferir.push({ tipo: 'Cancelamento descontado da loja', pedido: a.pedido, data: a.data, valor: v, desc: a.desc }); } }
      else if (a.tipo === 'entrega') { if (a.valor < 0) s.entregaCobrada += v; }
      else if (a.tipo === 'antecipacao') { if (a.valor < 0) s.antecipacao += v; }
      else if (a.tipo === 'promo') { if (a.valor < 0) s.promoLoja += v; }
      else if (a.tipo === 'outros') { if (a.valor < 0) { s.outros += v; conferir.push({ tipo: 'Desconto sem explicação clara', pedido: a.pedido, data: a.data, valor: v, desc: a.desc }); } }
    });
    // Mensalidade: duas no mesmo mês, ou cobrada num mês abaixo do piso
    Object.keys(porMes).forEach(function (mm) {
      var x = porMes[mm];
      if (x.mensalidades.length > 1) {
        var extra = x.mensalidades.slice(1).reduce(function (a, b) { return a + b; }, 0);
        achados.push({ tipo: 'Mensalidade cobrada ' + x.mensalidades.length + 'x no mesmo mês', pedido: '—', data: null, mes: mm, dif: arred(extra) }); total += extra;
      }
      if (x.mensalidades.length && x.bruto > 0 && x.bruto <= PISO_MENSALIDADE) {
        conferir.push({ tipo: 'Mensalidade num mês com vendas até R$ ' + Motor.fmtBR(PISO_MENSALIDADE) + ' — confira a regra do seu contrato', pedido: '—', data: null, mes: mm, valor: x.mensalidades[0] });
      }
    });
    Object.keys(s).forEach(function (k) { if (typeof s[k] === 'number' && k !== 'pedidos' && k !== 'cancelados') s[k] = arred(s[k]); });
    var descontos = arred(s.comissao + s.taxaPag + s.promoLoja + s.mensalidade + s.anuncios + s.cancelamentos + s.entregaCobrada + s.antecipacao + s.outros);
    var datas = ok.map(function (p) { return p.data; }).filter(Boolean).sort(function (a, b) { return a - b; });
    achados.sort(function (a, b) { return b.dif - a.dif; });
    return {
      somas: s, descontos: descontos,
      efetivo: s.bruto ? descontos / s.bruto * 100 : 0,
      sobraDe100: s.bruto ? arred(100 - descontos / s.bruto * 100) : null,
      refCom: refCom, refTx: refTx, fonteCom: contrato.comissao > 0 ? 'contrato' : 'padrao', fonteTx: contrato.taxaPag > 0 ? 'contrato' : 'padrao',
      achados: achados, totalAchado: arred(total), conferir: conferir,
      inicio: datas[0] || null, fim: datas[datas.length - 1] || null
    };
  }

  // Relatório de exemplo (fictício) — um pedido por linha
  function exemplo() {
    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var cab = ['ID do pedido', 'Data do pedido', 'Status', 'Forma de pagamento', 'Valor dos itens', 'Taxa de entrega', 'Incentivo promocional da loja', 'Comissão iFood', 'Taxa de transação', 'Valor líquido'];
    var L = [['Relatório financeiro — Lanchonete Exemplo (dados fictícios)'], ['Período: 01/09/2026 a 30/09/2026'], [], cab];
    var n = 5001;
    function f(x) { return Motor.fmtBR(x); }
    for (var dia = 1; dia <= 30; dia++) {
      var q = 4 + Math.floor(rnd() * 6);
      for (var k = 0; k < q; k++) {
        var itens = Math.round((28 + rnd() * 70) * 100) / 100, ent = 6.99;
        var forma = rnd() < 0.88 ? 'Pago pelo app - ' + (rnd() < 0.5 ? 'Pix' : 'Cartão de crédito') : 'Pagamento na entrega - Dinheiro';
        var com = 12, tx = forma.indexOf('app') >= 0 ? 3.2 : 0;
        if (dia >= 20 && dia <= 22 && k < 2) com = 15;           // comissão fora do contrato em alguns pedidos
        if (dia === 9 && k === 0) { tx = 3.2; forma = 'Pagamento na entrega - Dinheiro'; } // taxa online em pedido pago na entrega
        var promo = (dia % 7 === 0 && k < 3) ? 5 : 0;
        var vCom = Math.round(itens * com) / 100, vTx = Math.round((itens + ent) * tx) / 100;
        var status = (dia === 14 && k === 1) ? 'Cancelado' : 'Concluído';
        var liq = Math.round((itens + ent - promo - vCom - vTx) * 100) / 100;
        L.push(['#' + (n++), ('0' + dia).slice(-2) + '/09/2026', status, forma, f(itens), f(ent), promo ? f(promo) : '0,00', f(vCom), f(vTx), f(liq)]);
      }
    }
    return L;
  }

  return { PLANOS: PLANOS, detectar: detectar, ler: ler, conferir: conferir, exemplo: exemplo, classificarLanc: classificarLanc };
});

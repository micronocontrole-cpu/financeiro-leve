/* Conciliador do Micro no Controle
   Cruza as vendas da maquininha com os créditos do extrato do banco e mostra
   o que caiu, o que caiu a menos e o que não caiu. Roda 100% no navegador
   (e no Node para testes). Nenhum arquivo sai do aparelho.
   Regras fixas, sem inteligência artificial: o mesmo arquivo sempre dá o mesmo resultado. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../auditoria-maquininha/motor.js'));
  else root.Conciliador = factory(root.Motor);
})(this, function (Motor) {
  'use strict';
  var numero = Motor.numero, lerData = Motor.data;
  var DIA = 86400000;

  function semAcento(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function arred(n) { return n >= 0 ? Math.round(n * 100 + 1e-7) / 100 : -Math.round(-n * 100 + 1e-7) / 100; }
  function chave(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function somaDias(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function diasEntre(a, b) { return Math.round((b - a) / DIA); }
  // fim de semana vai para a segunda-feira (feriados ficam na folga da conferência)
  function diaUtil(d) { var w = d.getDay(); return w === 6 ? somaDias(d, 2) : w === 0 ? somaDias(d, 1) : d; }
  function maisDiasUteis(d, n) { var x = d; while (n > 0) { x = somaDias(x, 1); if (x.getDay() !== 0 && x.getDay() !== 6) n--; } return x; }
  function dma(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
  function brl(n) { return 'R$ ' + Motor.fmtBR(Math.abs(n)); }

  /* ---------- 1. Vendas da maquininha ---------- */
  var PREVISAO = /previs|data (de |do )?(pagamento|credito|recebimento|liquidacao|deposito)|pagamento previsto|data prevista|dt\.? pagamento|vencimento/;

  function lerVendas(linhas) {
    var det = Motor.detectar(linhas);
    if (!det.ok) return { ok: false, erro: 'Não achei as colunas de valor da venda neste arquivo. Ele precisa ter o valor bruto e o valor líquido (ou a taxa) de cada venda.' };
    var cab = det.cabecalho.map(semAcento), mapa = det.mapa;
    var colPrev = -1;
    for (var i = 0; i < cab.length; i++) { if (i !== mapa.data && PREVISAO.test(cab[i])) { colPrev = i; break; } }
    var colLiq = mapa.liquido, lista = [], ignoradas = 0;
    for (var r = det.linha + 1; r < linhas.length; r++) {
      var L = linhas[r]; if (!L) continue;
      var bruto = numero(L[mapa.bruto]);
      if (!(bruto > 0)) { ignoradas++; continue; }
      if (mapa.status >= 0 && /cancel|estorn|negad|recus|desfeit|chargeback|contesta/.test(semAcento(L[mapa.status]))) { ignoradas++; continue; }
      var liquido = colLiq >= 0 ? Math.abs(numero(L[colLiq])) : NaN;
      if (isNaN(liquido) && mapa.taxa >= 0) liquido = bruto - Math.abs(numero(L[mapa.taxa]));
      if (isNaN(liquido) && mapa.taxaPct >= 0) liquido = bruto * (1 - numero(L[mapa.taxaPct]) / 100);
      if (isNaN(liquido) || liquido <= 0 || liquido > bruto * 1.001) { ignoradas++; continue; }
      var dv = mapa.data >= 0 ? lerData(L[mapa.data]) : null;
      if (!dv) { ignoradas++; continue; }
      var parc = mapa.parcelas >= 0 ? parseInt(String(L[mapa.parcelas]).replace(/\D/g, ''), 10) : 1;
      var band = mapa.bandeira >= 0 ? String(L[mapa.bandeira] || '').trim() : '';
      var mod = Motor.classificar(mapa.modalidade >= 0 ? L[mapa.modalidade] : '', parc, band);
      if (!(parc > 1)) parc = /credito_2a6|credito_7a12/.test(mod) ? 2 : 1;
      lista.push({ linha: r + 1, data: dv, mod: mod, parcelas: parc, bruto: arred(bruto), liquido: arred(liquido),
        previsao: colPrev >= 0 ? lerData(L[colPrev]) : null, bandeira: band });
    }
    if (!lista.length) return { ok: false, erro: 'Achei as colunas, mas nenhuma venda válida. Confira se o arquivo é o relatório de vendas do mês.' };
    return { ok: true, vendas: lista, ignoradas: ignoradas, temPrevisao: colPrev >= 0, colunaPrevisao: colPrev >= 0 ? det.cabecalho[colPrev] : '' };
  }

  // Prazo padrão (dias) de cada modalidade, quando o arquivo não traz a data prevista
  var PRAZOS = { debito: 1, credito_vista: 30, credito_2a6: 30, credito_7a12: 30, pre_pago: 2, pix: 0, voucher: 30, outro: 30 };

  function previstos(vendas, op) {
    op = op || {}; var prazos = op.prazos || PRAZOS, antecipa = !!op.antecipa, out = [];
    vendas.forEach(function (v) {
      if (v.previsao) { out.push({ data: diaUtil(v.previsao), valor: v.liquido, venda: v, parcela: 0 }); return; }
      if (antecipa && v.mod !== 'pix' && v.mod !== 'voucher') { out.push({ data: maisDiasUteis(v.data, 1), valor: v.liquido, venda: v, parcela: 0 }); return; }
      if (v.mod === 'debito') { out.push({ data: maisDiasUteis(v.data, prazos.debito), valor: v.liquido, venda: v, parcela: 0 }); return; }
      if (v.mod === 'pix') { out.push({ data: diaUtil(somaDias(v.data, prazos.pix)), valor: v.liquido, venda: v, parcela: 0 }); return; }
      var n = Math.max(1, v.parcelas), base = Math.floor(v.liquido / n * 100) / 100, resto = arred(v.liquido - base * n);
      for (var k = 1; k <= n; k++) {
        out.push({ data: diaUtil(somaDias(v.data, (prazos[v.mod] || 30) * k)), valor: arred(base + (k === 1 ? resto : 0)), venda: v, parcela: n > 1 ? k : 0 });
      }
    });
    return out;
  }

  /* ---------- 2. Extrato do banco ---------- */
  function lerOFX(texto) {
    var blocos = String(texto).split(/<STMTTRN>/i).slice(1), lista = [];
    blocos.forEach(function (b) {
      function tag(n) { var m = b.match(new RegExp('<' + n + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; }
      var dt = tag('DTPOSTED'), valor = numero(tag('TRNAMT').replace(',', '.'));
      if (!/^\d{8}/.test(dt) || isNaN(valor)) return;
      var d = new Date(+dt.slice(0, 4), +dt.slice(4, 6) - 1, +dt.slice(6, 8));
      lista.push({ data: d, valor: arred(valor), desc: (tag('MEMO') + ' ' + tag('NAME')).trim() });
    });
    return lista;
  }

  function lerExtratoLinhas(linhas) {
    var melhor = null;
    for (var r = 0; r < Math.min(linhas.length, 40); r++) {
      var cab = linhas[r].map(semAcento), m = { data: -1, desc: -1, valor: -1, cred: -1, deb: -1 };
      cab.forEach(function (h, i) {
        if (m.data < 0 && /^data|data (do )?lancamento|data mov/.test(h)) m.data = i;
        else if (m.desc < 0 && /hist|descri|lancamento|detalhe|memo|titulo/.test(h)) m.desc = i;
        else if (m.cred < 0 && /^credito|entrada/.test(h)) m.cred = i;
        else if (m.deb < 0 && /^debito|saida/.test(h)) m.deb = i;
        else if (m.valor < 0 && /^valor|quantia|montante/.test(h)) m.valor = i;
      });
      if (m.data >= 0 && (m.valor >= 0 || m.cred >= 0)) { melhor = { linha: r, m: m }; break; }
    }
    if (!melhor) return null;
    var m = melhor.m, lista = [];
    for (var k = melhor.linha + 1; k < linhas.length; k++) {
      var L = linhas[k]; if (!L) continue;
      var d = lerData(L[m.data]); if (!d) continue;
      var v = m.cred >= 0 ? numero(L[m.cred]) : numero(L[m.valor]);
      if (m.cred >= 0 && (isNaN(v) || v === 0) && m.deb >= 0) { var db = numero(L[m.deb]); if (!isNaN(db)) v = -Math.abs(db); }
      if (isNaN(v)) continue;
      // extratos que marcam débito com "D" numa coluna ao lado
      var linhaTxt = semAcento(L.join(' '));
      if (m.cred < 0 && v > 0 && /\s(d|debito)\s*$/.test(linhaTxt) && !/\s(c|credito)\s*$/.test(linhaTxt)) v = -v;
      lista.push({ data: d, valor: arred(v), desc: m.desc >= 0 ? String(L[m.desc] || '').trim() : L.join(' ') });
    }
    return lista;
  }

  function lerExtrato(entrada) {
    var lanc = typeof entrada === 'string' && /<STMTTRN>/i.test(entrada) ? lerOFX(entrada)
      : lerExtratoLinhas(typeof entrada === 'string' ? Motor.lerCSV(entrada) : entrada);
    if (!lanc || !lanc.length) return { ok: false, erro: 'Não consegui ler o extrato. Use o arquivo OFX (o melhor), CSV ou Excel exportado pelo app do banco.' };
    var cred = lanc.filter(function (x) { return x.valor > 0; });
    if (!cred.length) return { ok: false, erro: 'O extrato não tem nenhuma entrada de dinheiro.' };
    var ini = lanc.reduce(function (a, x) { return x.data < a ? x.data : a; }, lanc[0].data);
    var fim = lanc.reduce(function (a, x) { return x.data > a ? x.data : a; }, lanc[0].data);
    return { ok: true, creditos: cred, total: lanc.length, inicio: ini, fim: fim };
  }

  var ADQUIRENTES = 'stone|\\bton\\b|pagseguro|pagbank|pag seguro|cielo|\\brede\\b|redecard|getnet|mercado ?pago|mercadopago|sumup|infinite|safrapay|\\bvero\\b|sipag|sicredi|sicoob|bin |adyen|granito|cappta|vindi|pagarme|zoop|c6 ?pay|banricompras|elo pag|ifood|antecip|recebiveis|cartao|cartoes|liquidacao';
  function credAdquirente(creditos, extra) {
    var re = new RegExp(ADQUIRENTES + (extra ? '|' + extra : ''), 'i');
    var achados = creditos.filter(function (c) { return re.test(semAcento(c.desc)); });
    return { lista: achados.length ? achados : creditos, filtrou: achados.length > 0 };
  }

  /* ---------- 3. Cruzamento ---------- */
  function conciliar(prev, extrato, op) {
    op = op || {};
    var folga = op.folga == null ? 3 : op.folga;
    var adq = credAdquirente(extrato.creditos, op.palavra);
    var creds = adq.lista.map(function (c, i) { return { id: i, data: c.data, valor: c.valor, desc: c.desc, usado: false }; })
      .sort(function (a, b) { return a.data - b.data; });
    // agrupa o que devia cair por dia
    var por = {};
    prev.forEach(function (p) {
      var k = chave(p.data);
      if (!por[k]) por[k] = { data: p.data, valor: 0, itens: [], parcelado: false, mods: {} };
      var g = por[k]; g.valor = arred(g.valor + p.valor); g.itens.push(p); g.mods[p.venda.mod] = 1;
      if (p.parcela) g.parcelado = true;
    });
    var grupos = Object.keys(por).sort().map(function (k) { return por[k]; });
    function tol(v) { return Math.max(0.05, v * 0.005); }
    function janela(g) { return creds.filter(function (c) { return !c.usado && diasEntre(g.data, c.data) >= -1 && diasEntre(g.data, c.data) <= folga; }); }

    // passo 1: um crédito com o mesmo valor
    grupos.forEach(function (g) {
      var c = janela(g).filter(function (c) { return Math.abs(c.valor - g.valor) <= tol(g.valor); })
        .sort(function (a, b) { return Math.abs(diasEntre(g.data, a.data)) - Math.abs(diasEntre(g.data, b.data)); })[0];
      if (c) { c.usado = true; g.status = 'ok'; g.caiu = c.valor; g.credito = [c]; }
    });
    // passo 2: vários créditos do mesmo dia somando o valor
    grupos.forEach(function (g) {
      if (g.status) return;
      var porDia = {};
      janela(g).forEach(function (c) { var k = chave(c.data); (porDia[k] = porDia[k] || []).push(c); });
      Object.keys(porDia).some(function (k) {
        var s = arred(porDia[k].reduce(function (a, c) { return a + c.valor; }, 0));
        if (Math.abs(s - g.valor) <= tol(g.valor)) { porDia[k].forEach(function (c) { c.usado = true; }); g.status = 'ok'; g.caiu = s; g.credito = porDia[k]; return true; }
        return false;
      });
    });
    // passo 3: dias seguidos pagos juntos (ex.: vendas de sábado e domingo pagas na segunda)
    for (var i = 0; i < grupos.length; i++) {
      if (grupos[i].status) continue;
      var soma = 0, junta = [];
      for (var j = i; j < grupos.length && diasEntre(grupos[i].data, grupos[j].data) <= 3; j++) {
        if (grupos[j].status) continue;
        soma = arred(soma + grupos[j].valor); junta.push(grupos[j]);
        if (junta.length < 2) continue;
        var ult = junta[junta.length - 1];
        var c = janela(ult).filter(function (c) { return Math.abs(c.valor - soma) <= tol(soma); })[0];
        if (c) { c.usado = true; junta.forEach(function (g) { g.status = 'ok'; g.caiu = g.valor; g.credito = [c]; g.junto = true; }); break; }
      }
    }
    // passo 4: o que sobrou
    var fimExtrato = extrato.fim;
    grupos.forEach(function (g) {
      if (g.status) return;
      var limite = somaDias(g.data, folga);
      if (limite > fimExtrato) { g.status = 'aguardando'; return; }
      var parecidos = janela(g).filter(function (c) { return c.valor >= g.valor * 0.5 && c.valor < g.valor; })
        .sort(function (a, b) { return b.valor - a.valor; });
      if (parecidos[0]) {
        var c = parecidos[0]; c.usado = true;
        g.status = 'menos'; g.caiu = c.valor; g.credito = [c]; g.diferenca = arred(g.valor - c.valor); g.certeza = 'provavel';
        g.motivo = 'Caiu um valor menor. Pode ser aluguel da máquina, estorno ou ajuste: confira no app da maquininha antes de cobrar.';
        return;
      }
      g.status = 'naocaiu'; g.caiu = 0; g.diferenca = g.valor;
      if (g.parcelado || g.mods.voucher) { g.certeza = 'provavel'; g.motivo = g.parcelado ? 'Tem parcela de venda parcelada: confira se a data do parcelamento é esta.' : 'Vale-refeição tem prazo diferente: confira o prazo do seu contrato.'; }
      else { g.certeza = 'confirmada'; g.motivo = 'A venda está no relatório da maquininha e nenhum crédito parecido entrou no banco até ' + dma(limite) + '.'; }
    });

    var r = { grupos: grupos, filtrouAdquirente: adq.filtrou, sobras: creds.filter(function (c) { return !c.usado; }) };
    r.devia = arred(grupos.reduce(function (a, g) { return a + (g.status === 'aguardando' ? 0 : g.valor); }, 0));
    r.caiu = arred(grupos.reduce(function (a, g) { return a + (g.caiu || 0); }, 0));
    r.confirmado = arred(grupos.reduce(function (a, g) { return a + (g.certeza === 'confirmada' ? g.diferenca : 0); }, 0));
    r.provavel = arred(grupos.reduce(function (a, g) { return a + (g.certeza === 'provavel' ? g.diferenca : 0); }, 0));
    r.aguardando = arred(grupos.reduce(function (a, g) { return a + (g.status === 'aguardando' ? g.valor : 0); }, 0));
    r.qtd = { ok: 0, menos: 0, naocaiu: 0, aguardando: 0 };
    grupos.forEach(function (g) { r.qtd[g.status]++; });
    return r;
  }

  function textoCobranca(g, maquininha) {
    var vendas = g.itens.map(function (p) { return p.venda; });
    var dias = {}; vendas.forEach(function (v) { dias[dma(v.data)] = 1; });
    var listaDias = Object.keys(dias).slice(0, 4).join(', ') + (Object.keys(dias).length > 4 ? ' e outros dias' : '');
    var t = 'Olá! Sou cliente ' + (maquininha ? 'da ' + maquininha : 'de vocês') + '. O repasse previsto para ' + dma(g.data) + ', no valor de ' + brl(g.valor) +
      ', referente às vendas de ' + listaDias + ', ';
    t += g.status === 'menos' ? 'caiu só ' + brl(g.caiu) + ' na minha conta. Faltam ' + brl(g.diferenca) + '.' : 'não caiu na minha conta.';
    return t + ' Podem verificar e me mandar o comprovante do repasse, por favor?';
  }

  /* ---------- Exemplo fictício ---------- */
  function exemplo() {
    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var cab = ['Data da venda', 'Forma de pagamento', 'Bandeira', 'Parcelas', 'Valor bruto', 'Valor líquido', 'Status'];
    var linhas = [['Relatório de vendas — Lanchonete fictícia'], [], cab], vendas = [];
    for (var dia = 1; dia <= 31; dia++) {
      var d = new Date(2026, 9, dia), n = 6 + Math.floor(rnd() * 8);
      for (var k = 0; k < n; k++) {
        var x = rnd(), forma = x < 0.45 ? 'Débito' : x < 0.85 ? 'Crédito à vista' : 'Pix';
        var taxa = forma === 'Débito' ? 1.99 : forma === 'Pix' ? 0.99 : 3.49;
        var bruto = Math.round((15 + rnd() * 110) * 100) / 100, liq = Math.round(bruto * (100 - taxa)) / 100;
        linhas.push([dma(d), forma, forma === 'Pix' ? '' : ['Visa', 'Mastercard', 'Elo'][Math.floor(rnd() * 3)], '1', Motor.fmtBR(bruto), Motor.fmtBR(liq), 'Aprovada']);
        vendas.push({ data: d, mod: forma === 'Débito' ? 'debito' : forma === 'Pix' ? 'pix' : 'credito_vista', parcelas: 1, liquido: liq });
      }
    }
    // o banco: cada dia de repasse vira um crédito "STONE PAGAMENTOS"; dois dias não caíram e um caiu a menos
    var prev = previstos(vendas.map(function (v) { return { data: v.data, mod: v.mod, parcelas: 1, liquido: v.liquido, bruto: v.liquido }; }), {});
    var por = {};
    prev.forEach(function (p) { var kk = chave(p.data); por[kk] = por[kk] || { data: p.data, v: 0 }; por[kk].v = arred(por[kk].v + p.valor); });
    var ofx = ['OFXHEADER:100', 'DATA:OFXSGML', '<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>', '<DTSTART>20261001', '<DTEND>20261130'];
    var dias = Object.keys(por).sort(), i = 0;
    dias.forEach(function (kk) {
      var p = por[kk]; if (p.data > new Date(2026, 10, 30)) return;
      i++;
      if (kk === '2026-10-08' || kk === '2026-10-21') return; // não caiu
      var valor = kk === '2026-10-14' ? arred(p.v - 89.9) : p.v; // caiu a menos (aluguel descontado)
      ofx.push('<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>' + kk.replace(/-/g, '') + '<TRNAMT>' + valor.toFixed(2) + '<FITID>' + i + '<MEMO>STONE PAGAMENTOS SA</STMTTRN>');
    });
    ofx.push('<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005<TRNAMT>-1800.00<FITID>a1<MEMO>PAGTO ALUGUEL</STMTTRN>');
    ofx.push('<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261012<TRNAMT>350.00<FITID>a2<MEMO>PIX RECEBIDO MARIA</STMTTRN>');
    ofx.push('</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>');
    return { vendas: linhas, extrato: ofx.join('\n') };
  }

  return { lerVendas: lerVendas, previstos: previstos, lerExtrato: lerExtrato, lerOFX: lerOFX, conciliar: conciliar,
    textoCobranca: textoCobranca, exemplo: exemplo, PRAZOS: PRAZOS, dma: dma, brl: brl, chave: chave };
});

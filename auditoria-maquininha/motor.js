/* Motor da Auditoria de Maquininha — Micro no Controle
   Lê o extrato de vendas (CSV/Excel já convertido em linhas), descobre as colunas,
   calcula a taxa cobrada em cada venda e compara com a taxa combinada.
   Roda 100% no navegador (e no Node para testes). Nenhum dado sai do computador. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Motor = factory();
})(this, function () {
  'use strict';

  var MODS = {
    debito: 'Débito',
    credito_vista: 'Crédito à vista',
    credito_2a6: 'Crédito parcelado 2 a 6x',
    credito_7a12: 'Crédito parcelado 7 a 12x',
    pre_pago: 'Pré-pago',
    pix: 'Pix',
    voucher: 'Vale-refeição / alimentação',
    outro: 'Outros'
  };
  var ORDEM = ['debito', 'credito_vista', 'credito_2a6', 'credito_7a12', 'pre_pago', 'pix', 'voucher', 'outro'];

  function semAcento(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  // "R$ 1.234,56" -> 1234.56 ; "2,39%" -> 2.39 ; 12.5 -> 12.5 ; "(12,30)" -> -12.3
  function numero(v) {
    if (v == null || v === '') return NaN;
    if (typeof v === 'number') return v;
    var s = String(v).trim();
    var neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s);
    s = s.replace(/[^\d.,]/g, '');
    if (!s) return NaN;
    var temVirgula = s.indexOf(',') >= 0, temPonto = s.indexOf('.') >= 0;
    if (temVirgula && temPonto) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (temVirgula) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (temPonto) {
      // "1.234.567" ou "1.234" = milhar ; "12.5" ou "12.34" = decimal
      var partes = s.split('.');
      if (partes.length > 2 || partes[1].length === 3) s = partes.join('');
    }
    var n = parseFloat(s);
    return neg ? -Math.abs(n) : n;
  }

  // Aceita Date, número serial do Excel, "dd/mm/aaaa [hh:mm]", "aaaa-mm-dd"
  function data(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var d = new Date(Math.round((v - 25569) * 86400000));
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))) {
      var a = +m[3]; if (a < 100) a += 2000;
      return new Date(a, +m[2] - 1, +m[1]);
    }
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
    return null;
  }

  // CSV com ; , ou tab, e aspas
  function lerCSV(texto) {
    texto = String(texto).replace(/^﻿/, '');
    var linhas = texto.split(/\r?\n/).slice(0, 15).join('\n');
    var cont = { ';': (linhas.match(/;/g) || []).length, ',': (linhas.match(/,/g) || []).length, '\t': (linhas.match(/\t/g) || []).length };
    var sep = ';';
    if (cont['\t'] > cont[';'] && cont['\t'] > cont[',']) sep = '\t';
    else if (cont[','] > cont[';'] * 1.5) sep = ',';
    var out = [], linha = [], campo = '', aspas = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (aspas) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        linha.push(campo); campo = '';
        if (linha.some(function (x) { return String(x).trim() !== ''; })) out.push(linha);
        linha = [];
      } else campo += c;
    }
    linha.push(campo);
    if (linha.some(function (x) { return String(x).trim() !== ''; })) out.push(linha);
    return out;
  }

  // Palavras-chave de cada coluna (em ordem de preferência)
  var CHAVES = {
    data: [['data da venda'], ['data venda'], ['data de venda'], ['data da transacao'], ['data']],
    bandeira: [['bandeira'], ['cartao'], ['arranjo']],
    modalidade: [['forma de pagamento'], ['modalidade'], ['tipo de pagamento'], ['meio de pagamento'], ['produto'], ['tipo de venda'], ['tipo'], ['forma']],
    parcelas: [['quantidade de parcelas'], ['qtd parcelas'], ['n de parcelas'], ['numero de parcelas'], ['parcelas'], ['plano']],
    bruto: [['valor bruto'], ['valor da venda original'], ['valor original'], ['valor da venda'], ['valor total'], ['bruto'], ['valor']],
    liquido: [['valor liquido'], ['liquido'], ['valor a receber']],
    taxa: [['valor da taxa'], ['taxa/tarifa'], ['tarifa'], ['desconto mdr'], ['valor descontado'], ['mdr'], ['desconto'], ['taxa']],
    taxaPct: [['taxa %'], ['taxa (%)'], ['% taxa'], ['percentual']],
    antecipacao: [['antecipa']],
    status: [['status'], ['situacao']]
  };

  function acharColuna(cabecalho, nome, usadas) {
    var lista = CHAVES[nome];
    if (nome === 'taxaPct') {
      for (var j = 0; j < cabecalho.length; j++) {
        var hh = semAcento(cabecalho[j]);
        if (!usadas[j] && /%|percent/.test(hh) && /taxa|mdr|tarifa/.test(hh) && !/antecip/.test(hh)) return j;
      }
    }
    for (var k = 0; k < lista.length; k++) {
      for (var i = 0; i < cabecalho.length; i++) {
        if (usadas[i]) continue;
        var h = semAcento(cabecalho[i]);
        if (!h) continue;
        var chave = lista[k][0];
        if (h === chave || h.indexOf(chave) >= 0) {
          // evita confundir "valor bruto" com "valor líquido" e "taxa" com "taxa %"
          if (nome === 'bruto' && /liquid|taxa|tarifa|descont|parcela|antecip/.test(h)) continue;
          if (nome === 'taxa' && /%|percent|antecip/.test(h)) continue;
          if (nome === 'data' && /pagamento|prevista|credito|recebimento|vencimento/.test(h) && k === lista.length - 1) continue;
          if (nome === 'modalidade' && /bandeira/.test(h)) continue;
          return i;
        }
      }
    }
    return -1;
  }

  function mapearColunas(cabecalho) {
    var usadas = {}, mapa = {};
    ['antecipacao', 'taxaPct', 'liquido', 'bruto', 'taxa', 'data', 'bandeira', 'parcelas', 'modalidade', 'status'].forEach(function (nome) {
      var i = acharColuna(cabecalho, nome, usadas);
      mapa[nome] = i;
      if (i >= 0) usadas[i] = true;
    });
    return mapa;
  }

  // Procura a linha de cabeçalho nas primeiras 40 linhas
  function detectar(linhas) {
    var melhor = { pontos: -1 };
    for (var r = 0; r < Math.min(linhas.length, 40); r++) {
      var cab = linhas[r].map(function (x) { return String(x == null ? '' : x); });
      var mapa = mapearColunas(cab);
      var pontos = 0;
      if (mapa.bruto >= 0) pontos += 3;
      if (mapa.liquido >= 0 || mapa.taxa >= 0 || mapa.taxaPct >= 0) pontos += 3;
      if (mapa.data >= 0) pontos += 1;
      if (mapa.modalidade >= 0) pontos += 2;
      if (mapa.bandeira >= 0) pontos += 1;
      if (pontos > melhor.pontos) melhor = { pontos: pontos, linha: r, mapa: mapa, cabecalho: cab };
    }
    melhor.ok = melhor.pontos >= 6 && melhor.mapa.bruto >= 0 && (melhor.mapa.liquido >= 0 || melhor.mapa.taxa >= 0 || melhor.mapa.taxaPct >= 0);
    return melhor;
  }

  function classificar(texto, parcelas, bandeira) {
    var t = semAcento(texto) + ' ' + semAcento(bandeira);
    if (/pix/.test(t)) return 'pix';
    if (/alelo|ticket|sodexo|pluxee|vr |vr$|\bvr\b|ben |verocard|refeic|aliment|voucher|vale/.test(t)) return 'voucher';
    if (/pre-?pago|prepago/.test(t)) return 'pre_pago';
    if (/debit/.test(t)) return 'debito';
    var p = parseInt(parcelas, 10);
    var m = semAcento(texto).match(/(\d{1,2})\s*x/);
    if ((!p || isNaN(p)) && m) p = +m[1];
    if (/parcel/.test(t) || p > 1) {
      if (!p || p <= 1) p = 2;
      return p <= 6 ? 'credito_2a6' : 'credito_7a12';
    }
    if (/credit|vista|rotativo/.test(t)) return 'credito_vista';
    if (!semAcento(texto)) return 'credito_vista';
    return 'outro';
  }

  function cancelada(status) {
    return /cancel|estorn|negad|recus|desfeit|chargeback|contesta/.test(semAcento(status));
  }

  // Transforma as linhas em vendas
  function vendas(linhas, det, mapaManual) {
    var mapa = mapaManual || det.mapa, lista = [], ignoradas = 0, temAntecip = mapa.antecipacao >= 0;
    for (var r = det.linha + 1; r < linhas.length; r++) {
      var L = linhas[r];
      if (!L) continue;
      var bruto = numero(L[mapa.bruto]);
      if (!(bruto > 0)) { ignoradas++; continue; }
      if (mapa.status >= 0 && cancelada(L[mapa.status])) { ignoradas++; continue; }
      var desconto = NaN;
      if (mapa.taxa >= 0) desconto = Math.abs(numero(L[mapa.taxa]));
      if (isNaN(desconto) && mapa.liquido >= 0) {
        var liq = numero(L[mapa.liquido]);
        if (!isNaN(liq)) {
          desconto = bruto - Math.abs(liq);
          if (temAntecip) { var an = Math.abs(numero(L[mapa.antecipacao])); if (!isNaN(an)) desconto -= an; }
        }
      }
      if (isNaN(desconto) && mapa.taxaPct >= 0) {
        var pct = numero(L[mapa.taxaPct]);
        if (!isNaN(pct)) desconto = bruto * pct / 100;
      }
      if (isNaN(desconto) || desconto < 0 || desconto > bruto * 0.5) { ignoradas++; continue; }
      var parcelas = mapa.parcelas >= 0 ? L[mapa.parcelas] : '';
      var band = mapa.bandeira >= 0 ? String(L[mapa.bandeira] || '').trim() : '';
      var modTxt = mapa.modalidade >= 0 ? L[mapa.modalidade] : '';
      lista.push({
        linha: r + 1,
        data: mapa.data >= 0 ? data(L[mapa.data]) : null,
        bandeira: band || '—',
        mod: classificar(modTxt, parcelas, band),
        modTexto: String(modTxt || '').trim(),
        bruto: arred(bruto),
        desconto: arred(desconto),
        taxa: bruto ? desconto / bruto * 100 : 0
      });
    }
    return { vendas: lista, ignoradas: ignoradas, temAntecipacao: temAntecip };
  }

  // arredonda dinheiro "meio centavo para cima", sem o erro de ponto flutuante (0,945 -> 0,95)
  function arred(n) { return n >= 0 ? Math.round(n * 100 + 1e-7) / 100 : -Math.round(-n * 100 + 1e-7) / 100; }

  // Taxa "padrão" da modalidade = a mais frequente (arredondada a 0,01 ponto)
  function taxaModal(taxas) {
    var cont = {}, melhor = null, mx = 0;
    taxas.forEach(function (t) {
      var k = (Math.round(t * 100) / 100).toFixed(2);
      cont[k] = (cont[k] || 0) + 1;
      if (cont[k] > mx || (cont[k] === mx && +k < +melhor)) { mx = cont[k]; melhor = k; }
    });
    return melhor == null ? null : +melhor;
  }

  function resumo(lista) {
    var por = {};
    lista.forEach(function (v) {
      var g = por[v.mod] || (por[v.mod] = { mod: v.mod, nome: MODS[v.mod], qtd: 0, bruto: 0, desconto: 0, taxas: [] });
      g.qtd++; g.bruto += v.bruto; g.desconto += v.desconto; g.taxas.push(v.taxa);
    });
    return ORDEM.filter(function (m) { return por[m]; }).map(function (m) {
      var g = por[m];
      g.bruto = arred(g.bruto); g.desconto = arred(g.desconto);
      g.media = g.bruto ? g.desconto / g.bruto * 100 : 0;
      // taxas que aparecem com frequência (em pelo menos 15% das vendas, mínimo 2)
      var cont = {};
      g.taxas.forEach(function (t) { var k = (Math.round(t * 100) / 100).toFixed(2); cont[k] = (cont[k] || 0) + 1; });
      var corte = Math.max(2, Math.ceil(g.qtd * 0.15));
      g.frequentes = Object.keys(cont).filter(function (k) { return cont[k] >= corte; }).map(Number).sort(function (a, b) { return a - b; });
      // referência = a MENOR taxa que se repete (se você já pagou essa taxa várias vezes, ela é a combinada)
      g.padrao = g.frequentes.length ? g.frequentes[0] : taxaModal(g.taxas);
      g.variacao = g.frequentes.length >= 2 && (g.frequentes[g.frequentes.length - 1] - g.frequentes[0]) > 0.1;
      g.min = Math.min.apply(null, g.taxas); g.max = Math.max.apply(null, g.taxas);
      delete g.taxas;
      return g;
    });
  }

  // contratos: { debito: 1.37, credito_vista: null, ... } (null/undefined = usar o padrão do próprio extrato)
  function auditar(lista, contratos, tolerancia) {
    contratos = contratos || {};
    tolerancia = tolerancia == null ? 0.05 : tolerancia;
    var grupos = resumo(lista), ref = {}, fonte = {};
    grupos.forEach(function (g) {
      var c = contratos[g.mod];
      if (c != null && !isNaN(c) && c !== '') { ref[g.mod] = +c; fonte[g.mod] = 'contrato'; }
      else { ref[g.mod] = g.padrao; fonte[g.mod] = 'padrao'; }
    });
    var acima = [], totalAcima = 0, bruto = 0, desconto = 0, dmin = null, dmax = null;
    lista.forEach(function (v) {
      bruto += v.bruto; desconto += v.desconto;
      if (v.data) { if (!dmin || v.data < dmin) dmin = v.data; if (!dmax || v.data > dmax) dmax = v.data; }
      var r = ref[v.mod];
      if (r == null || v.mod === 'outro') return;
      var difPp = v.taxa - r;
      if (difPp > tolerancia) {
        var dif = arred(v.desconto - v.bruto * r / 100);
        if (dif >= 0.01) { acima.push({ venda: v, ref: r, difPp: difPp, dif: dif }); totalAcima += dif; }
      }
    });
    grupos.forEach(function (g) {
      g.ref = ref[g.mod]; g.fonte = fonte[g.mod];
      g.acimaQtd = 0; g.acimaValor = 0;
      acima.forEach(function (a) { if (a.venda.mod === g.mod) { g.acimaQtd++; g.acimaValor += a.dif; } });
      g.acimaValor = arred(g.acimaValor);
      // diferença da média em relação ao combinado, quando há contrato
      g.excessoMedio = g.fonte === 'contrato' ? arred(Math.max(0, g.desconto - g.bruto * g.ref / 100)) : null;
    });
    acima.sort(function (a, b) { return b.dif - a.dif; });
    var dias = dmin && dmax ? Math.round((dmax - dmin) / 86400000) + 1 : null;
    var fator = dias && dias >= 7 ? 365 / dias : null;
    return {
      grupos: grupos,
      acima: acima,
      totalAcima: arred(totalAcima),
      qtd: lista.length,
      bruto: arred(bruto),
      desconto: arred(desconto),
      taxaMedia: bruto ? desconto / bruto * 100 : 0,
      inicio: dmin, fim: dmax, dias: dias,
      anualAcima: fator ? arred(totalAcima * fator) : null,
      anualTaxas: fator ? arred(desconto * fator) : null,
      tolerancia: tolerancia
    };
  }

  // Extrato de exemplo (fictício), no formato parecido com o de uma adquirente
  function exemplo() {
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var bands = ['Visa', 'Mastercard', 'Elo', 'Visa', 'Mastercard', 'Hipercard', 'Amex'];
    var cab = ['Data da venda', 'Bandeira', 'Forma de pagamento', 'Quantidade de parcelas', 'Valor bruto', 'Taxa/tarifa', 'Valor líquido', 'NSU', 'Status'];
    var linhas = [['Relatório de vendas — Loja Exemplo (dados fictícios)'], ['Período: 01/09/2026 a 30/09/2026'], [], cab];
    var nsu = 400100;
    for (var dia = 1; dia <= 30; dia++) {
      var n = 3 + Math.floor(rnd() * 5);
      for (var k = 0; k < n; k++) {
        var x = rnd(), forma, parc = 1, taxa;
        if (x < 0.42) { forma = 'Débito'; taxa = 1.37; }
        else if (x < 0.82) { forma = 'Crédito à vista'; taxa = 3.15; }
        else if (x < 0.95) { forma = 'Crédito parcelado loja'; parc = 2 + Math.floor(rnd() * 4); taxa = 3.79; }
        else { forma = 'Crédito parcelado loja'; parc = 7 + Math.floor(rnd() * 4); taxa = 4.29; }
        // cenário comum: a taxa promocional acabou no dia 16 e a maquininha passou a cobrar a taxa cheia
        if (dia >= 16 && forma === 'Débito') taxa = 1.99;
        if (dia >= 16 && forma === 'Crédito à vista') taxa = 3.49;
        // e algumas vendas soltas cobradas fora do padrão
        if (forma === 'Crédito parcelado loja' && parc <= 6 && (dia === 7 || dia === 12) && k < 3) taxa = 4.49;
        var bruto = Math.round((18 + rnd() * (forma === 'Débito' ? 160 : 420)) * 100) / 100;
        var tar = Math.round(bruto * taxa) / 100;
        var status = (dia === 15 && k === 0) ? 'Cancelada' : 'Aprovada';
        var dd = ('0' + dia).slice(-2);
        linhas.push([dd + '/09/2026', bands[Math.floor(rnd() * bands.length)], forma, String(parc),
          fmtBR(bruto), fmtBR(tar), fmtBR(Math.round((bruto - tar) * 100) / 100), String(nsu++), status]);
      }
    }
    return linhas;
  }

  function fmtBR(n) {
    return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function linhasParaCSV(linhas) {
    return linhas.map(function (L) {
      return L.map(function (c) { c = String(c == null ? '' : c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';');
    }).join('\r\n');
  }

  return {
    MODS: MODS, ORDEM: ORDEM, numero: numero, data: data, lerCSV: lerCSV, detectar: detectar,
    mapearColunas: mapearColunas, classificar: classificar, vendas: vendas, resumo: resumo,
    auditar: auditar, exemplo: exemplo, linhasParaCSV: linhasParaCSV, fmtBR: fmtBR
  };
});

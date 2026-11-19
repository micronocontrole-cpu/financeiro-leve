/* Micro no Controle — 🎤 Falar
   O dono fala (ou escreve) uma frase do dia a dia e o app entende e lança:
   "vendi 50 no pix pro João", "gastei 120 de mercadoria", "conta de luz 180 dia 10",
   "marca a Maria amanhã às 3 pra corte". Sem IA e sem internet para entender
   (a fala em si usa o reconhecimento do próprio navegador). */
(function () {
  'use strict';

  // ---------- 1. entender a frase (função pura, testável) ----------
  function sa(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var UN = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
    vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
    cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900 };
  // "cento e vinte e cinco" -> "125"; "dois mil e quinhentos" -> "2500"; "mil" -> "1000"
  function palavrasParaNumeros(t) {
    var pal = '(?:' + Object.keys(UN).join('|') + '|mil)';
    var re = new RegExp('\\b' + pal + '(?:\\s+(?:e\\s+)?' + pal + ')*\\b', 'g');
    return t.replace(re, function (m) {
      if (m === 'um' || m === 'uma') return m;
      var tot = 0, parc = 0;
      m.split(/\s+/).forEach(function (w) {
        if (w === 'e') return;
        if (w === 'mil') { tot += (parc || 1) * 1000; parc = 0; } else parc += UN[w];
      });
      return String(tot + parc);
    });
  }
  function num(s) {
    s = String(s).replace(/\s/g, '');
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    var n = parseFloat(s); return isNaN(n) ? 0 : n;
  }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function deIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function soma(s, n) { var d = deIso(s); d.setDate(d.getDate() + n); return iso(d); }
  var DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  var CATS = [
    ['contas', /\b(luz|energia|agua|internet|telefone|celular|gas|condominio|conta de luz|conta de agua)\b/, { luz: 'Luz', energia: 'Luz', agua: 'Água', internet: 'Internet', telefone: 'Telefone', celular: 'Celular', gas: 'Gás', condominio: 'Condomínio' }],
    ['aluguel', /\b(aluguel|aluguer)\b/, { aluguel: 'Aluguel' }],
    ['impostos', /\b(das|imposto|impostos|taxa da prefeitura|iptu|alvara)\b/, { das: 'DAS', imposto: 'Imposto', impostos: 'Impostos', iptu: 'IPTU', alvara: 'Alvará' }],
    ['transporte', /\b(gasolina|combustivel|uber|onibus|frete|estacionamento|moto|carro)\b/, {}],
    ['pessoal', /\b(ajudante|funcionario|funcionaria|diaria|diarista|salario d[oa])\b/, {}],
    ['maquina', /\b(maquininha|taxa da maquina|aluguel da maquina)\b/, {}],
    ['mercadoria', /\b(mercadoria|material|materiais|produto|produtos|estoque|fornecedor|carne|frango|farinha|pao|bebida|refrigerante|esmalte|lamina|shampoo|tinta|embalagem|embalagens|insumo|insumos|verdura|fruta)\b/, {}]
  ];
  var SERV = /\b(corte|barba|sobrancelha|escova|progressiva|luzes|mechas|coloracao|tintura|hidratacao|manicure|pedicure|pe e mao|unha|unhas|gel|alongamento|depilacao|massagem|limpeza de pele|maquiagem|banho|tosa|revisao|lavagem)\b/;

  function entender(texto, hojeIso, nomesConhecidos) {
    var orig = String(texto || '').trim(), r = { texto: orig, tipo: null, valor: 0, forma: '', nome: '', data: hojeIso, hora: '', desc: '', cat: '', rec: 'nao', serv: '' };
    if (!orig) return r;
    var t = palavrasParaNumeros(sa(orig)).replace(/r\$\s*/g, 'r$ ');
    // --- hora ---
    var hm = t.match(/\b(?:as|para as|pras|la pelas|lá pelas)\s+(\d{1,2})(?:[:h](\d{2}))?\s*(?:h|hs|horas?)?(\s+e\s+meia)?(\s+da\s+(?:tarde|noite|manha))?\b/) ||
      t.match(/\b(\d{1,2})[:h](\d{2})?\s*(?:h|hs)?\b()()/) || t.match(/\b(\d{1,2})\s+horas?(\s+e\s+meia)?()(\s+da\s+(?:tarde|noite|manha))?\b/) ||
      t.match(/\b(\d{1,2})()(\s+e\s+meia)(\s+da\s+(?:tarde|noite|manha))?\b/);
    if (/\bmeio[- ]dia\b/.test(t)) r.hora = '12:00';
    else if (hm) {
      var h = +hm[1], mi = hm[2] ? +hm[2] : 0, resto = (hm[0] || '');
      if (/e meia/.test(resto)) mi = 30;
      if (/tarde|noite/.test(resto) && h < 12) h += 12;
      if (!/manha/.test(resto) && h >= 1 && h <= 7) h += 12;
      if (h <= 23 && mi <= 59) r.hora = ('0' + h).slice(-2) + ':' + ('0' + mi).slice(-2);
    }
    // --- data ---
    var semData = t;
    var dm = t.match(/\bdia\s+(\d{1,2})(?:\s+de\s+(\w+)|\/(\d{1,2}))?\b/) || t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    if (/\bdepois de amanha\b/.test(t)) r.data = soma(hojeIso, 2);
    else if (/\bamanha\b/.test(t)) r.data = soma(hojeIso, 1);
    else if (/\banteontem\b/.test(t)) r.data = soma(hojeIso, -2);
    else if (/\bontem\b/.test(t)) r.data = soma(hojeIso, -1);
    else if (dm) {
      var d = +dm[1], base = deIso(hojeIso), mes = base.getMonth(), ano = base.getFullYear();
      var MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      if (dm[2] && isNaN(+dm[2]) && MESES.indexOf(dm[2]) >= 0) mes = MESES.indexOf(dm[2]);
      else if (dm[3] || (dm[2] && !isNaN(+dm[2]))) mes = +(dm[3] || dm[2]) - 1;
      if (d >= 1 && d <= 31 && mes >= 0 && mes <= 11) r._diaFixo = { d: d, mes: mes, ano: ano, mesDito: !!(dm[2] || dm[3]) };
      semData = t.replace(dm[0], ' ');
    } else {
      DIAS.forEach(function (n, i) { if (new RegExp('\\b' + n + '(-feira)?\\b').test(t)) r._semana = i; });
    }
    // --- forma ---
    if (/\bpix\b/.test(t)) r.forma = 'pix';
    else if (/\b(dinheiro|especie|em maos|cash)\b/.test(t)) r.forma = 'dinheiro';
    else if (/\bdebito\b/.test(t)) r.forma = 'debito';
    else if (/\b(credito|parcelad|parcelou|vezes no cartao)\b/.test(t)) r.forma = 'credito';
    else if (/\b(fiado|pendura|pendurou|anota|anotado|na conta d|vai pagar depois|paga depois|pagar depois)\b/.test(t)) r.forma = 'fiado';
    else if (/\bifood\b/.test(t)) r.forma = 'ifood';
    // --- tipo ---
    if (/\b(marca|marcar|marquei|agenda|agendar|agendei|encaixa|encaixar|horario)\b/.test(t) && (r.hora || SERV.test(t))) r.tipo = 'horario';
    else if (/\b(conta d[aoe]|boleto|fatura|vence|vencimento|vai vencer|pagar (no |ate )?dia|tenho que pagar|preciso pagar|parcela d[oa])\b/.test(t) && !/\b(paguei|pago hoje|ja paguei)\b/.test(t)) r.tipo = 'conta';
    else if (/\b(dia \d{1,2}|todo mes|todos os meses|mensal)\b/.test(t) && /\b(das|imposto|aluguel|luz|agua|internet|telefone|condominio|parcela|mensalidade|iptu|financiamento|emprestimo)\b/.test(t) && !/\b(paguei|ja paguei)\b/.test(t)) r.tipo = 'conta';
    else if (/\b(pra casa|para casa|pro mercado de casa|tirei pra mim|retirei|retirada|meu salario|pro meu bolso)\b/.test(t)) r.tipo = 'retirada';
    else if (/\b(devendo|devia|me deve|pagou o fiado|pagou o que dev|acertou|quitou|pagou a conta dele|pagou a conta dela|pagou parte|pagou o resto|abateu)\b/.test(t) && !/\b(vendi|fiado hoje)\b/.test(t)) r.tipo = 'receb';
    else if (/\b(gastei|paguei|comprei|despesa|gasto|saiu|paguei o|paguei a|investi)\b/.test(t)) r.tipo = 'despesa';
    else if (/\b(vendi|venda|vendeu|recebi|entrou|cobrei|fiz um|fiz uma|fiz o|fiz a|atendi|cliente pagou|pagou)\b/.test(t) || r.forma) r.tipo = 'venda';
    // --- valor (tira números de data e hora antes) ---
    var tv = semData.replace(/\b(?:as|pras|para as|la pelas)\s+\d{1,2}(?:[:h]\d{2})?\s*(?:h|hs|horas?)?(?:\s+e\s+meia)?\b/g, ' ').replace(/\b\d{1,2}\s+e\s+meia\b/g, ' ').replace(/\b\d{1,2}[:h]\d{2}\b/g, ' ').replace(/\b\d{1,2}\s+horas?\b/g, ' ')
      .replace(/\b\d+\s*(?:x|vezes)\b/g, ' ').replace(/\b(?:em|de)\s+\d+\s*(?:parcelas?)\b/g, ' ');
    var vm = tv.match(/r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/) || tv.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|conto|contos|pila|pilas)\b/) || tv.match(/\b(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\b/);
    if (vm) r.valor = Math.round(num(vm[1]) * 100) / 100;
    var qp = tv.match(/\b(\d{1,2})\s+([a-z]{3,}?)s?\s+(?:de|a|por)\s+(?:r\$\s*)?(\d+(?:,\d{1,2})?)\b(?!\s*(?:\/|de (?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)))/);
    if (qp && +qp[1] > 1 && +qp[1] <= 50 && !/^(reai|rea|dia|hora|vez|parcela)$/.test(qp[2])) { r.valor = Math.round(+qp[1] * num(qp[3]) * 100) / 100; r._item = qp[1] + ' ' + qp[2] + 's de ' + qp[3]; }
    var cent = tv.match(/(?:reais|real)\s+e\s+(\d{1,2})\s+centavos?/); if (cent && r.valor) r.valor = Math.round((Math.floor(r.valor) + (+cent[1]) / 100) * 100) / 100;
    // --- datas que dependem do tipo ---
    var futuro = r.tipo === 'conta' || r.tipo === 'horario';
    if (r._diaFixo) {
      var f = r._diaFixo, dt = new Date(f.ano, f.mes, f.d, 12);
      if (!f.mesDito && futuro && iso(dt) < hojeIso) dt = new Date(f.ano, f.mes + 1, f.d, 12);
      if (!f.mesDito && !futuro && iso(dt) > hojeIso) dt = new Date(f.ano, f.mes - 1, f.d, 12);
      r.data = iso(dt);
    } else if (r._semana != null) {
      var bd = deIso(hojeIso), dif = (r._semana - bd.getDay() + 7) % 7;
      if (futuro) { if (dif === 0) dif = 7; r.data = soma(hojeIso, dif); } else r.data = soma(hojeIso, dif === 0 ? 0 : dif - 7);
    }
    delete r._diaFixo; delete r._semana;
    if (r.tipo === 'conta' && /\b(todo mes|mensal|todos os meses|todo dia \d+)\b/.test(t)) r.rec = 'mensal';
    if (r.tipo === 'conta' && /\b(toda semana|semanal)\b/.test(t)) r.rec = 'semanal';
    // --- categoria e descrição ---
    CATS.forEach(function (c) { var m = t.match(c[1]); if (m && !r.cat) { r.cat = c[0]; r.desc = c[2][m[1]] || (r.tipo === 'despesa' && c[0] !== 'mercadoria' ? cap(m[1]) : ''); } });
    var cd = orig.match(/\b(?:conta|boleto|fatura|parcela)\s+(?:d[aoe]\s+)([^\d,.;]+?)(?=\s+(?:de\s+)?(?:r\$|\d|dia|vence|no|na|pra|para|ate|todo|$))/i);
    if (cd && (r.tipo === 'conta' || r.tipo === 'despesa')) r.desc = cap(cd[1].trim());
    if (r.tipo === 'despesa' && !r.desc) { var cm = orig.match(/\b(?:comprei|gastei(?:\s+\S+)?\s+(?:com|de|em|no|na)|paguei\s+(?:o|a|os|as))\s+([^\d,.;]+?)(?=\s+(?:r\$|\d|por|de \d|no pix|em dinheiro|dia|hoje|ontem|$))/i); if (cm) r.desc = cap(cm[1].trim()); }
    if (r.tipo === 'conta' && !r.cat) r.cat = 'outros';
    if (r.tipo === 'despesa' && !r.cat) r.cat = 'outros';
    var sv = t.match(SERV); if (sv) r.serv = cap(sv[1]);
    if (r.tipo === 'venda' && !r.desc) {
      var PARA = /^(no|na|pra|pro|para|em|de|do|da|ontem|hoje|amanha|reais|real|fiado|pix|dinheiro|cartao|debito|credito|r|um|uma)$/;
      var vd = sa(orig).match(/\b(?:vendi|fiz)\s+(?:um|uma|o|a)\s+([a-z]{3,})/);
      if (r._item) r.desc = r._item;
      else if (r.serv) r.desc = r.serv;
      else if (vd && !PARA.test(vd[1])) r.desc = cap(vd[1]);
    }
    delete r._item;
    // --- nome da pessoa ---
    var nm = orig.match(/\b(?:pro|pra|para|para o|para a|do|da|com o|com a|marca|marcar|agenda|agendar|encaixa|encaixar|cliente|o cliente|a cliente)\s+(?:o\s+|a\s+|seu\s+|dona\s+|sr\.?\s+|sra\.?\s+)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)/);
    if (nm && !/^(Pix|Dinheiro|Cartao|Cartão|Debito|Débito|Credito|Crédito|Hoje|Amanha|Amanhã|Ontem|Dia)$/.test(nm[1])) r.nome = nm[1];
    if (!r.nome) {
      var NAO = /^(Pix|Dinheiro|Cartao|Cartão|Debito|Débito|Credito|Crédito|Hoje|Amanha|Amanhã|Ontem|Dia|Conta|Luz|DAS|Das|MEI|Mei|iFood|Ifood|Real|Reais|Segunda|Terça|Terca|Quarta|Quinta|Sexta|Sábado|Sabado|Domingo|Janeiro|Fevereiro|Março|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)$/;
      var re2 = /(^|\s)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)/g, mm;
      while ((mm = re2.exec(orig))) { if (mm.index === 0 && !mm[1]) continue; var w = mm[2].split(/\s+/).filter(function (x) { return !NAO.test(x); }).join(' '); if (w) { r.nome = w; break; } }
    }
    if (!r.nome && r.tipo === 'horario') {
      var lm = sa(orig).match(/\b(?:marca|marcar|agenda|agendar|encaixa|encaixar)\s+(?:o\s+|a\s+|pro\s+|pra\s+)?([a-z]{2,})\b/);
      if (lm && !/^(hoje|amanha|horario|um|uma|dia|pra|pro|as|corte|barba|unha|escova|segunda|terca|quarta|quinta|sexta|sabado|domingo)$/.test(lm[1])) r.nome = cap(lm[1]);
    }
    if (!r.nome && nomesConhecidos && nomesConhecidos.length) {
      var ts = ' ' + sa(orig) + ' ';
      nomesConhecidos.forEach(function (n) { if (!r.nome && n && ts.indexOf(' ' + sa(n) + ' ') >= 0) r.nome = n; });
    }
    if (r.forma === 'fiado' && r.tipo !== 'venda') r.forma = '';
    return r;
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  var api = { entender: entender, palavrasParaNumeros: palavrasParaNumeros };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---------- 2. tela ----------
  var K = window.MNCK; if (!K) return;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = K.esc, brl = K.brl, toast = K.toast, uid = K.uid, hoje = K.hoje, dm = K.dm, diaRel = K.diaRel;
  function E() { return K.E(); }
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var TIPOS = { venda: '💰 Venda', despesa: '🧾 Despesa', retirada: '🏠 Pra casa', receb: '🤝 Fiado pago', conta: '📅 Conta a pagar', horario: '✂️ Horário' };
  var FORMAS = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito', ifood: 'iFood', fiado: 'Fiado' };
  var EXEMPLOS = ['vendi 50 no pix pro João', 'gastei 120 de mercadoria no dinheiro', 'conta de luz 180 reais dia 10', 'marca a Maria amanhã às 3 pra corte', 'o Pedro levou 35 fiado', 'tirei 200 pra casa'];

  function salvarRes(r) {
    var x = E();
    if (r.tipo === 'venda' || r.tipo === 'despesa' || r.tipo === 'retirada') {
      var m = { id: uid(), data: r.data, tipo: r.tipo, valor: r.valor, forma: r.tipo === 'venda' ? r.forma : '', nat: K.natPadrao(), nf: false, cli: null, venc: '', desc: r.desc || '', cat: r.tipo === 'despesa' ? (r.cat || 'outros') : '' };
      if (r.tipo === 'venda' && r.forma === 'fiado') {
        var c = null, k = r.nome.trim().toLowerCase();
        x.cli.forEach(function (y) { if (y.nome.toLowerCase() === k) c = y; });
        if (!c) { c = { id: uid(), nome: r.nome.trim(), fone: '', criado: hoje() }; x.cli.push(c); }
        m.cli = c.id; m.venc = K.somaDias(r.data, 15);
      } else if (r.tipo === 'venda' && r.nome && !r.desc) m.desc = r.nome;
      x.mov.push(m); return 'Lançado ✓';
    }
    if (r.tipo === 'receb') {
      x.mov.push({ id: uid(), data: r.data, tipo: 'receb', valor: r.valor, forma: r.forma === 'fiado' ? 'pix' : (r.forma || 'pix'), cli: r.cliId, desc: '' });
      return 'Recebido ✓ O fiado de ' + K.cliente(r.cliId).nome + ' foi abatido.';
    }
    if (r.tipo === 'conta') {
      x.contas = x.contas || [];
      x.contas.push({ id: uid(), desc: r.desc || 'Conta', valor: r.valor, venc: r.data, cat: r.cat || 'outros', rec: r.rec || 'nao', pago: null, obs: '' });
      return 'Conta salva. Vou te avisar perto do vencimento ✓';
    }
    if (r.tipo === 'horario') {
      var cc = null; if (r.nome) x.cli.forEach(function (y) { if (y.nome.toLowerCase() === r.nome.trim().toLowerCase()) cc = y; });
      x.ag.push({ id: uid(), data: r.data, hora: r.hora, cliNome: r.nome.trim(), fone: cc ? cc.fone : '', cli: cc ? cc.id : null, serv: r.serv || '', valor: r.valor || 0, sinal: 0, sinalPago: false, status: 'marcado', lembrado: false });
      return 'Horário marcado ✓';
    }
  }
  function falta(r) {
    if (!r.tipo) return 'Não entendi se é venda, despesa, conta ou horário. Escolha abaixo.';
    if (r.tipo !== 'horario' && !(r.valor > 0)) return 'Faltou o valor.';
    if (r.tipo === 'venda' && !r.forma) return 'Como recebeu? Escolha abaixo.';
    if (r.tipo === 'venda' && r.forma === 'fiado' && !r.nome.trim()) return 'Fiado para quem? Escreva o nome.';
    if (r.tipo === 'receb' && !r.cliId) return 'Escolha quem pagou.';
    if (r.tipo === 'receb' && !r.forma) return 'Como recebeu?';
    if (r.tipo === 'horario' && !r.nome.trim()) return 'Para quem é o horário?';
    if (r.tipo === 'horario' && !r.hora) return 'Faltou a hora.';
    return '';
  }
  function cartao(r) {
    var h = '<div class="card" style="margin-top:14px;border:2px solid var(--mint)"><p class="muted peq">Entendi assim. Confira e ajuste se precisar:</p>' +
      '<div class="chips" style="margin-top:10px">' + Object.keys(TIPOS).map(function (k) { return '<button class="chip ' + (r.tipo === k ? 'on' : '') + '" data-ft="' + k + '">' + TIPOS[k] + '</button>'; }).join('') + '</div>';
    if (r.tipo) {
      if (r.tipo !== 'horario' || r.valor) h += '<label class="campo"><span>Valor</span><input class="inp" id="fValor" inputmode="decimal" value="' + (r.valor ? String(r.valor.toFixed(2)).replace('.', ',') : '') + '" placeholder="R$ 0,00"></label>';
      if (r.tipo === 'receb') {
        var dv = K.devedores();
        if (!r.cliId && r.nome) dv.forEach(function (x) { if (!r.cliId && sa(x.c.nome).indexOf(sa(r.nome)) === 0) r.cliId = x.c.id; });
        h += '<p style="font-weight:600;font-size:14.5px;margin-top:12px">Quem pagou?</p>' + (dv.length ? '<div class="chips" style="margin-top:8px">' + dv.map(function (x) { return '<button class="chip ' + (r.cliId === x.c.id ? 'on' : '') + '" data-fc="' + x.c.id + '">' + esc(x.c.nome) + ' · ' + brl(x.s.total) + '</button>'; }).join('') + '</div>' : '<p class="peq muted" style="margin-top:6px">Ninguém está devendo no app agora.</p>');
      }
      if (r.tipo === 'venda' || r.tipo === 'receb') h += '<p style="font-weight:600;font-size:14.5px;margin-top:12px">Como recebeu?</p><div class="chips" style="margin-top:8px">' + Object.keys(FORMAS).filter(function (k) { return r.tipo === 'venda' || k !== 'fiado'; }).map(function (k) { return '<button class="chip ' + (r.forma === k ? 'on' : '') + '" data-ff="' + k + '">' + FORMAS[k] + '</button>'; }).join('') + '</div>';
      if (r.tipo === 'horario' || (r.tipo === 'venda' && (r.forma === 'fiado' || r.nome))) h += '<label class="campo"><span>' + (r.tipo === 'horario' ? 'Cliente' : r.forma === 'fiado' ? 'Quem vai pagar depois' : 'Cliente (opcional)') + '</span><input class="inp" id="fNome" value="' + esc(r.nome) + '" autocomplete="off"></label>';
      if (r.tipo === 'horario') h += '<div class="grade"><label class="campo"><span>Dia</span><input class="inp" type="date" id="fData" value="' + r.data + '"></label><label class="campo"><span>Hora</span><input class="inp" type="time" id="fHora" value="' + r.hora + '"></label></div><label class="campo"><span>Serviço (opcional)</span><input class="inp" id="fServ" value="' + esc(r.serv) + '"></label>';
      else h += '<label class="campo"><span>' + (r.tipo === 'conta' ? 'Vence em' : 'Data') + '</span><input class="inp" type="date" id="fData" value="' + r.data + '"></label>';
      if (r.tipo !== 'horario' && r.tipo !== 'receb') h += '<label class="campo"><span>' + (r.tipo === 'conta' ? 'O que é' : 'Descrição (opcional)') + '</span><input class="inp" id="fDesc" value="' + esc(r.desc) + '" autocomplete="off"></label>';
      if (r.tipo === 'conta') h += '<label class="check"><input type="checkbox" id="fRec" ' + (r.rec === 'mensal' ? 'checked' : '') + '> Repete todo mês</label>';
    }
    var aviso = falta(r);
    h += (aviso ? '<p class="peq" style="margin-top:10px;color:var(--red)">' + esc(aviso) + '</p>' : '') +
      '<button class="btn mint cheio" style="margin-top:14px" id="fOk">Confirmar e lançar</button></div>';
    return h;
  }
  function abrir() {
    var r = null, rec = null, ouvindo = false;
    var nomes = E().cli.map(function (c) { return c.nome; });
    var html = '<h1>Fale o que aconteceu</h1><p class="muted" style="margin-top:4px">Do jeito que você falaria para alguém. Eu entendo e lanço.</p>' +
      (SR ? '<button class="btn cheio" id="fMic" style="margin-top:14px;min-height:64px;font-size:19px">🎤 Toque e fale</button><p class="peq muted" id="fEstado" style="margin-top:6px;text-align:center"></p>'
        : '<div class="dica" style="margin-top:12px">Neste celular, toque no campo abaixo e use o <b>microfone do teclado</b> 🎤 para falar.</div>') +
      '<label class="campo"><span>' + (SR ? 'Ou escreva' : 'Fale pelo teclado ou escreva') + '</span><textarea class="inp" id="fTexto" rows="2" placeholder="Ex.: vendi 50 no pix pro João" style="min-height:64px"></textarea></label>' +
      '<button class="btn linha cheio" id="fEnt" style="margin-top:8px">Entender</button><div id="fRes"></div>' +
      '<details class="como"><summary>Exemplos do que dá para falar</summary><ul>' + EXEMPLOS.map(function (e) { return '<li><a href="#" data-ex="' + esc(e) + '">' + esc(e) + '</a></li>'; }).join('') + '</ul></details>';
    var f = K.abrirFolha(html);
    function mostrar(rolar) { $('#fRes', f).innerHTML = r ? cartao(r) : ''; ligar(); if (rolar) { var c = $('#fRes .card', f); if (c && c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
    function ler() {
      if (!r) return;
      var v = $('#fValor', f); if (v) r.valor = K.arred(K.num(v.value));
      var n = $('#fNome', f); if (n) r.nome = n.value;
      var d = $('#fData', f); if (d && d.value) r.data = d.value;
      var ho = $('#fHora', f); if (ho) r.hora = ho.value;
      var s = $('#fServ', f); if (s) r.serv = s.value;
      var de = $('#fDesc', f); if (de) r.desc = de.value;
      var rc = $('#fRec', f); if (rc) r.rec = rc.checked ? 'mensal' : 'nao';
    }
    function ligar() {
      $$('[data-ft]', f).forEach(function (b) { b.onclick = function () { ler(); r.tipo = b.dataset.ft; if (r.tipo !== 'venda' && r.forma === 'fiado') r.forma = ''; if ((r.tipo === 'conta' || r.tipo === 'despesa') && !r.cat) r.cat = 'outros'; mostrar(); }; });
      $$('[data-fc]', f).forEach(function (b) { b.onclick = function () { ler(); r.cliId = b.dataset.fc; mostrar(); }; });
      $$('[data-ff]', f).forEach(function (b) { b.onclick = function () { ler(); r.forma = b.dataset.ff; mostrar(); }; });
      var ok = $('#fOk', f); if (ok) ok.onclick = function () {
        ler(); var a = falta(r); if (a) { toast(a); mostrar(); return; }
        var msg = salvarRes(r); K.salvar(); K.track('FalarLancou', { tipo: r.tipo, voz: !!r.voz });
        K.fecharFolha(); K.rotear(); toast(msg);
      };
    }
    function entenderTexto(txt, voz) { r = entender(txt, hoje(), nomes); r.voz = voz; mostrar(true); K.track('FalarEntendeu', { ok: !falta(r), voz: !!voz }); }
    $('#fEnt', f).onclick = function () { var t = $('#fTexto', f).value.trim(); if (!t) { toast('Fale ou escreva uma frase.'); return; } entenderTexto(t, false); };
    $$('[data-ex]', f).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); $('#fTexto', f).value = a.dataset.ex; entenderTexto(a.dataset.ex, false); }; });
    if (SR) $('#fMic', f).onclick = function () {
      var bt = this, st = $('#fEstado', f);
      if (ouvindo && rec) { rec.stop(); return; }
      if (!navigator.onLine) { st.textContent = 'Sem internet: escreva a frase abaixo.'; return; }
      rec = new SR(); rec.lang = 'pt-BR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      var final = '';
      rec.onstart = function () { ouvindo = true; bt.textContent = '⏹ Ouvindo… toque para parar'; st.textContent = 'Pode falar.'; };
      rec.onresult = function (ev) {
        var txt = ''; for (var i = 0; i < ev.results.length; i++) { txt += ev.results[i][0].transcript; if (ev.results[i].isFinal) final = txt; }
        $('#fTexto', f).value = txt;
      };
      rec.onerror = function (ev) { st.textContent = ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'Permita o microfone para este site, ou use o microfone do teclado.' : ev.error === 'no-speech' ? 'Não ouvi nada. Tente de novo, mais perto do celular.' : 'Não deu para ouvir agora. Escreva a frase abaixo.'; };
      rec.onend = function () { ouvindo = false; bt.textContent = '🎤 Toque e fale'; var t = (final || $('#fTexto', f).value).trim(); if (t) { st.textContent = ''; entenderTexto(t, true); } };
      try { rec.start(); } catch (e) { st.textContent = 'Não deu para usar o microfone. Escreva a frase abaixo.'; }
    };
  }
  window.MNCX = window.MNCX || {};
  window.MNCX.falar = { abrir: abrir, entender: entender };
})();

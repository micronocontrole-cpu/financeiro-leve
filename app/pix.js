/* Pix "copia e cola" (BR Code estático, padrão EMV do Banco Central) — Micro no Controle
   Gera o código com valor e identificador. Roda no navegador e no Node (testes). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pix = factory();
})(this, function () {
  'use strict';

  function semAcento(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function campo(id, valor) {
    valor = String(valor);
    var tam = new TextEncoder().encode(valor).length;
    return id + (tam < 10 ? '0' : '') + tam + valor;
  }
  // CRC16-CCITT (polinômio 0x1021, início 0xFFFF)
  function crc16(s) {
    var bytes = new TextEncoder().encode(s), crc = 0xFFFF;
    for (var i = 0; i < bytes.length; i++) {
      crc ^= bytes[i] << 8;
      for (var b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
  }

  // Normaliza a chave conforme o tipo escolhido pelo usuário
  // tipo: 'cpf' | 'cnpj' | 'celular' | 'email' | 'aleatoria'
  function normalizarChave(chave, tipo) {
    var c = String(chave || '').trim();
    if (tipo === 'cpf' || tipo === 'cnpj') return c.replace(/\D/g, '');
    if (tipo === 'celular') {
      var d = c.replace(/\D/g, '').replace(/^0+/, '');
      // "0 + operadora + DDD + número" (ex.: 0 21 61 99999-8888): tira o código da operadora
      if ((d.length === 12 || d.length === 13) && !/^55/.test(d) && /^0/.test(c.replace(/\D/g, ''))) d = d.slice(2);
      if (d.length === 10 || d.length === 11) d = '55' + d;
      return '+' + d;
    }
    if (tipo === 'email') return c.toLowerCase();
    return c.toLowerCase();
  }

  function validarChave(chave, tipo) {
    var c = normalizarChave(chave, tipo);
    if (tipo === 'cpf') return c.length === 11 ? '' : 'CPF precisa ter 11 números.';
    if (tipo === 'cnpj') return c.length === 14 ? '' : 'CNPJ precisa ter 14 números.';
    if (tipo === 'celular') return /^\+55\d{10,11}$/.test(c) ? '' : 'Celular com DDD, ex.: (61) 99999-9999.';
    if (tipo === 'email') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) ? '' : 'E-mail inválido.';
    if (tipo === 'aleatoria') return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(c) ? '' : 'Chave aleatória tem o formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.';
    return 'Escolha o tipo da chave.';
  }

  function limpar(s, max) {
    return semAcento(s).replace(/[^A-Za-z0-9 .\-]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max).trim();
  }

  // opts: { chave, tipo, nome, cidade, valor (número), txid, mensagem }
  function gerar(opts) {
    var chave = normalizarChave(opts.chave, opts.tipo);
    var conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave);
    // Sem o subcampo 02 (mensagem): alguns bancos recusam Pix estático com ele.
    var txid = String(opts.txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
    var p = campo('00', '01') +
      campo('26', conta) +
      campo('52', '0000') +
      campo('53', '986');
    if (opts.valor && +opts.valor > 0) p += campo('54', (+opts.valor).toFixed(2));
    p += campo('58', 'BR') +
      campo('59', limpar(opts.nome, 25) || 'RECEBEDOR') +
      campo('60', limpar(opts.cidade, 15) || 'BRASIL') +
      campo('62', campo('05', txid)) +
      '6304';
    return p + crc16(p);
  }

  // Lê um BR Code (para testes e para conferir)
  function ler(codigo) {
    var out = {}, i = 0;
    while (i < codigo.length - 4) {
      var id = codigo.substr(i, 2), tam = +codigo.substr(i + 2, 2);
      out[id] = codigo.substr(i + 4, tam);
      i += 4 + tam;
    }
    out.crcOk = crc16(codigo.slice(0, -4)) === codigo.slice(-4);
    return out;
  }

  return { gerar: gerar, ler: ler, crc16: crc16, normalizarChave: normalizarChave, validarChave: validarChave };
});

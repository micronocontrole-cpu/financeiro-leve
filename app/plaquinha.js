/* Micro no Controle — Plaquinha de balcão (avaliação no Google + Pix)
   Gera uma imagem A6 pronta para imprimir na gráfica e colocar num display de acrílico.
   Usa qrcode (vendor/qrcode.js) e Pix (pix.js), tudo no aparelho: nada é enviado. */
(function () {
  'use strict';
  var K = window.MNCK; if (!K || !window.qrcode) return;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = K.esc, toast = K.toast, R = K.ROTAS;
  var CORES = { verde: ['#0E3B3C', '#22C3A6'], preto: ['#151515', '#FFCF3A'], vinho: ['#5B1A2B', '#F2B8C6'], azul: ['#123B6B', '#7CC4FF'] };
  var KEY = 'mnc-plaquinha';
  function ler() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function gravar(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

  function qr(g, texto, x, y, lado) {
    var q = qrcode(0, 'M'); q.addData(texto); q.make();
    var n = q.getModuleCount(), cel = lado / (n + 4);
    g.fillStyle = '#fff'; g.fillRect(x, y, lado, lado); g.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(Math.floor(x + (c + 2) * cel), Math.floor(y + (r + 2) * cel), Math.ceil(cel), Math.ceil(cel));
  }
  function quebra(g, txt, max) {
    var ps = String(txt).split(' '), linhas = [], l = '';
    ps.forEach(function (p) { var t = l ? l + ' ' + p : p; if (g.measureText(t).width > max && l) { linhas.push(l); l = p; } else l = t; });
    if (l) linhas.push(l); return linhas;
  }
  /* A6 em 300 dpi: 1240 x 1748 */
  function desenhar(d) {
    var W = 1240, H = 1748, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), cor = CORES[d.cor] || CORES.verde, temPix = !!d.pix, temGoogle = !!d.google;
    g.fillStyle = cor[0]; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = '800 92px system-ui, sans-serif';
    var nome = quebra(g, d.nome || 'Seu negócio', W - 160), y = 190;
    nome.slice(0, 2).forEach(function (l) { g.fillText(l, W / 2, y); y += 104; });
    var blocos = (temGoogle ? 1 : 0) + (temPix ? 1 : 0);
    var lado = blocos === 2 ? 400 : 640, topo = y + 40;
    function bloco(titulo, sub, texto, cx, cy) {
      g.fillStyle = cor[1]; g.font = '800 58px system-ui, sans-serif'; g.fillText(titulo, cx, cy);
      g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '500 38px system-ui, sans-serif'; g.fillText(sub, cx, cy + 56);
      var x = cx - lado / 2, yy = cy + 96;
      g.fillStyle = '#fff'; roundRect(g, x - 24, yy - 24, lado + 48, lado + 48, 36); g.fill();
      qr(g, texto, x, yy, lado);
      return yy + lado + 24;
    }
    var fim = topo;
    if (blocos === 2) {
      var f1 = bloco('Gostou?', 'Avalie a gente no Google', d.google, W / 2, topo + 40);
      fim = bloco('Pague com Pix', 'Aponte a câmera do celular', d.pixCodigo, W / 2, f1 + 90);
    } else if (temGoogle) fim = bloco('Gostou do atendimento?', 'Avalie a gente no Google ★★★★★', d.google, W / 2, topo + 60);
    else if (temPix) fim = bloco('Pague com Pix', 'Aponte a câmera do celular', d.pixCodigo, W / 2, topo + 60);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '600 40px system-ui, sans-serif';
    var rod = [d.nfc ? 'Ou aproxime o celular aqui' : '', d.insta ? '@' + d.insta.replace(/^@/, '') : ''].filter(Boolean).join('   ·   ');
    if (rod) g.fillText(rod, W / 2, H - 80);
    return cv;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  R.plaquinha = function () {
    var E = K.E(), s = ler(), p = (E.neg && E.neg.pix) || {};
    var temPixApp = !!(p.chave && p.tipo);
    var html = K.topo('Plaquinha de balcão', 'Avaliação no Google e Pix', '#/biblioteca') + '<main>' +
      '<div class="card"><p class="sub" style="margin:0">Monte a plaquinha, baixe a imagem e mande imprimir na gráfica (tamanho A6, 10,5 × 14,8 cm). Depois é só colocar num display de acrílico no balcão ou na mesa.</p></div>' +
      '<div class="card">' +
      '<label class="campo"><span>Nome do negócio</span><input class="inp" id="pqNome" value="' + esc(s.nome || (E.neg && E.neg.nome) || '') + '"></label>' +
      '<label class="campo"><span>Link de avaliação do Google</span><input class="inp" id="pqGoogle" inputmode="url" placeholder="https://g.page/r/..." value="' + esc(s.google || '') + '"></label>' +
      '<p class="sub" style="margin:4px 0 10px">Onde achar: no Google, abra o seu perfil, toque em <b>Pedir avaliações</b> e copie o link.</p>' +
      '<label class="campo" style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="pqPix"' + (temPixApp ? (s.pix === false ? '' : ' checked') : ' disabled') + '> <span>Incluir o Pix do negócio' + (temPixApp ? '' : ' (cadastre a chave em Mais › Meu negócio)') + '</span></label>' +
      '<label class="campo"><span>Instagram (opcional)</span><input class="inp" id="pqInsta" placeholder="@seunegocio" value="' + esc(s.insta || '') + '"></label>' +
      '<label class="campo"><span>Cor</span><select class="inp" id="pqCor">' + Object.keys(CORES).map(function (c) { return '<option value="' + c + '"' + (s.cor === c ? ' selected' : '') + '>' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>'; }).join('') + '</select></label>' +
      '<label class="campo" style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="pqNfc"' + (s.nfc ? ' checked' : '') + '> <span>Vou colar uma tag NFC atrás (aproximar o celular)</span></label>' +
      '<button class="btn" style="width:100%;margin-top:8px" id="pqGerar">Ver a plaquinha</button></div>' +
      '<div class="card" id="pqPrev" hidden><img id="pqImg" alt="Prévia da plaquinha" style="width:100%;border-radius:12px"><button class="btn mint" style="width:100%;margin-top:10px" id="pqBaixar">Baixar para imprimir</button></div>' +
      '<div class="card"><b>Passo a passo</b><ol style="margin:8px 0 0 20px;font-size:15px;line-height:1.6">' +
      '<li>Baixe a imagem e leve na gráfica: peça <b>A6 em papel couché 250 g</b> ou <b>adesivo vinil</b>.</li>' +
      '<li>Compre um <b>display de acrílico A6</b> (porta-folheto de mesa) em papelaria ou na internet.</li>' +
      '<li>Opcional: compre uma <b>tag NFC adesiva (NTAG213)</b>. Grave o link de avaliação nela com um app gratuito de NFC e cole atrás do papel, dentro do acrílico. Quem aproximar o celular abre a página de avaliação.</li>' +
      '<li>Teste com o seu celular antes de deixar no balcão.</li></ol></div>' +
      '<p class="rodape">Micro no Controle · soluções com sabedoria</p></main>';
    return {
      html: html,
      montar: function (el) {
        var cv = null;
        $('#pqGerar', el).onclick = function () {
          var d = { nome: $('#pqNome', el).value.trim(), google: $('#pqGoogle', el).value.trim(), insta: $('#pqInsta', el).value.trim(), cor: $('#pqCor', el).value, nfc: $('#pqNfc', el).checked, pix: $('#pqPix', el).checked };
          if (d.google && !/^https?:\/\//i.test(d.google)) { toast('O link do Google começa com https://'); return; }
          if (d.pix) { try { d.pixCodigo = Pix.gerar({ chave: p.chave, tipo: p.tipo, nome: p.nome || E.neg.nome, cidade: p.cidade || 'BRASIL' }); } catch (e) { d.pix = false; } }
          if (!d.google && !d.pix) { toast('Coloque o link do Google ou inclua o Pix.'); return; }
          gravar({ nome: d.nome, google: d.google, insta: d.insta, cor: d.cor, nfc: d.nfc, pix: d.pix });
          cv = desenhar(d); $('#pqImg', el).src = cv.toDataURL('image/png'); $('#pqPrev', el).hidden = false;
          $('#pqPrev', el).scrollIntoView({ behavior: 'smooth' });
          K.track && K.track('plaquinha_gerada', { google: !!d.google, pix: !!d.pix });
        };
        $('#pqBaixar', el).onclick = function () {
          if (!cv) return; var a = document.createElement('a'); a.download = 'plaquinha-balcao-A6.png'; a.href = cv.toDataURL('image/png'); a.click();
        };
      }
    };
  };
})();

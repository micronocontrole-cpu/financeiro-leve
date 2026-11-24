/* Micro no Controle — recebe os pedidos de conferência e de diagnóstico.
   Roda na Cloudflare (Pages Functions). Valida os dados, grava na planilha de pedidos
   (Google Forms) e só responde "ok" quando a gravação foi confirmada.
   Se o e-mail vier, também inscreve na lista de dicas (MailerLite). */

const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLScRL147-f6i2sMMDthBvpYteGqikdibLo4RLEtBQlon4VTEeA/formResponse';
const E = { nome: 'entry.904971888', email: 'entry.772389020', whatsapp: 'entry.712925562', tipo: 'entry.1443340015', origem: 'entry.1160383430' };
const MAILERLITE = 'https://assets.mailerlite.com/jsonp/2741459/forms/202329636930062083/subscribe';
const TIPOS = ['Lanchonete, restaurante ou delivery', 'Salão, barbearia ou manicure', 'Comércio ou loja', 'Serviços', 'Outro'];
const DDD = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99]);

function resposta(dados, status) {
  return new Response(JSON.stringify(dados), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function limpa(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }

export function validar(d) {
  const nome = limpa(d.nome, 80);
  let zap = limpa(d.whatsapp, 30).replace(/\D/g, '');
  if (zap.length >= 12 && zap.startsWith('55')) zap = zap.slice(2);
  const email = limpa(d.email, 120);
  if (nome.length < 2) return { erro: 'Digite seu nome.' };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { erro: 'Confira o e-mail.' };
  if (!zap && !email) return { erro: 'Confira o WhatsApp com DDD.' };
  if (zap) {
    if (zap.length < 10 || zap.length > 11 || !DDD.has(Number(zap.slice(0, 2)))) return { erro: 'Confira o WhatsApp com DDD.' };
    if (zap.length === 11 && zap[2] !== '9') return { erro: 'Confira o WhatsApp com DDD.' };
  }
  const tipo = TIPOS.includes(d.tipo) ? d.tipo : 'Outro';
  const zapFmt = zap ? '(' + zap.slice(0, 2) + ') ' + zap.slice(2, zap.length - 4) + '-' + zap.slice(-4) : 'não informado';
  return { nome, zap: zapFmt, email, tipo, origem: limpa(d.origem, 400) };
}

export async function onRequestPost({ request }) {
  let d;
  try { d = await request.json(); } catch (e) { return resposta({ ok: false, erro: 'Não entendi os dados enviados.' }, 400); }
  if (d && d.site) return resposta({ ok: true }); // campo escondido: robô
  const v = validar(d || {});
  if (v.erro) return resposta({ ok: false, erro: v.erro }, 400);

  const corpo = new URLSearchParams();
  corpo.append(E.nome, v.nome);
  corpo.append(E.email, v.email || 'sem-email@micronocontrole.com');
  corpo.append(E.whatsapp, v.zap);
  corpo.append(E.tipo, v.tipo);
  corpo.append(E.origem, v.origem || 'site');

  let gravou = false;
  try {
    const r = await fetch(FORM, { method: 'POST', body: corpo, headers: { 'content-type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });
    gravou = r.status >= 200 && r.status < 400;
  } catch (e) { gravou = false; }

  if (gravou && v.email) {
    try {
      const m = new URLSearchParams();
      m.append('fields[email]', v.email); m.append('fields[name]', v.nome); m.append('ml-submit', '1'); m.append('anticsrf', 'true');
      await fetch(MAILERLITE, { method: 'POST', body: m });
    } catch (e) { /* a lista de e-mail é opcional */ }
  }
  if (!gravou) return resposta({ ok: false, erro: 'Não conseguimos registrar agora.' }, 502);
  return resposta({ ok: true });
}

export function onRequestGet() { return resposta({ ok: true, servico: 'pedidos' }); }

const f=require('../app/falar.js');
const H='2026-11-18'; // quarta
const C=[
'vendi 50 no pix pro João','gastei 120 de mercadoria no dinheiro','conta de luz 180 reais dia 10','marca a Maria amanhã às 3 pra corte',
'o Pedro levou 35 fiado','tirei 200 pra casa','vendi um corte de 45 no débito','recebi 1.250,50 no pix','paguei o aluguel 900',
'boleto do fornecedor 340 vence sexta','agenda o Carlos sexta 10h barba','vendi cinquenta reais no dinheiro','vendi cento e vinte e cinco no crédito',
'comprei esmalte 60 reais','fiz uma escova 80 pix','das do mei 76,90 todo mês dia 20','marcar Ana dia 25 às 14:30 manicure',
'vendi 30 ontem no pix','vendi 3 lanches de 15 no pix','Entrou 70 de pix','conta de internet 99,90 dia 5 todo mês','vendi 40 pra Dona Rosa fiado',
'marca o Zé hoje 4 e meia','gastei 50 de gasolina','vendi 200 no cartão'];
for(const c of C){const r=f.entender(c,H,['Rosa','João']);console.log(c.padEnd(48),'|',r.tipo,r.valor,r.forma,'|',r.nome,'|',r.data,r.hora,'|',r.cat,r.desc,r.rec,r.serv);}
console.log('---');
for(const c of ['vendi R$ 50 no Pix pro João','marca a joana às 15h','vendi 2 cortes a 40 no pix','gastei 50 de gasolina','paguei 35 de luz','vendi 15,50 no débito','marca amanhã às 9 a Bia escova','recebi 80 do João que tava devendo','gastei 1250 de material dia 3','conta de água 80 dia 25 de dezembro']){const r=f.entender(c,H,['João']);console.log(c.padEnd(48),'|',r.tipo,r.valor,r.forma,'|',r.nome,'|',r.data,r.hora,'|',r.cat,r.desc,r.rec,r.serv);}

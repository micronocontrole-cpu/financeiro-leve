// Micro no Controle — comportamento comum do site
(function(){
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toque = matchMedia('(hover: none)').matches;

  // Inclinação 3D: o objeto segue o mouse dentro da sua área ([data-tilt-area] ou o pai)
  if(!calmo && !toque){
    document.querySelectorAll('[data-tilt]').forEach(el=>{
      const area = el.closest('[data-tilt-area]') || el.parentElement;
      const max = parseFloat(el.dataset.tilt) || 10;
      area.addEventListener('pointermove', e=>{
        const r = area.getBoundingClientRect();
        const x = (e.clientX - r.left)/r.width - .5, y = (e.clientY - r.top)/r.height - .5;
        el.classList.add('vivo');
        el.style.setProperty('--ry', (x*max*2).toFixed(2)+'deg');
        el.style.setProperty('--rx', (-y*max*2).toFixed(2)+'deg');
        const er = el.getBoundingClientRect();
        el.style.setProperty('--gx', ((e.clientX-er.left)/er.width*100).toFixed(1)+'%');
        el.style.setProperty('--gy', ((e.clientY-er.top)/er.height*100).toFixed(1)+'%');
        el.style.setProperty('--go', 1);
      });
      area.addEventListener('pointerleave', ()=>{
        el.classList.remove('vivo');
        el.style.setProperty('--rx','0deg'); el.style.setProperty('--ry','0deg'); el.style.setProperty('--go',0);
      });
    });
  }

  // Cupom do herói: as linhas "imprimem" uma vez ao carregar (único movimento automático da página)
  const cup = document.querySelector('[data-imprime]');
  if(cup){
    const linhas = [...cup.querySelectorAll('.l, hr, .falta')];
    const carimbo = cup.querySelector('.carimbo');
    if(calmo){ return; }
    linhas.forEach(l=>l.style.opacity=0); if(carimbo){carimbo.style.opacity=0}
    let i = 0;
    const passo = ()=>{
      if(i < linhas.length){ linhas[i].style.transition='opacity .25s'; linhas[i].style.opacity=1; i++; setTimeout(passo, 230); }
      else if(carimbo){
        carimbo.animate([{opacity:0,transform:'rotate(-10deg) translateZ(40px) scale(2.2)'},{opacity:1,transform:'rotate(-10deg) translateZ(40px) scale(1)'}],
          {duration:380,easing:'cubic-bezier(.2,1.4,.4,1)',fill:'forwards'});
      }
    };
    setTimeout(passo, 500);
  }
})();

// Utilitários das ferramentas
window.MNC = {
  brl(v){ return (isFinite(v)?v:0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); },
  num(v,d=2){ return (isFinite(v)?v:0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}); },
  pct(v,d=2){ return MNC.num(v*100,d)+'%'; },
  // aceita "1.250,50", "1250.5", "R$ 1.250"
  ler(s){
    if(typeof s==='number') return s;
    s = String(s||'').replace(/[^\d,.-]/g,'');
    if(!s) return 0;
    if(s.includes(',')) s = s.replace(/\./g,'').replace(',', '.');
    else if((s.match(/\./g)||[]).length>1) s = s.replace(/\./g,'');
    const n = parseFloat(s); return isFinite(n)?n:0;
  },
  campos(form){ const o={}; form.querySelectorAll('input,select').forEach(i=>{ if(i.name) o[i.name] = i.type==='text'||i.inputMode==='decimal' ? MNC.ler(i.value) : i.value; }); return o; },
  ao(form, fn){ const run=()=>fn(MNC.campos(form)); form.addEventListener('input',run); form.addEventListener('change',run); run(); }
};

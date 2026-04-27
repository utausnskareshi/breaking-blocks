// =========================================
// audio.js - Web Audio API based SFX (no external files)
// =========================================
const Audio = (() => {
  let ctx = null;
  let muted = false;
  let masterGain = null;

  function ensure(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(ctx.destination);
    return ctx;
  }

  function resume(){
    ensure();
    if(ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone({freq=440, type='sine', dur=0.12, vol=0.5, slide=0, delay=0}){
    if(muted) return;
    const c = ensure(); if(!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if(slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq+slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({dur=0.15, vol=0.4, filterFreq=1200}){
    if(muted) return;
    const c = ensure(); if(!c) return;
    const buf = c.createBuffer(1, c.sampleRate*dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * (1 - i/data.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=filterFreq;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(masterGain);
    src.start();
  }

  return {
    resume,
    setMuted(v){ muted = !!v; },
    isMuted(){ return muted; },

    // Specific sound effects
    hitBlock(){ tone({freq:520, type:'square', dur:0.08, vol:0.35, slide:-150}); },
    hitTough(){ tone({freq:280, type:'sawtooth', dur:0.07, vol:0.3}); },
    hitSteel(){ tone({freq:160, type:'square', dur:0.05, vol:0.25}); },
    hitPaddle(){ tone({freq:340, type:'triangle', dur:0.07, vol:0.35}); },
    hitWall(){ tone({freq:220, type:'sine', dur:0.04, vol:0.18}); },
    explode(){ noise({dur:0.35, vol:0.5, filterFreq:800}); tone({freq:90, type:'square', dur:0.3, vol:0.3, slide:-50}); },
    item(){
      tone({freq:660, type:'triangle', dur:0.1, vol:0.4});
      tone({freq:880, type:'triangle', dur:0.1, vol:0.4, delay:0.08});
      tone({freq:1100,type:'triangle', dur:0.15, vol:0.4, delay:0.16});
    },
    death(){
      tone({freq:330, type:'sawtooth', dur:0.2, vol:0.4, slide:-200});
      tone({freq:200, type:'sawtooth', dur:0.3, vol:0.4, slide:-150, delay:0.2});
    },
    gameOver(){
      tone({freq:440, type:'square', dur:0.25, vol:0.4, slide:-200});
      tone({freq:330, type:'square', dur:0.25, vol:0.4, slide:-150, delay:0.25});
      tone({freq:220, type:'square', dur:0.5,  vol:0.4, slide:-100, delay:0.5});
    },
    clear(){
      const seq = [523, 659, 784, 1047];
      seq.forEach((f,i)=> tone({freq:f, type:'triangle', dur:0.18, vol:0.45, delay:i*0.1}));
    },
    combo(level){
      const f = 600 + Math.min(level,12)*40;
      tone({freq:f, type:'square', dur:0.06, vol:0.3});
    },
    launch(){ tone({freq:880, type:'triangle', dur:0.08, vol:0.3, slide:300}); },
  };
})();

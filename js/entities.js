// =========================================
// entities.js - Ball, Paddle, Block, Item, Particle
// =========================================

// ---------- Paddle ----------
class Paddle {
  constructor(canvasW, canvasH){
    this.baseW = Math.max(70, canvasW * 0.18);
    this.w = this.baseW;
    this.h = 12;
    this.x = canvasW/2 - this.w/2;
    this.y = canvasH - 50;
    this.targetX = this.x;
    this.maxSpeed = 18;
    this.sticky = false;     // magnet effect
    this.stickyTimer = 0;
    this.longTimer = 0;      // long paddle countdown
  }
  // Reposition only; do NOT recompute baseW/w/h here. Paddle dimensions
  // are intentionally locked at construction so that screen rotations
  // (portrait → landscape → portrait) restore the paddle to its original
  // visual size rather than tracking transient canvas-size variations.
  resize(canvasW, canvasH){
    this.y = canvasH - 50;
    this.x = Math.max(0, Math.min(canvasW - this.w, this.x));
  }
  setTilt(tilt, canvasW){
    // tilt: -1 .. 1 ; map to position with bias toward where user is tilting
    // Use velocity-based for smoother feel
    const center = canvasW/2 - this.w/2;
    this.targetX = center + tilt * (canvasW/2 - this.w/2 - 4);
    const dx = this.targetX - this.x;
    this.x += Math.max(-this.maxSpeed, Math.min(this.maxSpeed, dx * 0.35));
    this.x = Math.max(4, Math.min(canvasW - this.w - 4, this.x));
  }
  applyLong(duration){
    this.longTimer = duration;
    this.w = this.baseW * 1.6;
  }
  applyMagnet(duration){
    this.sticky = true;
    this.stickyTimer = duration;
  }
  tick(dt){
    if(this.longTimer > 0){
      this.longTimer -= dt;
      if(this.longTimer <= 0){ this.w = this.baseW; }
    }
    if(this.stickyTimer > 0){
      this.stickyTimer -= dt;
      if(this.stickyTimer <= 0){ this.sticky = false; }
    }
  }
  draw(ctx){
    const g = ctx.createLinearGradient(0,this.y,0,this.y+this.h);
    g.addColorStop(0, this.sticky ? '#fbbf24' : '#7c5cff');
    g.addColorStop(1, this.sticky ? '#f59e0b' : '#22d3ee');
    ctx.fillStyle = g;
    roundRect(ctx, this.x, this.y, this.w, this.h, 6, true);
    // glow
    ctx.save();
    ctx.shadowColor = this.sticky ? '#fbbf24' : '#22d3ee';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    roundRect(ctx, this.x+2, this.y+2, this.w-4, 3, 2, true);
    ctx.restore();
  }
  getBounds(){ return {x:this.x, y:this.y, w:this.w, h:this.h}; }
}

// ---------- Ball ----------
class Ball {
  constructor(x, y, vx, vy, options={}){
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.r = options.r || 7;
    this.pierce = !!options.pierce;
    this.pierceTimer = options.pierceTimer || 0;
    this.stuck = false;
    this.stuckOffset = 0;
    this.trail = [];
    this.dead = false;
  }
  tick(dt, canvasW){
    if(this.stuck) return;
    if(this.pierceTimer > 0){
      this.pierceTimer -= dt;
      if(this.pierceTimer <= 0){ this.pierce = false; }
    }
    this.x += this.vx;
    this.y += this.vy;

    // wall bounce
    if(this.x - this.r < 0){ this.x = this.r; this.vx = Math.abs(this.vx); Audio.hitWall(); }
    else if(this.x + this.r > canvasW){ this.x = canvasW - this.r; this.vx = -Math.abs(this.vx); Audio.hitWall(); }

    // trail
    this.trail.push({x:this.x, y:this.y});
    if(this.trail.length > 8) this.trail.shift();
  }
  draw(ctx){
    // trail
    for(let i=0;i<this.trail.length;i++){
      const t = this.trail[i];
      const a = (i+1) / this.trail.length;
      ctx.fillStyle = this.pierce ? `rgba(167,139,250,${a*0.4})` : `rgba(255,255,255,${a*0.3})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, this.r * a * 0.9, 0, Math.PI*2); ctx.fill();
    }
    // ball
    const g = ctx.createRadialGradient(this.x-2, this.y-2, 1, this.x, this.y, this.r);
    if(this.pierce){
      g.addColorStop(0, '#f5f3ff');
      g.addColorStop(1, '#a78bfa');
    } else {
      g.addColorStop(0, '#fff');
      g.addColorStop(1, '#22d3ee');
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill();
    ctx.save();
    ctx.shadowColor = this.pierce ? '#a78bfa' : '#22d3ee';
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r*0.6, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fill();
    ctx.restore();
  }
  speed(){ return Math.hypot(this.vx, this.vy); }
  setSpeed(s){
    const cur = this.speed() || 1;
    this.vx = this.vx / cur * s;
    this.vy = this.vy / cur * s;
  }
}

// ---------- Block ----------
const BLOCK_KINDS = {
  NORMAL:'normal', TOUGH:'tough', STEEL:'steel', EXPLOSIVE:'explosive', ITEM:'item'
};
const BLOCK_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#a855f7','#ec4899'
];

class Block {
  constructor(col, row, x, y, w, h, kind, opts={}){
    this.col=col; this.row=row;
    this.x=x; this.y=y; this.w=w; this.h=h;
    this.kind = kind;
    this.hp = opts.hp || (kind===BLOCK_KINDS.TOUGH?2:1);
    this.maxHp = this.hp;
    this.color = opts.color || BLOCK_COLORS[(col+row)%BLOCK_COLORS.length];
    this.itemKind = opts.itemKind || null;
    this.dead = false;
    this.flashTimer = 0;
    this.pulse = Math.random()*Math.PI*2;
  }
  hit(){
    this.flashTimer = 0.15;
    if(this.kind === BLOCK_KINDS.STEEL) return false;
    this.hp -= 1;
    if(this.hp <= 0){ this.dead = true; return true; }
    return false;
  }
  destroy(){
    if(this.kind === BLOCK_KINDS.STEEL) return false;
    this.dead = true; return true;
  }
  tick(dt){
    if(this.flashTimer > 0) this.flashTimer -= dt;
    this.pulse += dt * 2;
  }
  draw(ctx){
    const flash = this.flashTimer > 0;
    let fill = this.color;
    if(this.kind === BLOCK_KINDS.STEEL) fill = '#64748b';
    if(this.kind === BLOCK_KINDS.EXPLOSIVE) fill = '#fb923c';
    if(this.kind === BLOCK_KINDS.TOUGH && this.hp < this.maxHp) fill = shade(this.color, -25);

    ctx.save();
    if(flash){
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 14;
    }
    if(this.kind === BLOCK_KINDS.ITEM){
      const pulse = (Math.sin(this.pulse*4) + 1) / 2;
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 8 + pulse*10;
    }

    // gradient fill
    const g = ctx.createLinearGradient(this.x, this.y, this.x, this.y+this.h);
    g.addColorStop(0, shade(fill, 25));
    g.addColorStop(1, shade(fill, -15));
    ctx.fillStyle = g;
    roundRect(ctx, this.x+1, this.y+1, this.w-2, this.h-2, 4, true);

    // top highlight
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    roundRect(ctx, this.x+3, this.y+2, this.w-6, 3, 2, true);

    // steel pattern
    if(this.kind === BLOCK_KINDS.STEEL){
      ctx.strokeStyle = 'rgba(255,255,255,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x+4, this.y+this.h-4);
      ctx.lineTo(this.x+this.w-4, this.y+4);
      ctx.stroke();
    }

    // explosive icon
    if(this.kind === BLOCK_KINDS.EXPLOSIVE){
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('!', this.x + this.w/2, this.y + this.h/2);
    }

    // item shimmer
    if(this.kind === BLOCK_KINDS.ITEM){
      ctx.fillStyle = '#fff8';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('?', this.x + this.w/2, this.y + this.h/2);
    }
    ctx.restore();
  }
  getBounds(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; }
}

// ---------- Item ----------
const ITEM_KINDS = ['long','multi','slow','pierce','magnet','life','bonus'];
const ITEM_DEFS = {
  long:   { color:'#4ade80', label:'L' },
  multi:  { color:'#60a5fa', label:'M' },
  slow:   { color:'#facc15', label:'S' },
  pierce: { color:'#a78bfa', label:'P' },
  magnet: { color:'#f87171', label:'T' },
  life:   { color:'#fb923c', label:'+' },
  bonus:  { color:'#22d3ee', label:'★' },
};

class Item {
  constructor(x,y,kind){
    this.x=x; this.y=y; this.r=12;
    this.kind=kind;
    this.vy = 2.5;
    this.dead = false;
    this.pulse = 0;
  }
  tick(dt, canvasH){
    this.y += this.vy;
    this.pulse += dt * 5;
    if(this.y - this.r > canvasH) this.dead = true;
  }
  draw(ctx){
    const def = ITEM_DEFS[this.kind];
    ctx.save();
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 12 + Math.sin(this.pulse)*4;
    ctx.fillStyle = def.color;
    roundRect(ctx, this.x-this.r, this.y-this.r, this.r*2, this.r*2, 5, true);
    ctx.fillStyle = '#0a0a18';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(def.label, this.x, this.y+1);
    ctx.restore();
  }
}

// ---------- Particle ----------
class Particle {
  constructor(x,y,vx,vy,color,life){
    this.x=x; this.y=y; this.vx=vx; this.vy=vy;
    this.color=color; this.life=life; this.maxLife=life;
    this.dead=false;
    this.size=2 + Math.random()*3;
  }
  tick(dt){
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.15;
    this.vx *= 0.98;
    this.life -= dt;
    if(this.life <= 0) this.dead = true;
  }
  draw(ctx){
    const a = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = a;
    ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

// ---------- helpers ----------
function roundRect(ctx, x, y, w, h, r, fill){
  if(w<2*r) r=w/2; if(h<2*r) r=h/2;
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y,   x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x,   y+h, r);
  ctx.arcTo(x,   y+h, x,   y,   r);
  ctx.arcTo(x,   y,   x+w, y,   r);
  ctx.closePath();
  if(fill) ctx.fill();
}

function shade(hex, amt){
  // amt: -100..100 (% lighter/darker)
  const c = hex.replace('#','');
  const num = parseInt(c, 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}

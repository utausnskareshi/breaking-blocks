// =========================================
// game.js - Game loop, state, collisions
// =========================================
const Game = (() => {
  const canvas = () => document.getElementById('game-canvas');
  let ctx, W, H;
  // Logical world dimensions - locked at the very first sized resize().
  // All game state is stored/computed in this fixed coordinate space;
  // any later canvas-CSS-size variation (rotation, address-bar, safe-area)
  // is absorbed by scaling the drawing context, so every entity scales
  // together and the visual layout stays consistent.
  let logicalW = 0, logicalH = 0;
  let paddle, balls, blocks, items, particles;
  let score=0, hi=0, life=3, stageNum=1;
  let combo=0, comboTimer=0;
  let scoreMult = 1, scoreMultTimer=0;
  let slowTimer = 0;
  let state = 'idle';   // idle | playing | clear | gameover | paused
  let lastT = 0;
  let shake = 0;
  let dpr = 1;
  let onUpdateHud = () => {};

  function init(){
    ctx = canvas().getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    Input.bindTap(canvas());
    Input.onTap(() => {
      Audio.resume();
      // Launch any stuck balls
      balls.forEach(b => { if(b.stuck){ launchStuck(b); } });
    });
    hi = parseInt(localStorage.getItem('bb_highscore')||'0', 10) || 0;
    document.getElementById('hi-score-value').textContent = hi;
  }

  function resize(){
    const c = canvas();
    const rect = c.getBoundingClientRect();
    if(rect.width <= 0 || rect.height <= 0) return;  // hidden / in transition

    const newW = rect.width;
    const newH = rect.height;

    // -------------------------------------------------------------------
    // FIXED LOGICAL COORDINATE SYSTEM
    // -------------------------------------------------------------------
    // Capture the FIRST valid canvas size as the canonical "world".
    // Game logic (collisions, paddle, blocks, balls) all live in this
    // fixed logical space - their pixel sizes never change. To make the
    // canvas CSS area display the world correctly, we scale the drawing
    // context so logical (logicalW × logicalH) maps to current CSS area.
    //
    // Result: when iOS Safari hands us a slightly different canvas size
    // after a rotation round-trip, EVERY entity (block / ball / paddle /
    // item) scales together by the same factor. The user perceives the
    // exact same layout, just rendered at the new canvas size.
    if(logicalW === 0){
      logicalW = newW;
      logicalH = newH;
    }

    dpr = window.devicePixelRatio || 1;
    c.width = Math.floor(newW * dpr);
    c.height = Math.floor(newH * dpr);

    const sx = newW / logicalW;
    const sy = newH / logicalH;
    ctx.setTransform(dpr * sx, 0, 0, dpr * sy, 0, 0);

    // Game logic always uses logical dims (locked)
    W = logicalW;
    H = logicalH;

    // Force re-render so paused state shows the rescaled view
    if(paddle && blocks){
      try { render(); } catch(e){}
    }
  }

  function setHudCallback(fn){ onUpdateHud = fn; }

  function startNewGame(){
    resize();   // canvas was likely 0x0 during init (hidden) - ensure size now
    score = 0; life = 3; stageNum = 1; combo = 0; comboTimer = 0;
    scoreMult = 1; scoreMultTimer = 0; slowTimer = 0;
    paddle = new Paddle(W, H);
    items = []; particles = [];
    loadStage();
    state = 'playing';
    lastT = performance.now();
    requestAnimationFrame(loop);
    updateHud();
  }

  function loadStage(){
    blocks = Stage.generate(stageNum, W, H);
    spawnInitialBall();
  }

  function spawnInitialBall(){
    balls = [];
    const ball = new Ball(paddle.x + paddle.w/2, paddle.y - 10, 0, 0);
    ball.stuck = true;
    ball.stuckOffset = paddle.w/2;
    balls.push(ball);
    showTapHint(true);
  }

  function launchStuck(b){
    b.stuck = false;
    const speed = 6;
    const angle = -Math.PI/2 + (Math.random()-0.5)*0.6;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    Audio.launch();
    showTapHint(false);
  }

  function showTapHint(show){
    const el = document.getElementById('tap-to-launch');
    if(!el) return;
    if(show) el.removeAttribute('hidden'); else el.setAttribute('hidden','');
  }

  function pause(){
    if(state !== 'playing') return;
    state = 'paused';
    showOverlay('一時停止', '深呼吸して、再開しましょう。', 'pause');
  }
  function resume(){
    if(state !== 'paused') return;
    state = 'playing';
    hideOverlay();
    lastT = performance.now();
    requestAnimationFrame(loop);
  }
  function restart(){
    hideOverlay();
    startNewGame();
  }
  function exit(){
    hideOverlay();
    state = 'idle';
  }

  // ---- Loop ----
  function loop(now){
    if(state !== 'playing') return;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    // Apply slow modifier to dt for ball movement
    const ballDt = slowTimer > 0 ? dt * 0.55 : dt;
    if(slowTimer > 0) slowTimer -= dt;

    update(dt, ballDt);
    render();
    requestAnimationFrame(loop);
  }

  function update(dt, ballDt){
    // paddle
    paddle.setTilt(Input.getTilt(), W);
    paddle.tick(dt);

    // balls
    for(const b of balls){
      if(b.stuck){
        b.x = paddle.x + b.stuckOffset;
        b.y = paddle.y - b.r - 1;
      } else {
        // sub-step ball movement to avoid tunneling
        const subSteps = Math.max(1, Math.ceil(b.speed() * (slowTimer>0?0.55:1) / 4));
        const stepScale = (slowTimer>0?0.55:1) / subSteps;
        for(let s=0; s<subSteps; s++){
          b.x += b.vx * stepScale;
          b.y += b.vy * stepScale;

          // wall
          if(b.x - b.r < 0){ b.x = b.r; b.vx = Math.abs(b.vx); Audio.hitWall(); }
          else if(b.x + b.r > W){ b.x = W - b.r; b.vx = -Math.abs(b.vx); Audio.hitWall(); }
          if(b.y - b.r < 0){ b.y = b.r; b.vy = Math.abs(b.vy); Audio.hitWall(); }

          // paddle
          collidePaddle(b);

          // blocks
          collideBlocks(b);
        }

        if(b.pierceTimer > 0){
          b.pierceTimer -= ballDt;
          if(b.pierceTimer <= 0) b.pierce = false;
        }

        // trail
        b.trail.push({x:b.x, y:b.y});
        if(b.trail.length > 8) b.trail.shift();

        // bottom = lost
        if(b.y - b.r > H){ b.dead = true; }
      }
    }
    balls = balls.filter(b => !b.dead);

    if(balls.length === 0){
      // lose life
      life -= 1;
      Audio.death();
      shake = 12;
      combo = 0;
      paddle.sticky = false; paddle.stickyTimer = 0;
      paddle.longTimer = 0;
      paddle.w = paddle.baseW;
      slowTimer = 0;
      if(life <= 0){
        gameOver();
      } else {
        spawnInitialBall();
      }
      updateHud();
    }

    // items
    for(const it of items) it.tick(dt, H);
    for(const it of items){
      if(it.dead) continue;
      // catch by paddle
      if(it.y + it.r >= paddle.y && it.y - it.r <= paddle.y + paddle.h &&
         it.x >= paddle.x && it.x <= paddle.x + paddle.w){
        applyItem(it.kind);
        it.dead = true;
        Audio.item();
        spawnSparkles(it.x, it.y, ITEM_DEFS[it.kind].color, 14);
      }
    }
    items = items.filter(i => !i.dead);

    // blocks tick
    for(const blk of blocks) blk.tick(dt);

    // particles
    for(const p of particles) p.tick(dt);
    particles = particles.filter(p => !p.dead);

    // combo timer
    if(comboTimer > 0){
      comboTimer -= dt;
      if(comboTimer <= 0) combo = 0;
    }
    if(scoreMultTimer > 0){
      scoreMultTimer -= dt;
      if(scoreMultTimer <= 0) scoreMult = 1;
    }

    // shake decay
    if(shake > 0) shake = Math.max(0, shake - dt*30);

    // stage clear?
    if(blocks.every(b => b.kind === 'steel' || b.dead)){
      stageClear();
    }
  }

  function collidePaddle(b){
    if(b.vy <= 0) return;
    const p = paddle.getBounds();
    if(b.y + b.r >= p.y && b.y - b.r <= p.y + p.h &&
       b.x + b.r >= p.x && b.x - b.r <= p.x + p.w){
      // Sticky?
      if(paddle.sticky){
        b.stuck = true;
        b.stuckOffset = b.x - p.x;
        b.vx = 0; b.vy = 0;
        showTapHint(true);
      } else {
        b.y = p.y - b.r;
        // angle based on hit position
        const hit = (b.x - (p.x + p.w/2)) / (p.w/2);
        const speed = Math.max(5, b.speed());
        const angle = -Math.PI/2 + hit * (Math.PI/3);
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        Audio.hitPaddle();
      }
      // reset combo grace on paddle hit (keep combo alive)
      comboTimer = Math.max(comboTimer, 1.2);
    }
  }

  function collideBlocks(b){
    for(let i=0;i<blocks.length;i++){
      const blk = blocks[i];
      if(blk.dead) continue;
      if(b.x + b.r < blk.x || b.x - b.r > blk.x + blk.w) continue;
      if(b.y + b.r < blk.y || b.y - b.r > blk.y + blk.h) continue;

      // closest point on rect
      const cx = Math.max(blk.x, Math.min(b.x, blk.x + blk.w));
      const cy = Math.max(blk.y, Math.min(b.y, blk.y + blk.h));
      const dx = b.x - cx, dy = b.y - cy;
      const dist = Math.hypot(dx, dy);
      if(dist > b.r) continue;

      // Determine collision normal & resolve
      if(!b.pierce){
        // Bounce based on penetration axis
        const overlapX = (b.r) - Math.abs(dx);
        const overlapY = (b.r) - Math.abs(dy);
        if(overlapX < overlapY){
          b.vx = dx >= 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
          b.x += (dx >= 0 ? 1 : -1) * overlapX;
        } else {
          b.vy = dy >= 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
          b.y += (dy >= 0 ? 1 : -1) * overlapY;
        }
      }

      hitBlock(blk, b);
      if(!b.pierce) break;
    }
  }

  function hitBlock(blk, b){
    if(blk.kind === 'steel'){
      blk.hit();
      Audio.hitSteel();
      return;
    }
    const destroyed = blk.hit();
    if(destroyed){
      // score with combo
      combo += 1; comboTimer = 1.5;
      const base = 10 * (blk.kind === 'tough' ? 2 : 1) * (blk.kind === 'explosive' ? 3 : 1);
      const gain = Math.floor(base * scoreMult * (1 + combo*0.05));
      score += gain;
      flyText(blk.x + blk.w/2, blk.y, '+'+gain, '#facc15');

      spawnDebris(blk);
      Audio.combo(combo);
      if(blk.kind === 'item' && blk.itemKind){
        items.push(new Item(blk.x + blk.w/2, blk.y + blk.h/2, blk.itemKind));
      }
      if(blk.kind === 'explosive'){
        explodeAt(blk.x + blk.w/2, blk.y + blk.h/2, 70);
      }
      Audio.hitBlock();
    } else {
      Audio.hitTough();
    }
    updateHud();
  }

  function explodeAt(cx, cy, radius){
    Audio.explode();
    shake = Math.max(shake, 10);
    spawnSparkles(cx, cy, '#fb923c', 30);
    // chain destruction
    for(const blk of blocks){
      if(blk.dead) continue;
      const bx = blk.x + blk.w/2, by = blk.y + blk.h/2;
      const d = Math.hypot(bx-cx, by-cy);
      if(d <= radius){
        if(blk.kind === 'explosive'){
          const tx = blk.x + blk.w/2, ty = blk.y + blk.h/2;
          const stageAtSchedule = stageNum;
          blk.dead = true;
          spawnDebris(blk);
          score += Math.floor(15 * scoreMult);
          setTimeout(() => {
            if(state === 'playing' && stageNum === stageAtSchedule){
              explodeAt(tx, ty, radius);
            }
          }, 60);
        } else if(blk.kind !== 'steel'){
          blk.dead = true;
          spawnDebris(blk);
          score += Math.floor(8 * scoreMult);
          if(blk.kind === 'item' && blk.itemKind){
            items.push(new Item(blk.x + blk.w/2, blk.y + blk.h/2, blk.itemKind));
          }
        }
      }
    }
    updateHud();
  }

  function spawnDebris(blk){
    const cx = blk.x + blk.w/2, cy = blk.y + blk.h/2;
    for(let i=0;i<10;i++){
      const a = Math.random()*Math.PI*2;
      const s = 1 + Math.random()*3;
      particles.push(new Particle(cx, cy, Math.cos(a)*s, Math.sin(a)*s - 1, blk.color, 0.6 + Math.random()*0.3));
    }
  }

  function spawnSparkles(x,y,color,count){
    for(let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2;
      const s = 1 + Math.random()*3;
      particles.push(new Particle(x, y, Math.cos(a)*s, Math.sin(a)*s, color, 0.5 + Math.random()*0.4));
    }
  }

  function applyItem(kind){
    switch(kind){
      case 'long':   paddle.applyLong(15); break;
      case 'multi': {
        const newBalls = [];
        for(const b of balls){
          if(b.stuck) continue;
          for(let i=0;i<2;i++){
            const speed = b.speed();
            const ang = Math.atan2(b.vy, b.vx) + (i===0 ? -0.4 : 0.4);
            newBalls.push(new Ball(b.x, b.y, Math.cos(ang)*speed, Math.sin(ang)*speed));
          }
        }
        balls.push(...newBalls);
        break;
      }
      case 'slow':   slowTimer = 8; break;
      case 'pierce':
        balls.forEach(b => { b.pierce = true; b.pierceTimer = 8; });
        break;
      case 'magnet': paddle.applyMagnet(12); break;
      case 'life':   life = Math.min(life+1, 9); break;
      case 'bonus':  scoreMult = 2; scoreMultTimer = 12; break;
    }
    flyText(paddle.x + paddle.w/2, paddle.y - 20, ITEM_DEFS[kind].label + ' GET!', ITEM_DEFS[kind].color);
    updateHud();
  }

  function stageClear(){
    state = 'clear';
    Audio.clear();
    saveHi();
    setTimeout(() => {
      if(state !== 'clear') return;   // user navigated away during transition
      stageNum += 1;
      loadStage();
      paddle.w = paddle.baseW; paddle.longTimer = 0;
      paddle.sticky = false; paddle.stickyTimer = 0;
      slowTimer = 0;
      state = 'playing';
      lastT = performance.now();
      flyText(W/2, H/2, 'STAGE ' + stageNum, '#22d3ee');
      updateHud();
      requestAnimationFrame(loop);
    }, 1400);
    showOverlay('STAGE CLEAR!', `Stage ${stageNum} 突破！`, 'clear');
    setTimeout(() => { if(state === 'clear') hideOverlay(); }, 1300);
  }

  function gameOver(){
    state = 'gameover';
    Audio.gameOver();
    saveHi();
    showOverlay('GAME OVER', `スコア: ${score}\nハイスコア: ${hi}`, 'gameover');
  }

  function saveHi(){
    if(score > hi){
      hi = score;
      localStorage.setItem('bb_highscore', String(hi));
      const el = document.getElementById('hi-score-value');
      if(el) el.textContent = hi;
    }
  }

  function showOverlay(title, text, kind){
    const ov = document.getElementById('overlay');
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-text').textContent = text;
    document.getElementById('btn-resume').style.display = (kind === 'pause') ? '' : 'none';
    document.getElementById('btn-restart').style.display = (kind === 'gameover' || kind === 'pause') ? '' : 'none';
    document.getElementById('btn-back').style.display = '';
    ov.removeAttribute('hidden');
  }
  function hideOverlay(){ document.getElementById('overlay').setAttribute('hidden',''); }

  function flyText(x, y, txt, color){
    const game = document.getElementById('screen-game');
    const rect = canvas().getBoundingClientRect();
    // Convert logical (x,y) to CSS coords for DOM positioning
    const sx = logicalW > 0 ? rect.width / logicalW : 1;
    const sy = logicalH > 0 ? rect.height / logicalH : 1;
    const el = document.createElement('div');
    el.className = 'fly-text';
    el.style.left = (rect.left + x * sx) + 'px';
    el.style.top  = (rect.top + y * sy) + 'px';
    el.style.color = color;
    el.textContent = txt;
    game.appendChild(el);
    setTimeout(()=>el.remove(), 1000);
  }

  function updateHud(){
    document.getElementById('hud-score').textContent = score;
    document.getElementById('hud-stage').textContent = stageNum;
    document.getElementById('hud-life').textContent = '♥'.repeat(Math.max(0,life));
    document.getElementById('hud-combo').textContent = combo;
    onUpdateHud({score, stageNum, life, combo});
  }

  // ---- Render ----
  function render(){
    ctx.save();
    if(shake > 0){
      ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
    }
    // background
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0,0,W,H);

    // grid
    ctx.strokeStyle = 'rgba(124,92,255,.05)';
    ctx.lineWidth = 1;
    for(let x=0;x<W;x+=20){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for(let y=0;y<H;y+=20){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // borders
    ctx.strokeStyle = 'rgba(124,92,255,.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1,1,W-2,H-2);

    // blocks
    for(const blk of blocks) if(!blk.dead) blk.draw(ctx);

    // items
    for(const it of items) it.draw(ctx);

    // particles
    for(const p of particles) p.draw(ctx);

    // paddle
    paddle.draw(ctx);

    // balls
    for(const b of balls) b.draw(ctx);

    // tilt indicator (small)
    drawTiltIndicator();

    // score multiplier indicator
    if(scoreMult > 1){
      ctx.fillStyle = 'rgba(34,211,238,.85)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign='left';
      ctx.fillText('×2 SCORE  '+ scoreMultTimer.toFixed(1)+'s', 8, H - 8);
    }
    if(slowTimer > 0){
      ctx.fillStyle = 'rgba(250,204,21,.85)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign='right';
      ctx.fillText('SLOW '+ slowTimer.toFixed(1)+'s', W-8, H - 8);
    }

    ctx.restore();
  }

  function drawTiltIndicator(){
    const cx = W/2, y = H - 18;
    const w = 80, h = 4;
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    ctx.fillRect(cx-w/2, y, w, h);
    const t = Input.getTilt();
    const px = cx + t*(w/2);
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(px-2, y-2, 4, h+4);
  }

  return {
    init, startNewGame, pause, resume, restart, exit, setHudCallback,
    getState: () => state,
  };
})();

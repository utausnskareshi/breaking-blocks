// =========================================
// main.js - Screen flow & init
// =========================================
(function(){
  const $ = id => document.getElementById(id);
  const screens = ['screen-title','screen-game','screen-permission'];

  function show(id){
    screens.forEach(s => {
      const el = $(s);
      if(!el) return;
      if(s === id) el.classList.add('active');
      else el.classList.remove('active');
    });
  }

  // -------- Title screen wiring --------
  $('btn-howto').addEventListener('click', () => togglePanel('panel-howto'));
  $('btn-install').addEventListener('click', () => togglePanel('panel-install'));
  document.querySelectorAll('.close-panel').forEach(b => {
    b.addEventListener('click', () => {
      $(b.dataset.target).hidden = true;
    });
  });
  function togglePanel(id){
    const el = $(id);
    el.hidden = !el.hidden;
    if(!el.hidden) el.scrollIntoView({behavior:'smooth', block:'nearest'});
  }

  $('btn-start').addEventListener('click', async () => {
    Audio.resume();
    // iOS 13+ requires explicit user-gesture permission; show dedicated screen
    if(typeof DeviceOrientationEvent !== 'undefined' &&
       typeof DeviceOrientationEvent.requestPermission === 'function'){
      show('screen-permission');
    } else {
      // Try sensor on supported browsers (Android Chrome, etc.); always enable touch
      await Input.requestPermission();
      Input.enableTouch($('game-canvas'));
      enterGame();
    }
  });

  $('btn-perm-grant').addEventListener('click', async () => {
    Audio.resume();
    await Input.requestPermission();
    Input.enableTouch($('game-canvas'));   // touch coexists as override when finger is down
    enterGame();
  });
  $('btn-perm-skip').addEventListener('click', () => {
    Audio.resume();
    Input.enableTouch($('game-canvas'));
    enterGame();
  });

  function enterGame(){
    show('screen-game');
    tryLockPortrait();
    // Resize canvas now that it's visible
    requestAnimationFrame(() => {
      Game.startNewGame();
    });
  }

  // -------- Orientation handling --------
  // Try Screen Orientation API (works in Android Chrome PWA standalone).
  // iOS Safari doesn't honor this; CSS overlay handles that case.
  function tryLockPortrait(){
    try{
      if(screen.orientation && typeof screen.orientation.lock === 'function'){
        screen.orientation.lock('portrait').catch(()=>{ /* not supported */ });
      }
    }catch(e){ /* ignore */ }
  }

  function isLandscape(){
    if(screen.orientation && screen.orientation.type){
      return /landscape/.test(screen.orientation.type);
    }
    if(typeof window.orientation === 'number'){
      return window.orientation === 90 || window.orientation === -90;
    }
    return window.innerWidth > window.innerHeight;
  }

  function handleOrientationChange(){
    const inGame = $('screen-game').classList.contains('active');
    if(isLandscape() && inGame && Game.getState && Game.getState() === 'playing'){
      Game.pause();   // auto-pause when phone rotated to landscape
    }
  }
  window.addEventListener('orientationchange', handleOrientationChange);
  window.addEventListener('resize', handleOrientationChange);

  // -------- Game screen wiring --------
  $('btn-pause').addEventListener('click', () => {
    if(Game.getState() === 'playing') Game.pause();
    else if(Game.getState() === 'paused') Game.resume();
  });
  $('btn-resume').addEventListener('click', () => Game.resume());
  $('btn-restart').addEventListener('click', () => Game.restart());
  $('btn-back').addEventListener('click', () => {
    Game.exit();
    show('screen-title');
  });

  // -------- Init --------
  window.addEventListener('load', () => {
    Game.init();
    show('screen-title');
    // Register service worker
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('service-worker.js').catch(()=>{});
    }
  });

  // Prevent pinch zoom & accidental scroll
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('touchmove', e => {
    if(e.target.closest('#screen-title')) return; // allow scrolling on title
    e.preventDefault();
  }, {passive:false});
})();

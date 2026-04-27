// =========================================
// input.js - Tilt sensor + touch fallback (coexist)
// =========================================
const Input = (() => {
  let tiltValue = 0;        // -1 .. 1 from gyro
  let touchValue = 0;       // -1 .. 1 from touch/mouse
  let touchActive = false;  // finger currently down
  let tiltEnabled = false;
  let touchEnabled = false;
  let calibration = 0;
  const TILT_RANGE = 25;    // degrees of full deflection

  function onOrientation(e){
    if(!tiltEnabled) return;
    const g = e.gamma;
    if(g === null || g === undefined) return;
    const adj = g - calibration;
    tiltValue = Math.max(-1, Math.min(1, adj / TILT_RANGE));
  }

  async function requestPermission(){
    if(typeof DeviceOrientationEvent !== 'undefined' &&
       typeof DeviceOrientationEvent.requestPermission === 'function'){
      try{
        const res = await DeviceOrientationEvent.requestPermission();
        if(res === 'granted'){ enableTilt(); return true; }
        return false;
      }catch(err){ return false; }
    }
    if('DeviceOrientationEvent' in window){ enableTilt(); return true; }
    return false;
  }

  function enableTilt(){
    if(tiltEnabled) return;
    tiltEnabled = true;
    window.addEventListener('deviceorientation', onOrientation, true);
    setTimeout(calibrateNow, 250);
  }

  function calibrateNow(){
    const handler = (e) => {
      if(e.gamma !== null && e.gamma !== undefined){
        calibration = e.gamma;
      }
      window.removeEventListener('deviceorientation', handler, true);
    };
    window.addEventListener('deviceorientation', handler, true);
  }

  function enableTouch(canvas){
    if(touchEnabled) return;
    touchEnabled = true;

    const updateFromX = (clientX) => {
      const r = canvas.getBoundingClientRect();
      const localX = clientX - r.left;
      touchValue = Math.max(-1, Math.min(1, (localX - r.width/2) / (r.width/2)));
    };

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if(e.touches[0]){
        touchActive = true;
        updateFromX(e.touches[0].clientX);
      }
    }, {passive:false});
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if(e.touches[0]) updateFromX(e.touches[0].clientX);
    }, {passive:false});
    canvas.addEventListener('touchend', () => { touchActive = false; });
    canvas.addEventListener('touchcancel', () => { touchActive = false; });

    canvas.addEventListener('mousedown', (e) => { touchActive = true; updateFromX(e.clientX); });
    canvas.addEventListener('mousemove', (e) => { if(touchActive) updateFromX(e.clientX); });
    canvas.addEventListener('mouseup',   () => { touchActive = false; });
    canvas.addEventListener('mouseleave',() => { touchActive = false; });
  }

  // Most recent active input wins; tilt as default
  function getTilt(){
    if(touchEnabled && touchActive) return touchValue;
    if(tiltEnabled) return tiltValue;
    if(touchEnabled) return touchValue;
    return 0;
  }
  function getMode(){
    if(touchActive) return 'touch';
    if(tiltEnabled) return 'tilt';
    if(touchEnabled) return 'touch';
    return 'none';
  }

  // ---- Tap detection (single source, dedupe touch/click) ----
  const tapHandlers = [];
  function onTap(handler){ tapHandlers.push(handler); }
  function fireTap(){ tapHandlers.forEach(h => h()); }

  function bindTap(canvas){
    let startT = 0, startX = 0, startY = 0, moved = false, touched = false;
    let lastTapAt = 0;
    const dedupedFire = () => {
      const now = Date.now();
      if(now - lastTapAt < 350) return; // suppress synthetic click after touch
      lastTapAt = now;
      fireTap();
    };

    canvas.addEventListener('touchstart', e => {
      touched = true;
      startT = Date.now();
      moved = false;
      if(e.touches[0]){ startX = e.touches[0].clientX; startY = e.touches[0].clientY; }
    }, {passive:true});
    canvas.addEventListener('touchmove', e => {
      if(e.touches[0]){
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if(dx*dx+dy*dy > 100) moved = true;
      }
    }, {passive:true});
    canvas.addEventListener('touchend', () => {
      if(!moved && Date.now() - startT < 300) dedupedFire();
    });
    canvas.addEventListener('click', () => {
      if(touched) return;        // touch device - click is a duplicate
      dedupedFire();
    });
  }

  return {
    requestPermission, enableTilt, enableTouch, calibrateNow,
    getTilt, getMode, onTap, bindTap,
  };
})();

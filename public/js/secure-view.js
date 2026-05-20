(function(){
  // Minimal, focused protections for secure-view page.
  // Requires PDF.js to be loaded as `pdfjsLib` (included in the page).

  const container = document.getElementById('secure-pdf-container');
  if (!container) return;

  // Read assignment id and viewer token from data attributes
  const assignmentId = container.getAttribute('data-assignment-id');
  let viewerToken = container.getAttribute('data-viewer-token') || '';

  // Hardening helpers
  function stopEvent(e){ e.preventDefault(); e.stopPropagation(); return false; }

  // Block context menu and common clipboard/drag actions site-wide (secure view only)
  ['contextmenu','copy','cut','paste','dragstart','selectstart'].forEach(evt => {
    document.addEventListener(evt, function(e){
      // allow inputs inside forms to still accept paste in non-secure contexts (but here we block)
      stopEvent(e);
    }, {capture:true});
  });

  // Block keyboard shortcuts
  document.addEventListener('keydown', function(e){
    const key = (e.key || '').toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    // Forbidden combos
    if (
      (ctrl && key === 's') ||
      (ctrl && key === 'p') ||
      (ctrl && key === 'u') ||
      (ctrl && key === 'c') ||
      (ctrl && key === 'a') ||
      (ctrl && shift && (key === 'i' || key === 'j' || key === 'c')) ||
      key === 'f12'
    ){
      stopEvent(e);
      return false;
    }
    // PrintScreen best-effort
    if (key === 'printscreen'){
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(''); } catch(_){}
      stopEvent(e);
      return false;
    }
  }, {capture:true});

  // Prevent dragging images from canvas
  document.addEventListener('dragstart', stopEvent, {capture:true});

  // Disable selection
  try { document.body.style.userSelect = 'none'; } catch(_){}

  // DevTools detection & protection overlay
  const devOverlay = document.createElement('div');
  devOverlay.id = 'devtools-protect-overlay';
  Object.assign(devOverlay.style, {
    position: 'fixed', left:0, top:0, right:0, bottom:0, zIndex:99999,
    background:'#000', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:'22px', opacity:0, transition:'opacity 220ms ease', pointerEvents:'none'
  });
  devOverlay.textContent = 'Protected Content — Developer tools detected';
  document.body.appendChild(devOverlay);

  let devtoolsOpen = false;
  function setDevtoolsOpen(v){
    if (v === devtoolsOpen) return;
    devtoolsOpen = v;
    if (v){
      // blur/hide PDF
      container.style.filter = 'blur(12px)';
      devOverlay.style.opacity = '1';
      devOverlay.style.pointerEvents = 'auto';
    } else {
      container.style.filter = '';
      devOverlay.style.opacity = '0';
      devOverlay.style.pointerEvents = 'none';
    }
  }

  // Multiple heuristics for detection
  function detectDevTools(){
    try{
      const threshold = 160;
      const widthDiff = Math.abs(window.outerWidth - window.innerWidth);
      const heightDiff = Math.abs(window.outerHeight - window.innerHeight);
      if (widthDiff > threshold || heightDiff > threshold) return true;

      // stringifying a function has different length when devtools modifies Function.prototype.toString
      const start = Date.now();
      debugger; // eslint-disable-line no-debugger
      const took = Date.now() - start;
      if (took > 100) return true;
    } catch(_){}
    return false;
  }

  setInterval(function(){
    try{
      const detected = detectDevTools();
      setDevtoolsOpen(detected);
    } catch(_){}
  }, 1000);

  // PDF rendering using PDF.js
  async function fetchPdfBytes(){
    if (!assignmentId) throw new Error('Missing assignment id');
    const url = `/secure-file/${assignmentId}/raw`;
    const headers = {};
    if (viewerToken) headers['x-viewer-token'] = viewerToken;
    const resp = await fetch(url, { method: 'GET', credentials: 'same-origin', headers });
    if (!resp.ok) throw new Error('Unable to fetch PDF: ' + resp.status);
    const ab = await resp.arrayBuffer();
    // zero out token as soon as possible to reduce DOM exposure
    try{ viewerToken = ''; container.removeAttribute('data-viewer-token'); }catch(_){}
    return ab;
  }

  function makeCanvasForPage(width, height){
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.className = 'secure-pdf-page';
    // styling to prevent selection/drag
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';
    canvas.style.touchAction = 'none';
    canvas.oncontextmenu = stopEvent;
    canvas.addEventListener('dragstart', stopEvent);
    canvas.addEventListener('mousedown', function(e){ if (e.button === 2) stopEvent(e); });
    return canvas;
  }

  async function renderPdf(){
    try{
      if (typeof pdfjsLib === 'undefined') throw new Error('pdfjsLib not found');
      // Configure worker to use CDN (allowed by CSP updated in server)
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      }

      const bytes = await fetchPdfBytes();
      const loadingTask = pdfjsLib.getDocument({ data: bytes, disableStream: true });
      const pdf = await loadingTask.promise;
      // clear container
      container.innerHTML = '';
      // render each page sequentially
      for (let i = 1; i <= pdf.numPages; i++){
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = makeCanvasForPage(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d', { alpha: false });
        await page.render({ canvasContext: ctx, viewport }).promise;
        // after paint, create a wrapper and overlay a transparent div to intercept interactions
        const protector = document.createElement('div');
        protector.className = 'canvas-protector';
        Object.assign(protector.style, {
          position: 'absolute', left: '0px', top: '0px', width: viewport.width + 'px', height: viewport.height + 'px',
          pointerEvents: 'auto', // block interactions
          background: 'transparent'
        });
        // position relative to canvas
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.width = viewport.width + 'px';
        wrapper.style.height = viewport.height + 'px';
        canvas.style.display = 'block';
        wrapper.appendChild(canvas);
        wrapper.appendChild(protector);
        // append wrapper to container (avoid replaceChild race conditions)
        container.appendChild(wrapper);

        // protectors prevent context menu and selection
        protector.addEventListener('contextmenu', stopEvent);
        protector.addEventListener('mousedown', stopEvent);
        protector.addEventListener('mouseup', stopEvent);
        protector.addEventListener('click', function(e){ e.preventDefault(); });
      }

      // add watermark overlay if present in DOM
      const watermark = document.getElementById('overlay-watermark');
      if (watermark){
        watermark.style.pointerEvents = 'none';
      }

    } catch (err){
        console.error('Secure viewer error', err);
        // show a visible, informative error overlay so user can report it
        const errHtml = document.createElement('div');
        errHtml.style.color = '#fff';
        errHtml.style.padding = '20px';
        errHtml.style.background = 'rgba(0,0,0,0.6)';
        errHtml.textContent = 'Unable to load document: ' + (err && err.message ? err.message : String(err));
        container.innerHTML = '';
        container.appendChild(errHtml);
        // also show an alert for immediate feedback (non-spammy)
        try{ if (!window._secureViewerAlertShown) { alert('Document load error: ' + (err && err.message ? err.message : 'unknown')); window._secureViewerAlertShown = true; } } catch(_){}
    }
  }

  // Kick off rendering after small delay to allow layout
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(renderPdf, 80);
  } else {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(renderPdf,80); });
  }

})();

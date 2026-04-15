// Global frontend hardening: disable right-click, copy/paste, certain shortcuts, and download links
(function(){
  // Basic event blocks
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  document.addEventListener('copy', function(e){ e.preventDefault(); });
  document.addEventListener('cut', function(e){ e.preventDefault(); });
  document.addEventListener('paste', function(e){ e.preventDefault(); });
  document.addEventListener('dragstart', function(e){ e.preventDefault(); });

  // Block common shortcuts and devtools keys
  document.addEventListener('keydown', function(e){
    const key = (e.key || '').toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const forbidden = ['c','v','x','s','p','u','a'];
    if ( (ctrl && forbidden.includes(key)) || key === 'f12' || key === 'printscreen') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  });

  // Attempt to clear clipboard on PrintScreen (best-effort)
  document.addEventListener('keyup', function(e){
    if ((e.key || '').toLowerCase() === 'printscreen' && navigator.clipboard && navigator.clipboard.writeText) {
      try { navigator.clipboard.writeText(''); } catch(_) {}
      alert('Screenshot disabled');
    }
  });

  // Detect devtools (basic) and lock content
  setInterval(function(){
    try {
      if (window.outerWidth - window.innerWidth > 160) {
        document.body.innerHTML = '<div style="padding:40px;color:#fff;background:#000;">Access Restricted</div>';
      }
    } catch(_) {}
  }, 1000);

  // Disable selection via style (redundant with CSS)
  try { document.body.style.userSelect = 'none'; } catch(_) {}

  // Intercept download link clicks
  document.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.includes('/file/') && href.includes('/download')) {
      e.preventDefault();
      e.stopPropagation();
      alert('Download disabled for security');
    }
  });

  // Watermark injection for all pages if currentUser info available via meta tag
  try {
    var userName = null;
    try { userName = window.AV_CURRENT_USER_NAME || null; } catch(_) {}
    if (!userName) {
      var el = document.querySelector('meta[name="av-user"]');
      if (el) userName = el.getAttribute('content');
    }
    if (userName) {
      var wm = document.createElement('div');
      wm.id = 'watermark';
      wm.textContent = userName + ' | ' + new Date().toLocaleString();
      document.documentElement.appendChild(wm);
    }
  } catch(_) {}

  // Blur-until-hover/tap handlers for secure-content
  function enableSecureContent() {
    document.querySelectorAll('.secure-content').forEach(function(el){
      // Add blocker if not present
      if (!el.querySelector('.secure-blocker')) {
        var b = document.createElement('div');
        b.className = 'secure-blocker';
        el.appendChild(b);
      }

      // Toggle on click (mobile)
      el.addEventListener('click', function(e){
        // ignore clicks that originate from links or buttons inside
        if (e.target && (e.target.closest('a') || e.target.closest('button'))) return;
        el.classList.toggle('active');
      });

      // Remove active on mouseleave for wider UX
      el.addEventListener('mouseleave', function(){ el.classList.remove('active'); });
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(enableSecureContent, 50);
  } else {
    document.addEventListener('DOMContentLoaded', enableSecureContent);
  }

})();

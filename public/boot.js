/* Boot guard. If a script fails to load, or the app throws before its first
 * render, put the reason on screen instead of leaving a blank page. Classic
 * (non-module) script so it runs even when the module graph cannot load.
 * Inert once the shell has rendered: #boot is gone by then. */
(function () {
  'use strict';
  function fail(message) {
    var boot = document.getElementById('boot');
    if (!boot) return; // app already rendered; not a boot failure
    boot.className = 'failed';
    var pre = boot.querySelector('.boot-err pre');
    if (pre) pre.textContent = message;
  }
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && (t.src || t.href)) {
      fail('Could not load ' + (t.src || t.href));
      return;
    }
    var where = e.filename ? '\n' + e.filename.replace(/^.*\//, '') + ':' + e.lineno : '';
    fail((e.message || 'Script error') + where);
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    fail(r && r.message ? r.message : String(r));
  });
})();

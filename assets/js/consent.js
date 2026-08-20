// Cookie consent banner — gates Google Consent Mode's analytics_storage signal.
// Requires the page to have already called:
//   gtag('consent', 'default', { analytics_storage: 'denied' });
// before this file runs, so GA starts denied and this only ever grants or
// re-confirms denial once the visitor has chosen.
(function () {
    var STORAGE_KEY = 'uc-consent';

    function applyStoredChoice(choice) {
        if (typeof gtag !== 'function') return;
        gtag('consent', 'update', {
            analytics_storage: choice === 'granted' ? 'granted' : 'denied'
        });
    }

    function injectStyles() {
        var css = [
            '.ucc-bar{position:fixed;left:0;right:0;bottom:0;z-index:9999;',
            'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;',
            'padding:16px 20px;background:rgba(15,15,15,.97);backdrop-filter:blur(6px);',
            'border-top:1px solid #0d9488;box-shadow:0 -8px 24px rgba(0,0,0,.35);',
            'font-family:"Inconsolata",monospace;transform:translateY(0);transition:transform .3s ease,opacity .3s ease;}',
            '.ucc-bar.ucc-hide{transform:translateY(110%);opacity:0;pointer-events:none;}',
            '.ucc-text{flex:1 1 320px;color:#eee;font-size:.92rem;line-height:1.5;margin:0;}',
            '.ucc-actions{display:flex;gap:10px;flex:0 0 auto;}',
            '.ucc-btn{font-family:inherit;font-size:.9rem;font-weight:500;padding:.6rem 1.1rem;',
            'border-radius:8px;cursor:pointer;border:none;box-sizing:border-box;transition:background .2s ease,border-color .2s ease;}',
            '.ucc-btn-accept{background:#0d9488;color:#fff;}',
            '.ucc-btn-accept:hover{background:#14b8a6;}',
            '.ucc-btn-reject{background:transparent;color:#ccc;border:1px solid #3a3a3a;}',
            '.ucc-btn-reject:hover{border-color:#666;color:#fff;}',
            '@media (max-width:520px){.ucc-actions{width:100%;}.ucc-btn{flex:1;}}'
        ].join('');
        var style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    function showBanner() {
        injectStyles();
        var bar = document.createElement('div');
        bar.className = 'ucc-bar';
        bar.setAttribute('role', 'region');
        bar.setAttribute('aria-label', 'Cookie consent');
        bar.innerHTML =
            '<p class="ucc-text">This site uses cookies for analytics, so we can see which pages are useful and which aren’t. ' +
            'No cookies are set until you accept.</p>' +
            '<div class="ucc-actions">' +
            '<button type="button" class="ucc-btn ucc-btn-reject" data-ucc="reject">Reject</button>' +
            '<button type="button" class="ucc-btn ucc-btn-accept" data-ucc="accept">Accept</button>' +
            '</div>';
        document.body.appendChild(bar);

        bar.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-ucc]');
            if (!btn) return;
            var choice = btn.getAttribute('data-ucc') === 'accept' ? 'granted' : 'denied';
            localStorage.setItem(STORAGE_KEY, choice);
            applyStoredChoice(choice);
            bar.classList.add('ucc-hide');
            setTimeout(function () { bar.remove(); }, 320);
        });
    }

    function init() {
        var stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'granted' || stored === 'denied') {
            applyStoredChoice(stored);
            return;
        }
        showBanner();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());

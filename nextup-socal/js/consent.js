// Cookie consent banner — gates Google Consent Mode's analytics_storage signal.
// Requires the page to have already called:
//   gtag('consent', 'default', { analytics_storage: 'denied' });
// before this file runs, so GA starts denied and this only ever grants or
// re-confirms denial once the visitor has chosen. Styled to match this
// bundle's own brand variables (--indigo/--violet/--teal-bright/--sans),
// so it works unchanged across the splash, deck, checklist and mobile pages.
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
            '.ucc-bar{position:fixed;left:0;right:0;bottom:0;z-index:999999;',
            'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;',
            'padding:16px 22px;background:rgba(20,15,52,.96);backdrop-filter:blur(6px);',
            'border-top:1px solid rgba(255,255,255,.14);box-shadow:0 -10px 28px rgba(15,10,40,.35);',
            'font-family:var(--sans,\'Manrope\',\'Segoe UI\',system-ui,sans-serif);',
            'transform:translateY(0);transition:transform .3s ease,opacity .3s ease;}',
            '.ucc-bar.ucc-hide{transform:translateY(110%);opacity:0;pointer-events:none;}',
            '.ucc-text{flex:1 1 320px;color:#E7E3FA;font-size:13.5px;line-height:1.5;margin:0;}',
            '.ucc-actions{display:flex;gap:10px;flex:0 0 auto;}',
            '.ucc-btn{font-family:var(--display,\'Sora\',\'Segoe UI\',system-ui,sans-serif);',
            'font-size:13.5px;font-weight:800;padding:.62rem 1.15rem;border-radius:10px;cursor:pointer;',
            'border:none;box-sizing:border-box;transition:filter .18s ease,border-color .18s ease;}',
            '.ucc-btn-accept{background:var(--grad-brand,linear-gradient(125deg,#4B3BB0,#6A57DB,#35C6D0));color:#fff;}',
            '.ucc-btn-accept:hover{filter:brightness(1.08);}',
            '.ucc-btn-reject{background:transparent;color:#C3BCEA;border:1.5px solid rgba(255,255,255,.28);}',
            '.ucc-btn-reject:hover{border-color:rgba(255,255,255,.55);color:#fff;}',
            '@media (max-width:560px){.ucc-actions{width:100%;}.ucc-btn{flex:1;}}',
            '@media print{.ucc-bar{display:none !important;}}'
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
        // Never show the banner in a headless/print render — both the deck
        // and the checklist are captured to PDF via headless Chrome, and a
        // freshly-injected banner would get baked permanently into the file.
        if (window.matchMedia && window.matchMedia('print').matches) return;

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

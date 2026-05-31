// Scroll depth — fires once per milestone per page load
(function () {
    const milestones = [25, 50, 75, 90];
    const reached    = new Set();
    let ticking      = false;
    function depth() {
        const total = document.documentElement.scrollHeight - window.innerHeight;
        return total > 0 ? Math.floor((window.scrollY / total) * 100) : 0;
    }
    window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
            const pct = depth();
            milestones.forEach(function (m) {
                if (pct >= m && !reached.has(m)) {
                    reached.add(m);
                    if (typeof gtag === 'function')
                        gtag('event', 'scroll_depth', { percent_scrolled: m });
                }
            });
            ticking = false;
        });
    }, { passive: true });
}());

document.addEventListener('DOMContentLoaded', () => {

    function gtagEvent(name, params) {
        if (typeof gtag !== 'function') return;
        gtag('event', name, params);
    }

    // --- Section visibility (fires once per section per page load) ---
    const sections = document.querySelectorAll('section[id]');
    if ('IntersectionObserver' in window && sections.length) {
        const seen = new Set();
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !seen.has(entry.target.id)) {
                    seen.add(entry.target.id);
                    gtagEvent('section_view', { section_name: entry.target.id });
                }
            });
        }, { threshold: 0.4 });
        sections.forEach(s => observer.observe(s));
    }

    // --- Nav link clicks ---
    document.querySelectorAll('nav a[href]').forEach(link => {
        link.addEventListener('click', () => {
            gtagEvent('nav_click', { link_label: link.textContent.trim() });
        });
    });

    // --- Service card clicks ---
    document.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('click', () => {
            gtagEvent('service_card_click', {
                service_name: card.dataset.origin || card.querySelector('h3')?.textContent.trim()
            });
        });
    });

    // --- Work card link clicks ---
    document.querySelectorAll('.work-card .work-link').forEach(link => {
        link.addEventListener('click', () => {
            const card = link.closest('.work-card');
            gtagEvent('work_link_click', {
                project_name: card?.querySelector('h3')?.textContent.trim(),
                link_label:   link.textContent.trim()
            });
        });
    });

    // --- Contact modal open ---
    document.querySelectorAll('.open-contact-modal').forEach(el => {
        el.addEventListener('click', () => {
            gtagEvent('contact_modal_open', { origin: el.dataset.origin || 'unknown' });
        });
    });

    // --- Courses CTA click ---
    const coursesCta = document.querySelector('.courses-cta');
    if (coursesCta) {
        coursesCta.addEventListener('click', () => {
            gtagEvent('courses_cta_click', {});
        });
    }

    // --- Email link click ---
    const emailLink = document.querySelector('a.contact-email');
    if (emailLink) {
        emailLink.addEventListener('click', () => {
            gtagEvent('email_link_click', {});
        });
    }

});

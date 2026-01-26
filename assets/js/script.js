// Detect mobile device
function isMobile() {
    return window.innerWidth <= 768;
}

// Create bokeh particles with mobile optimization
function createParticles() {
    const container = document.getElementById('particles');
    const mobile = isMobile();

    // Reduce particle count on mobile for better performance
    const sizeConfig = {
        'bokeh-sm': { base: 6,  variance: 4,  count: mobile ? 2 : 4 },
        'bokeh-md': { base: 42, variance: 28, count: mobile ? 3 : 6 },
        'bokeh-lg': { base: 115, variance: 65, count: mobile ? 2 : 4 }
    };

    const colors = ['', 'cyan', 'teal'];

    Object.entries(sizeConfig).forEach(([sizeClass, config]) => {
        for (let i = 0; i < config.count; i++) {
            const particle = document.createElement('div');
            const color = colors[Math.floor(Math.random() * colors.length)];
            particle.className = `particle ${sizeClass} ${color}`.trim();

            // Distribute across the hero area
            particle.style.left = (Math.random() * 100) + '%';
            particle.style.top = (Math.random() * 100) + '%';

            const actualSize = config.base + (Math.random() - 0.5) * config.variance;
            particle.style.width = actualSize + 'px';
            particle.style.height = actualSize + 'px';
            particle.style.opacity = 0.25 + Math.random() * 0.45;

            // Longer durations for smoother, more natural drift
            const baseDuration = sizeClass === 'bokeh-sm' ? 25 :
                                sizeClass === 'bokeh-md' ? 35 : 45;
            particle.style.animationDelay = (Math.random() * 15) + 's';
            particle.style.animationDuration = (baseDuration + Math.random() * 20) + 's';

            container.appendChild(particle);
        }
    });
}

// Animate hero elements
function animateHero() {
    const particles = document.getElementById('particles');
    const aurora = document.getElementById('aurora');
    const logo = document.getElementById('logo');
    const companyName = document.getElementById('companyName');
    const tagline = document.getElementById('tagline');
    const ctaButton = document.querySelector('.cta-button'); // safer, no id
    const scrollIndicator = document.getElementById('scrollIndicator');

    if (particles) setTimeout(() => particles.classList.add('visible'), 200);
    if (aurora) setTimeout(() => aurora.classList.add('active'), 400);
    if (logo) setTimeout(() => logo.classList.add('visible'), 600);
    if (companyName) setTimeout(() => companyName.classList.add('visible'), 1000);
    if (tagline) setTimeout(() => tagline.classList.add('visible'), 1200);
    if (ctaButton) setTimeout(() => ctaButton.classList.add('visible'), 1400);
    if (scrollIndicator) setTimeout(() => scrollIndicator.classList.add('visible'), 2000);
}

// Mobile navigation toggle
function initMobileNav() {
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (!navToggle || !navLinks) return;

    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Support keyboard navigation
    navToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navToggle.click();
        }
    });

    // Close menu when clicking a nav link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
            navToggle.classList.remove('active');
            navLinks.classList.remove('active');
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    animateHero();
    initMobileNav();
});

// Smooth scroll for nav links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

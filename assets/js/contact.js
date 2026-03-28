document.addEventListener('DOMContentLoaded', () => {

    const firebaseConfig = {
        apiKey: "AIzaSyBV6dwTqKhJSlmyrV3g8aLSYrBwIVQXOKo",
        authDomain: "nickmccarty-site.firebaseapp.com",
        projectId: "nickmccarty-site",
        storageBucket: "nickmccarty-site.firebasestorage.app",
        messagingSenderId: "875332555466",
        appId: "1:875332555466:web:2e27a8f809933dde295a33"
    };

    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore(app);

    // --- Spam validation ---
    function spamCheck(name, email, message, honeypot) {
        if (honeypot) return 'Your message could not be sent.';
        if (name.length > 20 && !name.includes(' '))
            return 'Please enter your first and last name.';
        const localPart = email.split('@')[0] || '';
        if ((localPart.match(/\./g) || []).length > 2)
            return 'Please use a valid email address.';
        if (message.length < 10)
            return 'Your message is too short. Please provide more detail.';
        if (!message.includes(' '))
            return 'Your message must contain more than one word.';
        return null;
    }

    // --- Modal contact form ---
    const modalForm = document.getElementById('contact-form');
    if (modalForm) {
        const messageDiv = document.getElementById('form-message');
        const submitBtn = document.getElementById('submit-btn');

        modalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name    = document.getElementById('name').value.trim();
            const email   = document.getElementById('email').value.trim();
            const message = document.getElementById('message').value.trim();
            const honeypot = (document.getElementById('hp-website') || {}).value || '';

            const blocked = spamCheck(name, email, message, honeypot);
            if (blocked) {
                messageDiv.innerHTML = `<div class="message error">${blocked}</div>`;
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Sending\u2026';
            try {
                await db.collection('contacts').add({
                    name, email, message,
                    source:  modalForm.source.value,
                    origin:  modalForm.origin.value,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                messageDiv.innerHTML =
                    '<div class="message success">Thanks for reaching out! I\'ll get back to you soon.</div>';
                if (typeof gtag === 'function') gtag('event', 'contact_form_submit', { origin: modalForm.origin.value });
                modalForm.reset();
            } catch (err) {
                console.error(err);
                messageDiv.innerHTML =
                    '<div class="message error">Something went wrong. Please try again or email me directly.</div>';
            }
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Send';
        });
    }

    // --- Footer contact form ---
    const footerForm = document.getElementById('footer-contact-form');
    if (footerForm) {
        const messageDiv = document.getElementById('footer-form-message');
        const submitBtn = document.getElementById('footer-submit-btn');

        footerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('footer-email').value.trim();
            if (!email) return;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending\u2026';
            try {
                await db.collection('contacts').add({
                    name:    document.getElementById('footer-name').value.trim(),
                    email,
                    message: '',
                    source:  'footer',
                    origin:  'footer',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                messageDiv.innerHTML =
                    '<div class="message success">Got it \u2014 we\'ll be in touch.</div>';
                if (typeof gtag === 'function') gtag('event', 'footer_form_submit', {});
                footerForm.reset();
            } catch (err) {
                console.error(err);
                messageDiv.innerHTML =
                    '<div class="message error">Something went wrong. Please try again.</div>';
            }
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send';
        });
    }

    // --- Modal open / close ---
    const modal = document.getElementById('contactModal');
    if (modal) {
        const originInput = document.getElementById('form-origin');

        document.querySelectorAll('.open-contact-modal').forEach(el => {
            el.addEventListener('click', () => {
                originInput.value = el.dataset.origin || 'unknown';
                modal.classList.add('active');
                modal.setAttribute('aria-hidden', 'false');
            });
        });

        document.getElementById('closeModal').addEventListener('click', () => {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        });

        modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        });
    }
});
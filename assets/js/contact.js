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

    // --- Modal contact form ---
    const modalForm = document.getElementById('contact-form');
    if (modalForm) {
        const messageDiv = document.getElementById('form-message');
        const submitBtn = document.getElementById('submit-btn');

        modalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Sending\u2026';
            try {
                await db.collection('contacts').add({
                    name:    document.getElementById('name').value.trim(),
                    email:   document.getElementById('email').value.trim(),
                    message: document.getElementById('message').value.trim(),
                    source:  modalForm.source.value,
                    origin:  modalForm.origin.value,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                messageDiv.innerHTML =
                    '<div class="message success">Thanks for reaching out! I\'ll get back to you soon.</div>';
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
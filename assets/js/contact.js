document.addEventListener('DOMContentLoaded', () => {

    const firebaseConfig = {
        apiKey: "AIzaSyBV6dwTqKhJSlmyrV3g8aLSYrBwIVQXOKo",
        authDomain: "nickmccarty-site.firebaseapp.com",
        projectId: "nickmccarty-site",
        storageBucket: "nickmccarty-site.firebasestorage.app",
        messagingSenderId: "875332555466",
        appId: "1:875332555466:web:2e27a8f809933dde295a33"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const form = document.getElementById('contact-form');
    if (!form) return;

    const messageDiv = document.getElementById('form-message');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const message = document.getElementById('message').value.trim();

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Sending…';

        try {
        await db.collection('contacts').add({
            name,
            email,
            message,
            source: form.source.value,
            origin: form.origin.value,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });


        messageDiv.innerHTML =
            '<div class="message success">Thanks for reaching out! I’ll get back to you soon.</div>';
        form.reset();
        } catch (error) {
        console.error(error);
        messageDiv.innerHTML =
            '<div class="message error">Something went wrong. Please try again or email me directly.</div>';
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Send';
    });
});

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('contactModal');
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
});
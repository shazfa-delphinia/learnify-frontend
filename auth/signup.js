// auth/signup.js
// Pastikan config.js sudah di-load lebih dulu sehingga NODE_API_URL tersedia

// ==== SIGN UP FORM (Nama Lengkap, Email, Password) ====
class EcoWellnessSignupForm {
    constructor() {
        this.form           = document.getElementById('signupForm');
        if (!this.form) return; // kalau halaman lain, jangan jalan

        this.fullnameInput  = document.getElementById('fullname');
        this.emailInput     = document.getElementById('email');
        this.passwordInput  = document.getElementById('password');
        this.passwordToggle = document.getElementById('passwordToggle');
        this.submitButton   = this.form.querySelector('.harmony-button');

        // Sembunyikan icon mata saat awal (password masih kosong)
        if (this.passwordToggle) {
            this.passwordToggle.style.display = 'none';
        }

        this.init();
    }

    init() {
        this.bindEvents();
        this.setupPasswordToggle();
    }

    bindEvents() {
        // submit
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // validasi per field
        this.fullnameInput.addEventListener('blur',  () => this.validateFullname());
        this.emailInput.addEventListener('blur',     () => this.validateEmail());
        this.passwordInput.addEventListener('blur',  () => this.validatePassword());

        this.fullnameInput.addEventListener('input', () => this.clearError('fullname'));
        this.emailInput.addEventListener('input',    () => this.clearError('email'));
        this.passwordInput.addEventListener('input', () => {
            this.clearError('password');
            this.handlePasswordTyping();
        });

        // supaya animasi label jalan
        this.fullnameInput.setAttribute('placeholder', ' ');
        this.emailInput.setAttribute('placeholder', ' ');
        this.passwordInput.setAttribute('placeholder', ' ');
    }

    // Saat password diketik
    handlePasswordTyping() {
        const value = this.passwordInput.value.trim();

        if (!this.passwordToggle) return;

        if (value.length > 0) {
            // Tampilkan icon mata
            this.passwordToggle.style.display = 'flex';
        } else {
            // Sembunyikan lagi kalau password dikosongkan
            this.passwordToggle.style.display = 'none';
            this.passwordInput.type = 'password';
            this.updatePasswordIcon();
        }
    }

    setupPasswordToggle() {
        if (!this.passwordToggle) return;

        this.passwordToggle.addEventListener('click', () => {
            const isCurrentlyPassword = this.passwordInput.type === 'password';
            this.passwordInput.type = isCurrentlyPassword ? 'text' : 'password';
            this.updatePasswordIcon();
        });

        // posisi awal icon (jika nanti muncul)
        this.updatePasswordIcon();
    }

    // Atur icon mata terbuka / dicoret
    updatePasswordIcon() {
        if (!this.passwordToggle) return;

        const isHidden = this.passwordInput.type === 'password';

        // Kalau hidden (type=password) → pakai class toggle-visible
        if (isHidden) {
            this.passwordToggle.classList.add('toggle-visible');
        } else {
            this.passwordToggle.classList.remove('toggle-visible');
        }
    }

    // ======== VALIDASI =========
    validateFullname() {
        const name = this.fullnameInput.value.trim();
        if (!name) {
            this.showError('fullname', 'Full name is required');
            return false;
        }
        this.clearError('fullname');
        return true;
    }

    validateEmail() {
        const email = this.emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            this.showError('email', 'Email is required');
            return false;
        }

        if (!emailRegex.test(email)) {
            this.showError('email', 'Masukkan email yang valid');
            return false;
        }

        this.clearError('email');
        return true;
    }

    validatePassword() {
        const password = this.passwordInput.value;

        if (!password) {
            this.showError('password', 'Password is required');
            return false;
        }

        if (password.length < 6) {
            this.showError('password', 'Password minimal 6 karakter');
            return false;
        }

        this.clearError('password');
        return true;
    }

    // ======== ERROR HANDLING =========
    showError(field, message) {
        const fieldWrapper = document.getElementById(field).closest('.organic-field');
        const errorElement = document.getElementById(`${field}Error`);

        fieldWrapper.classList.add('error');
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }

    clearError(field) {
        const fieldWrapper = document.getElementById(field).closest('.organic-field');
        const errorElement = document.getElementById(`${field}Error`);

        fieldWrapper.classList.remove('error');
        errorElement.classList.remove('show');
        setTimeout(() => {
            errorElement.textContent = '';
        }, 300);
    }

    // ======== SUBMIT =========
    async handleSubmit(e) {
        e.preventDefault();

        const okName     = this.validateFullname();
        const okEmail    = this.validateEmail();
        const okPassword = this.validatePassword();

        if (!okName || !okEmail || !okPassword) return;

        this.setLoading(true);

        try {
            const name = this.fullnameInput.value.trim();
            const email = this.emailInput.value.trim();
            const password = this.passwordInput.value;

            // Call backend API (Render)
            const response = await fetch(`${NODE_API_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Sign up failed');
            }

            alert('Sign up berhasil! Silakan login.');
            // Redirect ke sign in (di folder auth yang sama)
            window.location.href = "signin.html";
        } catch (error) {
            console.error('Signup error:', error);
            let errorMessage = 'Sign up gagal. Coba lagi ya.';

            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage = 'Tidak bisa terhubung ke server. Pastikan backend sudah bisa diakses di ' + NODE_API_URL;
            } else if (error.message) {
                errorMessage = error.message;
            }

            this.showError('password', errorMessage);
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        this.submitButton.classList.toggle('loading', loading);
        this.submitButton.disabled = loading;
    }
}

// tambahkan keyframes gentleBreath kalau belum ada (opsional)
if (!document.querySelector('#wellness-keyframes')) {
    const style = document.createElement('style');
    style.id = 'wellness-keyframes';
    style.textContent = `
        @keyframes gentleBreath {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.01); }
        }
    `;
    document.head.appendChild(style);
}

// inisialisasi ketika DOM siap
document.addEventListener('DOMContentLoaded', () => {
    new EcoWellnessSignupForm();
});
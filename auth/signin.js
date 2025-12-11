// Simple Eco Wellness Sign In (email + password only)
class EcoWellnessLoginForm {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.passwordToggle = document.getElementById('passwordToggle');
        this.submitButton = this.form.querySelector('.harmony-button');

        this.init();
    }
    
    init() {
        this.bindEvents();
        this.setupPasswordToggle();
    }
    
    bindEvents() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.emailInput.addEventListener('blur', () => this.validateEmail());
    this.passwordInput.addEventListener('blur', () => this.validatePassword());

    // email input handler
    this.emailInput.addEventListener('input', () => this.clearError('email'));

    // password input handler + kontrol ikon mata
    this.passwordInput.addEventListener('input', () => {
        this.clearError('password');

        const hasValue = this.passwordInput.value.length > 0;

        if (hasValue) {
            // Tampilkan ikon mata
            this.passwordToggle.classList.add('show');
        } else {
            // Sembunyikan ikon mata
            this.passwordToggle.classList.remove('show');

            // Jika sedang dalam mode "text", balikkan ke "password"
            if (this.passwordInput.type === 'text') {
                this.passwordInput.type = 'password';
                this.passwordToggle.classList.remove('toggle-visible');
            }
        }
    });

    // supaya animasi label jalan
    this.emailInput.setAttribute('placeholder', ' ');
    this.passwordInput.setAttribute('placeholder', ' ');
}
   
    setupPasswordToggle() {
        this.passwordToggle.addEventListener('click', () => {
            const type = this.passwordInput.type === 'password' ? 'text' : 'password';
            this.passwordInput.type = type;
            this.passwordToggle.classList.toggle('toggle-visible', type === 'text');
        });
    }
    
    validateEmail() {
        const email = this.emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email) {
            this.showError('email', 'Email is required');
            return false;
        }
        
        if (!emailRegex.test(email)) {
            this.showError('email', 'Please enter a valid email');
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
            this.showError('password', 'Password must be at least 6 characters');
            return false;
        }
        
        this.clearError('password');
        return true;
    }
    
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
    
    async handleSubmit(e) {
        e.preventDefault();
        
        const isEmailValid = this.validateEmail();
        const isPasswordValid = this.validatePassword();
        
        if (!isEmailValid || !isPasswordValid) {
            return;
        }
        
        // loading state sederhana
        this.setLoading(true);
        
        try {
            const email = this.emailInput.value.trim();
            const password = this.passwordInput.value;

            // Call backend API
            const response = await fetch('http://localhost:5000/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // SIMPAN STATUS LOGIN DAN DATA USER DI LOCALSTORAGE
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userName', data.user.name || 'User');
            localStorage.setItem('userEmail', data.user.email || email);
            localStorage.setItem('userId', data.user.id || '');

            // REDIRECT KE LANDING PAGE
            window.location.href = "../index.html";
        } catch (error) {
            console.error('Login error:', error);
            let errorMessage = 'Login failed. Please try again.';
            
            // Check if it's a network error
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage = 'Tidak bisa terhubung ke server. Pastikan backend server sudah running di port 5000.';
            } else {
                errorMessage = error.message || 'Login failed. Please try again.';
            }
            
            this.showError('password', errorMessage);
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
    new EcoWellnessLoginForm();
});

document.addEventListener('DOMContentLoaded', async () => {
    // --- Elements ---
    const themeToggle = document.getElementById('theme-toggle');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');

    // --- Theme Logic ---
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            themeToggle.textContent = '🌙';
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggle.textContent = '☀️';
        }
    });

    // --- Tab Logic ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked
            btn.classList.add('active');

            const tab = btn.getAttribute('data-tab');
            if (tab === 'login') {
                loginFormContainer.style.display = 'block';
                registerFormContainer.style.display = 'none';
            } else {
                loginFormContainer.style.display = 'none';
                registerFormContainer.style.display = 'block';
            }
            // Clear errors
            loginError.textContent = '';
            registerError.textContent = '';
        });
    });

    // --- Auth Logic ---
    
    // Fungsi untuk inisialisasi logic auth
    const initAuth = async () => {
        if (!window.supabaseClient) {
            console.error('Supabase client belum siap saat initAuth.');
            return;
        }
        const supabase = window.supabaseClient;

        // Redirect jika sudah login
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            window.location.href = 'index.html';
            return;
        }

        // Helper: Show Error
        const showError = (element, message, color = null) => {
            element.textContent = message;
            element.style.color = color || 'var(--danger-color)';
        };

        // Helper: Loading State
        const setLoginLoading = (isLoading) => {
            btnLogin.disabled = isLoading;
            btnLogin.textContent = isLoading ? 'Loading...' : 'Masuk';
        };

        const setRegisterLoading = (isLoading) => {
            btnRegister.disabled = isLoading;
            btnRegister.textContent = isLoading ? 'Loading...' : 'Daftar';
        };

        // Login Handler
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setLoginLoading(true);
            showError(loginError, '');

            let email = document.getElementById('login-email').value.trim();
            // Auto-append domain if username is entered
            if (!email.includes('@')) {
                email += '@todolist.app';
            }
            
            const password = document.getElementById('login-password').value;

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                showError(loginError, error.message);
                setLoginLoading(false);
            } else {
                // Berhasil login, redirect
                window.location.href = 'index.html';
            }
        });

        // Register Handler
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setRegisterLoading(true);
            showError(registerError, '');

            let email = document.getElementById('register-email').value.trim();
            // Auto-append domain if username is entered
            if (!email.includes('@')) {
                email += '@todolist.app';
            }
            
            const password = document.getElementById('register-password').value;
            const name = document.getElementById('register-name').value;

            if (password.length < 6) {
                showError(registerError, 'Password minimal 6 karakter');
                setRegisterLoading(false);
                return;
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name
                    }
                }
            });

            if (error) {
                showError(registerError, error.message);
            } else {
                // Cek apakah auto-login atau butuh verifikasi email
                if (data.session) {
                    window.location.href = 'index.html';
                } else {
                    showError(registerError, 'Pendaftaran berhasil! Silakan cek email Anda untuk verifikasi.', 'green');
                }
            }
            setRegisterLoading(false);
        });
    };

    // Cek apakah Supabase sudah siap, atau tunggu event
    if (window.supabaseClient) {
        initAuth();
    } else {
        window.addEventListener('supabase:ready', initAuth);
    }
});

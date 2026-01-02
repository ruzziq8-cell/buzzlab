(() => {
    // 1. Constants
    const STORAGE_KEY = 'theme_v1';
    const THEME_DARK = 'dark';
    const THEME_LIGHT = 'light';
    const ATTRIBUTE = 'data-theme';

    // 2. Determine preferred theme
    const getPreferredTheme = () => {
        // Check localStorage first
        const storedTheme = localStorage.getItem(STORAGE_KEY);
        if (storedTheme) {
            return storedTheme;
        }
        
        // Fallback to system preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_DARK : THEME_LIGHT;
    };

    // 3. Apply theme to document
    const applyTheme = (theme) => {
        document.documentElement.setAttribute(ATTRIBUTE, theme);
        updateToggleButton(theme);
    };

    // 4. Update Toggle Button Icon
    const updateToggleButton = (theme) => {
        const btn = document.getElementById('theme-toggle');
        if (btn) {
            // If dark, show sun (to switch to light)
            // If light, show moon (to switch to dark)
            btn.textContent = theme === THEME_DARK ? '☀️' : '🌙';
            btn.setAttribute('aria-label', theme === THEME_DARK ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        }
    };

    // 5. Initialize
    const currentTheme = getPreferredTheme();
    applyTheme(currentTheme);

    // 6. Event Listener for Toggle (Wait for DOM)
    const initThemeToggle = () => {
        const btn = document.getElementById('theme-toggle');
        if (btn) {
            // Update icon initially in case it wasn't ready during immediate execution
            updateToggleButton(document.documentElement.getAttribute(ATTRIBUTE));

            btn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute(ATTRIBUTE);
                const next = current === THEME_DARK ? THEME_LIGHT : THEME_DARK;
                
                applyTheme(next);
                localStorage.setItem(STORAGE_KEY, next);
            });
        }
    };

    // Run initialization logic
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemeToggle);
    } else {
        initThemeToggle();
    }
})();

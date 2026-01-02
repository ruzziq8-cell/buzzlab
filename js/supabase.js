
(function() {
    const SUPABASE_URL = 'https://pyawabcoppwaaaewpkny.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable__MNgyCgZ98xSGsWc4z1lHg_zVKdyZZc';

    console.log('Initializing Supabase...');

    function init() {
        if (window.supabase && window.supabase.createClient) {
            try {
                window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('Supabase client initialized successfully');
                // Dispatch event so other scripts know it's ready
                window.dispatchEvent(new CustomEvent('supabase:ready'));
            } catch (e) {
                console.error('Failed to create Supabase client:', e);
            }
        } else {
            console.error('Supabase library not found in window.supabase');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

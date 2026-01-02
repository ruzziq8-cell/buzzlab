document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Supabase
    const waitForSupabase = () => {
        return new Promise(resolve => {
            if (window.supabaseClient) return resolve(window.supabaseClient);
            window.addEventListener('supabase:ready', () => resolve(window.supabaseClient));
        });
    };

    const supabase = await waitForSupabase();

    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('admin-content');
    const deniedEl = document.getElementById('access-denied');
    const tableBody = document.getElementById('user-table-body');
    const btnRefresh = document.getElementById('btn-refresh');

    // 1. Check Auth
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Fetch Users Data
    async function loadUsers() {
        loadingEl.style.display = 'block';
        contentEl.style.display = 'none';
        tableBody.innerHTML = '';

        const { data: users, error } = await supabase.rpc('get_admin_users_stats');

        if (error) {
            console.error('Error fetching users:', error);
            // Fallback: If RPC fails (maybe permissions), show denied
            if (error.code === 'PGRST116' || error.message.includes('permission')) {
                loadingEl.style.display = 'none';
                deniedEl.style.display = 'block';
            } else {
                alert('Gagal memuat data: ' + error.message);
            }
            return;
        }

        renderTable(users);
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
    }

    function renderTable(users) {
        if (!users || users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">Tidak ada user.</td></tr>';
            return;
        }

        users.forEach(user => {
            const tr = document.createElement('tr');
            
            const isMe = user.user_id === session.user.id;
            const emailDisplay = isMe ? `<b>${user.email} (You)</b>` : user.email;
            
            const roleClass = user.role === 'admin' ? 'role-admin' : 'role-user';
            
            // Reminder Switch
            const isChecked = user.is_reminder_enabled ? 'checked' : '';
            
            tr.innerHTML = `
                <td>${emailDisplay}</td>
                <td>${user.whatsapp_number || '-'}</td>
                <td><span class="role-badge ${roleClass}">${user.role || 'user'}</span></td>
                <td>${user.active_tasks} / ${user.total_tasks}</td>
                <td>
                    <label class="switch">
                        <input type="checkbox" ${isChecked} data-userid="${user.user_id}" class="reminder-toggle">
                        <span class="slider"></span>
                    </label>
                </td>
            `;
            
            tableBody.appendChild(tr);
        });

        // Add Event Listeners
        document.querySelectorAll('.reminder-toggle').forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const userId = e.target.dataset.userid;
                const newStatus = e.target.checked;
                
                const { error } = await supabase.rpc('toggle_user_reminder_status', {
                    target_user_id: userId,
                    new_status: newStatus
                });

                if (error) {
                    alert('Gagal update status: ' + error.message);
                    e.target.checked = !newStatus; // Revert
                } else {
                    console.log(`User ${userId} reminder set to ${newStatus}`);
                }
            });
        });
    }

    btnRefresh.addEventListener('click', loadUsers);

    // Initial Load
    loadUsers();
});

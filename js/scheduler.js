document.addEventListener('DOMContentLoaded', () => {
    // Check auth
    checkAuth();

    // Event listeners
    const form = document.getElementById('schedule-form');
    if (form) {
        form.addEventListener('submit', handleSchedule);
    }
});

async function checkAuth() {
    // Wait for Supabase to be ready
    if (!window.supabaseClient) {
        console.log('Waiting for Supabase...');
        await new Promise(resolve => window.addEventListener('supabase:ready', resolve));
    }
    
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'auth.html';
        return;
    }
    
    // Load data only if we are on the page
    if (document.getElementById('message-list')) {
        loadMessages();
    }
}

async function loadMessages() {
    const list = document.getElementById('message-list');
    list.innerHTML = '<p style="text-align:center">Memuat...</p>';

    const { data, error } = await window.supabaseClient
        .from('scheduled_messages')
        .select('*')
        .order('scheduled_at', { ascending: true });

    if (error) {
        console.error('Error loading messages:', error);
        list.innerHTML = '<p style="color:red; text-align:center">Gagal memuat data. Pastikan tabel sudah dibuat.</p>';
        return;
    }

    renderList(data);
}

function renderList(messages) {
    const list = document.getElementById('message-list');
    list.innerHTML = '';

    if (!messages || messages.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:gray">Belum ada pesan terjadwal.</p>';
        return;
    }

    messages.forEach(msg => {
        const dateObj = new Date(msg.scheduled_at);
        const dateStr = dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        const statusClass = `status-${msg.status}`;
        
        let repeatBadge = '';
        if (msg.repeat_interval && msg.repeat_interval !== 'none') {
            repeatBadge = ` <span style="font-size:0.8rem; background:#3b82f6; color:white; padding:2px 6px; border-radius:8px;">🔄 ${msg.repeat_interval}</span>`;
        }
        
        const li = document.createElement('li');
        li.className = 'message-item';
        li.innerHTML = `
            <div class="message-info">
                <h4>📱 ${msg.phone_number} <span class="status-badge ${statusClass}">${msg.status}</span>${repeatBadge}</h4>
                <p>"${msg.message}"</p>
                <div class="message-meta">📅 ${dateStr} ⏰ ${timeStr}</div>
            </div>
            <div>
                <button onclick="deleteMessage(${msg.id})" class="btn-small btn-danger">Hapus</button>
            </div>
        `;
        list.appendChild(li);
    });
}

async function handleSchedule(e) {
    e.preventDefault();
    
    const phone = document.getElementById('phone').value;
    const message = document.getElementById('message').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const repeat = document.getElementById('repeat').value || 'none';

    if (!phone || !message || !date || !time) return;

    // Combine date time
    const scheduledAt = new Date(`${date}T${time}:00`);
    
    // Validasi waktu (tidak boleh masa lalu)
    if (scheduledAt < new Date()) {
        alert('❌ Waktu tidak boleh di masa lalu!');
        return;
    }

    // Get user
    const { data: { user } } = await window.supabaseClient.auth.getUser();

    // Clean phone number (remove +, -, space)
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    // Auto-fix 08... to 628...
    if (cleanPhone.startsWith('08')) {
        cleanPhone = '62' + cleanPhone.substring(1);
    }

    const { error } = await window.supabaseClient
        .from('scheduled_messages')
        .insert({
            user_id: user.id,
            phone_number: cleanPhone,
            message: message,
            scheduled_at: scheduledAt.toISOString(),
            status: 'pending',
            repeat_interval: repeat
        });

    if (error) {
        console.error(error);
        alert('❌ Gagal menyimpan: ' + error.message);
    } else {
        alert('✅ Pesan berhasil dijadwalkan!');
        document.getElementById('schedule-form').reset();
        loadMessages();
    }
}

// Expose delete function to window
window.deleteMessage = async (id) => {
    if (!confirm('Yakin ingin menghapus jadwal ini?')) return;

    const { error } = await window.supabaseClient
        .from('scheduled_messages')
        .delete()
        .eq('id', id);

    if (error) {
        alert('❌ Gagal menghapus: ' + error.message);
    } else {
        loadMessages();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    const form = document.getElementById('schedule-form');
    if (form) {
        form.addEventListener('submit', handleSchedule);
    }

    const exportDaily = document.getElementById('export-daily');
    const exportWeekly = document.getElementById('export-weekly');
    const exportMonthly = document.getElementById('export-monthly');

    if (exportDaily) {
        exportDaily.addEventListener('click', () => exportMessages('daily'));
    }
    if (exportWeekly) {
        exportWeekly.addEventListener('click', () => exportMessages('weekly'));
    }
    if (exportMonthly) {
        exportMonthly.addEventListener('click', () => exportMessages('monthly'));
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

    const { data: { user } } = await window.supabaseClient.auth.getUser();

    let cleanPhone = phone.replace(/[^0-9]/g, '');
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

async function exportMessages(period) {
    const now = new Date();
    const to = new Date(now);
    const from = new Date(now);

    if (period === 'daily') {
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
    } else if (period === 'weekly') {
        from.setDate(from.getDate() - 7);
    } else if (period === 'monthly') {
        from.setMonth(from.getMonth() - 1);
    }

    const { data, error } = await window.supabaseClient
        .from('scheduled_messages')
        .select('*')
        .gte('scheduled_at', from.toISOString())
        .lte('scheduled_at', to.toISOString())
        .order('scheduled_at', { ascending: true });

    if (error) {
        alert('❌ Gagal export: ' + error.message);
        return;
    }

    if (!data || data.length === 0) {
        alert('ℹ️ Tidak ada data untuk periode ini.');
        return;
    }

    const headers = [
        'id',
        'phone_number',
        'message',
        'scheduled_at',
        'status',
        'repeat_interval',
        'created_at',
        'updated_at'
    ];

    const escapeCell = (value) => {
        const str = value == null ? '' : String(value);
        return '"' + str.replace(/"/g, '""') + '"';
    };

    const rows = [];
    rows.push(headers.join(','));

    data.forEach(msg => {
        rows.push([
            escapeCell(msg.id),
            escapeCell(msg.phone_number),
            escapeCell(msg.message),
            escapeCell(msg.scheduled_at),
            escapeCell(msg.status),
            escapeCell(msg.repeat_interval),
            escapeCell(msg.created_at),
            escapeCell(msg.updated_at)
        ].join(','));
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const dateLabel = now.toISOString().slice(0, 10);
    const filename = 'scheduled_messages_' + period + '_' + dateLabel + '.csv';

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

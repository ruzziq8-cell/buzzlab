const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const http = require('http');

// Setup Puppeteer for Termux/Linux vs Windows
let puppeteerConfig = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
};

if (process.env.PREFIX === '/data/data/com.termux/files/usr') {
    console.log('Detected Termux environment. Using system Chromium...');
    const chromiumPath = '/data/data/com.termux/files/usr/bin/chromium-browser';
    
    if (fs.existsSync(chromiumPath)) {
        console.log(`Chromium found at: ${chromiumPath}`);
        puppeteerConfig.executablePath = chromiumPath;
    } else {
        console.error('❌ Chromium NOT found! Please run: pkg install chromium');
    }
}

// Simple HTTP Server for Health Checks (Required for Cloud Deployments like Render/Koyeb)
// Also handles port collision recursively
const startServer = (attemptPort) => {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('BuzzLab Bot is Active!');
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log(`⚠️ Port ${attemptPort} is in use. Trying port ${attemptPort + 1}...`);
            startServer(attemptPort + 1);
        } else {
            console.error('HTTP Server Error:', e);
        }
    });

    server.listen(attemptPort, () => {
        console.log(`Server listening on port ${attemptPort}`);
    });
};

const initialPort = process.env.PORT || 8080;
startServer(initialPort);

// Config
const SUPABASE_URL = 'https://pyawabcoppwaaaewpkny.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__MNgyCgZ98xSGsWc4z1lHg_zVKdyZZc';

// State Management (In-memory for demo)
// Map<phoneNumber, { access_token, user }>
const sessions = new Map();

// Client Initialization
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'buzzlab_bot_v2' }),
    puppeteer: puppeteerConfig,
    // HAPUS webVersionCache untuk memaksa versi default yang mungkin lebih kompatibel
});

// Helper: Get Supabase Client for User
const getUserSupabase = (accessToken) => {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    });
};

// Main Supabase (for auth only)
const authSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Reminder Logic
const checkReminders = async () => {
    // Pastikan client sudah siap (sudah scan QR dan login)
    if (!client.info) return;

    // console.log('Checking for reminders via RPC...'); 
    
    // 1. Panggil RPC get_due_reminders
    const { data: reminders, error } = await authSupabase.rpc('get_due_reminders');

    if (error) {
        console.error('RPC Error (checkReminders):', error.message);
        return;
    }

    if (!reminders || reminders.length === 0) return;

    console.log(`Found ${reminders.length} tasks to remind.`);

    const now = new Date();

    for (const task of reminders) {
        // ... (interval calculation logic) ...
        const lastReminded = task.last_reminded_at ? new Date(task.last_reminded_at) : null;
        let intervalMs;
        
        if (task.reminder_interval === 1) {
            intervalMs = 5 * 1000; 
        } else {
            intervalMs = task.reminder_interval * 60 * 1000;
        }

        // LOGIKA WAKTU
            const created = new Date(task.created_at);
            const timeDiff = lastReminded ? (now - lastReminded) : (now - created);
            
            let shouldRemind = false;
            
            if (!lastReminded) {
                if (now - created >= intervalMs) {
                    shouldRemind = true;
                }
            } else {
                if (now - lastReminded >= intervalMs) {
                    shouldRemind = true;
                }
            }

            if (shouldRemind) {
                let phoneNumber = task.whatsapp_number;
                
                // NORMALISASI NOMOR WA
                // Hapus karakter non-digit
                phoneNumber = phoneNumber.replace(/\D/g, '');
                
                // Pastikan format @c.us
                if (!phoneNumber.endsWith('@c.us')) {
                    phoneNumber = `${phoneNumber}@c.us`;
                }

                console.log(`Sending reminder to ${phoneNumber} for "${task.title}"`);
                
                // Format pesan
                const msg = `🔔 *REMINDER TUGAS* 🔔\n\nJudul: *${task.title}*\nPrioritas: ${task.priority}\nTenggat: ${task.due_date || '-'}\n\nJangan lupa dikerjakan ya! Ketik !done ${task.title} jika sudah selesai.`;

                try {
                    await client.sendMessage(phoneNumber, msg);
                    
                    // Update last_reminded_at via RPC
                    await authSupabase.rpc('update_last_reminded', {
                        task_id: task.id,
                        new_time: now.toISOString()
                    });

                } catch (e) {
                    console.error(`❌ Failed to send reminder to ${phoneNumber}:`, e);
                }
            }
        }
    }
};

// Run checkReminders every 5 seconds (to support the 5-sec interval)
setInterval(checkReminders, 5 * 1000);

client.on('qr', (qr) => {
    console.log('SCAN QR CODE INI MENGGUNAKAN WHATSAPP ANDA:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

// Gunakan message_create agar bisa merespon pesan dari diri sendiri (Note to Self)
client.on('message_create', async msg => {
    // Abaikan pesan yang bukan command atau pesan dari status broadcast
    if (!msg.body.startsWith('!') || msg.from === 'status@broadcast') return;

    // Cegah bot merespon balasannya sendiri (jika balasan mengandung tanda seru di awal - jarang terjadi tapi untuk keamanan)
    // msg.id.fromMe bernilai true jika pesan dikirim oleh akun host.
    // Kita izinkan fromMe HANYA jika itu pesan ke diri sendiri (Note to Self) atau test command manual.
    // Tapi kita harus hati-hati agar tidak loop.
    // Karena logic kita hanya merespon jika startsWith('!'), dan balasan bot tidak diawali '!', maka aman.
    
    const chat = await msg.getChat();
    // Untuk pesan 'Note to Self', msg.from adalah nomor kita sendiri.
    // msg.to juga nomor kita sendiri.
    const sender = msg.from; 
    const text = msg.body.trim();

    // Command Handling
    if (text.startsWith('!trigger')) {
        msg.reply('Memicu pengecekan reminder manual...');
        await checkReminders();
        msg.reply('Pengecekan selesai. Cek log terminal.');
    }

    if (text.startsWith('!help')) {
        msg.reply(
            `*BuzzLab Bot Help*\n\n` +
            `Gunakan perintah berikut:\n` +
            `1. *!add <Judul> [| <Tgl> | <Interval>]*\n   Contoh: !add Rapat | 2024-12-31 | 60\n` +
            `2. *!list* - Lihat tugas aktif\n` +
            `3. *!done <Nomor>* - Tandai selesai\n` +
            `4. *!login <email> <password>* - Login manual (jika nomor belum terdaftar)\n` +
            `5. *!logout* - Logout sesi manual`
        );
    } 
    
    else if (text.startsWith('!add')) {
        let rawInput = text.slice(4).trim(); // !add length is 4
        if (!rawInput) {
            msg.reply('⚠️ Format salah.\nContoh: *!add Beli Susu | 2024-12-31 | 60*');
            return;
        }

        // Parse Input: Title | DueDate | Interval
        // Separator bisa " | " atau "|" atau " -- " (legacy support)
        let parts;
        if (rawInput.includes('|')) {
            parts = rawInput.split('|').map(p => p.trim());
        } else if (rawInput.includes('--')) {
            parts = rawInput.split('--').map(p => p.trim());
        } else {
            parts = [rawInput];
        }

        const title = parts[0];
        const dueDate = parts[1] || null;
        const interval = parts[2] ? parseInt(parts[2]) : 0;

        // Validasi Tanggal Sederhana
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
             msg.reply('⚠️ Format tanggal salah. Gunakan YYYY-MM-DD.');
             return;
        }

        // Coba Insert via RPC (Berdasarkan Nomor WA Sender)
        // Format sender: 628123456789@c.us -> +628123456789
        const senderNumber = sender.replace('@c.us', '');
        const formattedNumber = senderNumber.startsWith('+') ? senderNumber : `+${senderNumber}`;

        const { data: rpcResult, error: rpcError } = await authSupabase.rpc('create_task_from_bot', {
            p_whatsapp_number: formattedNumber,
            p_title: title,
            p_due_date: dueDate,
            p_interval: interval
        });

        if (rpcResult && rpcResult.success) {
            let reply = `✅ Tugas *"${title}"* berhasil ditambahkan!`;
            if (dueDate) reply += `\n📅 Tenggat: ${dueDate}`;
            if (interval > 0) reply += `\n⏰ Reminder: Tiap ${interval} menit`;
            msg.reply(reply);
            return;
        }

        // Jika RPC gagal karena User Not Found, coba fallback ke sesi manual (!login)
        if (rpcResult && !rpcResult.success && rpcResult.message === 'User not found') {
            const session = sessions.get(sender);
            if (session) {
                // Gunakan sesi login manual
                const supabase = getUserSupabase(session.access_token);
                const { error } = await supabase.from('tasks').insert([{
                    user_id: session.user.id,
                    title: title,
                    priority: 'medium',
                    status: 'active',
                    due_date: dueDate,
                    reminder_interval: interval
                }]);

                if (error) {
                    msg.reply('❌ Gagal menambah tugas (Login Session): ' + error.message);
                } else {
                    msg.reply(`✅ Tugas *"${title}"* ditambahkan (via Login Session)!`);
                }
            } else {
                msg.reply('⚠️ Nomor Anda belum terdaftar di profil BuzzLab.\nSilakan update nomor WhatsApp di menu settings website, atau gunakan !login <email> <password>.');
            }
        } else {
            console.error('RPC Error (!add):', rpcError || rpcResult);
            msg.reply('❌ Terjadi kesalahan sistem saat menambah tugas.');
        }
    }

    else if (text.startsWith('!login')) {
        const parts = text.split(' ');
        if (parts.length < 3) {
            msg.reply('Format salah. Gunakan: !login <username> <password>');
            return;
        }

        let email = parts[1];
        const password = parts[2];

        // Auto-append domain if username provided
        if (!email.includes('@')) {
            email += '@todolist.app';
        }

        try {
            const { data, error } = await authSupabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                msg.reply(`Login gagal: ${error.message}`);
                return;
            }

            sessions.set(sender, {
                access_token: data.session.access_token,
                user: data.user
            });

            msg.reply(`Login berhasil! Halo ${data.user.user_metadata?.name || email}. Ketik !list untuk melihat tugas.`);
        } catch (e) {
            console.error(e);
            msg.reply('Terjadi kesalahan saat login.');
        }
    }

    else if (text.startsWith('!logout')) {
        if (sessions.has(sender)) {
            sessions.delete(sender);
            msg.reply('Anda telah logout.');
        } else {
            msg.reply('Anda belum login.');
        }
    }

    // Auth Guard for other commands
    else if (['!list', '!done'].some(cmd => text.startsWith(cmd))) {
        const session = sessions.get(sender);
        if (!session) {
            msg.reply('Anda belum login. Silakan login dengan command: !login <username> <password>');
            return;
        }

        const supabase = getUserSupabase(session.access_token);

        if (text.startsWith('!list')) {
            const { data: tasks, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) {
                msg.reply('Gagal mengambil data tugas.');
                return;
            }

            if (tasks.length === 0) {
                msg.reply('Tidak ada tugas aktif. Gunakan !add untuk menambah.');
            } else {
                let reply = '*Daftar Tugas Anda:*\n\n';
                tasks.forEach((t, i) => {
                    const dateStr = t.due_date ? ` [📅 ${t.due_date}]` : '';
                    reply += `${i + 1}. ${t.title} [${t.priority}]${dateStr}\n`;
                });
                // Store mapping for this user to select by index
                session.lastTasks = tasks; 
                msg.reply(reply);
            }
        }

        else if (text.startsWith('!done')) {
            const index = parseInt(text.split(' ')[1]) - 1;
            
            if (isNaN(index) || !session.lastTasks || !session.lastTasks[index]) {
                msg.reply('Nomor tugas tidak valid. Gunakan !list dulu untuk melihat nomor.');
                return;
            }

            const task = session.lastTasks[index];
            const { error } = await supabase
                .from('tasks')
                .update({ status: 'completed' })
                .eq('id', task.id);

            if (error) {
                msg.reply('Gagal update tugas.');
            } else {
                msg.reply(`Tugas "${task.title}" ditandai selesai! ✅`);
                // Remove from local cache
                session.lastTasks.splice(index, 1);
            }
        }
    }
});

console.log('Memulai bot...');
client.initialize();

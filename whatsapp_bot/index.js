require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const http = require('http');
const { processWithAI } = require('./ai_service');
const { checkScheduledMessages } = require('./scheduler_service');

console.log('Bot Version: 3.0 (AI Enabled)');

// Setup Puppeteer for Termux/Linux vs Windows
let puppeteerConfig = {
    headless: true,
    timeout: 0, // Matikan timeout sepenuhnya (tunggu selamanya)
    ignoreDefaultArgs: ['--enable-automation'], // Sembunyikan infobar otomatisasi
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // PENTING: Paksa satu proses saja agar hemat RAM
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-features=site-per-process'
    ]
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
// Anti-Spam / Anti-Loop Guard: Map<senderId, lastTimestamp>
const lastRequestTime = new Map();
// Chat History Context: Map<senderId, Array<{role, content}>>
const chatHistory = new Map();

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
        // Suppress network errors (fetch failed) to avoid log spam
        if (error.message && error.message.includes('fetch failed')) {
            // console.warn('Network glitch (checkReminders), retrying later...');
            return;
        }
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
        
        // Interval dalam menit (Bebas, sesuai input user)
        // Default ke 60 menit jika null/0
        const intervalMinutes = task.reminder_interval && task.reminder_interval > 0 ? task.reminder_interval : 60;
        intervalMs = intervalMinutes * 60 * 1000;

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

                // Hitung nomor urut tugas untuk user ini
                let taskNumber = '?';
                try {
                    // Step 1: Dapatkan user_id dari profiles berdasarkan whatsapp_number
                    const { data: profile, error: profileError } = await authSupabase
                        .from('profiles')
                        .select('id')
                        .eq('whatsapp_number', task.whatsapp_number)
                        .single();

                    if (profileError || !profile) {
                         console.error('Debug: Could not find profile for number:', task.whatsapp_number);
                    } else {
                        // Step 2: Ambil semua tugas aktif milik user_id tersebut
                        const { data: userTasks, error: rankError } = await authSupabase
                            .from('tasks')
                            .select('id')
                            .eq('user_id', profile.id) // Gunakan user_id yang benar
                            .eq('status', 'active')
                            .order('created_at', { ascending: false });
        
                        if (!rankError && userTasks) {
                            const taskIndex = userTasks.findIndex(t => t.id === task.id);
                            taskNumber = taskIndex !== -1 ? taskIndex + 1 : '?';
                        }
                    }
                } catch (err) {
                    console.error('Error calculating task number:', err.message);
                }

                console.log(`Sending reminder to ${phoneNumber} for "${task.title}" (Task #${taskNumber})`);
                
                // Format Tanggal
                let dateStr = '-';
                if (task.due_date) {
                    try {
                        dateStr = new Date(task.due_date).toLocaleString('id-ID', { 
                            timeZone: 'Asia/Jakarta',
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', 
                            hour: '2-digit', minute: '2-digit' 
                        }).replace('.', ':'); // Fix separator jam di beberapa locale
                    } catch (e) { dateStr = task.due_date; }
                }

                // Siapkan Pesan Teks (Tanpa Tombol karena Deprecated)
                const msgText = `🔔 *REMINDER TUGAS* 🔔\n\n` +
                                `Judul: *${task.title}*\n` +
                                `Prioritas: ${task.priority}\n` +
                                `Tenggat: ${dateStr}\n\n` +
                                `Ketik perintah di bawah untuk merespon:\n` +
                                `✅ Selesai: *!done ${taskNumber}*\n` +
                                `⏰ Tunda: *!snooze ${taskNumber}*`;

                try {
                    await client.sendMessage(phoneNumber, msgText);
                } catch (e) {
                    console.error(`❌ Failed to send reminder text:`, e.message);
                }
                    
                // Update last_reminded_at via UPDATE biasa (bukan RPC, untuk menghindari masalah permissions/rpc)
                const { error: updateError } = await authSupabase
                    .from('tasks')
                    .update({ last_reminded_at: now.toISOString() })
                    .eq('id', task.id);

                if (updateError) {
                    console.error('Failed to update last_reminded_at:', updateError.message);
                }
            }
    }
};

// Run checkReminders every 30 seconds (less frequent to avoid congestion)
setInterval(checkReminders, 30 * 1000);

client.on('qr', (qr) => {
    console.log('SCAN QR CODE INI MENGGUNAKAN WHATSAPP ANDA:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Client is ready!');
    
    // Start Scheduler (Check every 60 seconds)
    console.log('⏰ Starting Scheduler Service...');
    checkScheduledMessages(client); // Run immediately
    setInterval(() => {
        checkScheduledMessages(client);
    }, 60000);
});

// Gunakan message_create agar bisa merespon pesan dari diri sendiri (Note to Self)
client.on('message_create', async msg => {
    // Abaikan pesan dari status broadcast
    if (msg.from === 'status@broadcast') return;

    console.log(`[MSG] From: ${msg.from} | Body: ${msg.body.substring(0, 50)}...`);

    const text = msg.body.trim();
    if (!text) return;

    // SAFETY CHECK: Abaikan pesan dari bot sendiri (menghindari loop)
    // Kecuali jika user menggunakan fitur "Note to Self", maka msg.fromMe = true.
    // Kita bedakan berdasarkan konten: Jika diawali emoji bot, abaikan.
    if (msg.id.fromMe) {
        if (text.startsWith('🤖') || text.startsWith('🔔') || text.startsWith('✅') || text.startsWith('⏰') || text.startsWith('⚠️') || text.startsWith('❌')) {
            return;
        }
    }

    // Cegah bot merespon balasannya sendiri (jika balasan mengandung tanda seru di awal - jarang terjadi tapi untuk keamanan)
    // msg.id.fromMe bernilai true jika pesan dikirim oleh akun host.
    // Kita izinkan fromMe HANYA jika itu pesan ke diri sendiri (Note to Self) atau test command manual.
    // Tapi kita harus hati-hati agar tidak loop.
    // Karena logic kita hanya merespon jika startsWith('!'), dan balasan bot tidak diawali '!', maka aman.
    
    const chat = await msg.getChat();
    // Untuk pesan 'Note to Self', msg.from adalah nomor kita sendiri.
    // msg.to juga nomor kita sendiri.
    const sender = msg.from;

    // Command Handling
    // Gunakan satu rantai if-else if raksasa untuk mencegah eksekusi ganda

    // 1. HANDLER !done & !snooze
    if (text.startsWith('!done ') || text.startsWith('!snooze ')) {
        const isDone = text.startsWith('!done ');
        const args = text.split(' ');
        const taskNumber = parseInt(args[1]);
        
        if (isNaN(taskNumber)) {
             msg.reply('⚠️ Harap sertakan nomor tugas yang valid. Contoh: !done 1');
             return;
        }

        // Cari session login untuk user ini (opsional)
        let session = sessions.get(sender);
        
        // Cari task berdasarkan nomor urut (tanpa perlu session login bot)
        const senderNumber = sender.replace('@c.us', '');
        
        // Coba variasi format nomor untuk mencari profile
        const formats = [
            senderNumber.startsWith('+') ? senderNumber : `+${senderNumber}`, // Format +62
            senderNumber.startsWith('+') ? senderNumber.substring(1) : senderNumber // Format 62
        ];

        let userProfile = null;
        
        // Coba cari profile dengan format pertama
        let { data: profile, error: profileError } = await authSupabase
            .from('profiles')
            .select('id')
            .eq('whatsapp_number', formats[0])
            .single();

        if (profile) {
            userProfile = profile;
        } else {
            // Jika tidak ketemu, coba format kedua
            const { data: profile2 } = await authSupabase
                .from('profiles')
                .select('id')
                .eq('whatsapp_number', formats[1])
                .single();
            userProfile = profile2;
        }

        if (!userProfile) {
            msg.reply('⚠️ Nomor Anda tidak terdaftar dalam sistem.');
            return;
        }

        // Ambil semua tugas aktif user ini berdasarkan user_id
        const { data: tasks, error } = await authSupabase
            .from('tasks')
            .select('*')
            .eq('user_id', userProfile.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error || !tasks || tasks.length === 0) {
            msg.reply('⚠️ Tidak ada tugas aktif yang ditemukan.');
            return;
        }

        const taskIndex = taskNumber - 1;
        if (taskIndex < 0 || taskIndex >= tasks.length) {
            msg.reply(`⚠️ Nomor tugas tidak valid. Masukkan nomor antara 1 - ${tasks.length}.`);
            return;
        }

        const task = tasks[taskIndex];

        if (isDone) {
            // Update status selesai
            const completedAt = new Date().toISOString();
            const { error: updateError } = await authSupabase
                .from('tasks')
                .update({ status: 'completed', completed_at: completedAt })
                .eq('id', task.id);

            if (updateError) {
                msg.reply('❌ Gagal update status tugas.');
            } else {
                msg.reply(`✅ Mantap! Tugas *"${task.title}"* (No. ${taskNumber}) telah ditandai selesai.`);
            }
        } else {
            // Logic Tunda 15 Menit (!snooze)
            const intervalMs = (task.reminder_interval || 60) * 60 * 1000; // Default 60m jika null
            const snoozeMs = 15 * 60 * 1000;
            
            // Pastikan tidak error jika interval < 15 menit
            const newLastRemindedTime = new Date(Date.now() - intervalMs + snoozeMs);

            const { error: updateError } = await authSupabase
                .from('tasks')
                .update({ last_reminded_at: newLastRemindedTime.toISOString() })
                .eq('id', task.id);

            if (updateError) {
                msg.reply('❌ Gagal menunda tugas.');
            } else {
                msg.reply(`⏰ Oke, saya ingatkan lagi soal *"${task.title}"* dalam 15 menit.`);
            }
        }
        return; 
    }

    // 2. HANDLER !trigger
    else if (text.startsWith('!trigger')) {
        msg.reply('Memicu pengecekan reminder manual...');
        await checkReminders();
        msg.reply('Pengecekan selesai. Cek log terminal.');
    }

    // 3. HANDLER !help
    else if (text.startsWith('!help')) {
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
    
    // 4. HANDLER !add
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
                    let dStr = '';
                    if (t.due_date) {
                        try {
                            dStr = ' [📅 ' + new Date(t.due_date).toLocaleString('id-ID', { 
                                timeZone: 'Asia/Jakarta',
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                            }).replace('.', ':') + ']';
                        } catch (e) { dStr = ` [📅 ${t.due_date}]`; }
                    }
                    reply += `${i + 1}. ${t.title} [${t.priority}]${dStr}\n`;
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

    // ---------------------------------------------------------
    // AI HANDLER (Untuk chat & perintah natural language)
    // ---------------------------------------------------------
    else {
        // SAFETY GUARD: Matikan AI untuk pesan dari diri sendiri (Loop Prevention)
        // Jika true, berarti pesan ini dikirim oleh BOT (atau user di Note to Self).
        // Kita block agar bot tidak membalas balasannya sendiri terus menerus.
        if (msg.fromMe) return;

        // PENTING: Jangan biarkan AI merespon pesan Command (!)
        if (text.startsWith('!')) return;

        // Hanya respon jika pesan cukup panjang (hindari "ok", "y")
        if (text.length < 2) return;

        // RATE LIMITER: Cegah spam request ke AI (Max 1 request per 3 detik per user)
        // Ini melindungi dari infinite loop jika user/bot mengirim pesan bertubi-tubi
        const now = Date.now();
        const lastTime = lastRequestTime.get(sender) || 0;
        if (now - lastTime < 3000) {
            console.warn(`[RATE LIMIT] Ignoring spam from ${sender}`);
            return;
        }
        lastRequestTime.set(sender, now);

        // Fetch User Profile & Tasks for Context
        let userProfile = null;
        let tasks = [];
        let isManualLogin = false;

        // PRIORITAS 1: Cek apakah user sudah login manual via !login
        const session = sessions.get(sender);
        if (session && session.user) {
            userProfile = session.user; // Pakai data user dari sesi login
            isManualLogin = true;
            
            // Ambil tugas menggunakan token user (Pasti berhasil, bypass RLS)
            try {
                const userClient = getUserSupabase(session.access_token);
                const { data: t, error } = await userClient
                    .from('tasks')
                    .select('*')
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })
                    .limit(10);
                
                if (!error && t) tasks = t;
            } catch (err) {
                console.error('Error fetching tasks via session:', err.message);
            }
        }

        // PRIORITAS 2: Jika belum login, coba cari manual by Phone Number (Public Lookup)
        if (!userProfile) {
            const senderNumber = sender.replace('@c.us', '');
            const formats = [
                senderNumber.startsWith('+') ? senderNumber : `+${senderNumber}`, 
                senderNumber.startsWith('+') ? senderNumber.substring(1) : senderNumber
            ];

            let { data: profile } = await authSupabase.from('profiles').select('id').eq('whatsapp_number', formats[0]).single();
            if (profile) userProfile = profile;
            else {
                let { data: profile2 } = await authSupabase.from('profiles').select('id').eq('whatsapp_number', formats[1]).single();
                userProfile = profile2;
            }

            // Fallback: Coba format 08xx jika 628xx gagal
            if (!userProfile && senderNumber.startsWith('62')) {
                const localFormat = '0' + senderNumber.substring(2);
                let { data: profile3 } = await authSupabase.from('profiles').select('id').eq('whatsapp_number', localFormat).single();
                if (profile3) userProfile = profile3;
            }
            
            // Jika ketemu profil via nomor HP, coba ambil tugas (mungkin diblokir RLS jika tabel private)
            if (userProfile) {
                const { data: t } = await authSupabase
                    .from('tasks')
                    .select('*')
                    .eq('user_id', userProfile.id)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })
                    .limit(10);
                if (t) tasks = t;
            }
        }
        
        let taskContext = "";
        if (userProfile) {
            if (tasks && tasks.length > 0) {
                // Format lebih jelas agar AI tidak bingung (Priority & Date explicit)
                taskContext = tasks.map((t, i) => `${i+1}. ${t.title} (Prioritas: ${t.priority || 'medium'}, Deadline: ${t.due_date || '-'})`).join('\n');
            } else {
                taskContext = "TIDAK ADA TUGAS.";
            }
        } else {
            // INFO PENTING: Beritahu AI bahwa user belum login
            taskContext = `USER_NOT_LOGGED_IN. SARANKAN: !login <email> <pass>`;
        }

        // Ambil History Chat
        let history = chatHistory.get(sender) || [];
        // Limit history to last 6 messages (3 turns) to save tokens/memory
        if (history.length > 6) history = history.slice(history.length - 6);

        // Proses dengan AI
        // await client.sendMessage(sender, "⏳"); // Hapus indikator loading yang mengganggu
        const aiResponse = await processWithAI(text, taskContext, history);
        
        // Simpan ke History (User & AI)
        history.push({ role: 'user', content: text });
        history.push({ role: 'assistant', content: aiResponse.text });
        chatHistory.set(sender, history);
        
        // Cek apakah ada JSON Action di dalam respon AI
        let jsonMatch = aiResponse.text.match(/```json\s*([\s\S]*?)\s*```/);
        let jsonString = null;

        if (jsonMatch) {
            jsonString = jsonMatch[1];
        } else {
            // Fallback: Manual Extraction untuk JSON tanpa code block
            // Cari posisi dimulainya {"action"
            const actionIndex = aiResponse.text.indexOf('{"action"');
            if (actionIndex !== -1) {
                // Cari tutup kurawal terakhir di pesan
                const lastBraceIndex = aiResponse.text.lastIndexOf('}');
                if (lastBraceIndex > actionIndex) {
                    jsonString = aiResponse.text.substring(actionIndex, lastBraceIndex + 1);
                    jsonMatch = [jsonString]; // Mock match agar bisa di-replace
                }
            }
        }
        
        // Default reply adalah teks dari AI (bersihkan JSON jika ada)
        let finalReply = aiResponse.text;
        if (jsonMatch) {
            finalReply = aiResponse.text.replace(jsonMatch[0], '').trim(); // Selalu hapus JSON dari chat
        }

        if (jsonString) {
            try {
                const actionData = JSON.parse(jsonString);
                
                if (actionData.action === 'create_task' && userProfile) {
                    const { title, priority, due_date, reminder_interval } = actionData.data;
                    
                    // Fix Timezone: Asumsikan input AI "YYYY-MM-DD HH:mm" adalah WIB (UTC+7)
                    let fixedDueDate = due_date ? due_date.trim() : null;
                    // console.log('[DEBUG AI] Create Task Raw DueDate:', fixedDueDate);

                    // FALLBACK AGRESIF: Selalu cari jam di teks user untuk menimpa/melengkapi jam AI
                            // Jika AI mengembalikan tanggal valid (minimal ada YYYY-MM-DD)
                            if (fixedDueDate) {
                                // Ekstrak YYYY-MM-DD dengan regex agar aman
                                const dateMatch = fixedDueDate.match(/^(\d{4}-\d{2}-\d{2})/);
                                const dateBase = dateMatch ? dateMatch[1] : fixedDueDate.substring(0, 10);
                                
                                // Cari jam di teks user (format: HH:MM, H:MM, HH.MM)
                                // Support: "jam 19:40", "pukul 19.40", "pkl 19:40", atau "19:40"
                                const timeMatch = text.match(/(?:jam|pukul|pkl)\s*(\d{1,2}[:.]\d{2})/i) || text.match(/\b(\d{1,2}[:.]\d{2})\b/);
                                
                                if (timeMatch) {
                                    let timeStr = timeMatch[1].replace('.', ':');
                                    const [h, m] = timeStr.split(':');
                                    // Padding jam/menit (misal 9:5 -> 09:05)
                                    const hStr = h.length === 1 ? '0' + h : h;
                                    const mStr = m.length === 1 ? '0' + m : m; // Asumsi menit jarang 1 digit, tapi jaga-jaga
                                    timeStr = `${hStr}:${mStr}`;
                                    
                                    // FORCE OVERRIDE JAM
                                    fixedDueDate = `${dateBase} ${timeStr}`;
                                    // console.log('[DEBUG FALLBACK] Force time injection:', fixedDueDate);
                                }
                            }

                    if (fixedDueDate && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(fixedDueDate)) {
                        let isoBase = fixedDueDate.replace(' ', 'T');
                        if (isoBase.length === 16) isoBase += ':00';
                        fixedDueDate = isoBase + '+07:00';
                        console.log('[DEBUG AI] Fixed DueDate (WIB):', fixedDueDate);
                    }

                    const { data: insertedData, error } = await authSupabase.from('tasks').insert([{
                        user_id: userProfile.id,
                        title: title || 'Tugas Baru',
                        priority: priority || 'medium',
                        due_date: fixedDueDate || null,
                        reminder_interval: reminder_interval || null,
                        status: 'active'
                    }]).select(); // Tambahkan .select() untuk melihat hasil simpan

                    if (!error) {
                        // Cek apa yang sebenarnya tersimpan di DB
                        const savedTask = insertedData && insertedData[0];
                        // console.log('[DEBUG SAVE] Saved Task DueDate:', savedTask ? savedTask.due_date : 'No Data');

                        let dateInfo = '';
                        // Gunakan data dari DB jika ada, untuk konfirmasi akurat
                        const finalDate = savedTask ? savedTask.due_date : fixedDueDate;
                        
                        if (finalDate) {
                            try {
                                dateInfo = ' 📅 ' + new Date(finalDate).toLocaleString('id-ID', { 
                                    timeZone: 'Asia/Jakarta',
                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                                }).replace('.', ':');
                            } catch (e) {}
                        }
                        finalReply = `✅ *Sukses!* Tugas "${title}" berhasil disimpan${dateInfo}`;
                        if (reminder_interval) finalReply += ` (Reminder: ${reminder_interval}m)`;
                    } else {
                        finalReply = `❌ Gagal: ${error.message}`;
                    }
                }

                else if (actionData.action === 'update_task' && userProfile) {
                    const { id, title, status, priority, due_date, reminder_interval } = actionData.data;
                    const targetIds = Array.isArray(id) ? id : [id];
                    let successCount = 0;

                    for (const targetId of targetIds) {
                        const taskIndex = parseInt(targetId) - 1;
                        if (!tasks || !tasks[taskIndex]) continue;

                        const realTask = tasks[taskIndex];
                        const updates = {};
                        if (title) updates.title = title;
                        if (status) {
                             updates.status = (status === 'selesai' || status === 'completed') ? 'completed' : status;
                             if (updates.status === 'completed') updates.completed_at = new Date().toISOString();
                        }
                        if (priority) updates.priority = priority;
                        if (due_date) {
                            let fixedDueDate = due_date ? due_date.trim() : null;
                            // console.log('[DEBUG AI] Update Task Raw DueDate:', fixedDueDate);

                            // FALLBACK AGRESIF: Selalu cari jam di teks user untuk menimpa/melengkapi jam AI
                            if (fixedDueDate) {
                                // Ekstrak YYYY-MM-DD dengan regex agar aman
                                const dateMatch = fixedDueDate.match(/^(\d{4}-\d{2}-\d{2})/);
                                const dateBase = dateMatch ? dateMatch[1] : fixedDueDate.substring(0, 10);
                                
                                // Cari jam di teks user (format: HH:MM, H:MM, HH.MM)
                                const timeMatch = text.match(/(?:jam|pukul|pkl)\s*(\d{1,2}[:.]\d{2})/i) || text.match(/\b(\d{1,2}[:.]\d{2})\b/);
                                
                                if (timeMatch) {
                                    let timeStr = timeMatch[1].replace('.', ':');
                                    const [h, m] = timeStr.split(':');
                                    const hStr = h.length === 1 ? '0' + h : h;
                                    const mStr = m.length === 1 ? '0' + m : m;
                                    timeStr = `${hStr}:${mStr}`;
                                    
                                    // FORCE OVERRIDE JAM
                                    fixedDueDate = `${dateBase} ${timeStr}`;
                                    // console.log('[DEBUG FALLBACK UPDATE] Force time injection:', fixedDueDate);
                                }
                            }

                            if (fixedDueDate && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(fixedDueDate)) {
                                let isoBase = fixedDueDate.replace(' ', 'T');
                                if (isoBase.length === 16) isoBase += ':00';
                                fixedDueDate = isoBase + '+07:00';
                                console.log('[DEBUG AI] Fixed DueDate (WIB):', fixedDueDate);
                            }
                            updates.due_date = fixedDueDate;
                        }
                        if (reminder_interval) updates.reminder_interval = reminder_interval;

                        const { data: updatedData, error } = await authSupabase.from('tasks').update(updates).eq('id', realTask.id).select();
                        if (!error) {
                            successCount++;
                            // Gunakan data aktual dari DB untuk feedback
                            if (updatedData && updatedData[0]) {
                                actionData.data.due_date = updatedData[0].due_date;
                                // console.log('[DEBUG UPDATE] Saved Task DueDate:', updatedData[0].due_date);
                            }
                        }
                    }
                    console.log(`[DEBUG AI ACTION] Update Task: TargetIds=${JSON.stringify(targetIds)}, Success=${successCount}`);
                    if (successCount === 0) console.log("Available Tasks Context:", tasks.map((t,i) => `${i+1}:${t.title}`).join(', '));
                    
                    finalReply = successCount > 0 ? `✅ ${successCount} tugas berhasil diupdate.` : `⚠️ Gagal update. Cek nomor tugas (!list).`;
                    // Tambahkan info tanggal baru jika ada update tanggal
                    if (successCount > 0 && actionData.data.due_date) {
                         try {
                             const newDateStr = new Date(actionData.data.due_date).toLocaleString('id-ID', { 
                                 timeZone: 'Asia/Jakarta',
                                 day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                             }).replace('.', ':');
                             finalReply += `\nTenggat baru: ${newDateStr}`;
                         } catch (e) {}
                    }
                }

                else if (actionData.action === 'delete_task' && userProfile) {
                    const { id } = actionData.data;
                    const targetIds = Array.isArray(id) ? id : [id];
                    let successCount = 0;

                    for (const targetId of targetIds) {
                         const taskIndex = parseInt(targetId) - 1;
                         if (!tasks || !tasks[taskIndex]) continue;
                         
                         const { error } = await authSupabase.from('tasks').delete().eq('id', tasks[taskIndex].id);
                         if (!error) successCount++;
                    }
                    finalReply = successCount > 0 ? `🗑️ ${successCount} tugas berhasil dihapus.` : `⚠️ Gagal hapus. Cek nomor tugas (!list).`;
                }
            } catch (e) {
                console.error("Gagal parsing JSON Action:", e);
            }
        }

        // Kirim balasan final (Teks AI + Status Aksi)
        if (finalReply) await client.sendMessage(sender, finalReply);
    }
});

console.log('Memulai bot...');
client.initialize();

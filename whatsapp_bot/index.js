const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const fs = require('fs');

// Termux / Android Detection & Configuration
const isTermux = process.env.TERMUX_VERSION || process.platform === 'android';
let puppeteerConfig = {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    headless: true
};

if (isTermux) {
    console.log('Detected Termux environment. Using system Chromium...');
    
    // List of possible Chromium paths in Termux
    const possiblePaths = [
        '/data/data/com.termux/files/usr/bin/chromium',
        '/data/data/com.termux/files/usr/bin/chromium-browser'
    ];

    let chromiumPath = null;
    for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
            chromiumPath = path;
            break;
        }
    }

    if (chromiumPath) {
        console.log(`Chromium found at: ${chromiumPath}`);
        puppeteerConfig.executablePath = chromiumPath;
    } else {
        // Try finding it with 'which' command as last resort
        try {
            const { execSync } = require('child_process');
            chromiumPath = execSync('which chromium').toString().trim();
            if (chromiumPath && fs.existsSync(chromiumPath)) {
                 console.log(`Chromium found via 'which': ${chromiumPath}`);
                 puppeteerConfig.executablePath = chromiumPath;
            } else {
                 throw new Error('Not found');
            }
        } catch (e) {
            console.error('ERROR: Chromium not found! Please run: pkg install chromium');
            console.error('Searched in:', possiblePaths.join(', '));
            process.exit(1);
        }
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

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig
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

        let shouldRemind = false;
        
        if (!lastReminded) {
            const created = new Date(task.created_at);
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

            console.log(`Attempting to send reminder to ${phoneNumber} for task "${task.title}"`);
            
            // Format pesan
            const msg = `🔔 *REMINDER TUGAS* 🔔\n\nJudul: *${task.title}*\nPrioritas: ${task.priority}\nTenggat: ${task.due_date || '-'}\n\nJangan lupa dikerjakan ya! Ketik !done ${task.title} jika sudah selesai.`;

            try {
                // Cek apakah nomor valid dan terdaftar di WA
                const isRegistered = await client.isRegisteredUser(phoneNumber);
                if (!isRegistered) {
                    console.log(`⚠️ Number ${phoneNumber} is not registered on WhatsApp.`);
                    continue;
                }

                // Kirim pesan
                await client.sendMessage(phoneNumber, msg);
                console.log(`✅ Reminder sent to ${phoneNumber}`);

                // Update last_reminded_at via RPC
                const { error: updateError } = await authSupabase.rpc('update_last_reminded', {
                    task_id: task.id,
                    new_time: now.toISOString()
                });

                if (updateError) {
                    console.error(`Failed to update timestamp for task ${task.id}:`, updateError.message);
                }

            } catch (e) {
                console.error(`❌ Failed to send reminder to ${phoneNumber}:`, e);
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
    if (text.startsWith('!help')) {
        msg.reply(
            `*BuzzLab Bot Help*\n\n` +
            `Use these commands to manage your tasks:\n` +
            `1. *!login <username> <password>* - Login to your account\n` +
            `2. *!list* - List your active tasks\n` +
            `3. *!add <title> [-- <date>]* - Add task (Date format: YYYY-MM-DD)\n` +
            `4. *!done <task number>* - Mark task as completed\n` +
            `5. *!logout* - Logout from bot`
        );
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
    else if (['!list', '!add', '!done'].some(cmd => text.startsWith(cmd))) {
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

        else if (text.startsWith('!add')) {
            let rawInput = text.slice(5).trim();
            if (!rawInput) {
                msg.reply('Tulis judul tugas. Contoh: !add Belajar Coding');
                return;
            }

            let title = rawInput;
            let dueDate = null;

            // Check for date separator ' -- '
            if (rawInput.includes(' -- ')) {
                const parts = rawInput.split(' -- ');
                title = parts[0].trim();
                dueDate = parts[1].trim();
                
                // Simple date validation (YYYY-MM-DD)
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(dueDate)) {
                     msg.reply('Format tanggal salah. Gunakan YYYY-MM-DD. Contoh: !add Rapat -- 2023-12-31');
                     return;
                }
            }

            const newTask = {
                user_id: session.user.id,
                title: title,
                priority: 'medium',
                status: 'active',
                due_date: dueDate
            };

            const { error } = await supabase.from('tasks').insert([newTask]);

            if (error) {
                msg.reply('Gagal menambah tugas.');
            } else {
                msg.reply(`Tugas "${title}" berhasil ditambahkan!${dueDate ? ` (Tenggat: ${dueDate})` : ''}`);
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

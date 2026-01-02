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
const port = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('BuzzLab Bot is Active!');
});
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

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
    console.log('Checking for reminders...');
    
    // 1. Get all active tasks with reminders
    // We use authSupabase but without user context (public query).
    // Note: RLS must allow reading tasks if they have reminders, or we need Service Role Key.
    // Assuming we don't have Service Key, this query might fail if RLS is strict.
    // BUT, for this demo, let's try. If it fails, we need the Service Key.
    
    // WORKAROUND: Since we don't have Service Role Key, we can only remind users who are "logged in" via the bot session.
    // We will iterate over active bot sessions.
    
    // Also include "self" (host user) if not explicitly logged in but matches the number
    const hostNumber = client.info ? client.info.wid.user : null;
    
    const usersToCheck = new Map(sessions);
    
    // If host number is not in sessions (didn't do !login), we might want to check for them too if we had a way to get their tasks.
    // But we need an access token to read their tasks.
    // Unless we assume the host is "ruzziq@gmail.com" and we hardcode/store that token?
    // Or we rely on the fact that if you use your own number, you should have done !login.
    
    // However, the user said "saya memakai nomer saya sendiri... tapi bot tidak mengirim reminder".
    // Issue: Maybe the phone number format in DB (62812...) doesn't match the session key (62812...@c.us)?
    // Or maybe the loop is skipping because of some mismatch.
    
    console.log(`Active sessions: ${usersToCheck.size}`);

    for (const [phoneNumber, session] of usersToCheck.entries()) {
        if (!session.user) {
            console.log(`Skipping ${phoneNumber}: No user session`);
            continue;
        }
        
        console.log(`Checking tasks for ${phoneNumber} (User: ${session.user.email})...`);

        const userClient = getUserSupabase(session.access_token);
        
        const { data: tasks, error } = await userClient
            .from('tasks')
            .select('*')
            .eq('status', 'active')
            .gt('reminder_interval', 0);

        if (error) {
            console.error(`Error fetching tasks for ${phoneNumber}:`, error.message);
            continue;
        }

        if (!tasks || tasks.length === 0) {
             // console.log(`No active reminders for ${phoneNumber}`);
             continue;
        }

        const now = new Date();
        
        for (const task of tasks) {
            const lastReminded = task.last_reminded_at ? new Date(task.last_reminded_at) : null;
            
            // Handle special 5-second interval (represented as 1 minute in DB for simplicity, or we check specifically)
            // Let's assume value '1' means 5 seconds for this demo request.
            // Normal logic: intervalMs = task.reminder_interval * 60 * 1000;
            
            let intervalMs;
            if (task.reminder_interval === 1) {
                intervalMs = 5 * 1000; // 5 seconds
            } else {
                intervalMs = task.reminder_interval * 60 * 1000; // minutes to ms
            }
            
            let shouldRemind = false;
            
            if (!lastReminded) {
                // Never reminded. Check if created_at + interval passed? 
                // Or just remind immediately if it's new?
                // Let's remind if created_at was > interval ago.
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
                // Send WhatsApp Message
                // phoneNumber is like '62812...@c.us'
                const msg = `🔔 *REMINDER TUGAS* 🔔\n\nJudul: *${task.title}*\nPrioritas: ${task.priority}\nTenggat: ${task.due_date || '-'}\n\nJangan lupa dikerjakan ya! Ketik !done ${task.title} jika sudah selesai.`;
                
                try {
                    await client.sendMessage(phoneNumber, msg);
                    console.log(`Reminder sent to ${phoneNumber} for task ${task.title}`);
                    
                    // Update last_reminded_at
                    await userClient
                        .from('tasks')
                        .update({ last_reminded_at: now.toISOString() })
                        .eq('id', task.id);
                        
                } catch (e) {
                    console.error('Failed to send reminder:', e);
                }
            }
        }
    }
    
    // NEW: Also check 'profiles' table for users who might not be logged in via !login command
    // This requires the tasks to be accessible. Since we don't have Service Key, 
    // we can only support this if RLS allows public read (bad practice) OR if we use the session map.
    // For now, sticking to session map is safer.
    // BUT, the user asked to "link user ruzziq@gmail.com".
    // If ruzziq is NOT logged in via !login, the bot won't know his token.
    // LIMITATION: Bot can only remind users who have performed !login.
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

require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const Jimp = require('jimp');
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

const SUPABASE_URL = 'https://pyawabcoppwaaaewpkny.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__MNgyCgZ98xSGsWc4z1lHg_zVKdyZZc';

const sessions = new Map();
const lastRequestTime = new Map();
const chatHistory = new Map();

const formatNowId = () => {
    return new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).replace(/\./g, ':');
};

const extractJsonAction = (raw) => {
    if (!raw) return null;
    let s = String(raw).trim();
    let candidate = null;
    const fenceMatch = s.match(/```json([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
        candidate = fenceMatch[1].trim();
    } else {
        if (/^json\s*/i.test(s)) {
            s = s.replace(/^json\s*/i, '');
        }
        const first = s.indexOf('{');
        const last = s.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) {
            candidate = s.slice(first, last + 1);
        }
    }
    if (!candidate) return null;
    try {
        return JSON.parse(candidate);
    } catch {
        return null;
    }
};

const handleAiAction = async (payload, { sender, tasks, userProfile, isManualLogin, userClient }) => {
    if (!payload || typeof payload !== 'object') return null;
    const action = (payload.action || '').toString().toLowerCase();
    const data = payload.data || {};

    if (action === 'create_task') {
        const title = data.title ? String(data.title).trim() : '';
        if (!title) return '⚠️ AI tidak mengirim judul tugas yang valid.';

        const dueRaw = data.due_date ? String(data.due_date).trim() : null;
        let rpcDue = dueRaw;
        if (dueRaw) {
            try {
                const normalized = dueRaw.replace(' ', 'T');
                const parsed = new Date(normalized);
                if (!isNaN(parsed.getTime())) {
                    rpcDue = parsed.toISOString();
                }
            } catch {
                rpcDue = dueRaw;
            }
        }

        const reminderInterval = Number.isFinite(Number(data.reminder_interval)) ? Number(data.reminder_interval) : 0;

        const senderNumber = sender.replace('@c.us', '');
        const formattedNumber = senderNumber.startsWith('+') ? senderNumber : `+${senderNumber}`;

        const { data: rpcResult, error: rpcError } = await authSupabase.rpc('create_task_from_bot', {
            p_whatsapp_number: formattedNumber,
            p_title: title,
            p_due_date: rpcDue,
            p_interval: reminderInterval
        });

        if (rpcResult && rpcResult.success) {
            let reply = `✅ Tugas *"${title}"* berhasil ditambahkan.`;
            if (dueRaw) reply += `\n📅 Tenggat: ${dueRaw}`;
            if (reminderInterval > 0) reply += `\n⏰ Reminder tiap ${reminderInterval} menit.`;
            return reply;
        }

        if (rpcResult && !rpcResult.success && rpcResult.message === 'User not found' && isManualLogin && userProfile && userClient) {
            const insertData = {
                user_id: userProfile.id,
                title: title,
                priority: data.priority || 'medium',
                status: 'active',
                due_date: rpcDue,
                reminder_interval: reminderInterval
            };
            const { error } = await userClient.from('tasks').insert([insertData]);
            if (!error) {
                let reply = `✅ Tugas *"${title}"* berhasil ditambahkan (via login).`;
                if (dueRaw) reply += `\n📅 Tenggat: ${dueRaw}`;
                if (reminderInterval > 0) reply += `\n⏰ Reminder tiap ${reminderInterval} menit.`;
                return reply;
            }
            return '❌ Gagal menambah tugas dari AI (Login Session).';
        }

        console.error('AI create_task error:', rpcError || rpcResult);
        return '❌ Gagal menambah tugas dari AI.';
    }

    if (action === 'update_task') {
        const ids = Array.isArray(data.id) ? data.id : [];
        if (!ids.length || !tasks || !tasks.length) {
            return '⚠️ Tidak bisa update tugas: daftar tugas kosong atau id tidak valid.';
        }
        const statusRaw = data.status ? String(data.status).toLowerCase() : '';
        let newStatus = statusRaw || 'completed';
        if (statusRaw === 'completed' || statusRaw === 'done') newStatus = 'completed';

        const clientForTasks = userClient || authSupabase;
        const updatedTitles = [];

        for (const idxRaw of ids) {
            const idx = parseInt(idxRaw) - 1;
            if (isNaN(idx) || idx < 0 || idx >= tasks.length) continue;
            const t = tasks[idx];
            const updatePayload = { status: newStatus };
            if (newStatus === 'completed') {
                updatePayload.completed_at = new Date().toISOString();
            }
            const { error } = await clientForTasks.from('tasks').update(updatePayload).eq('id', t.id);
            if (!error) {
                updatedTitles.push(t.title);
            }
        }

        if (!updatedTitles.length) {
            return '⚠️ Tidak ada tugas yang berhasil diupdate dari perintah AI.';
        }

        return `✅ Tugas berhasil diupdate: ${updatedTitles.map(t => `*${t}*`).join(', ')}`;
    }

    return null;
};

const cleanupChromeSingletonLock = () => {
    const baseDir = path.join(__dirname, '.wwebjs_auth', 'session-buzzlab_bot_v2');
    try {
        if (fs.existsSync(baseDir)) {
            fs.rmSync(baseDir, { recursive: true, force: true });
        }
    } catch (e) {
        console.warn('Error during Chrome SingletonLock cleanup:', e.message);
    }
};

const fontTitlePromise = Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
const fontHeaderPromise = Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
const fontSmallPromise = Jimp.loadFont(Jimp.FONT_SANS_14_BLACK);

cleanupChromeSingletonLock();

const generateTasksReportImage = async ({ userLabel, periodLabel, printedAtLabel, tasks }) => {
    const width = 1100;
    const marginX = 40;
    const marginY = 40;
    const headerGap = 10;
    const blockGap = 20;
    const summaryHeight = 80;
    const rowHeight = 36;
    const tableHeaderHeight = 40;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => (t.status || '').toLowerCase() === 'completed').length;
    const pendingTasks = tasks.filter(t => {
        const s = (t.status || '').toLowerCase();
        return s !== 'completed' && s !== 'cancelled';
    }).length;
    const lateTasks = tasks.filter(t => {
        const s = (t.status || '').toLowerCase();
        if (s === 'completed') return false;
        if (!t.due_date) return false;
        const due = new Date(t.due_date);
        return due.getTime() < Date.now();
    }).length;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const tableHeight = tableHeaderHeight + rowHeight * totalTasks;
    const estimatedHeight = marginY * 2 + 130 + blockGap + summaryHeight + blockGap + tableHeight;
    const height = estimatedHeight;

    const [fontTitle, fontHeader, fontSmall] = await Promise.all([
        fontTitlePromise,
        fontHeaderPromise,
        fontSmallPromise
    ]);

    const image = new Jimp(width, height, Jimp.rgbaToInt(255, 255, 255, 255));

    const colorText = Jimp.rgbaToInt(0, 0, 0, 255);
    const colorMuted = Jimp.rgbaToInt(120, 120, 120, 255);
    const colorBorder = Jimp.rgbaToInt(210, 210, 210, 255);
    const colorHeaderBg = Jimp.rgbaToInt(245, 245, 245, 255);
    const colorSummaryBg = Jimp.rgbaToInt(250, 250, 250, 255);
    const colorGreen = Jimp.rgbaToInt(0, 153, 51, 255);
    const colorRed = Jimp.rgbaToInt(204, 0, 0, 255);
    const colorOrange = Jimp.rgbaToInt(230, 120, 0, 255);

    const fillRect = (x, y, w, h, color) => {
        for (let yy = y; yy < y + h; yy++) {
            for (let xx = x; xx < x + w; xx++) {
                image.setPixelColor(color, xx, yy);
            }
        }
    };

    const drawRectStroke = (x, y, w, h, color) => {
        for (let xx = x; xx < x + w; xx++) {
            image.setPixelColor(color, xx, y);
            image.setPixelColor(color, xx, y + h - 1);
        }
        for (let yy = y; yy < y + h; yy++) {
            image.setPixelColor(color, x, yy);
            image.setPixelColor(color, x + w - 1, yy);
        }
    };

    let cursorY = marginY;

    image.print(fontTitle, marginX, cursorY, {
        text: `Laporan Tugas (${periodLabel})`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    }, width - marginX * 2, 40);
    cursorY += 46;

    image.print(fontHeader, marginX, cursorY, {
        text: `User: ${userLabel}`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    }, width - marginX * 2, 24);
    cursorY += 26;

    image.print(fontHeader, marginX, cursorY, {
        text: printedAtLabel,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    }, width - marginX * 2, 24);
    cursorY += 24 + headerGap;

    const summaryWidth = width - marginX * 2;
    const cardWidth = Math.floor((summaryWidth - 4) / 5);
    const cardHeight = summaryHeight;
    const summaryY = cursorY;

    const summaryItems = [
        { label: 'Total Tugas', value: String(totalTasks), color: colorText },
        { label: 'Selesai', value: String(completedTasks), color: colorGreen },
        { label: 'Pending', value: String(pendingTasks), color: colorOrange },
        { label: 'Terlambat', value: String(lateTasks), color: colorRed },
        { label: 'Penyelesaian', value: `${completionPercent}%`, color: colorText }
    ];

    summaryItems.forEach((item, idx) => {
        const x = marginX + idx * (cardWidth + 1);
        fillRect(x, summaryY, cardWidth, cardHeight, colorSummaryBg);
        drawRectStroke(x, summaryY, cardWidth, cardHeight, colorBorder);

        image.print(fontHeader, x + 8, summaryY + 8, item.label);
        image.print(fontTitle, x, summaryY + 30, {
            text: item.value,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }, cardWidth, 34);
    });

    cursorY += summaryHeight + blockGap;

    const tableX = marginX;
    const tableWidth = width - marginX * 2;

    const colNo = 60;
    const colTitle = 360;
    const colDue = 170;
    const colPriority = 150;
    const colStatus = 140;
    const colCompletedAt = tableWidth - colNo - colTitle - colDue - colPriority - colStatus;

    const tableHeaderY = cursorY;
    fillRect(tableX, tableHeaderY, tableWidth, tableHeaderHeight, colorHeaderBg);
    drawRectStroke(tableX, tableHeaderY, tableWidth, tableHeaderHeight, colorBorder);

    const headerRow = [
        { label: 'No', width: colNo },
        { label: 'Tugas & Deskripsi', width: colTitle },
        { label: 'Tenggat', width: colDue },
        { label: 'Prioritas', width: colPriority },
        { label: 'Status', width: colStatus },
        { label: 'Selesai Pada', width: colCompletedAt }
    ];

    let headerCursorX = tableX;
    headerRow.forEach(col => {
        image.print(fontHeader, headerCursorX + 8, tableHeaderY + 12, col.label);
        headerCursorX += col.width;
        if (headerCursorX < tableX + tableWidth) {
            for (let yy = tableHeaderY; yy < tableHeaderY + tableHeaderHeight; yy++) {
                image.setPixelColor(colorBorder, headerCursorX, yy);
            }
        }
    });

    cursorY += tableHeaderHeight;

    const formatDateShort = iso => {
        if (!iso) return '-';
        try {
            const d = new Date(iso);
            const datePart = d.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            const timePart = d.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace('.', ':');
            return `${datePart}`;
        } catch (e) {
            return iso;
        }
    };

    const formatTimeShort = iso => {
        if (!iso) return '-';
        try {
            const d = new Date(iso);
            return d.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace('.', ':');
        } catch (e) {
            return '-';
        }
    };

    const normalizePriority = p => {
        if (!p) return 'Medium';
        const v = String(p).toLowerCase();
        if (v === 'low') return 'Low';
        if (v === 'high') return 'High';
        return 'Medium';
    };

    const normalizeStatus = s => {
        if (!s) return 'Aktif';
        const v = String(s).toLowerCase();
        if (v === 'completed') return 'Selesai';
        if (v === 'active') return 'Aktif';
        if (v === 'pending') return 'Pending';
        return s;
    };

    const getPriorityColor = p => {
        const v = String(p).toLowerCase();
        if (v === 'low') return colorGreen;
        if (v === 'high') return colorRed;
        return colorOrange;
    };

    const getStatusColor = s => {
        const v = String(s).toLowerCase();
        if (v === 'completed') return colorGreen;
        if (v === 'pending') return colorOrange;
        if (v === 'active') return colorText;
        return colorText;
    };

    tasks.forEach((t, index) => {
        const rowY = cursorY + index * rowHeight;
        fillRect(tableX, rowY, tableWidth, rowHeight, index % 2 === 0 ? Jimp.rgbaToInt(255, 255, 255, 255) : Jimp.rgbaToInt(248, 248, 248, 255));
        drawRectStroke(tableX, rowY, tableWidth, rowHeight, colorBorder);

        const noText = String(index + 1);
        const titleText = t.title || '-';
        const dueDateText = formatDateShort(t.due_date);
        const dueTimeText = formatTimeShort(t.due_date);
        const priorityRaw = normalizePriority(t.priority);
        const statusRaw = normalizeStatus(t.status);
        const completedAtText = t.completed_at ? `${formatDateShort(t.completed_at)} ${formatTimeShort(t.completed_at)}` : '-';

        let colX = tableX;

        image.print(fontSmall, colX + 8, rowY + 10, noText);
        colX += colNo;

        image.print(fontSmall, colX + 8, rowY + 6, titleText);
        colX += colTitle;

        image.print(fontSmall, colX + 8, rowY + 4, dueDateText);
        image.print(fontSmall, colX + 8, rowY + 18, dueTimeText);
        colX += colDue;

        fillRect(colX + 6, rowY + 8, colPriority - 12, rowHeight - 16, Jimp.rgbaToInt(255, 255, 255, 255));
        image.print(fontSmall, colX + 10, rowY + 10, {
            text: priorityRaw,
            alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }, colPriority - 20, rowHeight - 20);
        colX += colPriority;

        image.print(fontSmall, colX + 10, rowY + 10, {
            text: statusRaw,
            alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }, colStatus - 16, rowHeight - 20);
        colX += colStatus;

        image.print(fontSmall, colX + 8, rowY + 10, completedAtText);
    });

    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
    return buffer.toString('base64');
};

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'buzzlab_bot_v2' }),
    puppeteer: puppeteerConfig,
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

const getUserSupabase = (accessToken) => {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    });
};

const authSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const checkReminders = async () => {
    const cycleTimeId = formatNowId();

    if (!client.info) {
        console.log(`[Reminder CCTV] ${cycleTimeId} | client=not_ready`);
        return;
    }

    const { data: reminders, error } = await authSupabase.rpc('get_due_reminders');

    if (error) {
        const msg = error.message || '';
        if (msg.includes('fetch failed')) {
            console.log(`[Reminder CCTV] ${cycleTimeId} | error=fetch_failed`);
            return;
        }
        console.error('RPC Error (checkReminders):', msg);
        console.log(`[Reminder CCTV] ${cycleTimeId} | error=${msg}`);
        return;
    }

    const count = Array.isArray(reminders) ? reminders.length : 0;
    console.log(`[Reminder CCTV] ${cycleTimeId} | cycle=30s | due=${count}`);

    if (!reminders || reminders.length === 0) return;

    const now = new Date();

    for (const task of reminders) {
        const lastReminded = task.last_reminded_at ? new Date(task.last_reminded_at) : null;
        let shouldRemind = false;
        let reminderType = 'custom'; // 'custom', '5min', '1min', 'recurring'

        const hasDueDate = task.due_date != null;
        let dueDate = null;
        
        if (hasDueDate) {
            const parsed = new Date(task.due_date);
            if (!isNaN(parsed.getTime())) {
                dueDate = parsed;
            }
        }

        if (dueDate) {
            const diffMs = dueDate.getTime() - now.getTime();
            const diffMins = diffMs / 60000;

            // 1. REMINDER 1 MENIT (Range: 0 - 1.5 menit sebelum tenggat)
            if (diffMins > 0 && diffMins <= 1.5) {
                // Kirim jika belum ada reminder dalam 2 menit terakhir
                if (!lastReminded || (now.getTime() - lastReminded.getTime() > 2 * 60 * 1000)) {
                    shouldRemind = true;
                    reminderType = '1min';
                }
            }
            // 2. REMINDER 5 MENIT (Range: 4.5 - 5.5 menit sebelum tenggat)
            else if (diffMins > 4.5 && diffMins <= 5.5) {
                // Kirim jika belum ada reminder dalam 5 menit terakhir
                if (!lastReminded || (now.getTime() - lastReminded.getTime() > 5 * 60 * 1000)) {
                    shouldRemind = true;
                    reminderType = '5min';
                }
            }
            // 3. REMINDER CUSTOM INTERVAL
            else if (task.reminder_interval && task.reminder_interval > 0) {
                const intervalMinutes = task.reminder_interval;
                const intervalMs = intervalMinutes * 60 * 1000;
                const customReminderTime = new Date(dueDate.getTime() - intervalMs);

                // Jika sudah melewati waktu reminder custom
                if (now >= customReminderTime) {
                    // Dan belum diingatkan sejak waktu reminder itu lewat
                    if (!lastReminded || lastReminded < customReminderTime) {
                        shouldRemind = true;
                        reminderType = 'custom';
                    }
                }
            }
        } else {
            // TUGAS TANPA TENGGAT (Recurring/Periodic)
            const created = new Date(task.created_at);
            const baseTime = lastReminded || created;
            const intervalMinutes = task.reminder_interval && task.reminder_interval > 0 ? task.reminder_interval : 60;
            const intervalMs = intervalMinutes * 60 * 1000;

            if (now - baseTime >= intervalMs) {
                shouldRemind = true;
                reminderType = 'recurring';
            }
        }

        if (shouldRemind) {
                let phoneNumber = task.whatsapp_number;
                
                // NORMALISASI NOMOR WA
                phoneNumber = phoneNumber.replace(/\D/g, '');
                if (!phoneNumber.endsWith('@c.us')) {
                    phoneNumber = `${phoneNumber}@c.us`;
                }

                // Hitung nomor urut tugas untuk user ini
                let taskNumber = '?';
                try {
                    const { data: profile, error: profileError } = await authSupabase
                        .from('profiles')
                        .select('id')
                        .eq('whatsapp_number', task.whatsapp_number)
                        .single();

                    if (!profileError && profile) {
                        const { data: userTasks, error: rankError } = await authSupabase
                            .from('tasks')
                            .select('id')
                            .eq('user_id', profile.id)
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

                const nowId = formatNowId();

                console.log(`[Reminder] ${nowId} | type=${reminderType} | to=${phoneNumber} | title="${task.title}"`);

                let dateStr = '-';
                if (task.due_date) {
                    try {
                        dateStr = new Date(task.due_date).toLocaleString('id-ID', { 
                            timeZone: 'Asia/Jakarta',
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', 
                            hour: '2-digit', minute: '2-digit' 
                        }).replace('.', ':');
                    } catch (e) { dateStr = task.due_date; }
                }

                // Custom Header based on Reminder Type
                let header = '🔔 *REMINDER TUGAS* 🔔';
                if (reminderType === '5min') header = '⚠️ *TUGAS TENGGAT 5 MENIT LAGI!* ⚠️';
                if (reminderType === '1min') header = '🚨 *TUGAS TENGGAT 1 MENIT LAGI!* 🚨';

                const msgText = `${header}\n\n` +
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

client.on('ready', async () => {
    console.log('✅ Client is ready!');

    try {
        const page = client.pupPage || client._page;
        if (page) {
            await page.evaluate(() => {
                if (window && window.WWebJS && typeof window.WWebJS.sendSeen === 'function') {
                    window.WWebJS.sendSeen = async () => {};
                }
            });
            console.log('🔧 Patched WWebJS.sendSeen to no-op to avoid markedUnread bug');
        } else {
            console.warn('Cannot access Puppeteer page to patch sendSeen');
        }
    } catch (e) {
        console.warn('Failed to patch sendSeen:', e.message);
    }
    
    console.log('⏰ Starting Scheduler Service...');
    checkScheduledMessages(client);
    setInterval(() => {
        checkScheduledMessages(client);
    }, 60000);
});

client.on('message', async msg => {
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

    else if (text.toLowerCase().includes('export tugas') || text.startsWith('!export')) {
        const lower = text.toLowerCase();
        let period = 'daily';
        let label = 'Harian (Hari Ini)';
        if (lower.includes('minggu') || lower.includes('mingguan') || lower.includes('minggu ini')) {
            period = 'weekly';
            label = 'Mingguan';
        } else if (lower.includes('bulan') || lower.includes('bulanan') || lower.includes('bulan ini')) {
            period = 'monthly';
            label = 'Bulanan';
        }
        if (text.startsWith('!export')) {
            const parts = lower.split(' ');
            if (parts[1] === 'minggu' || parts[1] === 'mingguan' || parts[1] === 'week') {
                period = 'weekly';
                label = 'Mingguan';
            } else if (parts[1] === 'bulan' || parts[1] === 'bulanan' || parts[1] === 'month') {
                period = 'monthly';
                label = 'Bulanan';
            } else if (parts[1] === 'hari' || parts[1] === 'harian' || parts[1] === 'day') {
                period = 'daily';
                label = 'Harian (Hari Ini)';
            }
        }

        const senderNumber = sender.replace('@c.us', '');
        let userProfile = null;
        let tasksClient = null;

        const session = sessions.get(sender);
        if (session && session.user && session.access_token) {
            userProfile = { id: session.user.id };
            tasksClient = getUserSupabase(session.access_token);
        } else {
            const formats = [
                senderNumber.startsWith('+') ? senderNumber : `+${senderNumber}`,
                senderNumber.startsWith('+') ? senderNumber.substring(1) : senderNumber
            ];
            let { data: profile } = await authSupabase
                .from('profiles')
                .select('id')
                .eq('whatsapp_number', formats[0])
                .single();
            if (profile) {
                userProfile = profile;
            } else {
                let { data: profile2 } = await authSupabase
                    .from('profiles')
                    .select('id')
                    .eq('whatsapp_number', formats[1])
                    .single();
                userProfile = profile2;
            }
            if (!userProfile && senderNumber.startsWith('62')) {
                const localFormat = '0' + senderNumber.substring(2);
                let { data: profile3 } = await authSupabase
                    .from('profiles')
                    .select('id')
                    .eq('whatsapp_number', localFormat)
                    .single();
                if (profile3) userProfile = profile3;
            }
            if (!userProfile) {
                await msg.reply('⚠️ Nomor Anda tidak terdaftar dalam sistem. Pastikan sudah mengisi nomor WhatsApp di BuzzLab.');
                return;
            }
            tasksClient = authSupabase;
        }

        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);
        if (period === 'daily') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'weekly') {
            start.setDate(start.getDate() - 7);
        } else if (period === 'monthly') {
            start.setMonth(start.getMonth() - 1);
        }
        const { data: tasks, error } = await tasksClient
            .from('tasks')
            .select('*')
            .eq('user_id', userProfile.id)
            .order('created_at', { ascending: false });
        if (error) {
            await msg.reply('❌ Gagal mengambil data tugas untuk export.');
            return;
        }
        const tasksFiltered = (tasks || []).filter(t => {
            if (!t.due_date) return false;
            const d = new Date(t.due_date);
            return d >= start && d <= end;
        });
        if (!tasksFiltered.length) {
            await msg.reply('ℹ️ Tidak ada tugas untuk periode ini.');
            return;
        }
        const dateStr = now.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const userLabel = senderNumber;
        const printedAtLabel = `Dicetak pada ${dateStr}`;
        const periodLabel = label;
        const fileName =
            period === 'daily'
                ? 'tugas_hari_ini.png'
                : period === 'weekly'
                ? 'tugas_minggu_ini.png'
                : 'tugas_bulan_ini.png';
        try {
            const base64 = await generateTasksReportImage({
                userLabel,
                periodLabel,
                printedAtLabel,
                tasks: tasksFiltered
            });
            const media = new MessageMedia('image/png', base64, fileName);
            await client.sendMessage(sender, media, { caption: `Laporan Tugas ${label}` });
        } catch (e) {
            const msgText = (e && e.message) ? e.message : String(e);
            if (msgText.includes('markedUnread') || msgText.includes('sendSeen')) {
                console.warn('WhatsApp Web internal bug (markedUnread/sendSeen) diabaikan saat kirim foto export.');
            } else {
                console.error('Error sending export image:', e);
                await msg.reply('❌ Terjadi kesalahan saat mengirim export tugas.');
            }
        }
    }

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
        let userClient = null;

        // PRIORITAS 1: Cek apakah user sudah login manual via !login
        const session = sessions.get(sender);
        if (session && session.user) {
            userProfile = session.user;
            isManualLogin = true;
            try {
                userClient = getUserSupabase(session.access_token);
                // Fetch tasks for context
                const { data: t } = await userClient
                    .from('tasks')
                    .select('*')
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })
                    .limit(5);
                if (t) tasks = t;
            } catch (e) { console.error(e); }
        } 
        
        // PRIORITAS 2: Jika belum login, cek apakah nomor WA terdaftar di Profile
        if (!isManualLogin) {
            const senderNumber = sender.replace('@c.us', '');
            const formats = [
                senderNumber.startsWith('+') ? senderNumber : `+${senderNumber}`,
                senderNumber.startsWith('+') ? senderNumber.substring(1) : senderNumber
            ];
            
            let { data: profile } = await authSupabase
                .from('profiles')
                .select('id, role')
                .eq('whatsapp_number', formats[0])
                .single();
            
            if (!profile) {
                let { data: profile2 } = await authSupabase
                    .from('profiles')
                    .select('id, role')
                    .eq('whatsapp_number', formats[1])
                    .single();
                profile = profile2;
            }

            if (profile) {
                userProfile = profile;
                // Fetch tasks using Service Role (karena kita punya profile ID)
                const { data: t } = await authSupabase
                    .from('tasks')
                    .select('*')
                    .eq('user_id', profile.id)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })
                    .limit(5);
                if (t) tasks = t;
            }
        }

        let context = '';
        if (tasks && tasks.length > 0) {
            context = tasks
                .map((t, idx) => {
                    const num = idx + 1;
                    const title = t.title || '-';
                    const priority = t.priority || 'medium';
                    const status = t.status || 'active';
                    const due = t.due_date ? new Date(t.due_date).toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }).replace(/\./g, ':') : '-';
                    return `${num}. [${priority}] ${title} | status=${status} | due=${due}`;
                })
                .join('\n');
        }
        const history = chatHistory.get(sender) || [];
        const aiResult = await processWithAI(text, context, history);
        const replyText = typeof aiResult === 'string' ? aiResult : aiResult && aiResult.text ? aiResult.text : '';

        let finalReply = '';
        const actionPayload = extractJsonAction(replyText);
        if (actionPayload && actionPayload.action) {
            try {
                const handled = await handleAiAction(actionPayload, {
                    sender,
                    tasks,
                    userProfile,
                    isManualLogin,
                    userClient
                });
                if (handled) {
                    finalReply = handled;
                }
            } catch (e) {
                console.error('Error handling AI action:', e);
            }
        }

        if (!finalReply && replyText && replyText.length > 0) {
            finalReply = replyText;
        }

        if (finalReply && finalReply.length > 0) {
            await msg.reply(finalReply);
            const newHistory = history.slice(-18);
            newHistory.push({ role: 'user', content: text });
            newHistory.push({ role: 'assistant', content: finalReply });
            chatHistory.set(sender, newHistory);
        }
    }
});

client.initialize();

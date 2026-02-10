const { createClient } = require('@supabase/supabase-js');

// Config
const SUPABASE_URL = 'https://pyawabcoppwaaaewpkny.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__MNgyCgZ98xSGsWc4z1lHg_zVKdyZZc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Check for pending messages and send them
 * @param {import('whatsapp-web.js').Client} client 
 */
async function checkScheduledMessages(client) {
    // Silent log to avoid clutter, only log when action happens
    // console.log('[Scheduler] Checking...');

    try {
        // Call RPC function
        const { data: messages, error } = await supabase.rpc('get_pending_scheduled_messages');

        if (error) {
            const msg = `${error.message || ''} ${error.details || ''}`;
            if (msg.includes('fetch failed') || msg.includes('UND_ERR_CONNECT_TIMEOUT') || msg.includes('Connect Timeout Error')) {
                // Too many logs. Reduce noise.
                // console.warn('[Scheduler] Supabase timeout/fetch failed, will retry later.');
                return;
            }
            if (!error.message.includes('function get_pending_scheduled_messages() does not exist')) {
                console.error('[Scheduler] Error fetching messages:', error);
            }
            return;
        }

        if (!messages || messages.length === 0) {
            return;
        }

        console.log(`[Scheduler] Found ${messages.length} messages to send.`);

        for (const msg of messages) {
            try {
                // Format phone number (ensure @c.us)
                let chatId = msg.phone_number;
                if (!chatId.includes('@c.us')) {
                    chatId = `${chatId}@c.us`;
                }

                // Send message
                console.log(`[Scheduler] Sending to ${chatId}: "${msg.message}"`);
                await client.sendMessage(chatId, msg.message);

                // Calculate next schedule if repeating
                let nextSchedule = null;
                if (msg.repeat_interval && msg.repeat_interval !== 'none') {
                    const currentSchedule = new Date(msg.scheduled_at);
                    
                    if (msg.repeat_interval === 'daily') {
                        currentSchedule.setDate(currentSchedule.getDate() + 1);
                    } else if (msg.repeat_interval === 'weekly') {
                        currentSchedule.setDate(currentSchedule.getDate() + 7);
                    } else if (msg.repeat_interval === 'monthly') {
                        currentSchedule.setMonth(currentSchedule.getMonth() + 1);
                    }
                    
                    nextSchedule = currentSchedule.toISOString();
                    console.log(`[Scheduler] Rescheduling message ${msg.id} to ${nextSchedule} (${msg.repeat_interval})`);
                }

                // Mark as sent (and reschedule if needed)
                const { error: updateError } = await supabase.rpc('mark_scheduled_message_sent', {
                    msg_id: msg.id,
                    new_status: 'sent',
                    next_schedule: nextSchedule
                });

                if (updateError) console.error('[Scheduler] Failed to update status:', updateError);
                else console.log(`[Scheduler] Message ${msg.id} sent & marked.`);

            } catch (sendError) {
                console.error(`[Scheduler] Failed to send message ${msg.id}:`, sendError);
                
                // Mark as failed
                await supabase.rpc('mark_scheduled_message_sent', {
                    msg_id: msg.id,
                    new_status: 'failed'
                });
            }
        }

    } catch (e) {
        console.error('[Scheduler] Critical error:', e);
    }
}

module.exports = { checkScheduledMessages };

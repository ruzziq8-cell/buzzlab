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
            // Ignore "function not found" if SQL hasn't been run yet
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

                // Mark as sent
                const { error: updateError } = await supabase.rpc('mark_scheduled_message_sent', {
                    msg_id: msg.id,
                    new_status: 'sent'
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

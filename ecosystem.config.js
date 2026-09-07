'use strict';

// pm2 process file for a VPS:
//   npm ci && pm2 start ecosystem.config.js && pm2 save
//
// pm2 sets pm_id in the environment, which is how .restart knows that exiting
// will be followed by a restart rather than leaving the bot offline.
module.exports = {
    apps: [
        {
            name: 'toosii-xd-ultra',
            script: 'index.js',
            instances: 1,
            // A WhatsApp socket cannot be shared across workers: a second
            // connection on the same credentials triggers a 401 conflict.
            exec_mode: 'fork',
            autorestart: true,
            max_restarts: 20,
            // Stops a boot-loop from hammering WhatsApp and risking a ban.
            restart_delay: 5000,
            max_memory_restart: '600M',
            env: {
                NODE_ENV: 'production',
                RESTART_SUPERVISED: 'true'
            },
            out_file: 'logs/out.log',
            error_file: 'logs/error.log',
            merge_logs: true,
            time: true
        }
    ]
};

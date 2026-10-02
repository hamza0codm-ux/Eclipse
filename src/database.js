import pg from 'pg';

import { config } from './config.js';

const { Pool } = pg;

const pool = new Pool({
    connectionString: config.database.url,
    ssl: {
        rejectUnauthorized: false,
    },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

let initialized = false;

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

export async function initializeDatabase() {
    if (initialized) {
        return;
    }

    /*
     * Create the modern table if it does not exist.
     *
     * ticket_type is intentionally included because older
     * Eclipse databases used that column name.
     */
    await pool.query(`
        CREATE TABLE IF NOT EXISTS eclipse_tickets (
            id BIGSERIAL PRIMARY KEY,

            guild_id TEXT,
            channel_id TEXT,
            channel_name TEXT,

            user_id TEXT,
            username TEXT,

            ticket_type TEXT,
            type TEXT,

            question TEXT,

            priority TEXT DEFAULT 'low',

            claimed_by TEXT,

            status TEXT DEFAULT 'open',

            opened_at TIMESTAMPTZ DEFAULT NOW(),
            claimed_at TIMESTAMPTZ,
            closed_at TIMESTAMPTZ,

            closed_by TEXT
        );
    `);

    /*
     * Add every column that may be missing from an older
     * Eclipse ticket table.
     */
    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS guild_id TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS channel_id TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS channel_name TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS user_id TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS username TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS ticket_type TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS type TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS question TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS priority TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS claimed_by TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS status TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS closed_by TEXT;
    `);

    /*
     * Sync the old ticket_type column with the newer type
     * column for existing records.
     */
    await pool.query(`
        UPDATE eclipse_tickets
        SET ticket_type = type
        WHERE ticket_type IS NULL
          AND type IS NOT NULL;
    `);

    /*
     * Sync the newer type column from ticket_type for older
     * records.
     */
    await pool.query(`
        UPDATE eclipse_tickets
        SET type = ticket_type
        WHERE type IS NULL
          AND ticket_type IS NOT NULL;
    `);

    /*
     * Backfill missing values from older database records.
     */
    await pool.query(`
        UPDATE eclipse_tickets
        SET priority = 'low'
        WHERE priority IS NULL;
    `);

    await pool.query(`
        UPDATE eclipse_tickets
        SET status = 'open'
        WHERE status IS NULL;
    `);

    await pool.query(`
        UPDATE eclipse_tickets
        SET opened_at = NOW()
        WHERE opened_at IS NULL;
    `);

    /*
     * Some older versions stored the channel ID but did not
     * have channel_name.
     */
    await pool.query(`
        UPDATE eclipse_tickets
        SET channel_name = channel_id
        WHERE channel_name IS NULL
          AND channel_id IS NOT NULL;
    `);

    /*
     * Set defaults for future records.
     */
    await pool.query(`
        ALTER TABLE eclipse_tickets
        ALTER COLUMN priority
        SET DEFAULT 'low';
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ALTER COLUMN status
        SET DEFAULT 'open';
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ALTER COLUMN opened_at
        SET DEFAULT NOW();
    `);

    /*
     * Indexes.
     */
    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_eclipse_tickets_guild
        ON eclipse_tickets(guild_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_eclipse_tickets_user
        ON eclipse_tickets(user_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_eclipse_tickets_status
        ON eclipse_tickets(status);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_eclipse_tickets_channel
        ON eclipse_tickets(channel_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_eclipse_tickets_type
        ON eclipse_tickets(ticket_type);
    `);

    initialized = true;

    console.log('[Eclipse Database] PostgreSQL database initialized.');
}

/* =========================================================
   COUNT OPEN TICKETS
========================================================= */

export async function countOpenTickets(guildId, userId) {
    const result = await pool.query(
        `
        SELECT COUNT(*)::int AS count
        FROM eclipse_tickets
        WHERE guild_id = $1
          AND user_id = $2
          AND status = 'open'
        `,
        [
            guildId,
            userId,
        ],
    );

    return result.rows[0]?.count ?? 0;
}

/* =========================================================
   CREATE TICKET
========================================================= */

export async function createTicket({
    guildId,
    channelId,
    channelName,
    userId,
    username,
    type,
    priority = 'low',
    question = null,
}) {
    try {
        /*
         * IMPORTANT:
         *
         * We write BOTH ticket_type and type.
         *
         * ticket_type is required by the older Eclipse
         * PostgreSQL schema.
         *
         * type is used by the newer code.
         */
        const result = await pool.query(
            `
            INSERT INTO eclipse_tickets (
                guild_id,
                channel_id,
                channel_name,
                user_id,
                username,
                ticket_type,
                type,
                question,
                priority,
                status,
                opened_at
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                'open',
                NOW()
            )
            RETURNING *
            `,
            [
                guildId,
                channelId,
                channelName,
                userId,
                username,
                type,
                type,
                question,
                priority,
            ],
        );

        return result.rows[0] || null;
    } catch (error) {
        console.error('[Eclipse Database] createTicket failed:', {
            message: error?.message,
            code: error?.code,
            detail: error?.detail,
            hint: error?.hint,
            constraint: error?.constraint,
            table: error?.table,
            column: error?.column,
        });

        throw error;
    }
}

/* =========================================================
   GET TICKET
========================================================= */

export async function getTicket(channelId) {
    const result = await pool.query(
        `
        SELECT *
        FROM eclipse_tickets
        WHERE channel_id = $1
        LIMIT 1
        `,
        [channelId],
    );

    return result.rows[0] || null;
}

/* =========================================================
   CLAIM TICKET
========================================================= */

export async function claimTicket(channelId, userId) {
    const result = await pool.query(
        `
        UPDATE eclipse_tickets
        SET
            claimed_by = $2,
            claimed_at = NOW()
        WHERE channel_id = $1
          AND status = 'open'
        RETURNING *
        `,
        [
            channelId,
            userId,
        ],
    );

    return result.rows[0] || null;
}

/* =========================================================
   UNCLAIM TICKET
========================================================= */

export async function unclaimTicket(channelId) {
    const result = await pool.query(
        `
        UPDATE eclipse_tickets
        SET
            claimed_by = NULL,
            claimed_at = NULL
        WHERE channel_id = $1
          AND status = 'open'
        RETURNING *
        `,
        [channelId],
    );

    return result.rows[0] || null;
}

/* =========================================================
   SET PRIORITY
========================================================= */

export async function setTicketPriority(channelId, priority) {
    const allowed = [
        'low',
        'high',
        'urgent',
    ];

    if (!allowed.includes(priority)) {
        throw new Error(
            `Invalid ticket priority: ${priority}`,
        );
    }

    const result = await pool.query(
        `
        UPDATE eclipse_tickets
        SET priority = $2
        WHERE channel_id = $1
          AND status = 'open'
        RETURNING *
        `,
        [
            channelId,
            priority,
        ],
    );

    return result.rows[0] || null;
}

/* =========================================================
   CLOSE TICKET
========================================================= */

export async function closeTicket(
    channelId,
    closedBy = null,
) {
    const result = await pool.query(
        `
        UPDATE eclipse_tickets
        SET
            status = 'closed',
            closed_at = NOW(),
            closed_by = $2
        WHERE channel_id = $1
          AND status = 'open'
        RETURNING *
        `,
        [
            channelId,
            closedBy,
        ],
    );

    return result.rows[0] || null;
}

/* =========================================================
   GET OPEN TICKETS
========================================================= */

export async function getOpenTickets(guildId) {
    const result = await pool.query(
        `
        SELECT *
        FROM eclipse_tickets
        WHERE guild_id = $1
          AND status = 'open'
        ORDER BY opened_at ASC
        `,
        [guildId],
    );

    return result.rows;
}

/* =========================================================
   GET USER OPEN TICKETS
========================================================= */

export async function getUserOpenTickets(
    guildId,
    userId,
) {
    const result = await pool.query(
        `
        SELECT *
        FROM eclipse_tickets
        WHERE guild_id = $1
          AND user_id = $2
          AND status = 'open'
        ORDER BY opened_at ASC
        `,
        [
            guildId,
            userId,
        ],
    );

    return result.rows;
}

/* =========================================================
   GET ALL TICKETS
========================================================= */

export async function getAllTickets(guildId) {
    const result = await pool.query(
        `
        SELECT *
        FROM eclipse_tickets
        WHERE guild_id = $1
        ORDER BY opened_at DESC
        `,
        [guildId],
    );

    return result.rows;
}

/* =========================================================
   DELETE TICKET
========================================================= */

export async function deleteTicket(channelId) {
    const result = await pool.query(
        `
        DELETE FROM eclipse_tickets
        WHERE channel_id = $1
        RETURNING *
        `,
        [channelId],
    );

    return result.rows[0] || null;
}

/* =========================================================
   DATABASE CONNECTION CHECK
========================================================= */

export async function checkDatabaseConnection() {
    const result = await pool.query(
        'SELECT NOW() AS now',
    );

    return {
        connected: true,
        timestamp: result.rows[0]?.now ?? null,
    };
}

/* =========================================================
   CLOSE DATABASE
========================================================= */

export async function closeDatabase() {
    await pool.end();

    initialized = false;

    console.log(
        '[Eclipse Database] PostgreSQL connection closed.',
    );
}

/* =========================================================
   EXPORT POOL
========================================================= */

export { pool };

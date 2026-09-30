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

/* -------------------------------------------------------------------------- */
/* DATABASE INITIALIZATION                                                    */
/* -------------------------------------------------------------------------- */

export async function initializeDatabase() {
    if (initialized) {
        return;
    }

    /*
     * Create the table if it does not exist.
     *
     * IMPORTANT:
     * CREATE TABLE IF NOT EXISTS does NOT modify an existing table.
     * The migrations below handle older Eclipse databases.
     */

    await pool.query(`
        CREATE TABLE IF NOT EXISTS eclipse_tickets (
            id BIGSERIAL PRIMARY KEY,

            guild_id TEXT NOT NULL,

            channel_id TEXT UNIQUE NOT NULL,

            channel_name TEXT,

            user_id TEXT NOT NULL,

            username TEXT NOT NULL,

            type TEXT NOT NULL,

            question TEXT,

            priority TEXT NOT NULL DEFAULT 'low',

            claimed_by TEXT,

            status TEXT NOT NULL DEFAULT 'open',

            opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            claimed_at TIMESTAMPTZ,

            closed_at TIMESTAMPTZ,

            closed_by TEXT
        );
    `);

    /*
     * ----------------------------------------------------------------------
     * SAFE MIGRATIONS
     * ----------------------------------------------------------------------
     *
     * These are safe to run every time the bot starts.
     *
     * They fix databases created by older versions of the bot.
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
        ADD COLUMN IF NOT EXISTS type TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS question TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'low';
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS claimed_by TEXT;
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
    `);

    await pool.query(`
        ALTER TABLE eclipse_tickets
        ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NOW();
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
     * Older rows may have NULL channel names after the migration.
     * Fill them from the Discord channel ID so they don't break anything.
     */

    await pool.query(`
        UPDATE eclipse_tickets
        SET channel_name = channel_id
        WHERE channel_name IS NULL;
    `);

    /*
     * Older rows may have NULL priorities/status values.
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

    /*
     * Indexes.
     */

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_eclipse_tickets_guild
        ON eclipse_tickets(guild_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_eclipse_tickets_user
        ON eclipse_tickets(user_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_eclipse_tickets_status
        ON eclipse_tickets(status);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_eclipse_tickets_channel
        ON eclipse_tickets(channel_id);
    `);

    /*
     * Unique channel ID index/constraint.
     *
     * Only create it if channel_id isn't already covered by a
     * unique constraint/index.
     */

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS
        idx_eclipse_tickets_channel_unique
        ON eclipse_tickets(channel_id);
    `);

    initialized = true;

    console.log(
        '[Eclipse Database] PostgreSQL database initialized.',
    );
}

/* -------------------------------------------------------------------------- */
/* TICKETS                                                                    */
/* -------------------------------------------------------------------------- */

export async function countOpenTickets(
    guildId,
    userId,
) {
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

/* -------------------------------------------------------------------------- */
/* CREATE TICKET                                                              */
/* -------------------------------------------------------------------------- */

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
    const result = await pool.query(
        `
        INSERT INTO eclipse_tickets (
            guild_id,
            channel_id,
            channel_name,
            user_id,
            username,
            type,
            question,
            priority,
            status
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
            'open'
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
            question,
            priority,
        ],
    );

    return result.rows[0] || null;
}

/* -------------------------------------------------------------------------- */
/* GET TICKET                                                                 */
/* -------------------------------------------------------------------------- */

export async function getTicket(
    channelId,
) {
    const result = await pool.query(
        `
        SELECT *
        FROM eclipse_tickets
        WHERE channel_id = $1
        LIMIT 1
        `,
        [
            channelId,
        ],
    );

    return result.rows[0] || null;
}

/* -------------------------------------------------------------------------- */
/* CLAIM                                                                      */
/* -------------------------------------------------------------------------- */

export async function claimTicket(
    channelId,
    userId,
) {
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

/* -------------------------------------------------------------------------- */
/* UNCLAIM                                                                    */
/* -------------------------------------------------------------------------- */

export async function unclaimTicket(
    channelId,
) {
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
        [
            channelId,
        ],
    );

    return result.rows[0] || null;
}

/* -------------------------------------------------------------------------- */
/* PRIORITY                                                                   */
/* -------------------------------------------------------------------------- */

export async function setTicketPriority(
    channelId,
    priority,
) {
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

/* -------------------------------------------------------------------------- */
/* CLOSE                                                                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* OPEN TICKETS                                                               */
/* -------------------------------------------------------------------------- */

export async function getOpenTickets(
    guildId,
) {
    const result = await pool.query(
        `
        SELECT *
        FROM eclipse_tickets
        WHERE guild_id = $1
          AND status = 'open'
        ORDER BY opened_at ASC
        `,
        [
            guildId,
        ],
    );

    return result.rows;
}

/* -------------------------------------------------------------------------- */
/* USER OPEN TICKETS                                                          */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* ALL TICKETS                                                                */
/* -------------------------------------------------------------------------- */

export async function getAllTickets(
    guildId,
) {
    const result = await pool.query(
        `
        SELECT *
        FROM eclipse_tickets
        WHERE guild_id = $1
        ORDER BY opened_at DESC
        `,
        [
            guildId,
        ],
    );

    return result.rows;
}

/* -------------------------------------------------------------------------- */
/* DELETE TICKET                                                              */
/* -------------------------------------------------------------------------- */

export async function deleteTicket(
    channelId,
) {
    const result = await pool.query(
        `
        DELETE FROM eclipse_tickets
        WHERE channel_id = $1
        RETURNING *
        `,
        [
            channelId,
        ],
    );

    return result.rows[0] || null;
}

/* -------------------------------------------------------------------------- */
/* DATABASE HEALTH                                                            */
/* -------------------------------------------------------------------------- */

export async function checkDatabaseConnection() {
    const result = await pool.query(
        'SELECT NOW() AS now',
    );

    return {
        connected: true,
        timestamp:
            result.rows[0]?.now ?? null,
    };
}

/* -------------------------------------------------------------------------- */
/* CLOSE DATABASE                                                             */
/* -------------------------------------------------------------------------- */

export async function closeDatabase() {
    await pool.end();

    initialized = false;

    console.log(
        '[Eclipse Database] PostgreSQL connection closed.',
    );
}

/* -------------------------------------------------------------------------- */
/* EXPORT POOL                                                                */
/* -------------------------------------------------------------------------- */

export {
    pool,
};


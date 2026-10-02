import pg from 'pg';

import { config } from './config.js';

const { Pool } = pg;


/* ========================================================================== */
/* POSTGRESQL                                                                  */
/* ========================================================================== */

const pool = new Pool({
    connectionString:
        config.database.url,

    ssl: {
        rejectUnauthorized: false,
    },

    max: 10,

    idleTimeoutMillis:
        30_000,

    connectionTimeoutMillis:
        10_000,
});


let initialized = false;


/* ========================================================================== */
/* INITIALIZE DATABASE                                                         */
/* ========================================================================== */

export async function initializeDatabase() {
    if (initialized) {
        return;
    }

    /*
     * Create the table if it does not exist.
     */

    await pool.query(`
        CREATE TABLE IF NOT EXISTS eclipse_tickets (
            id BIGSERIAL PRIMARY KEY,

            guild_id TEXT,
            channel_id TEXT UNIQUE,
            channel_name TEXT,

            user_id TEXT,
            username TEXT,

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


    /* ====================================================================== */
    /* SAFE MIGRATIONS                                                        */
    /* ====================================================================== */

    /*
     * IMPORTANT:
     *
     * CREATE TABLE IF NOT EXISTS does NOT modify an existing table.
     *
     * These ALTER TABLE statements make sure older Eclipse databases
     * receive the columns required by the current ticket system.
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


    /* ====================================================================== */
    /* BACKFILL OLD ROWS                                                      */
    /* ====================================================================== */

    /*
     * Give older records safe values.
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
     * Older databases may have channel_id but no channel_name.
     *
     * Using channel_id as the temporary fallback prevents existing rows
     * from breaking the migration.
     */

    await pool.query(`
        UPDATE eclipse_tickets
        SET channel_name = channel_id
        WHERE channel_name IS NULL
          AND channel_id IS NOT NULL;
    `);


    /* ====================================================================== */
    /* DEFAULTS                                                               */
    /* ====================================================================== */

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


    /* ====================================================================== */
    /* INDEXES                                                                 */
    /* ====================================================================== */

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


    initialized = true;

    console.log(
        '[Eclipse Database] PostgreSQL database initialized.',
    );
}


/* ========================================================================== */
/* COUNT OPEN TICKETS                                                         */
/* ========================================================================== */

export async function countOpenTickets(
    guildId,
    userId,
) {
    const result =
        await pool.query(
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

    return (
        result.rows[0]?.count ??
        0
    );
}


/* ========================================================================== */
/* CREATE TICKET                                                              */
/* ========================================================================== */

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
    const result =
        await pool.query(
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

    return (
        result.rows[0] ||
        null
    );
}


/* ========================================================================== */
/* GET TICKET                                                                 */
/* ========================================================================== */

export async function getTicket(
    channelId,
) {
    const result =
        await pool.query(
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

    return (
        result.rows[0] ||
        null
    );
}


/* ========================================================================== */
/* CLAIM TICKET                                                               */
/* ========================================================================== */

export async function claimTicket(
    channelId,
    userId,
) {
    const result =
        await pool.query(
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

    return (
        result.rows[0] ||
        null
    );
}


/* ========================================================================== */
/* UNCLAIM TICKET                                                             */
/* ========================================================================== */

export async function unclaimTicket(
    channelId,
) {
    const result =
        await pool.query(
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

    return (
        result.rows[0] ||
        null
    );
}


/* ========================================================================== */
/* SET PRIORITY                                                               */
/* ========================================================================== */

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

    const result =
        await pool.query(
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

    return (
        result.rows[0] ||
        null
    );
}


/* ========================================================================== */
/* CLOSE TICKET                                                               */
/* ========================================================================== */

export async function closeTicket(
    channelId,
    closedBy = null,
) {
    const result =
        await pool.query(
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

    return (
        result.rows[0] ||
        null
    );
}


/* ========================================================================== */
/* GET OPEN TICKETS                                                           */
/* ========================================================================== */

export async function getOpenTickets(
    guildId,
) {
    const result =
        await pool.query(
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


/* ========================================================================== */
/* GET USER OPEN TICKETS                                                      */
/* ========================================================================== */

export async function getUserOpenTickets(
    guildId,
    userId,
) {
    const result =
        await pool.query(
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


/* ========================================================================== */
/* GET ALL TICKETS                                                            */
/* ========================================================================== */

export async function getAllTickets(
    guildId,
) {
    const result =
        await pool.query(
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


/* ========================================================================== */
/* DELETE TICKET                                                              */
/* ========================================================================== */

export async function deleteTicket(
    channelId,
) {
    const result =
        await pool.query(
            `
            DELETE FROM eclipse_tickets
            WHERE channel_id = $1
            RETURNING *
            `,
            [
                channelId,
            ],
        );

    return (
        result.rows[0] ||
        null
    );
}


/* ========================================================================== */
/* DATABASE CONNECTION CHECK                                                  */
/* ========================================================================== */

export async function checkDatabaseConnection() {
    const result =
        await pool.query(
            'SELECT NOW() AS now',
        );

    return {
        connected: true,

        timestamp:
            result.rows[0]?.now ??
            null,
    };
}


/* ========================================================================== */
/* CLOSE DATABASE                                                             */
/* ========================================================================== */

export async function closeDatabase() {
    await pool.end();

    initialized = false;

    console.log(
        '[Eclipse Database] PostgreSQL connection closed.',
    );
}


/* ========================================================================== */
/* EXPORT POOL                                                                */
/* ========================================================================== */

export {
    pool,
};

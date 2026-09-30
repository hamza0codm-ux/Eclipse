import pg from 'pg';

import { config } from './config.js';

const { Pool } = pg;

/* -------------------------------------------------------------------------- */
/* POOL                                                                       */
/* -------------------------------------------------------------------------- */

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

    try {
        /*
         * Create the table if it does not already exist.
         *
         * IMPORTANT:
         * CREATE TABLE IF NOT EXISTS does NOT update an existing table.
         * The migration section below handles old databases.
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
         * ------------------------------------------------------------------
         * SAFE COLUMN MIGRATIONS
         * ------------------------------------------------------------------
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

        /*
         * ------------------------------------------------------------------
         * DEFAULT / OLD DATA REPAIR
         * ------------------------------------------------------------------
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
         * Old records may not have channel_name.
         * Use the channel ID as a fallback.
         */

        await pool.query(`
            UPDATE eclipse_tickets
            SET channel_name = channel_id
            WHERE channel_name IS NULL
              AND channel_id IS NOT NULL;
        `);

        /*
         * ------------------------------------------------------------------
         * INDEXES
         * ------------------------------------------------------------------
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
         * Don't create another unique index if the original UNIQUE
         * constraint already handles channel_id.
         *
         * We check PostgreSQL's catalog first.
         */

        const uniqueCheck = await pool.query(`
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'eclipse_tickets'::regclass
              AND contype = 'u'
              AND conkey = ARRAY[
                  (
                      SELECT attnum
                      FROM pg_attribute
                      WHERE attrelid = 'eclipse_tickets'::regclass
                        AND attname = 'channel_id'
                  )
              ]::smallint[]
            LIMIT 1;
        `);

        if (uniqueCheck.rowCount === 0) {
            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS
                idx_eclipse_tickets_channel_unique
                ON eclipse_tickets(channel_id);
            `);
        }

        initialized = true;

        console.log(
            '[Eclipse Database] PostgreSQL database initialized.',
        );
    } catch (error) {
        console.error(
            '[Eclipse Database] Initialization failed.',
        );

        console.error(
            'PostgreSQL error:',
            error,
        );

        console.error(
            'Error code:',
            error?.code,
        );

        console.error(
            'Error message:',
            error?.message,
        );

        console.error(
            'Error detail:',
            error?.detail,
        );

        console.error(
            'Error hint:',
            error?.hint,
        );

        throw error;
    }
}

/* -------------------------------------------------------------------------- */
/* COUNT OPEN TICKETS                                                         */
/* -------------------------------------------------------------------------- */

export async function countOpenTickets(
    guildId,
    userId,
) {
    try {
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
    } catch (error) {
        console.error(
            '[Eclipse Database] Failed to count open tickets:',
            error,
        );

        throw error;
    }
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
    try {
        /*
         * Extra safety:
         *
         * If the bot is running against an older database, make sure
         * channel_name exists before attempting the INSERT.
         */

        await pool.query(`
            ALTER TABLE eclipse_tickets
            ADD COLUMN IF NOT EXISTS channel_name TEXT;
        `);

        /*
         * Ensure the priority is always one of the supported values.
         *
         * Medium has intentionally been removed.
         */

        const allowedPriorities = [
            'low',
            'high',
            'urgent',
        ];

        if (!allowedPriorities.includes(priority)) {
            priority = 'low';
        }

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

        console.log(
            `[Eclipse Database] Ticket saved successfully: ${channelId}`,
        );

        return result.rows[0] || null;
    } catch (error) {
        console.error(
            '==================================================',
        );

        console.error(
            '[Eclipse Database] FAILED TO CREATE TICKET',
        );

        console.error(
            'PostgreSQL error:',
            error,
        );

        console.error(
            'Error code:',
            error?.code,
        );

        console.error(
            'Error message:',
            error?.message,
        );

        console.error(
            'Error detail:',
            error?.detail,
        );

        console.error(
            'Error hint:',
            error?.hint,
        );

        console.error(
            'Error constraint:',
            error?.constraint,
        );

        console.error(
            'Ticket data:',
            {
                guildId,
                channelId,
                channelName,
                userId,
                username,
                type,
                priority,
                question,
            },
        );

        console.error(
            '==================================================',
        );

        /*
         * VERY IMPORTANT:
         *
         * Re-throw the error so tickets.js knows that the database
         * save actually failed.
         */

        throw error;
    }
}

/* -------------------------------------------------------------------------- */
/* GET TICKET                                                                 */
/* -------------------------------------------------------------------------- */

export async function getTicket(
    channelId,
) {
    try {
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
    } catch (error) {
        console.error(
            '[Eclipse Database] Failed to get ticket:',
            error,
        );

        throw error;
    }
}

/* -------------------------------------------------------------------------- */
/* CLAIM TICKET                                                               */
/* -------------------------------------------------------------------------- */

export async function claimTicket(
    channelId,
    userId,
) {
    try {
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
    } catch (error) {
        console.error(
            '[Eclipse Database] Failed to claim ticket:',
            error,
        );

        throw error;
    }
}

/* -------------------------------------------------------------------------- */
/* UNCLAIM TICKET                                                             */
/* -------------------------------------------------------------------------- */

export async function unclaimTicket(
    channelId,
) {
    try {
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
    } catch (error) {
        console.error(
            '[Eclipse Database] Failed to unclaim ticket:',
            error,
        );

        throw error;
    }
}

/* -------------------------------------------------------------------------- */
/* SET PRIORITY                                                               */
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

    try {
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
    } catch (error) {
        console.error(
            '[Eclipse Database] Failed to change ticket priority:',
            error,
        );

        throw error;
    }
}

/* -------------------------------------------------------------------------- */
/* CLOSE TICKET                                                               */
/* -------------------------------------------------------------------------- */

export async function closeTicket(
    channelId,
    closedBy = null,
) {
    try {
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
    } catch (error) {
        console.error(
            '[Eclipse Database] Failed to close ticket:',
            error,
        );

        throw error;
    }
}

/* -------------------------------------------------------------------------- */
/* GET OPEN TICKETS                                                           */
/* -------------------------------------------------------------------------- */

export async function getOpenTickets(
    guildId,
) {
    try {
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
    } catch (error) {
        console.error(
            '[Eclipse Database] Failed to get open tickets:',
            error,
        );

        throw error;
    }
}

/* -------------------------------------------------------------------------- */
/* GET USER OPEN TICKETS                                                      */
/* -------------------------------------------------------------------------- */

export async function getUserOpenTickets(
    guildId,
    userId,
) {
    try {
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
    } catch (error) {
        console.error(
            '[Eclipse Database] Failed to get user tickets:',
            error,
        );

        throw error;
    }
}

/* -------------------------------------------------------------------------- */
/* GET ALL TICKETS                                                            */
/* -------------------------------------------------------------------------- */

export async function getAllTickets(
    guildId,
) {
    try {
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
    } catch (error) {
        console.error(
            '[Eclipse Database] Failed to get all tickets:',
            error,
        );

        throw error;
    }
}

/* -------------------------------------------------------------------------- */
/* DELETE TICKET                                                              */
/* -------------------------------------------------------------------------- */

export async function deleteTicket(
    channelId,
) {
    try {
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
    } catch (error) {
        console.error(
            '[Eclipse Database] Failed to delete ticket:',
            error,
        );

        throw error;
    }
}

/* -------------------------------------------------------------------------- */
/* DATABASE HEALTH                                                            */
/* -------------------------------------------------------------------------- */

export async function checkDatabaseConnection() {
    try {
        const result = await pool.query(
            'SELECT NOW() AS now',
        );

        return {
            connected: true,

            timestamp:
                result.rows[0]?.now ?? null,
        };
    } catch (error) {
        console.error(
            '[Eclipse Database] Database health check failed:',
            error,
        );

        return {
            connected: false,

            timestamp: null,
        };
    }
}

/* -------------------------------------------------------------------------- */
/* CLOSE DATABASE                                                             */
/* -------------------------------------------------------------------------- */

export async function closeDatabase() {
    try {
        await pool.end();

        initialized = false;

        console.log(
            '[Eclipse Database] PostgreSQL connection closed.',
        );
    } catch (error) {
        console.error(
            '[Eclipse Database] Failed to close PostgreSQL:',
            error,
        );
    }
}

/* -------------------------------------------------------------------------- */
/* EXPORT POOL                                                                */
/* -------------------------------------------------------------------------- */

export {
    pool,
};

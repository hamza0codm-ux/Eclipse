import pg from 'pg';

import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
    connectionString: config.database.url,

    ssl: {
        rejectUnauthorized: false,
    },

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000,
});

export async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS eclipse_tickets (
            id BIGSERIAL PRIMARY KEY,

            guild_id TEXT NOT NULL,

            channel_id TEXT UNIQUE NOT NULL,

            user_id TEXT NOT NULL,

            ticket_type TEXT NOT NULL,

            subtype TEXT,

            ticket_number INTEGER NOT NULL DEFAULT 1,

            claimed_by TEXT,

            priority TEXT NOT NULL DEFAULT 'low',

            status TEXT NOT NULL DEFAULT 'open',

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            closed_at TIMESTAMPTZ
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_eclipse_tickets_user
        ON eclipse_tickets(user_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_eclipse_tickets_channel
        ON eclipse_tickets(channel_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_eclipse_tickets_status
        ON eclipse_tickets(status);
    `);

    console.log(
        '[DATABASE] PostgreSQL connected and ready.',
    );
}

export async function createTicket(data) {
    const result = await pool.query(
        `
        INSERT INTO eclipse_tickets (
            guild_id,
            channel_id,
            user_id,
            ticket_type,
            subtype,
            ticket_number,
            priority
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
        `,
        [
            data.guildId,
            data.channelId,
            data.userId,
            data.ticketType,
            data.subtype || null,
            data.ticketNumber,
            data.priority || 'low',
        ],
    );

    return result.rows[0];
}

export async function getTicket(channelId) {
    const result = await pool.query(
        `
        SELECT *
        FROM eclipse_tickets
        WHERE channel_id = $1
        LIMIT 1;
        `,
        [channelId],
    );

    return result.rows[0] || null;
}

export async function getOpenTicketsForUser(
    userId,
    guildId,
) {
    const result = await pool.query(
        `
        SELECT *
        FROM eclipse_tickets
        WHERE user_id = $1
          AND guild_id = $2
          AND status = 'open'
        ORDER BY created_at ASC;
        `,
        [userId, guildId],
    );

    return result.rows;
}

export async function getNextTicketNumber(
    userId,
    guildId,
    ticketType,
) {
    const result = await pool.query(
        `
        SELECT COUNT(*)::INTEGER AS count
        FROM eclipse_tickets
        WHERE user_id = $1
          AND guild_id = $2
          AND ticket_type = $3;
        `,
        [
            userId,
            guildId,
            ticketType,
        ],
    );

    return Number(result.rows[0].count) + 1;
}

export async function claimTicket(
    channelId,
    userId,
) {
    await pool.query(
        `
        UPDATE eclipse_tickets
        SET claimed_by = $1
        WHERE channel_id = $2
          AND status = 'open';
        `,
        [
            userId,
            channelId,
        ],
    );
}

export async function unclaimTicket(channelId) {
    await pool.query(
        `
        UPDATE eclipse_tickets
        SET claimed_by = NULL
        WHERE channel_id = $1
          AND status = 'open';
        `,
        [channelId],
    );
}

export async function setTicketPriority(
    channelId,
    priority,
) {
    await pool.query(
        `
        UPDATE eclipse_tickets
        SET priority = $1
        WHERE channel_id = $2
          AND status = 'open';
        `,
        [
            priority,
            channelId,
        ],
    );
}

export async function closeTicket(channelId) {
    await pool.query(
        `
        UPDATE eclipse_tickets
        SET
            status = 'closed',
            closed_at = NOW()
        WHERE channel_id = $1;
        `,
        [channelId],
    );
}

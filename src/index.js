import {
    Client,
    GatewayIntentBits,
    Partials,
} from 'discord.js';

import { config } from './config.js';

import {
    initializeDatabase,
} from './database.js';

import {
    registerWelcome,
} from './welcome.js';

import {
    registerTicketSystem,
} from './tickets.js';

import {
    registerRules,
} from './rules.js';

import {
    registerModeration,
} from './moderation.js';


/* ========================================================================== */
/* CLIENT                                                                     */
/* ========================================================================== */

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],

    partials: [
        Partials.GuildMember,
        Partials.Channel,
        Partials.Message,
    ],
});


/* ========================================================================== */
/* SYSTEM REGISTRATION                                                        */
/* ========================================================================== */

registerWelcome(client);

registerTicketSystem(client);

registerRules(client);

registerModeration(client);


/* ========================================================================== */
/* READY                                                                      */
/* ========================================================================== */

client.once('clientReady', async () => {
    console.log(
        `[BOT] Logged in as ${client.user.tag}`,
    );

    console.log(
        `[BOT] Serving ${client.guilds.cache.size} guild(s).`,
    );

    try {
        await initializeDatabase();

        console.log(
            '[Eclipse Database] PostgreSQL database initialized.',
        );

        console.log(
            '[BOT] Eclipse systems loaded successfully.',
        );
    } catch (error) {
        console.error(
            '[BOT] Database initialization failed:',
            error,
        );
    }
});


/* ========================================================================== */
/* DISCORD ERRORS                                                             */
/* ========================================================================== */

client.on(
    'error',
    (error) => {
        console.error(
            '[DISCORD] Client error:',
            error,
        );
    },
);


/* ========================================================================== */
/* PROCESS ERRORS                                                             */
/* ========================================================================== */

process.on(
    'unhandledRejection',
    (error) => {
        console.error(
            '[PROCESS] Unhandled rejection:',
            error,
        );
    },
);

process.on(
    'uncaughtException',
    (error) => {
        console.error(
            '[PROCESS] Uncaught exception:',
            error,
        );
    },
);


/* ========================================================================== */
/* LOGIN                                                                      */
/* ========================================================================== */

client.login(
    config.discord.token,
).catch(
    (error) => {
        console.error(
            '[BOT] Failed to login:',
            error,
        );

        process.exitCode = 1;
    },
);

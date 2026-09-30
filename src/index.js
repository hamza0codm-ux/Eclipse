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
    registerModeration,
} from './moderation.js';

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

/*
 * Register all systems BEFORE login.
 *
 * This is important because some systems listen for
 * the clientReady event. If they are registered after
 * clientReady has already fired, they will never run.
 */

registerWelcome(client);

registerTicketSystem(client);

registerModeration(client);

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
            '[BOT] Eclipse systems loaded successfully.',
        );
    } catch (error) {
        console.error(
            '[BOT] Startup error:',
            error,
        );
    }
});

client.on('error', (error) => {
    console.error(
        '[DISCORD] Client error:',
        error,
    );
});

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

client.login(config.discord.token);

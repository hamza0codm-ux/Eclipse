import 'dotenv/config';

function required(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(
            `Missing required environment variable: ${name}`,
        );
    }

    return value;
}

export const config = {
    discord: {
        token: required('DISCORD_TOKEN'),
        clientId: required('CLIENT_ID'),
        guildId: required('GUILD_ID'),
    },

    database: {
        url: required('DATABASE_URL'),
    },

    ticketSupportRoleId:
        process.env.TICKET_SUPPORT_ROLE_ID || null,

    welcome: {
        channelId: '1554214248136310874',

        autoRoleId: '1554226294642708611',

        rulesChannelId: '1554214526478454976',

        howToJoinChannelId:
            '1554243021296640123',

        socialsChannelId:
            '1554243360842063942',
    },

    tickets: {
        panelChannelId:
            '1554243090460450936',

        categoryId:
            '1554805189616214096',

        logChannelId:
            '1554214604459085875',

        /*
         * Leave these blank until you have them.
         */
        panelImageUrl: '',

        panelFooter: '',

        maxOpenTicketsPerUser: 3,
    },

    moderation: {
        logChannelId:
            '1554214604459085875',

        maxPurge: 100,
    },
};

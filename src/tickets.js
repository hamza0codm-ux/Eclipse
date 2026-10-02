import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    ModalBuilder,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MessageFlags,
} from 'discord.js';

import {
    countOpenTickets,
    createTicket,
    getTicket,
    claimTicket,
    unclaimTicket,
    setTicketPriority,
    closeTicket,
} from './database.js';

import { config } from './config.js';

/* =========================================================
   CONFIG
========================================================= */

const PANEL_CHANNEL_ID =
    config.tickets?.panelChannelId ||
    '1554243090460450936';

const TICKET_CATEGORY_ID =
    config.tickets?.categoryId ||
    '1554805189616214096';

const LOG_CHANNEL_ID =
    config.tickets?.logChannelId ||
    '1554214604459085875';

const TEAM_ROLE_ID =
    '1554540279305084998';

const STAFF_TICKET_ROLE_ID =
    '1554221483507843222';

const OWNER_ROLE_IDS = [
    '1554219959251374220',
    '1554220571804303422',
];

const EXTRA_TICKET_ACCESS_ROLES = [
    '1554221254524010496',
    '1554220571804303422',
    '1554219959251374220',
];

const PANEL_IMAGE_URL =
    config.tickets?.panelImageUrl || null;

const PANEL_FOOTER =
    config.tickets?.panelFooter || null;

/* =========================================================
   CUSTOM IDS
========================================================= */

const CUSTOM_IDS = {
    staff: 'eclipse_ticket_staff',
    team: 'eclipse_ticket_team',
    enquiries: 'eclipse_ticket_enquiries',
    ownership: 'eclipse_ticket_ownership',

    teamSelect: 'eclipse_ticket_team_select',

    claim: 'eclipse_ticket_claim',
    priority: 'eclipse_ticket_priority',
    close: 'eclipse_ticket_close',

    closeReason: 'eclipse_ticket_close_reason',
};

/* =========================================================
   PRIORITIES
========================================================= */

const PRIORITIES = {
    low: {
        label: 'Low',
        emoji: '🟢',
        prefix: '',
    },

    high: {
        label: 'High',
        emoji: '🟠',
        prefix: '🟠',
    },

    urgent: {
        label: 'Urgent',
        emoji: '🚨',
        prefix: '🚨',
    },
};

/* =========================================================
   TICKET TYPES
========================================================= */

const TICKET_TYPES = {
    staffapplication: {
        key: 'staffapplication',
        label: 'Eclipse Staff applications',
        shortName: 'staffapplication',
        emoji: '<a:Briefcase:1555225149689696517>',

        accessRoles: [
            STAFF_TICKET_ROLE_ID,
        ],

        teamName: 'Eclipse Staff Management Team',
    },

    competitive: {
        key: 'competitive',
        label: 'Competitive Roster',
        shortName: 'competitive',
        emoji: '<a:Competitive:1555290266011836456>',

        accessRoles: [
            TEAM_ROLE_ID,
        ],

        teamName: 'Eclipse Staff Team',
    },

    creative: {
        key: 'creative',
        label: 'Creative Roster',
        shortName: 'creative',
        emoji: '📝',

        accessRoles: [
            TEAM_ROLE_ID,
        ],

        teamName: 'Eclipse Staff Team',
    },

    production: {
        key: 'production',
        label: 'GFX or VFX Roster',
        shortName: 'production',
        emoji: '🎨',

        accessRoles: [
            TEAM_ROLE_ID,
        ],

        teamName: 'Eclipse Staff Team',
    },

    content: {
        key: 'content',
        label: 'Streamer or Content Creator Roster',
        shortName: 'content',
        emoji: '📹',

        accessRoles: [
            TEAM_ROLE_ID,
        ],

        teamName: 'Eclipse Staff Team',
    },

    enquiries: {
        key: 'enquiries',
        label: 'General Enquiries',
        shortName: 'enquiries',
        emoji: '<:questions:1555225101438292108>',

        accessRoles: [
            TEAM_ROLE_ID,
        ],

        teamName: 'Eclipse Staff Team',
    },

    ownership: {
        key: 'ownership',
        label: 'Ownership Enquiries',
        shortName: 'ownership',
        emoji: '👑',

        /*
         * BOTH ownership roles are explicitly included.
         */
        accessRoles: [
            '1554219959251374220',
            '1554220571804303422',
        ],

        teamName: 'Eclipse Ownership Team',
    },
};

/* =========================================================
   HELPERS
========================================================= */

function getSupportRoleId() {
    return (
        config.ticketSupportRoleId ||
        TEAM_ROLE_ID
    );
}

function getLogChannelId() {
    return (
        config.tickets?.logChannelId ||
        LOG_CHANNEL_ID
    );
}

function formatPriority(priority) {
    return (
        PRIORITIES[priority] ||
        PRIORITIES.low
    );
}

function formatTicketType(type) {
    return (
        TICKET_TYPES[type]?.label ||
        type ||
        'Unknown'
    );
}

function formatUser(userId) {
    return userId
        ? `<@${userId}>`
        : 'None';
}

function cleanUsername(username) {
    return String(username)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 40);
}

function getBaseTicketName(username, type) {
    const clean = cleanUsername(username);

    const shortName =
        TICKET_TYPES[type]?.shortName ||
        type;

    return `${clean}-${shortName}`;
}

function getPriorityTicketName(ticket) {
    const priority =
        formatPriority(ticket.priority);

    const base =
        getBaseTicketName(
            ticket.username,
            ticket.type,
        );

    return `${priority.prefix}${base}`
        .slice(0, 100);
}

/*
 * PostgreSQL returns snake_case fields.
 * Normalize them so the ticket system can use
 * both the old and new database schemas.
 */
function normalizeTicket(row) {
    if (!row) {
        return null;
    }

    return {
        ...row,

        guildId:
            row.guildId ??
            row.guild_id ??
            null,

        channelId:
            row.channelId ??
            row.channel_id ??
            null,

        channelName:
            row.channelName ??
            row.channel_name ??
            null,

        userId:
            row.userId ??
            row.user_id ??
            null,

        username:
            row.username ??
            null,

        type:
            row.type ??
            row.ticket_type ??
            null,

        ticketType:
            row.ticketType ??
            row.ticket_type ??
            row.type ??
            null,

        question:
            row.question ??
            null,

        priority:
            row.priority ??
            'low',

        claimedBy:
            row.claimedBy ??
            row.claimed_by ??
            null,

        status:
            row.status ??
            'open',

        openedAt:
            row.openedAt ??
            row.opened_at ??
            null,

        claimedAt:
            row.claimedAt ??
            row.claimed_at ??
            null,

        closedAt:
            row.closedAt ??
            row.closed_at ??
            null,

        closedBy:
            row.closedBy ??
            row.closed_by ??
            null,
    };
}

/* =========================================================
   PANEL DETECTION
========================================================= */

function isEclipsePanel(message) {
    if (!message?.author?.bot) {
        return false;
    }

    if (!message.components?.length) {
        return false;
    }

    const json = JSON.stringify(
        message.toJSON?.() || message,
    );

    const requiredIds = [
        CUSTOM_IDS.staff,
        CUSTOM_IDS.team,
        CUSTOM_IDS.enquiries,
        CUSTOM_IDS.ownership,
    ];

    return requiredIds.every(
        id => json.includes(id),
    );
}

async function findExistingPanel(channel) {
    let before;

    while (true) {
        const options = {
            limit: 100,
        };

        if (before) {
            options.before = before;
        }

        const messages =
            await channel.messages.fetch(options);

        if (!messages.size) {
            return null;
        }

        const panel =
            messages.find(isEclipsePanel);

        if (panel) {
            return panel;
        }

        if (messages.size < 100) {
            return null;
        }

        before =
            messages.last().id;
    }
}

/* =========================================================
   PANEL BUTTON
========================================================= */

function panelButton(
    customId,
    label,
    emoji,
) {
    return new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(
            ButtonStyle.Secondary,
        );
}

/* =========================================================
   BUILD PANEL
========================================================= */

function buildTicketPanel() {
    const container =
        new ContainerBuilder();

    /*
     * Staff applications
     */
    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `<a:Briefcase:1555225149689696517> **Eclipse Staff applications**\n` +
                        `Apply for a position as staff at Eclipse.`,
                    ),
            )
            .setButtonAccessory(
                panelButton(
                    CUSTOM_IDS.staff,
                    'Apply for staff',
                    '<a:Briefcase:1555225149689696517>',
                ),
            ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true),
    );

    /*
     * Team applications
     */
    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `⚒️ **Eclipse Team Applications**\n` +
                        `Apply as a Competitive player, Creative player, Production or Content Roster at Eclipse.`,
                    ),
            )
            .setButtonAccessory(
                panelButton(
                    CUSTOM_IDS.team,
                    'Join Eclipse',
                    '⚒️',
                ),
            ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true),
    );

    /*
     * General enquiries
     */
    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `<:questions:1555225101438292108> **General Enquiries**\n` +
                        `For questions, enquiries and reports.`,
                    ),
            )
            .setButtonAccessory(
                panelButton(
                    CUSTOM_IDS.enquiries,
                    'General Enquiries',
                    '<:questions:1555225101438292108>',
                ),
            ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true),
    );

    /*
     * Ownership enquiries
     */
    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `👑 **Ownership Enquiries**\n` +
                        `For investment opportunities, partnerships and other ownership enquiries.`,
                    ),
            )
            .setButtonAccessory(
                panelButton(
                    CUSTOM_IDS.ownership,
                    'Ownership Enquiries',
                    '👑',
                ),
            ),
    );

    /*
     * Optional image.
     */
    if (PANEL_IMAGE_URL) {
        container.addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true),
        );

        container.addMediaGalleryComponents(
            new MediaGalleryBuilder()
                .addItems(
                    item =>
                        item.setURL(
                            PANEL_IMAGE_URL,
                        ),
                ),
        );
    }

    /*
     * Optional panel footer.
     *
     * This is ONLY for the public panel.
     * It is NOT used inside ticket embeds.
     */
    if (PANEL_FOOTER) {
        container.addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true),
        );

        container.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(
                    PANEL_FOOTER,
                ),
        );
    }

    return container;
}

/* =========================================================
   ENSURE PANEL
========================================================= */

async function ensureTicketPanel(client) {
    if (!client.isReady()) {
        console.log(
            '[Eclipse Tickets] Client is not ready yet. Panel check skipped.',
        );

        return null;
    }

    const channel =
        await client.channels.fetch(
            PANEL_CHANNEL_ID,
        );

    if (!channel) {
        throw new Error(
            `Ticket panel channel ${PANEL_CHANNEL_ID} was not found.`,
        );
    }

    if (!channel.isTextBased()) {
        throw new Error(
            `Ticket panel channel ${PANEL_CHANNEL_ID} is not a text channel.`,
        );
    }

    console.log(
        '[Eclipse Tickets] Searching for existing ticket panel...',
    );

    const existing =
        await findExistingPanel(channel);

    if (existing) {
        console.log(
            `[Eclipse Tickets] Existing ticket panel found: ${existing.id}`,
        );

        return existing;
    }

    console.log(
        '[Eclipse Tickets] No ticket panel found. Sending panel...',
    );

    const message =
        await channel.send({
            components: [
                buildTicketPanel(),
            ],
            flags:
                MessageFlags.IsComponentsV2,
        });

    console.log(
        `[Eclipse Tickets] Ticket panel sent: ${message.id}`,
    );

    return message;
}

/* =========================================================
   TICKET PERMISSIONS
========================================================= */

function buildInitialOverwrites(
    guild,
    userId,
    type,
) {
    const bot = guild.members.me;

    const ticketType =
        TICKET_TYPES[type];

    const accessRoles =
        ticketType?.accessRoles ||
        [TEAM_ROLE_ID];

    const overwrites = [
        {
            id: guild.roles.everyone.id,

            deny: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
            ],
        },

        {
            id: userId,

            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        },
    ];

    /*
     * Ticket-type access roles.
     */
    for (const roleId of accessRoles) {
        if (
            !overwrites.some(
                overwrite =>
                    overwrite.id === roleId,
            )
        ) {
            overwrites.push({
                id: roleId,

                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                ],
            });
        }
    }

    /*
     * Additional ticket access roles.
     */
    for (
        const roleId of
        EXTRA_TICKET_ACCESS_ROLES
    ) {
        if (
            !overwrites.some(
                overwrite =>
                    overwrite.id === roleId,
            )
        ) {
            overwrites.push({
                id: roleId,

                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                ],
            });
        }
    }

    /*
     * Bot permissions.
     */
    if (bot) {
        overwrites.push({
            id: bot.id,

            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        });
    }

    return overwrites;
}

/* =========================================================
   CLAIM PERMISSIONS
========================================================= */

async function applyClaimPermissions(
    channel,
    ticket,
    claimedBy,
) {
    if (!claimedBy) {
        /*
         * When unclaimed, restore the ticket owner.
         */
        await channel.permissionOverwrites.edit(
            ticket.userId,
            {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true,
            },
        );

        return;
    }

    /*
     * Ticket owner can always send.
     */
    await channel.permissionOverwrites.edit(
        ticket.userId,
        {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true,
        },
    );

    /*
     * Claimer can send.
     */
    await channel.permissionOverwrites.edit(
        claimedBy,
        {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true,
        },
    );

    /*
     * Staff / ownership roles can send.
     */
    const allowedRoles =
        new Set([
            ...EXTRA_TICKET_ACCESS_ROLES,
            TEAM_ROLE_ID,
            ...(
                TICKET_TYPES[
                    ticket.type
                ]?.accessRoles || []
            ),
        ]);

    for (const roleId of allowedRoles) {
        await channel.permissionOverwrites.edit(
            roleId,
            {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true,
            },
        );
    }
}

/* =========================================================
   TICKET NAME
========================================================= */

async function findAvailableTicketName(
    guild,
    username,
    type,
) {
    const base =
        getBaseTicketName(
            username,
            type,
        );

    let name = base;
    let number = 1;

    while (
        guild.channels.cache.some(
            channel =>
                channel.type ===
                    ChannelType.GuildText &&
                channel.name === name,
        )
    ) {
        number++;

        name =
            `${base}-${number}`;
    }

    return name.slice(0, 100);
}

/* =========================================================
   TICKET EMBED
========================================================= */

function buildTicketEmbed(ticket) {
    const type =
        TICKET_TYPES[ticket.type];

    const priority =
        formatPriority(
            ticket.priority,
        );

    const owner =
        `<@${ticket.userId}>`;

    let text;

    if (
        ticket.type ===
        'staffapplication'
    ) {
        text =
            `Hey ${owner}, thanks for opening a ticket!\n\n` +
            `Please sit tight while a member of the **Eclipse Staff Management Team** reviews your ticket and gets back to you.\n\n` +
            `Please refrain from pinging staff or owners regarding your ticket. If you provide as much information as possible, it will help our staff understand your request and respond more quickly.\n\n` +
            `Thank you for your patience.`;
    } else if (
        ticket.type ===
        'ownership'
    ) {
        text =
            `Hey ${owner}, thanks for opening a ticket!\n\n` +
            `Please sit tight while a member of the **Eclipse Ownership Team** reviews your ticket and gets back to you.\n\n` +
            `Please refrain from pinging owners regarding your ticket. If you provide as much information as possible, it will help our team understand your request and respond more quickly.\n\n` +
            `Thank you for your patience.`;
    } else {
        text =
            `Hey ${owner}, thanks for opening a ticket!\n\n` +
            `Please sit tight while a member of the **Eclipse Staff Team** reviews your ticket and gets back to you.\n\n` +
            `Please refrain from pinging staff or owners regarding your ticket. If you provide as much information as possible, it will help our staff understand your request and respond more quickly.\n\n` +
            `Thank you for your patience.`;
    }

    /*
     * IMPORTANT:
     *
     * There is intentionally NO .setFooter()
     * here.
     */
    return new EmbedBuilder()
        .setColor(0x5865F2)

        .setDescription(text)

        .addFields(
            {
                name: 'Ticket Type',
                value:
                    `${type?.emoji || ''} ${formatTicketType(ticket.type)}`,
                inline: true,
            },

            {
                name: 'Priority',
                value:
                    `${priority.emoji} ${priority.label}`,
                inline: true,
            },

            {
                name: 'Claimed By',
                value:
                    ticket.claimedBy
                        ? `<@${ticket.claimedBy}>`
                        : 'Unclaimed',
                inline: true,
            },
        );
}

/* =========================================================
   TICKET BUTTONS
========================================================= */

function buildTicketButtons(ticket) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    CUSTOM_IDS.claim,
                )
                .setLabel(
                    ticket.claimedBy
                        ? 'Unclaim'
                        : 'Claim',
                )
                .setEmoji('✋')
                .setStyle(
                    ButtonStyle.Secondary,
                ),

            new ButtonBuilder()
                .setCustomId(
                    CUSTOM_IDS.priority,
                )
                .setLabel('Priority')
                .setEmoji('💼')
                .setStyle(
                    ButtonStyle.Secondary,
                ),

            new ButtonBuilder()
                .setCustomId(
                    CUSTOM_IDS.close,
                )
                .setLabel('Close')
                .setEmoji('🔒')
                .setStyle(
                    ButtonStyle.Danger,
                ),
        );
}

/* =========================================================
   CREATE TICKET
========================================================= */

async function createTicketChannel(
    interaction,
    type,
) {
    const guild =
        interaction.guild;

    if (!guild) {
        throw new Error(
            'Tickets can only be opened inside a server.',
        );
    }

    const ticketType =
        TICKET_TYPES[type];

    if (!ticketType) {
        throw new Error(
            'Invalid ticket type.',
        );
    }

    const openCount =
        await countOpenTickets(
            guild.id,
            interaction.user.id,
        );

    if (
        Number(openCount) >= 3
    ) {
        throw new Error(
            'You already have 3 open tickets.',
        );
    }

    const channelName =
        await findAvailableTicketName(
            guild,
            interaction.user.username,
            type,
        );

    /*
     * Create Discord channel first.
     */
    const channel =
        await guild.channels.create({
            name: channelName,

            type: ChannelType.GuildText,

            parent:
                TICKET_CATEGORY_ID,

            permissionOverwrites:
                buildInitialOverwrites(
                    guild,
                    interaction.user.id,
                    type,
                ),
        });

    let ticket;

    /*
     * Save to PostgreSQL.
     */
    try {
        ticket = await createTicket({
            guildId: guild.id,
            channelId: channel.id,
            channelName,
            userId:
                interaction.user.id,
            username:
                interaction.user.username,
            type,
            priority: 'low',
            question: null,
        });
    } catch (error) {
        try {
            await channel.delete(
                'Ticket database save failed',
            );
        } catch {}

        console.error(
            '[Eclipse Tickets] Database error:',
            error,
        );

        throw new Error(
            'The ticket could not be saved to the database.',
        );
    }

    if (!ticket) {
        try {
            await channel.delete(
                'Ticket database save failed',
            );
        } catch {}

        throw new Error(
            'The ticket could not be saved to the database.',
        );
    }

    ticket =
        normalizeTicket(ticket);

    const freshTicket = {
        ...ticket,

        guildId:
            guild.id,

        channelId:
            channel.id,

        channelName,

        userId:
            interaction.user.id,

        username:
            interaction.user.username,

        type,

        priority: 'low',

        claimedBy: null,
    };

    /*
     * =====================================================
     * OPENING MESSAGE / ROLE PINGS
     * =====================================================
     */

    let mention;

    if (
        type ===
        'staffapplication'
    ) {
        /*
         * Staff application only pings the user.
         */
        mention =
            `<@${interaction.user.id}>`;
    } else {
        /*
         * All other ticket types ping their
         * configured access roles.
         *
         * Ownership therefore pings BOTH:
         *
         * 1554219959251374220
         * 1554220571804303422
         */
        const roles =
            ticketType.accessRoles ||
            [];

        const roleMentions =
            roles
                .map(
                    id =>
                        `<@&${id}>`,
                )
                .join(' ');

        mention =
            `<@${interaction.user.id}> ${roleMentions}`;
    }

    await channel.send({
        content: mention,

        allowedMentions: {
            users: [
                interaction.user.id,
            ],

            roles:
                ticketType.accessRoles ||
                [],
        },
    });

    /*
     * Ticket embed + controls.
     */
    await channel.send({
        embeds: [
            buildTicketEmbed(
                freshTicket,
            ),
        ],

        components: [
            buildTicketButtons(
                freshTicket,
            ),
        ],
    });

    return channel;
}

/* =========================================================
   TEAM MENU
========================================================= */

async function showTeamMenu(
    interaction,
) {
    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                CUSTOM_IDS.teamSelect,
            )
            .setPlaceholder(
                'Select a team application',
            )
            .addOptions(
                {
                    label:
                        'Competitive Roster',

                    description:
                        'Apply to join the Competitive Roster.',

                    value:
                        'competitive',

                    emoji: {
                        id:
                            '1555290266011836456',

                        name:
                            'Competitive',

                        animated:
                            true,
                    },
                },

                {
                    label:
                        'Creative Roster',

                    description:
                        'Apply to join the Creative Roster.',

                    value:
                        'creative',

                    emoji:
                        '📝',
                },

                {
                    label:
                        'GFX or VFX Roster',

                    description:
                        'Apply to join the production team.',

                    value:
                        'production',

                    emoji:
                        '🎨',
                },

                {
                    label:
                        'Streamer or Content Creator',

                    description:
                        'Apply to join as a content creator.',

                    value:
                        'content',

                    emoji:
                        '📹',
                },
            );

    await interaction.reply({
        content:
            '**Eclipse Team Applications**\n\n' +
            'Select the roster you would like to apply for.',

        components: [
            new ActionRowBuilder()
                .addComponents(menu),
        ],

        ephemeral: true,
    });
}

/* =========================================================
   STAFF ACCESS CHECK
========================================================= */

function hasTicketStaffAccess(
    member,
) {
    if (!member) {
        return false;
    }

    if (
        member.permissions?.has(
            PermissionFlagsBits.ManageChannels,
        )
    ) {
        return true;
    }

    return member.roles.cache.some(
        role =>
            [
                TEAM_ROLE_ID,
                STAFF_TICKET_ROLE_ID,
                ...EXTRA_TICKET_ACCESS_ROLES,
            ].includes(role.id),
    );
}

/* =========================================================
   CLAIM
========================================================= */

async function handleClaim(
    interaction,
) {
    let ticket =
        await getTicket(
            interaction.channel.id,
        );

    ticket =
        normalizeTicket(ticket);

    if (!ticket) {
        return interaction.reply({
            content:
                'This is not an Eclipse ticket.',
            ephemeral: true,
        });
    }

    const isStaff =
        hasTicketStaffAccess(
            interaction.member,
        );

    if (!isStaff) {
        return interaction.reply({
            content:
                'You do not have permission to claim this ticket.',
            ephemeral: true,
        });
    }

    if (
        ticket.claimedBy &&
        ticket.claimedBy !==
            interaction.user.id
    ) {
        return interaction.reply({
            content:
                `This ticket is already claimed by <@${ticket.claimedBy}>.`,
            ephemeral: true,
        });
    }

    /*
     * UNCLAIM
     */
    if (
        ticket.claimedBy ===
        interaction.user.id
    ) {
        const updated =
            await unclaimTicket(
                interaction.channel.id,
            );

        const fresh = normalizeTicket(
            updated || {
                ...ticket,
                claimedBy: null,
            },
        );

        await applyClaimPermissions(
            interaction.channel,
            fresh,
            null,
        );

        await interaction.message.edit({
            embeds: [
                buildTicketEmbed(
                    fresh,
                ),
            ],

            components: [
                buildTicketButtons(
                    fresh,
                ),
            ],
        });

        return interaction.reply({
            content:
                'You have unclaimed this ticket.',
            ephemeral: true,
        });
    }

    /*
     * CLAIM
     */
    const updated =
        await claimTicket(
            interaction.channel.id,
            interaction.user.id,
        );

    const fresh =
        normalizeTicket(
            updated || {
                ...ticket,
                claimedBy:
                    interaction.user.id,
            },
        );

    await applyClaimPermissions(
        interaction.channel,
        fresh,
        interaction.user.id,
    );

    await interaction.message.edit({
        embeds: [
            buildTicketEmbed(
                fresh,
            ),
        ],

        components: [
            buildTicketButtons(
                fresh,
            ),
        ],
    });

    return interaction.reply({
        content:
            'You have claimed this ticket.',
        ephemeral: true,
    });
}

/* =========================================================
   PRIORITY
========================================================= */

async function handlePriority(
    interaction,
) {
    let ticket =
        await getTicket(
            interaction.channel.id,
        );

    ticket =
        normalizeTicket(ticket);

    if (!ticket) {
        return interaction.reply({
            content:
                'This is not an Eclipse ticket.',
            ephemeral: true,
        });
    }

    if (
        !hasTicketStaffAccess(
            interaction.member,
        )
    ) {
        return interaction.reply({
            content:
                'You do not have permission to change ticket priority.',
            ephemeral: true,
        });
    }

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `${CUSTOM_IDS.priority}:${interaction.channel.id}`,
            )
            .setPlaceholder(
                'Select ticket priority',
            )
            .addOptions(
                {
                    label: 'Low',
                    description:
                        'Normal ticket priority.',
                    value: 'low',
                    emoji: '🟢',
                },

                {
                    label: 'High',
                    description:
                        'Requires increased attention.',
                    value: 'high',
                    emoji: '🟠',
                },

                {
                    label: 'Urgent',
                    description:
                        'Requires immediate attention.',
                    value: 'urgent',
                    emoji: '🚨',
                },
            );

    return interaction.reply({
        content:
            'Select the new ticket priority:',

        components: [
            new ActionRowBuilder()
                .addComponents(menu),
        ],

        ephemeral: true,
    });
}

/* =========================================================
   PRIORITY SELECTION
========================================================= */

async function handlePrioritySelection(
    interaction,
) {
    const priority =
        interaction.values[0];

    if (!PRIORITIES[priority]) {
        return interaction.update({
            content:
                'Invalid priority.',
            components: [],
        });
    }

    let ticket =
        await getTicket(
            interaction.channel.id,
        );

    ticket =
        normalizeTicket(ticket);

    if (!ticket) {
        return interaction.update({
            content:
                'This is not an Eclipse ticket.',
            components: [],
        });
    }

    if (
        !hasTicketStaffAccess(
            interaction.member,
        )
    ) {
        return interaction.update({
            content:
                'You do not have permission to change ticket priority.',
            components: [],
        });
    }

    const updated =
        await setTicketPriority(
            interaction.channel.id,
            priority,
        );

    const fresh =
        normalizeTicket(
            updated || {
                ...ticket,
                priority,
            },
        );

    const newName =
        getPriorityTicketName(
            fresh,
        );

    if (
        interaction.channel.name !==
        newName
    ) {
        await interaction.channel.setName(
            newName,
            `Priority changed to ${priority}`,
        );
    }

    const priorityInfo =
        formatPriority(priority);

    await interaction.update({
        content:
            `Priority changed to ${priorityInfo.emoji} **${priorityInfo.label}**.`,

        components: [],
    });

    /*
     * Find the ticket embed and update it.
     */
    const messages =
        await interaction.channel.messages.fetch({
            limit: 20,
        });

    const botId =
        interaction.client.user.id;

    const ticketMessage =
        messages.find(
            message =>
                message.author.id ===
                    botId &&
                message.embeds.length > 0,
        );

    if (ticketMessage) {
        await ticketMessage.edit({
            embeds: [
                buildTicketEmbed(
                    fresh,
                ),
            ],

            components: [
                buildTicketButtons(
                    fresh,
                ),
            ],
        });
    }
}

/* =========================================================
   CLOSE MODAL
========================================================= */

async function handleClose(
    interaction,
) {
    let ticket =
        await getTicket(
            interaction.channel.id,
        );

    ticket =
        normalizeTicket(ticket);

    if (!ticket) {
        return interaction.reply({
            content:
                'This is not an Eclipse ticket.',
            ephemeral: true,
        });
    }

    const canClose =
        hasTicketStaffAccess(
            interaction.member,
        ) ||
        interaction.user.id ===
            ticket.userId;

    if (!canClose) {
        return interaction.reply({
            content:
                'You do not have permission to close this ticket.',
            ephemeral: true,
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                CUSTOM_IDS.closeReason,
            )
            .setTitle(
                'Close Eclipse Ticket',
            );

    const reason =
        new TextInputBuilder()
            .setCustomId('reason')
            .setLabel(
                'Reason for closing',
            )
            .setPlaceholder(
                'Enter the reason this ticket is being closed...',
            )
            .setStyle(
                TextInputStyle.Paragraph,
            )
            .setRequired(true)
            .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(reason),
    );

    return interaction.showModal(
        modal,
    );
}

/* =========================================================
   COLLECT TRANSCRIPT
========================================================= */

async function collectTranscript(
    channel,
) {
    const messages = [];

    let before;

    while (true) {
        const options = {
            limit: 100,
        };

        if (before) {
            options.before =
                before;
        }

        const batch =
            await channel.messages.fetch(
                options,
            );

        if (!batch.size) {
            break;
        }

        messages.push(
            ...batch.values(),
        );

        if (batch.size < 100) {
            break;
        }

        before =
            batch.last().id;
    }

    messages.reverse();

    return messages
        .map(message => {
            const timestamp =
                message.createdAt.toISOString();

            const author =
                `${message.author.tag} (${message.author.id})`;

            let content =
                message.content ||
                '';

            if (
                !content &&
                (
                    message.embeds.length ||
                    message.components.length ||
                    message.attachments.size
                )
            ) {
                content =
                    '[embed/components/attachment]';
            }

            return `[${timestamp}] ${author}: ${content}`;
        })
        .join('\n');
}

/* =========================================================
   SEND TRANSCRIPT
========================================================= */

async function sendTranscript(
    client,
    channel,
    ticket,
    closedBy,
    closeReason,
) {
    const logChannel =
        await client.channels.fetch(
            getLogChannelId(),
        );

    if (
        !logChannel?.isTextBased()
    ) {
        return;
    }

    const transcript =
        await collectTranscript(
            channel,
        );

    const openedAt =
        ticket.openedAt ||
        ticket.opened_at ||
        new Date();

    const closedAt =
        new Date();

    const openedTimestamp =
        new Date(
            openedAt,
        ).getTime();

    const closedTimestamp =
        closedAt.getTime();

    const header = [
        'ECLIPSE TICKET TRANSCRIPT',
        '',
        `Ticket Owner: ${formatUser(ticket.userId)}`,

        `Staff Claimed By: ${
            ticket.claimedBy
                ? formatUser(
                      ticket.claimedBy,
                  )
                : 'Unclaimed'
        }`,

        `Date Opened: ${new Date(openedAt).toISOString()}`,

        `Date Closed: ${closedAt.toISOString()}`,

        `Closed By: ${formatUser(closedBy)}`,

        `Close Reason: ${closeReason}`,

        '',

        '--------------------------------------------------',

        '',

        transcript ||
            'No messages were sent.',
    ].join('\n');

    /*
     * Discord message limit.
     */
    const chunks = [];

    for (
        let i = 0;
        i < header.length;
        i += 1900
    ) {
        chunks.push(
            header.slice(
                i,
                i + 1900,
            ),
        );
    }

    /*
     * Transcript metadata.
     */
    const embeds = [
        new EmbedBuilder()
            .setColor(0x5865F2)

            .setTitle(
                'Eclipse Ticket Transcript',
            )

            .addFields(
                {
                    name:
                        'Ticket Owner',

                    value:
                        formatUser(
                            ticket.userId,
                        ),

                    inline: true,
                },

                {
                    name:
                        'Staff Claimed By',

                    value:
                        ticket.claimedBy
                            ? formatUser(
                                  ticket.claimedBy,
                              )
                            : 'Unclaimed',

                    inline: true,
                },

                {
                    name:
                        'Date Opened',

                    value:
                        `<t:${Math.floor(
                            openedTimestamp /
                                1000,
                        )}:F>`,

                    inline: false,
                },

                {
                    name:
                        'Date Closed',

                    value:
                        `<t:${Math.floor(
                            closedTimestamp /
                                1000,
                        )}:F>`,

                    inline: false,
                },

                {
                    name:
                        'Close Reason',

                    value:
                        closeReason,

                    inline: false,
                },
            )

            .setTimestamp(),
    ];

    await logChannel.send({
        embeds,
    });

    for (
        let i = 0;
        i < chunks.length;
        i++
    ) {
        await logChannel.send({
            content:
                `\`\`\`\n${chunks[i]}\n\`\`\``,
        });
    }
}

/* =========================================================
   CLOSE CONFIRMATION
========================================================= */

async function handleCloseConfirmation(
    interaction,
) {
    let ticket =
        await getTicket(
            interaction.channel.id,
        );

    ticket =
        normalizeTicket(ticket);

    if (!ticket) {
        return interaction.reply({
            content:
                'This ticket is no longer registered.',
            ephemeral: true,
        });
    }

    const reason =
        interaction.fields.getTextInputValue(
            'reason',
        );

    await interaction.reply({
        content:
            '🔒 Closing ticket and creating the transcript...',
        ephemeral: true,
    });

    /*
     * Transcript first.
     */
    try {
        await sendTranscript(
            interaction.client,
            interaction.channel,
            ticket,
            interaction.user.id,
            reason,
        );
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to create transcript:',
            error,
        );
    }

    /*
     * Close database record.
     */
    try {
        await closeTicket(
            interaction.channel.id,
            interaction.user.id,
        );
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to close database ticket:',
            error,
        );
    }

    /*
     * Delete the ticket channel.
     */
    setTimeout(
        async () => {
            try {
                await interaction.channel.delete(
                    'Eclipse ticket closed',
                );
            } catch (error) {
                console.error(
                    '[Eclipse Tickets] Failed to delete ticket:',
                    error,
                );
            }
        },
        1500,
    );
}

/* =========================================================
   INTERACTION HANDLER
========================================================= */

async function handleInteraction(
    interaction,
) {
    /*
     * BUTTONS
     */
    if (interaction.isButton()) {
        switch (
            interaction.customId
        ) {
            case CUSTOM_IDS.staff:
                return handleTicketOpen(
                    interaction,
                    'staffapplication',
                );

            case CUSTOM_IDS.team:
                return showTeamMenu(
                    interaction,
                );

            case CUSTOM_IDS.enquiries:
                return handleTicketOpen(
                    interaction,
                    'enquiries',
                );

            case CUSTOM_IDS.ownership:
                return handleTicketOpen(
                    interaction,
                    'ownership',
                );

            case CUSTOM_IDS.claim:
                return handleClaim(
                    interaction,
                );

            case CUSTOM_IDS.priority:
                return handlePriority(
                    interaction,
                );

            case CUSTOM_IDS.close:
                return handleClose(
                    interaction,
                );

            default:
                break;
        }
    }

    /*
     * SELECT MENUS
     */
    if (
        interaction.isStringSelectMenu()
    ) {
        if (
            interaction.customId ===
            CUSTOM_IDS.teamSelect
        ) {
            return handleTicketOpen(
                interaction,
                interaction.values[0],
            );
        }

        if (
            interaction.customId.startsWith(
                `${CUSTOM_IDS.priority}:`,
            )
        ) {
            return handlePrioritySelection(
                interaction,
            );
        }
    }

    /*
     * MODALS
     */
    if (
        interaction.isModalSubmit() &&
        interaction.customId ===
            CUSTOM_IDS.closeReason
    ) {
        return handleCloseConfirmation(
            interaction,
        );
    }
}

/* =========================================================
   OPEN HANDLER
========================================================= */

async function handleTicketOpen(
    interaction,
    type,
) {
    await interaction.deferReply({
        ephemeral: true,
    });

    try {
        const channel =
            await createTicketChannel(
                interaction,
                type,
            );

        await interaction.editReply({
            content:
                `Your ticket has been created: ${channel}`,
        });
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to create ticket:',
            error,
        );

        try {
            await interaction.editReply({
                content:
                    error?.message ||
                    'Something went wrong while creating your ticket.',
            });
        } catch {}
    }
}

/* =========================================================
   REGISTER
========================================================= */

export function registerTicketSystem(
    client,
) {
    /*
     * Register the interaction handler immediately.
     *
     * The panel itself is NOT searched for until
     * clientReady because Discord authentication is
     * required before fetching the channel.
     */
    client.on(
        'interactionCreate',
        async interaction => {
            try {
                await handleInteraction(
                    interaction,
                );
            } catch (error) {
                console.error(
                    '[Eclipse Tickets] Interaction error:',
                    error,
                );

                try {
                    if (
                        interaction.replied ||
                        interaction.deferred
                    ) {
                        await interaction.followUp({
                            content:
                                'Something went wrong while processing that action.',

                            ephemeral: true,
                        });
                    } else {
                        await interaction.reply({
                            content:
                                'Something went wrong while processing that action.',

                            ephemeral: true,
                        });
                    }
                } catch {}
            }
        },
    );

    /*
     * Search Discord for the panel on every startup.
     *
     * If it exists:
     *     do nothing.
     *
     * If it was deleted:
     *     create a new one.
     *
     * This prevents duplicate panels after restarts.
     */
    client.once(
        'clientReady',
        async () => {
            try {
                await ensureTicketPanel(
                    client,
                );

                console.log(
                    '[Eclipse Tickets] Ticket panel check complete.',
                );
            } catch (error) {
                console.error(
                    '[Eclipse Tickets] Ticket panel startup failed:',
                    error,
                );
            }
        },
    );
}

/* =========================================================
   EXPORTS
========================================================= */

export {
    ensureTicketPanel,
    TICKET_TYPES,
    PRIORITIES,
};

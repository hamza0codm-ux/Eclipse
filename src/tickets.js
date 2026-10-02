import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ContainerBuilder,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    SectionBuilder,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
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

/* -------------------------------------------------------------------------- */
/* CONFIG                                                                     */
/* -------------------------------------------------------------------------- */

const PANEL_CHANNEL_ID = '1554243090460450936';
const TICKET_CATEGORY_ID = '1554805189616214096';
const LOG_CHANNEL_ID = '1554214604459085875';

/*
 * Ticket visibility roles
 */

const TEAM_ENQUIRIES_ROLE_ID = '1554540279305084998';

const STAFF_TICKET_ROLE_ID = '1554221483507843222';

const OWNERSHIP_ROLE_IDS = [
    '1554219959251374220',
    '1554220571804303422',
];

/*
 * Users/roles allowed to continue sending after a ticket has been claimed.
 */

const TICKET_MANAGEMENT_ROLE_IDS = [
    '1554221254524010496',
    '1554220571804303422',
    '1554219959251374220',
];

/*
 * Ticket panel emojis.
 */

const PANEL_EMOJIS = {
    staff: '<a:Briefcase:1555225149689696517>',
    team: '⚒️',
    enquiries: '<:questions:1555225101438292108>',
    ownership: '👑',

    competitive: '<a:Competitive:1555290266011836456>',
    creative: '📝',
    production: '🎨',
    content: '📹',
};

/*
 * Priority system.
 *
 * Medium has intentionally been removed.
 */

const PRIORITIES = {
    low: {
        value: 'low',
        label: 'Low',
        emoji: '🟢',
        prefix: '',
    },

    high: {
        value: 'high',
        label: 'High',
        emoji: '🟠',
        prefix: '🟠',
    },

    urgent: {
        value: 'urgent',
        label: 'Urgent',
        emoji: '🚨',
        prefix: '🚨',
    },
};

const TICKET_TYPES = {
    staffapplication: {
        key: 'staffapplication',
        label: 'Eclipse Staff applications',
        shortName: 'staffapplication',
        panelLabel: 'Eclipse Staff applications',
        panelDescription:
            'Apply for a position as staff at Eclipse.',
        panelButton: 'Apply for staff',
        panelEmoji: PANEL_EMOJIS.staff,

        visibilityRoles: [
            STAFF_TICKET_ROLE_ID,
        ],

        teamName: 'Eclipse Staff Management Team',

        intro:
            'Hey {user}, thanks for opening a ticket!\n\n' +
            'Please sit tight while a member of the **Eclipse Staff Management Team** reviews your ticket and gets back to you.\n\n' +
            'Please refrain from pinging staff or owners regarding your ticket. If you provide as much information as possible, it will help our staff understand your request and respond more quickly.\n\n' +
            'Thank you for your patience.',
    },

    competitive: {
        key: 'competitive',
        label: 'Competitive Roster',
        shortName: 'competitive',

        visibilityRoles: [
            TEAM_ENQUIRIES_ROLE_ID,
        ],

        teamName: 'Eclipse Staff Team',

        intro:
            'Hey {user}, thanks for opening a ticket!\n\n' +
            'Please sit tight while a member of the **Eclipse Staff Team** reviews your ticket and gets back to you.\n\n' +
            'Please refrain from pinging staff or owners regarding your ticket. If you provide as much information as possible, it will help our staff understand your request and respond more quickly.\n\n' +
            'Thank you for your patience.',
    },

    creative: {
        key: 'creative',
        label: 'Creative Roster',
        shortName: 'creative',

        visibilityRoles: [
            TEAM_ENQUIRIES_ROLE_ID,
        ],

        teamName: 'Eclipse Staff Team',

        intro:
            'Hey {user}, thanks for opening a ticket!\n\n' +
            'Please sit tight while a member of the **Eclipse Staff Team** reviews your ticket and gets back to you.\n\n' +
            'Please refrain from pinging staff or owners regarding your ticket. If you provide as much information as possible, it will help our staff understand your request and respond more quickly.\n\n' +
            'Thank you for your patience.',
    },

    production: {
        key: 'production',
        label: 'GFX or VFX Roster',
        shortName: 'production',

        visibilityRoles: [
            TEAM_ENQUIRIES_ROLE_ID,
        ],

        teamName: 'Eclipse Staff Team',

        intro:
            'Hey {user}, thanks for opening a ticket!\n\n' +
            'Please sit tight while a member of the **Eclipse Staff Team** reviews your ticket and gets back to you.\n\n' +
            'Please refrain from pinging staff or owners regarding your ticket. If you provide as much information as possible, it will help our staff understand your request and respond more quickly.\n\n' +
            'Thank you for your patience.',
    },

    content: {
        key: 'content',
        label: 'Streamer or Content Creator Roster',
        shortName: 'content',

        visibilityRoles: [
            TEAM_ENQUIRIES_ROLE_ID,
        ],

        teamName: 'Eclipse Staff Team',

        intro:
            'Hey {user}, thanks for opening a ticket!\n\n' +
            'Please sit tight while a member of the **Eclipse Staff Team** reviews your ticket and gets back to you.\n\n' +
            'Please refrain from pinging staff or owners regarding your ticket. If you provide as much information as possible, it will help our staff understand your request and respond more quickly.\n\n' +
            'Thank you for your patience.',
    },

    enquiries: {
        key: 'enquiries',
        label: 'General Enquiries',
        shortName: 'enquiries',

        visibilityRoles: [
            TEAM_ENQUIRIES_ROLE_ID,
        ],

        teamName: 'Eclipse Staff Team',

        intro:
            'Hey {user}, thanks for opening a ticket!\n\n' +
            'Please sit tight while a member of the **Eclipse Staff Team** reviews your ticket and gets back to you.\n\n' +
            'Please refrain from pinging staff or owners regarding your ticket. If you provide as much information as possible, it will help our staff understand your request and respond more quickly.\n\n' +
            'Thank you for your patience.',
    },

    ownership: {
        key: 'ownership',
        label: 'Ownership Enquiries',
        shortName: 'ownership',

        visibilityRoles: [
            ...OWNERSHIP_ROLE_IDS,
        ],

        teamName: 'Eclipse Ownership Team',

        intro:
            'Hey {user}, thanks for opening a ticket!\n\n' +
            'Please sit tight while a member of the **Eclipse Ownership Team** reviews your ticket and gets back to you.\n\n' +
            'Please refrain from pinging owners regarding your ticket. If you provide as much information as possible, it will help our team understand your request and respond more quickly.\n\n' +
            'Thank you for your patience.',
    },
};

/* -------------------------------------------------------------------------- */
/* CUSTOM IDS                                                                 */
/* -------------------------------------------------------------------------- */

const CUSTOM_IDS = {
    staff: 'eclipse_ticket_staff',
    team: 'eclipse_ticket_team',
    enquiries: 'eclipse_ticket_enquiries',
    ownership: 'eclipse_ticket_ownership',

    teamSelect: 'eclipse_ticket_team_select',

    claim: 'eclipse_ticket_claim',
    priority: 'eclipse_ticket_priority',
    close: 'eclipse_ticket_close',

    closeModal: 'eclipse_ticket_close_modal',
    closeReason: 'eclipse_ticket_close_reason',
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function truncate(value, length = 1024) {
    const text = String(value ?? 'N/A');

    if (text.length <= length) {
        return text;
    }

    return `${text.slice(0, length - 3)}...`;
}

function formatUser(userId) {
    return userId ? `<@${userId}>` : 'N/A';
}

function getTicketType(type) {
    return TICKET_TYPES[type] || null;
}

function formatPriority(priority) {
    return PRIORITIES[priority] || PRIORITIES.low;
}

function getBaseTicketName(username, type) {
    const cleanUsername = String(username)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 45);

    const cleanType =
        TICKET_TYPES[type]?.shortName || type;

    return `${cleanUsername}-${cleanType}`;
}

function getPriorityChannelName(ticket) {
    const priority =
        formatPriority(ticket.priority);

    const baseName =
        getBaseTicketName(
            ticket.username,
            ticket.type,
        );

    return `${priority.prefix}${baseName}`.slice(
        0,
        100,
    );
}

function getTicketCategoryId() {
    return (
        config.tickets?.categoryId ||
        TICKET_CATEGORY_ID
    );
}

function getPanelChannelId() {
    return (
        config.tickets?.panelChannelId ||
        PANEL_CHANNEL_ID
    );
}

function getLogChannelId() {
    return (
        config.tickets?.logChannelId ||
        LOG_CHANNEL_ID
    );
}

/* -------------------------------------------------------------------------- */
/* PANEL DETECTION                                                            */
/* -------------------------------------------------------------------------- */

function isTicketPanel(message) {
    if (!message?.author?.bot) {
        return false;
    }

    const components =
        JSON.stringify(
            message.components || [],
        );

    return (
        components.includes(
            CUSTOM_IDS.staff,
        ) &&
        components.includes(
            CUSTOM_IDS.team,
        ) &&
        components.includes(
            CUSTOM_IDS.enquiries,
        ) &&
        components.includes(
            CUSTOM_IDS.ownership,
        )
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
            await channel.messages.fetch(
                options,
            );

        if (!messages.size) {
            return null;
        }

        const existing =
            messages.find(
                (message) =>
                    isTicketPanel(message),
            );

        if (existing) {
            return existing;
        }

        if (messages.size < 100) {
            return null;
        }

        before =
            messages.last().id;
    }
}

/* -------------------------------------------------------------------------- */
/* PANEL BUTTON                                                               */
/* -------------------------------------------------------------------------- */

function buildPanelButton(
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

/* -------------------------------------------------------------------------- */
/* PANEL                                                                      */
/* -------------------------------------------------------------------------- */

function buildTicketPanel() {
    const container =
        new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            '# Eclipse Support',
        ),
    );

    /* STAFF */

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `### ${PANEL_EMOJIS.staff} Eclipse Staff applications\n` +
                        `Apply for a position as staff at Eclipse.`,
                    ),
            )
            .setButtonAccessory(
                buildPanelButton(
                    CUSTOM_IDS.staff,
                    'Apply for staff',
                    PANEL_EMOJIS.staff,
                ),
            ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true),
    );

    /* TEAM */

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `### ⚒️ Eclipse Team Applications\n` +
                        `Apply as a Competitive player, Creative, Production or Content Roster at Eclipse.`,
                    ),
            )
            .setButtonAccessory(
                buildPanelButton(
                    CUSTOM_IDS.team,
                    'Join Eclipse',
                    PANEL_EMOJIS.team,
                ),
            ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true),
    );

    /* GENERAL */

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `### ${PANEL_EMOJIS.enquiries} General Enquiries\n` +
                        `For questions, enquiries and reports.`,
                    ),
            )
            .setButtonAccessory(
                buildPanelButton(
                    CUSTOM_IDS.enquiries,
                    'General Enquiries',
                    PANEL_EMOJIS.enquiries,
                ),
            ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true),
    );

    /* OWNERSHIP */

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `### ${PANEL_EMOJIS.ownership} Ownership Enquiries\n` +
                        `For investment opportunities, partnerships and other ownership enquiries.`,
                    ),
            )
            .setButtonAccessory(
                buildPanelButton(
                    CUSTOM_IDS.ownership,
                    'Ownership Enquiries',
                    PANEL_EMOJIS.ownership,
                ),
            ),
    );

    return container;
}

/* -------------------------------------------------------------------------- */
/* ENSURE PANEL                                                               */
/* -------------------------------------------------------------------------- */

async function ensureTicketPanel(client) {
    const channel =
        await client.channels.fetch(
            getPanelChannelId(),
        );

    if (!channel?.isTextBased()) {
        throw new Error(
            `Ticket panel channel ${getPanelChannelId()} is not a text channel.`,
        );
    }

    console.log(
        '[Eclipse Tickets] Checking ticket panel...',
    );

    const existing =
        await findExistingPanel(
            channel,
        );

    if (existing) {
        console.log(
            `[Eclipse Tickets] Ticket panel already exists: ${existing.id}`,
        );

        return existing;
    }

    const message =
        await channel.send({
            components: [
                buildTicketPanel(),
            ],

            flags:
                MessageFlags.IsComponentsV2,
        });

    console.log(
        `[Eclipse Tickets] Ticket panel created: ${message.id}`,
    );

    return message;
}

/* -------------------------------------------------------------------------- */
/* TICKET PERMISSIONS                                                         */
/* -------------------------------------------------------------------------- */

function getVisibilityRoles(type) {
    const ticketType =
        getTicketType(type);

    return (
        ticketType?.visibilityRoles ||
        []
    );
}

function canManageTicket(interaction) {
    if (!interaction.member) {
        return false;
    }

    if (
        interaction.member.permissions.has(
            PermissionFlagsBits.ManageChannels,
        )
    ) {
        return true;
    }

    return TICKET_MANAGEMENT_ROLE_IDS.some(
        (roleId) =>
            interaction.member.roles.cache.has(
                roleId,
            ),
    );
}

function canSendInTicket(
    interaction,
    ticket,
) {
    const userId =
        interaction.user.id;

    /*
     * Ticket owner can always send.
     */

    if (
        userId ===
        ticket.userId
    ) {
        return true;
    }

    /*
     * Claimed staff member can send.
     */

    if (
        ticket.claimedBy &&
        userId ===
            ticket.claimedBy
    ) {
        return true;
    }

    /*
     * Specific management roles can send.
     */

    if (
        interaction.member?.roles?.cache
    ) {
        for (
            const roleId
            of TICKET_MANAGEMENT_ROLE_IDS
        ) {
            if (
                interaction.member.roles.cache.has(
                    roleId,
                )
            ) {
                return true;
            }
        }
    }

    /*
     * Ticket visibility role can send.
     */

    const visibilityRoles =
        getVisibilityRoles(
            ticket.type,
        );

    if (
        interaction.member?.roles?.cache
    ) {
        for (
            const roleId
            of visibilityRoles
        ) {
            if (
                interaction.member.roles.cache.has(
                    roleId,
                )
            ) {
                return true;
            }
        }
    }

    return false;
}

/* -------------------------------------------------------------------------- */
/* TICKET INTRO                                                               */
/* -------------------------------------------------------------------------- */

function buildTicketIntro(ticket) {
    const ticketType =
        getTicketType(
            ticket.type,
        );

    const intro =
        ticketType?.intro ||
        TICKET_TYPES.enquiries.intro;

    return intro.replaceAll(
        '{user}',
        `<@${ticket.userId}>`,
    );
}

/* -------------------------------------------------------------------------- */
/* TICKET EMBED                                                               */
/* -------------------------------------------------------------------------- */

function buildTicketEmbed(ticket) {
    const ticketType =
        getTicketType(
            ticket.type,
        );

    const priority =
        formatPriority(
            ticket.priority,
        );

    return new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(
            buildTicketIntro(ticket),
        )
        .addFields(
            {
                name: 'Ticket Type',
                value:
                    ticketType?.label ||
                    ticket.type,
                inline: true,
            },
            {
                name: 'Priority',
                value:
                    `${priority.emoji} ${priority.label}`,
                inline: true,
            },
            {
                name: 'Status',
                value: '🟢 Open',
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

/* -------------------------------------------------------------------------- */
/* TICKET BUTTONS                                                             */
/* -------------------------------------------------------------------------- */

function buildTicketControls(ticket) {
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
                .setLabel(
                    'Priority',
                )
                .setEmoji('💼')
                .setStyle(
                    ButtonStyle.Secondary,
                ),

            new ButtonBuilder()
                .setCustomId(
                    CUSTOM_IDS.close,
                )
                .setLabel(
                    'Close',
                )
                .setEmoji('🔒')
                .setStyle(
                    ButtonStyle.Danger,
                ),
        );
}

/* -------------------------------------------------------------------------- */
/* TICKET MESSAGE                                                             */
/* -------------------------------------------------------------------------- */

function buildTicketMessage(ticket) {
    const container =
        new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(
                `**Ticket Information**`,
            ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true),
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(
                `**Ticket Type:** ${getTicketType(ticket.type)?.label || ticket.type}\n` +
                `**Status:** 🟢 Open\n` +
                `**Claimed by:** ${
                    ticket.claimedBy
                        ? `<@${ticket.claimedBy}>`
                        : 'Unclaimed'
                }\n` +
                `**Priority:** ${
                    formatPriority(
                        ticket.priority,
                    ).emoji
                } ${
                    formatPriority(
                        ticket.priority,
                    ).label
                }`,
            ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true),
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(
                'Please provide as much information as possible so our team can assist you quickly.',
            ),
    );

    container.addActionRowComponents(
        buildTicketControls(ticket),
    );

    return container;
}

/* -------------------------------------------------------------------------- */
/* FIND TICKET NAME                                                           */
/* -------------------------------------------------------------------------- */

async function findAvailableTicketName(
    guild,
    member,
    type,
) {
    const base =
        getBaseTicketName(
            member.user.username,
            type,
        );

    let name = base;
    let number = 1;

    while (
        guild.channels.cache.some(
            (channel) =>
                channel.type ===
                    ChannelType.GuildText &&
                channel.name === name,
        )
    ) {
        number += 1;

        name =
            `${base}-${number}`;
    }

    return name.slice(
        0,
        100,
    );
}

/* -------------------------------------------------------------------------- */
/* CREATE TICKET                                                              */
/* -------------------------------------------------------------------------- */

async function createTicketChannel(
    interaction,
    type,
) {
    const guild =
        interaction.guild;

    const member =
        interaction.member;

    if (!guild || !member) {
        throw new Error(
            'Tickets can only be opened inside a server.',
        );
    }

    const ticketType =
        getTicketType(type);

    if (!ticketType) {
        throw new Error(
            'Invalid ticket type.',
        );
    }

    const maxTickets =
        Number(
            config.tickets
                ?.maxOpenTicketsPerUser ||
                3,
        );

    const openCount =
        await countOpenTickets(
            guild.id,
            interaction.user.id,
        );

    if (
        Number(openCount) >=
        maxTickets
    ) {
        throw new Error(
            `You already have the maximum of ${maxTickets} open tickets.`,
        );
    }

    const channelName =
        await findAvailableTicketName(
            guild,
            member,
            type,
        );

    const botMember =
        guild.members.me;

    const overwrites = [
        {
            id:
                guild.roles.everyone.id,

            deny: [
                PermissionFlagsBits.ViewChannel,
            ],
        },

        {
            id:
                interaction.user.id,

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
     * Ticket-specific visibility roles.
     */

    for (
        const roleId
        of getVisibilityRoles(type)
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

    /*
     * Management roles.
     */

    for (
        const roleId
        of TICKET_MANAGEMENT_ROLE_IDS
    ) {
        if (
            overwrites.some(
                (entry) =>
                    entry.id ===
                    roleId,
            )
        ) {
            continue;
        }

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

    /*
     * Bot permissions.
     */

    if (botMember) {
        overwrites.push({
            id: botMember.id,

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

    let channel;

    try {
        channel =
            await guild.channels.create({
                name: channelName,

                type:
                    ChannelType.GuildText,

                parent:
                    getTicketCategoryId(),

                permissionOverwrites:
                    overwrites,
            });

        /*
         * Base priority is Low.
         * There is no Medium.
         */

        const ticket =
            await createTicket({
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

                priority:
                    'low',

                question:
                    null,
            });

        if (!ticket) {
            throw new Error(
                'The ticket was created but could not be saved to the database.',
            );
        }

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

            priority:
                'low',

            claimedBy:
                null,
        };

        /*
         * First message:
         *
         * User mention + role mention as a normal message.
         */

        const roleMentions =
            getVisibilityRoles(type)
                .map(
                    (roleId) =>
                        `<@&${roleId}>`,
                )
                .join(' ');

        await channel.send({
            content:
                `<@${interaction.user.id}> ${roleMentions}`.trim(),

            allowedMentions: {
                users: [
                    interaction.user.id,
                ],

                roles:
                    getVisibilityRoles(
                        type,
                    ),
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
                buildTicketMessage(
                    freshTicket,
                ),
            ],

            flags:
                MessageFlags.IsComponentsV2,
        });

        return channel;
    } catch (error) {
        /*
         * If the channel was created but the database failed,
         * remove the orphaned channel.
         */

        if (channel) {
            try {
                await channel.delete(
                    'Ticket creation failed and database save failed.',
                );
            } catch (deleteError) {
                console.error(
                    '[Eclipse Tickets] Failed to remove orphaned ticket channel:',
                    deleteError,
                );
            }
        }

        throw error;
    }
}

/* -------------------------------------------------------------------------- */
/* REFRESH TICKET                                                             */
/* -------------------------------------------------------------------------- */

async function refreshTicketMessage(
    channel,
    ticket,
) {
    const messages =
        await channel.messages.fetch({
            limit: 50,
        });

    const botId =
        channel.client.user.id;

    const message =
        messages.find(
            (msg) =>
                msg.author.id ===
                    botId &&
                msg.components?.length,
        );

    if (!message) {
        return;
    }

    await message.edit({
        components: [
            buildTicketMessage(
                ticket,
            ),
        ],

        flags:
            MessageFlags.IsComponentsV2,
    });
}

/* -------------------------------------------------------------------------- */
/* TEAM MENU                                                                  */
/* -------------------------------------------------------------------------- */

async function showTeamSelection(
    interaction,
) {
    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                CUSTOM_IDS.teamSelect,
            )
            .setPlaceholder(
                'Select a team roster',
            )
            .addOptions(
                {
                    label:
                        'Competitive Roster',

                    description:
                        'Apply as a Competitive player.',

                    value:
                        'competitive',

                    emoji:
                        PANEL_EMOJIS.competitive,
                },

                {
                    label:
                        'Creative Roster',

                    description:
                        'Apply for the Creative Roster.',

                    value:
                        'creative',

                    emoji:
                        PANEL_EMOJIS.creative,
                },

                {
                    label:
                        'GFX or VFX Roster',

                    description:
                        'Apply for the Production team.',

                    value:
                        'production',

                    emoji:
                        PANEL_EMOJIS.production,
                },

                {
                    label:
                        'Streamer or Content Creator Roster',

                    description:
                        'Apply for the Content team.',

                    value:
                        'content',

                    emoji:
                        PANEL_EMOJIS.content,
                },
            );

    await interaction.reply({
        content:
            'Please select the roster you would like to apply for.',

        components: [
            new ActionRowBuilder()
                .addComponents(
                    menu,
                ),
        ],

        ephemeral: true,
    });
}

/* -------------------------------------------------------------------------- */
/* OPEN                                                                       */
/* -------------------------------------------------------------------------- */

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

        await interaction.editReply({
            content:
                'The ticket could not be created. Please try again later.',
        });
    }
}

/* -------------------------------------------------------------------------- */
/* CLAIM                                                                      */
/* -------------------------------------------------------------------------- */

async function handleClaim(
    interaction,
) {
    const ticket =
        await getTicket(
            interaction.channel.id,
        );

    if (!ticket) {
        return interaction.reply({
            content:
                'This is not a registered Eclipse ticket.',
            ephemeral: true,
        });
    }

    if (
        !canManageTicket(
            interaction,
        )
    ) {
        return interaction.reply({
            content:
                'You do not have permission to claim Eclipse tickets.',
            ephemeral: true,
        });
    }

    /*
     * Unclaim.
     */

    if (ticket.claimedBy) {
        if (
            ticket.claimedBy !==
            interaction.user.id
        ) {
            return interaction.reply({
                content:
                    `This ticket is already claimed by <@${ticket.claimedBy}>.`,
                ephemeral: true,
            });
        }

        const updated =
            await unclaimTicket(
                interaction.channel.id,
            );

        const fresh = {
            ...ticket,
            ...(updated || {}),
            claimedBy:
                null,
        };

        await refreshTicketMessage(
            interaction.channel,
            fresh,
        );

        return interaction.reply({
            content:
                'You have unclaimed this ticket.',
            ephemeral: true,
        });
    }

    /*
     * Claim.
     */

    const updated =
        await claimTicket(
            interaction.channel.id,
            interaction.user.id,
        );

    const fresh = {
        ...ticket,
        ...(updated || {}),
        claimedBy:
            interaction.user.id,
    };

    /*
     * Once claimed, restrict the ticket to:
     *
     * - Ticket owner
     * - Claimer
     * - Management roles
     * - Ticket visibility roles
     * - Bot
     */

    try {
        const everyone =
            interaction.guild.roles
                .everyone;

        await interaction.channel.permissionOverwrites.edit(
            everyone.id,
            {
                ViewChannel: false,
                SendMessages: false,
            },
        );

        await interaction.channel.permissionOverwrites.edit(
            interaction.user.id,
            {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
            },
        );

        await interaction.channel.permissionOverwrites.edit(
            ticket.userId,
            {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
            },
        );

        for (
            const roleId
            of [
                ...getVisibilityRoles(
                    ticket.type,
                ),
                ...TICKET_MANAGEMENT_ROLE_IDS,
            ]
        ) {
            await interaction.channel.permissionOverwrites.edit(
                roleId,
                {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                },
            );
        }
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to update claim permissions:',
            error,
        );
    }

    await refreshTicketMessage(
        interaction.channel,
        fresh,
    );

    return interaction.reply({
        content:
            'You have claimed this ticket.',
        ephemeral: true,
    });
}

/* -------------------------------------------------------------------------- */
/* PRIORITY                                                                   */
/* -------------------------------------------------------------------------- */

async function handlePriority(
    interaction,
) {
    const ticket =
        await getTicket(
            interaction.channel.id,
        );

    if (!ticket) {
        return interaction.reply({
            content:
                'This is not a registered Eclipse ticket.',
            ephemeral: true,
        });
    }

    if (
        !canManageTicket(
            interaction,
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
                'eclipse_ticket_priority_select',
            )
            .setPlaceholder(
                'Select ticket priority',
            )
            .addOptions(
                {
                    label: 'Low',

                    description:
                        'Normal ticket priority.',

                    value:
                        'low',

                    emoji:
                        '🟢',
                },

                {
                    label: 'High',

                    description:
                        'Ticket requires increased attention.',

                    value:
                        'high',

                    emoji:
                        '🟠',
                },

                {
                    label: 'Urgent',

                    description:
                        'Ticket requires immediate attention.',

                    value:
                        'urgent',

                    emoji:
                        '🚨',
                },
            );

    await interaction.reply({
        content:
            'Select the new ticket priority:',

        components: [
            new ActionRowBuilder()
                .addComponents(
                    menu,
                ),
        ],

        ephemeral: true,
    });
}

/* -------------------------------------------------------------------------- */
/* PRIORITY SELECT                                                            */
/* -------------------------------------------------------------------------- */

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

    const ticket =
        await getTicket(
            interaction.channel.id,
        );

    if (!ticket) {
        return interaction.update({
            content:
                'This is not a registered Eclipse ticket.',

            components: [],
        });
    }

    if (
        !canManageTicket(
            interaction,
        )
    ) {
        return interaction.update({
            content:
                'You do not have permission to change priority.',

            components: [],
        });
    }

    const updated =
        await setTicketPriority(
            interaction.channel.id,
            priority,
        );

    const fresh = {
        ...ticket,
        ...(updated || {}),
        priority,
    };

    const newName =
        getPriorityChannelName(
            fresh,
        );

    if (
        interaction.channel.name !==
        newName
    ) {
        await interaction.channel.setName(
            newName,
            `Ticket priority changed to ${priority}`,
        );
    }

    await refreshTicketMessage(
        interaction.channel,
        fresh,
    );

    await interaction.update({
        content:
            `Ticket priority changed to ${formatPriority(priority).emoji} **${formatPriority(priority).label}**.`,

        components: [],
    });
}

/* -------------------------------------------------------------------------- */
/* CLOSE MODAL                                                                */
/* -------------------------------------------------------------------------- */

function buildCloseModal() {
    const modal =
        new ModalBuilder()
            .setCustomId(
                CUSTOM_IDS.closeModal,
            )
            .setTitle(
                'Close Eclipse Ticket',
            );

    const reason =
        new TextInputBuilder()
            .setCustomId(
                CUSTOM_IDS.closeReason,
            )
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
            .setMinLength(2)
            .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                reason,
            ),
    );

    return modal;
}

/* -------------------------------------------------------------------------- */
/* TRANSCRIPT                                                                 */
/* -------------------------------------------------------------------------- */

async function createTranscript(
    channel,
    ticket,
    closedBy,
    closeReason,
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

    messages.sort(
        (a, b) =>
            a.createdTimestamp -
            b.createdTimestamp,
    );

    const openedAt =
        ticket.openedAt ||
        ticket.opened_at ||
        Date.now();

    const closedAt =
        new Date();

    const lines = [];

    lines.push(
        'ECLIPSE TICKET TRANSCRIPT',
    );

    lines.push(
        '================================',
    );

    lines.push(
        `Ticket Owner: ${ticket.userId ? `<@${ticket.userId}>` : 'Unknown'} (${ticket.userId || 'Unknown'})`,
    );

    lines.push(
        `Staff Claimed By: ${
            ticket.claimedBy
                ? `<@${ticket.claimedBy}> (${ticket.claimedBy})`
                : 'Unclaimed'
        }`,
    );

    lines.push(
        `Date Opened: ${new Date(openedAt).toISOString()}`,
    );

    lines.push(
        `Date Closed: ${closedAt.toISOString()}`,
    );

    lines.push(
        `Closed By: <@${closedBy}> (${closedBy})`,
    );

    lines.push(
        `Close Reason: ${closeReason}`,
    );

    lines.push(
        '================================',
    );

    lines.push('');

    for (const message of messages) {
        const timestamp =
            new Date(
                message.createdTimestamp,
            ).toISOString();

        const author =
            `${message.author.username} (${message.author.id})`;

        const content =
            message.content ||
            '[No text content]';

        lines.push(
            `[${timestamp}] ${author}: ${content}`,
        );

        if (
            message.attachments.size
        ) {
            for (
                const attachment
                of message.attachments.values()
            ) {
                lines.push(
                    `Attachment: ${attachment.url}`,
                );
            }
        }
    }

    return Buffer.from(
        lines.join('\n'),
        'utf8',
    );
}

/* -------------------------------------------------------------------------- */
/* SEND TRANSCRIPT                                                            */
/* -------------------------------------------------------------------------- */

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
        throw new Error(
            'Eclipse ticket log channel could not be found.',
        );
    }

    const transcript =
        await createTranscript(
            channel,
            ticket,
            closedBy,
            closeReason,
        );

    const attachment = {
        attachment:
            transcript,
        name:
            `eclipse-${channel.name}-transcript.txt`,
    };

    await logChannel.send({
        content:
            `📁 **Eclipse Ticket Transcript**\n` +
            `**Ticket Owner:** <@${ticket.userId}>\n` +
            `**Staff Claimed By:** ${
                ticket.claimedBy
                    ? `<@${ticket.claimedBy}>`
                    : 'Unclaimed'
            }\n` +
            `**Date Opened:** <t:${Math.floor(new Date(ticket.openedAt || ticket.opened_at || Date.now()).getTime() / 1000)}:F>\n` +
            `**Date Closed:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
            `**Close Reason:** ${truncate(closeReason, 1000)}`,

        files: [
            attachment,
        ],
    });
}

/* -------------------------------------------------------------------------- */
/* CLOSE                                                                      */
/* -------------------------------------------------------------------------- */

async function handleClose(
    interaction,
) {
    const ticket =
        await getTicket(
            interaction.channel.id,
        );

    if (!ticket) {
        return interaction.reply({
            content:
                'This is not a registered Eclipse ticket.',
            ephemeral: true,
        });
    }

    /*
     * Only ticket management / staff roles can close.
     */

    if (
        !canManageTicket(
            interaction,
        )
    ) {
        return interaction.reply({
            content:
                'You do not have permission to close this ticket.',
            ephemeral: true,
        });
    }

    await interaction.showModal(
        buildCloseModal(),
    );
}

/* -------------------------------------------------------------------------- */
/* CLOSE SUBMIT                                                               */
/* -------------------------------------------------------------------------- */

async function handleCloseSubmit(
    interaction,
) {
    const ticket =
        await getTicket(
            interaction.channel.id,
        );

    if (!ticket) {
        return interaction.reply({
            content:
                'This is not a registered Eclipse ticket.',
            ephemeral: true,
        });
    }

    if (
        !canManageTicket(
            interaction,
        )
    ) {
        return interaction.reply({
            content:
                'You do not have permission to close this ticket.',
            ephemeral: true,
        });
    }

    const reason =
        interaction.fields.getTextInputValue(
            CUSTOM_IDS.closeReason,
        );

    await interaction.deferReply({
        ephemeral: true,
    });

    /*
     * Send transcript BEFORE deleting the channel.
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
            '[Eclipse Tickets] Failed to send transcript:',
            error,
        );

        return interaction.editReply({
            content:
                'The ticket could not be closed because the transcript could not be sent.',
        });
    }

    /*
     * Mark closed in database.
     */

    try {
        await closeTicket(
            interaction.channel.id,
            interaction.user.id,
        );
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to close ticket in database:',
            error,
        );
    }

    await interaction.editReply({
        content:
            '🔒 Ticket closed. The transcript has been saved.',
    });

    /*
     * Delete shortly after.
     */

    setTimeout(
        async () => {
            try {
                await interaction.channel.delete(
                    'Eclipse ticket closed',
                );
            } catch (error) {
                console.error(
                    '[Eclipse Tickets] Failed to delete closed ticket:',
                    error,
                );
            }
        },
        1500,
    );
}

/* -------------------------------------------------------------------------- */
/* REGISTER                                                                   */
/* -------------------------------------------------------------------------- */

export async function registerTicketSystem(
    client,
) {
    /*
     * IMPORTANT:
     *
     * index.js already calls registerTicketSystem()
     * after the bot is ready.
     *
     * Therefore we do NOT wait for clientReady here.
     * That was the reason the panel could fail to send
     * when registerTicketSystem() was called from ready.
     */

    try {
        await ensureTicketPanel(
            client,
        );

        console.log(
            '[Eclipse Tickets] Ticket panel check complete.',
        );
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to ensure ticket panel:',
            error,
        );
    }

    client.on(
        'interactionCreate',
        async (interaction) => {
            try {
                /* ---------------------------------------------------------- */
                /* BUTTONS                                                     */
                /* ---------------------------------------------------------- */

                if (
                    interaction.isButton()
                ) {
                    switch (
                        interaction.customId
                    ) {
                        case CUSTOM_IDS.staff:
                            return handleTicketOpen(
                                interaction,
                                'staffapplication',
                            );

                        case CUSTOM_IDS.team:
                            return showTeamSelection(
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

                /* ---------------------------------------------------------- */
                /* TEAM SELECT                                                */
                /* ---------------------------------------------------------- */

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId ===
                        CUSTOM_IDS.teamSelect
                ) {
                    const type =
                        interaction.values[0];

                    return handleTicketOpen(
                        interaction,
                        type,
                    );
                }

                /* ---------------------------------------------------------- */
                /* PRIORITY SELECT                                             */
                /* ---------------------------------------------------------- */

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId ===
                        'eclipse_ticket_priority_select'
                ) {
                    return handlePrioritySelection(
                        interaction,
                    );
                }

                /* ---------------------------------------------------------- */
                /* CLOSE MODAL                                                 */
                /* ---------------------------------------------------------- */

                if (
                    interaction.isModalSubmit() &&
                    interaction.customId ===
                        CUSTOM_IDS.closeModal
                ) {
                    return handleCloseSubmit(
                        interaction,
                    );
                }
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
                                'Something went wrong while processing that ticket action.',

                            ephemeral:
                                true,
                        });
                    } else {
                        await interaction.reply({
                            content:
                                'Something went wrong while processing that ticket action.',

                            ephemeral:
                                true,
                        });
                    }
                } catch {
                    // Ignore secondary interaction errors.
                }
            }
        },
    );
}

/* -------------------------------------------------------------------------- */
/* EXPORTS                                                                    */
/* -------------------------------------------------------------------------- */

export {
    ensureTicketPanel,
    TICKET_TYPES,
    PRIORITIES,
};

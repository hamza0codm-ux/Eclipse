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

/* ========================================================================== */
/* CONFIG                                                                     */
/* ========================================================================== */

const PANEL_CHANNEL_ID = '1554243090460450936';
const TICKET_CATEGORY_ID = '1554805189616214096';
const LOG_CHANNEL_ID = '1554214604459085875';

const TEAM_ROLE_ID = '1554540279305084998';
const STAFF_TICKET_ROLE_ID = '1554221483507843222';

const OWNER_ROLE_IDS = [
    '1554219959251374220',
    '1554220571804303422',
];

const EXTRA_TICKET_ACCESS_ROLES = [
    '1554221254524010496',
    '1554220571804303422',
    '1554219959251374220',
];

const PANEL_FOOTER =
    'Make sure to read <#1554243021296640123> before applying.';

const PANEL_IMAGE_URL =
    config.tickets?.panelImageUrl || null;

/* ========================================================================== */
/* CUSTOM IDS                                                                 */
/* ========================================================================== */

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

/* ========================================================================== */
/* PRIORITIES                                                                 */
/* ========================================================================== */

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

/* ========================================================================== */
/* TICKET TYPES                                                               */
/* ========================================================================== */

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
        accessRoles: [
            ...OWNER_ROLE_IDS,
        ],
        teamName: 'Eclipse Ownership Team',
    },
};

/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */

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

/* ========================================================================== */
/* PANEL DETECTION                                                            */
/* ========================================================================== */

function isEclipsePanel(message) {
    if (!message?.author?.bot) {
        return false;
    }

    if (!message.components?.length) {
        return false;
    }

    const text =
        JSON.stringify(
            message.toJSON?.() ||
            message,
        );

    const requiredIds = [
        CUSTOM_IDS.staff,
        CUSTOM_IDS.team,
        CUSTOM_IDS.enquiries,
        CUSTOM_IDS.ownership,
    ];

    return requiredIds.every(
        id => text.includes(id),
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

        const panel =
            messages.find(
                isEclipsePanel,
            );

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

/* ========================================================================== */
/* PANEL BUTTONS                                                              */
/* ========================================================================== */

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

/* ========================================================================== */
/* PANEL                                                                      */
/* ========================================================================== */

function buildTicketPanel() {
    const container =
        new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(
                '# Eclipse Support',
            ),
    );

    /* STAFF */

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true),
    );

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `# Eclipse Staff applications\n` +
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

    /* TEAM */

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true),
    );

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `# Eclipse Team Applications\n` +
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

    /* GENERAL */

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true),
    );

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `# General Enquiries\n` +
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

    /* OWNERSHIP */

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true),
    );

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `# Ownership Enquiries\n` +
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

    /* IMAGE */

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

    /* FOOTER */

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

    return container;
}

/* ========================================================================== */
/* ENSURE PANEL                                                               */
/* ========================================================================== */

async function ensureTicketPanel(client) {
    if (!client.isReady()) {
        throw new Error(
            'Discord client is not ready yet. Ticket panel startup was skipped.',
        );
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
        await findExistingPanel(
            channel,
        );

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

/* ========================================================================== */
/* TICKET PERMISSIONS                                                         */
/* ========================================================================== */

function buildInitialOverwrites(
    guild,
    userId,
    type,
) {
    const bot =
        guild.members.me;

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

    for (const roleId of EXTRA_TICKET_ACCESS_ROLES) {
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

/* ========================================================================== */
/* CLAIM PERMISSIONS                                                          */
/* ========================================================================== */

async function applyClaimPermissions(
    channel,
    ticket,
    claimedBy,
) {
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

    if (claimedBy) {
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
    }

    const allowedRoles = new Set([
        ...EXTRA_TICKET_ACCESS_ROLES,
        TEAM_ROLE_ID,
        ...(TICKET_TYPES[ticket.type]
            ?.accessRoles || []),
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

/* ========================================================================== */
/* TICKET NAMES                                                               */
/* ========================================================================== */

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

/* ========================================================================== */
/* TICKET EMBED                                                               */
/* ========================================================================== */

function buildTicketEmbed(ticket) {
    const type =
        TICKET_TYPES[ticket.type];

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

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setDescription(text);
}

/* ========================================================================== */
/* TICKET BUTTONS                                                             */
/* ========================================================================== */

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

/* ========================================================================== */
/* CREATE TICKET                                                              */
/* ========================================================================== */

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

    if (Number(openCount) >= 3) {
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

    const channel =
        await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: TICKET_CATEGORY_ID,

            permissionOverwrites:
                buildInitialOverwrites(
                    guild,
                    interaction.user.id,
                    type,
                ),
        });

    let ticket;

    try {
        ticket =
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

                ticketType:
                    type,

                priority:
                    'low',

                question:
                    null,
            });
    } catch (error) {
        try {
            await channel.delete(
                'Ticket database save failed',
            );
        } catch {
            // Ignore cleanup failure.
        }

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
        } catch {
            // Ignore.
        }

        throw new Error(
            'The ticket could not be saved to the database.',
        );
    }

    const freshTicket = {
        ...ticket,
        guildId: guild.id,
        channelId: channel.id,
        channelName,
        userId: interaction.user.id,
        username: interaction.user.username,
        type,
        ticketType: type,
        priority: 'low',
        claimedBy: null,
    };

    let mention;

    if (
        type ===
        'staffapplication'
    ) {
        mention =
            `<@${interaction.user.id}>`;
    } else {
        const roles =
            ticketType.accessRoles || [];

        const roleMentions =
            roles
                .map(
                    id => `<@&${id}>`,
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

/* ========================================================================== */
/* TEAM MENU                                                                  */
/* ========================================================================== */

async function showTeamMenu(interaction) {
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
                    emoji: '📝',
                },

                {
                    label:
                        'GFX or VFX Roster',
                    description:
                        'Apply to join the production team.',
                    value:
                        'production',
                    emoji: '🎨',
                },

                {
                    label:
                        'Streamer or Content Creator',
                    description:
                        'Apply to join as a content creator.',
                    value:
                        'content',
                    emoji: '📹',
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

/* ========================================================================== */
/* CLAIM                                                                      */
/* ========================================================================== */

async function handleClaim(interaction) {
    const ticket =
        await getTicket(
            interaction.channel.id,
        );

    if (!ticket) {
        return interaction.reply({
            content:
                'This is not an Eclipse ticket.',
            ephemeral: true,
        });
    }

    const member =
        interaction.member;

    const isStaff =
        member.roles.cache.some(
            role =>
                [
                    TEAM_ROLE_ID,
                    STAFF_TICKET_ROLE_ID,
                    ...EXTRA_TICKET_ACCESS_ROLES,
                ].includes(role.id),
        );

    const isManager =
        member.permissions.has(
            PermissionFlagsBits.ManageChannels,
        );

    if (!isStaff && !isManager) {
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

    if (
        ticket.claimedBy ===
        interaction.user.id
    ) {
        const updated =
            await unclaimTicket(
                interaction.channel.id,
            );

        const fresh = {
            ...ticket,
            ...(updated || {}),
            claimedBy: null,
        };

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

/* ========================================================================== */
/* PRIORITY                                                                   */
/* ========================================================================== */

async function handlePriority(interaction) {
    const ticket =
        await getTicket(
            interaction.channel.id,
        );

    if (!ticket) {
        return interaction.reply({
            content:
                'This is not an Eclipse ticket.',
            ephemeral: true,
        });
    }

    const member =
        interaction.member;

    const allowed =
        member.roles.cache.some(
            role =>
                [
                    TEAM_ROLE_ID,
                    STAFF_TICKET_ROLE_ID,
                    ...EXTRA_TICKET_ACCESS_ROLES,
                ].includes(role.id),
        ) ||
        member.permissions.has(
            PermissionFlagsBits.ManageChannels,
        );

    if (!allowed) {
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
                'This is not an Eclipse ticket.',
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

    await interaction.update({
        content:
            `Priority changed to ${formatPriority(priority).emoji} **${formatPriority(priority).label}**.`,
        components: [],
    });

    const messages =
        await interaction.channel.messages.fetch({
            limit: 20,
        });

    const ticketMessage =
        messages.find(
            message =>
                message.author.id ===
                    interaction.client.user.id &&
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

/* ========================================================================== */
/* CLOSE                                                                      */
/* ========================================================================== */

async function handleClose(interaction) {
    const ticket =
        await getTicket(
            interaction.channel.id,
        );

    if (!ticket) {
        return interaction.reply({
            content:
                'This is not an Eclipse ticket.',
            ephemeral: true,
        });
    }

    const member =
        interaction.member;

    const canClose =
        member.roles.cache.some(
            role =>
                [
                    TEAM_ROLE_ID,
                    STAFF_TICKET_ROLE_ID,
                    ...EXTRA_TICKET_ACCESS_ROLES,
                ].includes(role.id),
        ) ||
        member.permissions.has(
            PermissionFlagsBits.ManageChannels,
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
            .setCustomId(
                'reason',
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
            .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(reason),
    );

    return interaction.showModal(
        modal,
    );
}

/* ========================================================================== */
/* TRANSCRIPT                                                                 */
/* ========================================================================== */

async function collectTranscript(channel) {
    const messages = [];

    let before;

    while (true) {
        const options = {
            limit: 100,
        };

        if (before) {
            options.before = before;
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

            const content =
                message.content ||
                '[embed/components/attachment]';

            return `[${timestamp}] ${author}: ${content}`;
        })
        .join('\n');
}

/* ========================================================================== */
/* SEND TRANSCRIPT                                                            */
/* ========================================================================== */

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

    if (!logChannel?.isTextBased()) {
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

    const header =
        [
            'ECLIPSE TICKET TRANSCRIPT',
            '',
            `Ticket Owner: ${formatUser(ticket.userId)}`,
            `Staff Claimed By: ${
                ticket.claimedBy
                    ? formatUser(ticket.claimedBy)
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

    await logChannel.send({
        embeds: [
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
                                new Date(
                                    openedAt,
                                ).getTime() / 1000,
                            )}:F>`,
                        inline: false,
                    },
                    {
                        name:
                            'Date Closed',
                        value:
                            `<t:${Math.floor(
                                closedAt.getTime() / 1000,
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
        ],
    });

    for (const chunk of chunks) {
        await logChannel.send({
            content:
                `\`\`\`\n${chunk}\n\`\`\``,
        });
    }
}

/* ========================================================================== */
/* CLOSE CONFIRMATION                                                         */
/* ========================================================================== */

async function handleCloseConfirmation(
    interaction,
) {
    const ticket =
        await getTicket(
            interaction.channel.id,
        );

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

/* ========================================================================== */
/* INTERACTION HANDLER                                                        */
/* ========================================================================== */

async function handleInteraction(interaction) {
    if (interaction.isButton()) {
        switch (interaction.customId) {
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

/* ========================================================================== */
/* OPEN HANDLER                                                               */
/* ========================================================================== */

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
                error?.message ||
                'Something went wrong while creating your ticket.',
        });
    }
}

/* ========================================================================== */
/* REGISTER                                                                   */
/* ========================================================================== */

export async function registerTicketSystem(client) {
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
                } catch {
                    // Ignore secondary interaction errors.
                }
            }
        },
    );
}

/* ========================================================================== */
/* EXPORTS                                                                    */
/* ========================================================================== */

export {
    ensureTicketPanel,
    TICKET_TYPES,
    PRIORITIES,
};

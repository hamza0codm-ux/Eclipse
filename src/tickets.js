import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ContainerBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SectionBuilder,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
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

const TEAM_ENQUIRIES_ROLE = '1554540279305084998';

const STAFF_TICKET_ROLE = '1554221483507843222';

const OWNERSHIP_ROLE_ONE = '1554219959251374220';
const OWNERSHIP_ROLE_TWO = '1554220571804303422';

const TICKET_ACCESS_ROLES = [
    TEAM_ENQUIRIES_ROLE,
    STAFF_TICKET_ROLE,
    OWNERSHIP_ROLE_ONE,
    OWNERSHIP_ROLE_TWO,
];

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
        emoji: '💼',
        panelDescription:
            'Apply for a position as staff at Eclipse.',
        question:
            'Please provide the information required for your staff application.',
        accessRoles: [
            STAFF_TICKET_ROLE,
        ],
        teamName: 'Eclipse Staff Management Team',
    },

    competitive: {
        key: 'competitive',
        label: 'Competitive Roster',
        shortName: 'competitive',
        emoji: '⚔️',
        panelDescription:
            'Apply as a Competitive player at Eclipse.',
        question:
            'Please provide information about yourself and your competitive experience.',
        accessRoles: [
            TEAM_ENQUIRIES_ROLE,
        ],
        teamName: 'Eclipse Staff Team',
    },

    creative: {
        key: 'creative',
        label: 'Creative Roster',
        shortName: 'creative',
        emoji: '📝',
        panelDescription:
            'Apply as a Creative player at Eclipse.',
        question:
            'Please provide information about yourself and your creative experience.',
        accessRoles: [
            TEAM_ENQUIRIES_ROLE,
        ],
        teamName: 'Eclipse Staff Team',
    },

    production: {
        key: 'production',
        label: 'GFX or VFX Roster',
        shortName: 'production',
        emoji: '🎨',
        panelDescription:
            'Apply for the GFX/VFX production roster at Eclipse.',
        question:
            'Please provide information about your GFX/VFX experience.',
        accessRoles: [
            TEAM_ENQUIRIES_ROLE,
        ],
        teamName: 'Eclipse Staff Team',
    },

    content: {
        key: 'content',
        label: 'Streamer or Content Creator Roster',
        shortName: 'content',
        emoji: '📹',
        panelDescription:
            'Apply as a Streamer or Content Creator at Eclipse.',
        question:
            'Please provide information about your content creation or streaming experience.',
        accessRoles: [
            TEAM_ENQUIRIES_ROLE,
        ],
        teamName: 'Eclipse Staff Team',
    },

    enquiries: {
        key: 'enquiries',
        label: 'General Enquiries',
        shortName: 'enquiries',
        emoji: '❓',
        panelDescription:
            'For questions, enquiries and reports.',
        question:
            'Please provide as much information as possible about your question, enquiry or report.',
        accessRoles: [
            TEAM_ENQUIRIES_ROLE,
        ],
        teamName: 'Eclipse Staff Team',
    },

    ownership: {
        key: 'ownership',
        label: 'Ownership Enquiries',
        shortName: 'ownership',
        emoji: '👑',
        panelDescription:
            'For investing, partnerships and other ownership enquiries.',
        question:
            'Please provide as much information as possible about your ownership enquiry.',
        accessRoles: [
            OWNERSHIP_ROLE_ONE,
            OWNERSHIP_ROLE_TWO,
        ],
        teamName: 'Eclipse Ownership Team',
    },
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

function formatTicketType(type) {
    return TICKET_TYPES[type]?.label || type || 'Unknown';
}

function formatPriority(priority) {
    return PRIORITIES[priority] || PRIORITIES.low;
}

function getTicketType(type) {
    return TICKET_TYPES[type] || null;
}

function getBaseTicketName(username, type) {
    const cleanUsername = String(username)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 40);

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

/* -------------------------------------------------------------------------- */
/* PANEL DETECTION                                                            */
/* -------------------------------------------------------------------------- */

function isTicketPanelMessage(message) {
    if (!message?.author?.bot) {
        return false;
    }

    if (!message.components?.length) {
        return false;
    }

    const customIds = [];

    for (const row of message.components) {
        for (const component of row.components ?? []) {
            if (component.customId) {
                customIds.push(component.customId);
            }

            if (component.components) {
                for (const nested of component.components) {
                    if (nested.customId) {
                        customIds.push(
                            nested.customId,
                        );
                    }
                }
            }
        }
    }

    const required = [
        CUSTOM_IDS.staff,
        CUSTOM_IDS.team,
        CUSTOM_IDS.enquiries,
        CUSTOM_IDS.ownership,
    ];

    return required.every((id) =>
        customIds.includes(id),
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
                isTicketPanelMessage,
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
        .setStyle(ButtonStyle.Secondary);
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
                new TextDisplayBuilder().setContent(
                    `<a:Briefcase:1555225149689696517>  **Eclipse Staff applications**\n` +
                    `Apply for a position as staff at Eclipse.`,
                ),
            )
            .setButtonAccessory(
                buildPanelButton(
                    CUSTOM_IDS.staff,
                    'Apply for staff',
                    '<a:Briefcase:1555225149689696517>',
                ),
            ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    /* TEAM */

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `⚒️ **Eclipse Team Applications**\n` +
                    `Apply as a Competitive player, Creative player, Production or Content Roster at Eclipse.`,
                ),
            )
            .setButtonAccessory(
                buildPanelButton(
                    CUSTOM_IDS.team,
                    'Join Eclipse',
                    '⚒️',
                ),
            ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    /* GENERAL */

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `<:questions:1555225101438292108>  **General Enquiries**\n` +
                    `For questions, enquiries and reports.`,
                ),
            )
            .setButtonAccessory(
                buildPanelButton(
                    CUSTOM_IDS.enquiries,
                    'General Enquiries',
                    '<:questions:1555225101438292108>',
                ),
            ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    /* OWNERSHIP */

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `👑 **Ownership Enquiries**\n` +
                    `For investing, partnerships and other ownership enquiries.`,
                ),
            )
            .setButtonAccessory(
                buildPanelButton(
                    CUSTOM_IDS.ownership,
                    'Ownership Enquiries',
                    '👑',
                ),
            ),
    );

    /*
     * Image and footer can be enabled later through config.
     */

    if (
        config.tickets?.panelImageUrl
    ) {
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true),
        );

        container.addMediaGalleryComponents(
            (gallery) =>
                gallery.addItems(
                    (item) =>
                        item.setURL(
                            config.tickets
                                .panelImageUrl,
                        ),
                ),
        );
    }

    if (
        config.tickets?.panelFooter
    ) {
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true),
        );

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                config.tickets.panelFooter,
            ),
        );
    }

    return container;
}

/* -------------------------------------------------------------------------- */
/* ENSURE PANEL                                                               */
/* -------------------------------------------------------------------------- */

async function ensureTicketPanel(client) {
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
        '[Eclipse Tickets] Checking for existing ticket panel...',
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
        '[Eclipse Tickets] No ticket panel found. Sending a new panel...',
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
        `[Eclipse Tickets] New ticket panel sent: ${message.id}`,
    );

    return message;
}

/* -------------------------------------------------------------------------- */
/* TICKET MESSAGE                                                             */
/* -------------------------------------------------------------------------- */

function buildTicketMessage(
    ticket,
) {
    const type =
        getTicketType(ticket.type);

    const userMention =
        `<@${ticket.userId}>`;

    let teamText =
        'Eclipse Staff Team';

    if (
        ticket.type ===
        'staffapplication'
    ) {
        teamText =
            'Eclipse Staff Management Team';
    }

    if (
        ticket.type ===
        'ownership'
    ) {
        teamText =
            'Eclipse Ownership Team';
    }

    const container =
        new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `Hey ${userMention}, thanks for opening a ticket!`,
        ),
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `Please sit tight while a member of the **${teamText}** reviews your ticket and gets back to you.\n\n` +
            `Please refrain from pinging staff or owners regarding your ticket. If you provide as much information as possible, it will help our staff understand your request and respond more quickly.\n\n` +
            `Thank you for your patience.`,
        ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Ticket Type:** ${type?.label || 'Unknown'}\n` +
            `**Information:** ${ticket.question || 'N/A'}\n` +
            `**Status:** 🟢 Open\n` +
            `**Claimed by:** ${
                ticket.claimedBy
                    ? `<@${ticket.claimedBy}>`
                    : 'Unclaimed'
            }`,
        ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    const row =
        new ActionRowBuilder()
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

    container.addActionRowComponents(
        row,
    );

    return container;
}

/* -------------------------------------------------------------------------- */
/* TICKET CHANNEL NAME                                                        */
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
        number++;

        name =
            `${base}-${number}`;
    }

    return name;
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

    if (!guild) {
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

    const openCount =
        await countOpenTickets(
            guild.id,
            interaction.user.id,
        );

    if (
        Number(openCount) >=
        Number(
            config.tickets
                ?.maxOpenTicketsPerUser ||
                3,
        )
    ) {
        throw new Error(
            'You already have the maximum number of open tickets.',
        );
    }

    const channelName =
        await findAvailableTicketName(
            guild,
            interaction.member,
            type,
        );

    const botMember =
        guild.members.me;

    const overwrites = [
        {
            id:
                guild.roles.everyone.id,

            deny: [
                PermissionFlagsBits
                    .ViewChannel,
            ],
        },

        {
            id:
                interaction.user.id,

            allow: [
                PermissionFlagsBits
                    .ViewChannel,

                PermissionFlagsBits
                    .SendMessages,

                PermissionFlagsBits
                    .ReadMessageHistory,

                PermissionFlagsBits
                    .AttachFiles,

                PermissionFlagsBits
                    .EmbedLinks,
            ],
        },
    ];

    /*
     * Add the appropriate ticket access roles.
     */

    for (
        const roleId of ticketType.accessRoles
    ) {
        overwrites.push({
            id: roleId,

            allow: [
                PermissionFlagsBits
                    .ViewChannel,

                PermissionFlagsBits
                    .SendMessages,

                PermissionFlagsBits
                    .ReadMessageHistory,

                PermissionFlagsBits
                    .ManageMessages,

                PermissionFlagsBits
                    .AttachFiles,

                PermissionFlagsBits
                    .EmbedLinks,
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
                PermissionFlagsBits
                    .ViewChannel,

                PermissionFlagsBits
                    .SendMessages,

                PermissionFlagsBits
                    .ReadMessageHistory,

                PermissionFlagsBits
                    .ManageChannels,

                PermissionFlagsBits
                    .ManageMessages,

                PermissionFlagsBits
                    .AttachFiles,

                PermissionFlagsBits
                    .EmbedLinks,
            ],
        });
    }

    /*
     * No channel description/topic.
     */

    const channel =
        await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,

            parent:
                TICKET_CATEGORY_ID,

            permissionOverwrites:
                overwrites,
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

                priority:
                    'low',

                question:
                    ticketType.question,
            });
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Database ticket creation failed:',
            error,
        );

        try {
            await channel.delete(
                'Ticket database save failed',
            );
        } catch {
            // Ignore cleanup failure.
        }

        throw new Error(
            'The ticket could not be saved to the database.',
        );
    }

    const freshTicket = {
        ...(ticket || {}),

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
            ticketType.question,

        claimedBy:
            null,
    };

    /*
     * Non-embed user/team ping message.
     */

    const roleMentions =
        ticketType.accessRoles
            .map(
                (id) =>
                    `<@&${id}>`,
            )
            .join(' ');

    await channel.send({
        content:
            `${`<@${interaction.user.id}>`} ${roleMentions}`.trim(),

        allowedMentions: {
            users: [
                interaction.user.id,
            ],

            roles:
                ticketType.accessRoles,
        },
    });

    /*
     * Ticket Components V2 message.
     */

    await channel.send({
        components: [
            buildTicketMessage(
                freshTicket,
            ),
        ],

        flags:
            MessageFlags.IsComponentsV2,
    });

    return channel;
}

/* -------------------------------------------------------------------------- */
/* REFRESH TICKET MESSAGE                                                     */
/* -------------------------------------------------------------------------- */

async function refreshTicketMessage(
    channel,
    ticket,
) {
    const messages =
        await channel.messages.fetch({
            limit: 50,
        });

    const message =
        messages.find(
            (msg) =>
                msg.author.id ===
                    channel.client.user.id &&
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
                error?.message ||
                'Something went wrong while creating your ticket.',
        });
    }
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
                'Select a team application',
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
                        '<a:Competitive:1555290266011836456>',
                },

                {
                    label:
                        'Creative Roster',

                    description:
                        'Apply as a Creative player.',

                    value:
                        'creative',

                    emoji: '📝',
                },

                {
                    label:
                        'GFX or VFX Roster',

                    description:
                        'Apply for the GFX/VFX production team.',

                    value:
                        'production',

                    emoji: '🎨',
                },

                {
                    label:
                        'Streamer or Content Creator Roster',

                    description:
                        'Apply as a Streamer or Content Creator.',

                    value:
                        'content',

                    emoji: '📹',
                },
            );

    await interaction.reply({
        content:
            'Select the roster you would like to apply for:',

        components: [
            new ActionRowBuilder()
                .addComponents(menu),
        ],

        ephemeral: true,
    });
}

/* -------------------------------------------------------------------------- */
/* STAFF CHECK                                                                */
/* -------------------------------------------------------------------------- */

function hasTicketStaffPermission(
    interaction,
    ticket,
) {
    const member =
        interaction.member;

    if (!member?.roles?.cache) {
        return false;
    }

    const allowedRoles =
        TICKET_ACCESS_ROLES;

    return allowedRoles.some(
        (roleId) =>
            member.roles.cache.has(
                roleId,
            ),
    );
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

    const canManage =
        hasTicketStaffPermission(
            interaction,
            ticket,
        );

    if (!canManage) {
        return interaction.reply({
            content:
                'You do not have permission to claim this ticket.',
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
            claimedBy: null,
        };

        /*
         * Restore message permission for
         * the normal ticket roles.
         */

        await setClaimPermissions(
            interaction.channel,
            ticket,
            null,
        );

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

    await setClaimPermissions(
        interaction.channel,
        ticket,
        interaction.user.id,
    );

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
/* CLAIM PERMISSIONS                                                          */
/* -------------------------------------------------------------------------- */

async function setClaimPermissions(
    channel,
    ticket,
    claimerId,
) {
    /*
     * User who opened the ticket can always send.
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
     * Everyone in the ticket access role can see
     * the ticket, but after a claim only the claimer
     * can send.
     */

    const type =
        getTicketType(ticket.type);

    for (
        const roleId of
        type?.accessRoles || []
    ) {
        await channel.permissionOverwrites.edit(
            roleId,
            {
                ViewChannel: true,
                ReadMessageHistory: true,
                SendMessages:
                    !claimerId,
            },
        );
    }

    /*
     * Explicitly allow the claimer to send.
     */

    if (claimerId) {
        await channel.permissionOverwrites.edit(
            claimerId,
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
        !hasTicketStaffPermission(
            interaction,
            ticket,
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
                CUSTOM_IDS.priority,
            )
            .setPlaceholder(
                'Select ticket priority',
            )
            .addOptions(
                {
                    label:
                        'Low',

                    description:
                        'Normal ticket priority.',

                    value:
                        'low',

                    emoji: '🟢',
                },

                {
                    label:
                        'High',

                    description:
                        'Requires increased attention.',

                    value:
                        'high',

                    emoji: '🟠',
                },

                {
                    label:
                        'Urgent',

                    description:
                        'Requires immediate attention.',

                    value:
                        'urgent',

                    emoji: '🚨',
                },
            );

    await interaction.reply({
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
                'This is not a registered Eclipse ticket.',

            components: [],
        });
    }

    if (
        !hasTicketStaffPermission(
            interaction,
            ticket,
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

    const canClose =
        hasTicketStaffPermission(
            interaction,
            ticket,
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

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                CUSTOM_IDS.closeReason,
            )
            .setPlaceholder(
                'Select a reason for closing',
            )
            .addOptions(
                {
                    label:
                        'Resolved',

                    description:
                        'The request has been resolved.',

                    value:
                        'resolved',

                    emoji: '✅',
                },

                {
                    label:
                        'No response',

                    description:
                        'The ticket received no response.',

                    value:
                        'no_response',

                    emoji: '💤',
                },

                {
                    label:
                        'Duplicate',

                    description:
                        'This ticket duplicates another ticket.',

                    value:
                        'duplicate',

                    emoji: '📋',
                },

                {
                    label:
                        'Invalid',

                    description:
                        'The ticket was opened incorrectly.',

                    value:
                        'invalid',

                    emoji: '⚠️',
                },

                {
                    label:
                        'Other',

                    description:
                        'Another reason for closing.',

                    value:
                        'other',

                    emoji: '📝',
                },
            );

    await interaction.reply({
        content:
            'Please select the reason for closing this ticket:',

        components: [
            new ActionRowBuilder()
                .addComponents(menu),
        ],

        ephemeral: true,
    });
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
    const messages =
        await channel.messages.fetch({
            limit: 100,
        });

    const sorted =
        [...messages.values()]
            .sort(
                (a, b) =>
                    a.createdTimestamp -
                    b.createdTimestamp,
            );

    const openedAt =
        ticket.openedAt ||
        ticket.opened_at ||
        new Date();

    const closedAt =
        new Date();

    let transcript =
        `ECLIPSE TICKET TRANSCRIPT\n`;

    transcript +=
        `================================\n`;

    transcript +=
        `Ticket Owner: ${ticket.username} (${ticket.userId})\n`;

    transcript +=
        `Staff Claimed By: ${
            ticket.claimedBy
                ? `<@${ticket.claimedBy}> (${ticket.claimedBy})`
                : 'Unclaimed'
        }\n`;

    transcript +=
        `Date Opened: ${new Date(
            openedAt,
        ).toISOString()}\n`;

    transcript +=
        `Date Closed: ${closedAt.toISOString()}\n`;

    transcript +=
        `Close Reason: ${closeReason}\n`;

    transcript +=
        `================================\n\n`;

    for (
        const message of sorted
    ) {
        const timestamp =
            new Date(
                message.createdTimestamp,
            ).toISOString();

        const author =
            message.author
                ? `${message.author.tag} (${message.author.id})`
                : 'Unknown';

        const content =
            message.content || '';

        transcript +=
            `[${timestamp}] ${author}: ${content}\n`;

        if (
            message.attachments?.size
        ) {
            for (
                const attachment of
                message.attachments.values()
            ) {
                transcript +=
                    `Attachment: ${attachment.url}\n`;
            }
        }
    }

    return Buffer.from(
        transcript,
        'utf8',
    );
}

/* -------------------------------------------------------------------------- */
/* CLOSE + TRANSCRIPT                                                         */
/* -------------------------------------------------------------------------- */

async function finishClosingTicket(
    interaction,
    closeReason,
) {
    const channel =
        interaction.channel;

    const ticket =
        await getTicket(
            channel.id,
        );

    if (!ticket) {
        return interaction.update({
            content:
                'This is not a registered Eclipse ticket.',

            components: [],
        });
    }

    await interaction.update({
        content:
            '🔒 Ticket closing...',
        components: [],
    });

    let transcript;

    try {
        transcript =
            await createTranscript(
                channel,
                ticket,
                interaction.user.id,
                closeReason,
            );
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to create transcript:',
            error,
        );
    }

    try {
        await closeTicket(
            channel.id,
            interaction.user.id,
        );
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to close ticket in database:',
            error,
        );
    }

    /*
     * Send ONLY the transcript to the central log channel.
     */

    try {
        const logChannel =
            await interaction.client.channels.fetch(
                LOG_CHANNEL_ID,
            );

        if (
            logChannel?.isTextBased() &&
            transcript
        ) {
            const attachment =
                new (
                    await import('discord.js')
                ).AttachmentBuilder(
                    transcript,
                    {
                        name:
                            `${channel.name}-transcript.txt`,
                    },
                );

            await logChannel.send({
                content:
                    `📁 **Ticket Transcript**\n` +
                    `**Ticket:** ${channel.name}\n` +
                    `**Owner:** ${formatUser(ticket.userId)}\n` +
                    `**Claimed by:** ${
                        ticket.claimedBy
                            ? formatUser(
                                ticket.claimedBy,
                            )
                            : 'Unclaimed'
                    }\n` +
                    `**Opened:** <t:${Math.floor(new Date(
                        ticket.openedAt ||
                            ticket.opened_at ||
                            Date.now(),
                    ).getTime() / 1000)}:F>\n` +
                    `**Closed:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                    `**Reason:** ${closeReason}`,

                files: [
                    attachment,
                ],
            });
        }
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to send transcript:',
            error,
        );
    }

    setTimeout(
        async () => {
            try {
                await channel.delete(
                    'Eclipse ticket closed',
                );
            } catch (error) {
                console.error(
                    '[Eclipse Tickets] Failed to delete ticket:',
                    error,
                );
            }
        },
        2000,
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
     * index.js calls this AFTER client.once('ready')
     * has already fired.
     *
     * Therefore we MUST NOT register another clientReady
     * listener here.
     *
     * Check/send the panel immediately.
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

    /*
     * Interactions.
     */

    client.on(
        'interactionCreate',
        async (interaction) => {
            try {
                /*
                 * Buttons.
                 */

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

                /*
                 * Team menu.
                 */

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId ===
                        CUSTOM_IDS.teamSelect
                ) {
                    return handleTicketOpen(
                        interaction,
                        interaction.values[0],
                    );
                }

                /*
                 * Priority menu.
                 */

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId ===
                        CUSTOM_IDS.priority
                ) {
                    return handlePrioritySelection(
                        interaction,
                    );
                }

                /*
                 * Close reason menu.
                 */

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId ===
                        CUSTOM_IDS.closeReason
                ) {
                    const reason =
                        interaction.values[0];

                    return finishClosingTicket(
                        interaction,
                        reason,
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
                            ephemeral: true,
                        });
                    } else {
                        await interaction.reply({
                            content:
                                'Something went wrong while processing that ticket action.',
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

/* -------------------------------------------------------------------------- */
/* EXPORTS                                                                    */
/* -------------------------------------------------------------------------- */

export {
    ensureTicketPanel,
    buildTicketPanel,
    TICKET_TYPES,
    PRIORITIES,
};

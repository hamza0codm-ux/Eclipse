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

const PANEL_MARKER = 'eclipse-ticket-panel-v1';

const CUSTOM_IDS = {
    staff: 'eclipse_ticket_staff',
    team: 'eclipse_ticket_team',
    enquiries: 'eclipse_ticket_enquiries',
    partnerships: 'eclipse_ticket_partnerships',

    teamSelect: 'eclipse_ticket_team_select',

    claim: 'eclipse_ticket_claim',
    priority: 'eclipse_ticket_priority',
    close: 'eclipse_ticket_close',
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
        description:
            'Click the button below to apply for the position of Staff.',
        question:
            'Before you start your application with our staff please can you confirm you meet all the requirements to be on our staff team.',
    },

    enquiries: {
        key: 'enquiries',
        label: 'General Enquiries',
        shortName: 'enquiries',
        emoji: '📞',
        description:
            'Click the button below if you need help from our Staff.',
        question:
            'How may we help you today?',
    },

    partnerships: {
        key: 'partnerships',
        label: 'Partnerships',
        shortName: 'partnerships',
        emoji: '🤝',
        description:
            'Click the button below to partner with Eclipse.',
        question:
            'What is the name of your company/organisation and how long do you want to partner with us for?',
    },

    competitive: {
        key: 'competitive',
        label: 'Competitive Roster',
        shortName: 'competitive',
        emoji: '⚔️',
        description:
            'Click to open a ticket to join as a Competitive Player.',
        question:
            'Please provide information about yourself and your competitive experience.',
    },

    creative: {
        key: 'creative',
        label: 'Creative Roster',
        shortName: 'creative',
        emoji: '🎨',
        description:
            'Click to open a ticket to join as a Creative Player.',
        question:
            'Please provide information about yourself and your creative experience.',
    },

    production: {
        key: 'production',
        label: 'GFX/VFX Roster',
        shortName: 'production',
        emoji: '🎬',
        description:
            'Click to open a ticket to join as part of the production team.',
        question:
            'Please provide information about your GFX/VFX experience.',
    },

    content: {
        key: 'content',
        label: 'Content/Streamer Roster',
        shortName: 'content',
        emoji: '📹',
        description:
            'Click to open a ticket to join as part of the Content team.',
        question:
            'Please provide information about your content/streaming experience.',
    },
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function getSupportRoleId() {
    return config.ticketSupportRoleId || null;
}

function getLogChannelId() {
    return config.tickets.logChannelId;
}

function truncate(value, length = 1024) {
    const text = String(value ?? 'N/A');

    if (text.length <= length) {
        return text;
    }

    return `${text.slice(0, length - 3)}...`;
}

function formatUser(userId) {
    if (!userId) {
        return 'N/A';
    }

    return `<@${userId}>`;
}

function formatTicketType(type) {
    return TICKET_TYPES[type]?.label || type || 'Unknown';
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
    const priority = formatPriority(ticket.priority);

    const baseName = getBaseTicketName(
        ticket.username,
        ticket.type,
    );

    return `${priority.prefix}${baseName}`.slice(0, 100);
}

function getTicketTopic(type, userId) {
    return `Eclipse Ticket | ${type} | ${userId}`;
}

/* -------------------------------------------------------------------------- */
/* PANEL DETECTION                                                            */
/* -------------------------------------------------------------------------- */

function hasTicketPanel(message) {
    if (!message) {
        return false;
    }

    if (!message.author?.bot) {
        return false;
    }

    if (!message.components?.length) {
        return false;
    }

    const components = JSON.stringify(
        message.components,
    );

    /*
     * Primary detection.
     */

    if (components.includes(PANEL_MARKER)) {
        return true;
    }

    /*
     * Secondary detection for an older Eclipse panel
     * that may have been created before the marker existed.
     */

    const expectedButtonIds = [
        CUSTOM_IDS.staff,
        CUSTOM_IDS.team,
        CUSTOM_IDS.enquiries,
        CUSTOM_IDS.partnerships,
    ];

    const matches = expectedButtonIds.filter(
        (id) => components.includes(id),
    );

    return matches.length >= 3;
}

async function findExistingPanel(channel) {
    let before = null;

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

        const existingPanel =
            messages.find((message) =>
                hasTicketPanel(message),
            );

        if (existingPanel) {
            console.log(
                `[Eclipse Tickets] Existing panel found: ${existingPanel.id}`,
            );

            return existingPanel;
        }

        if (messages.size < 100) {
            return null;
        }

        before = messages.last().id;
    }
}

/* -------------------------------------------------------------------------- */
/* PANEL BUTTONS                                                              */
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
/* PUBLIC TICKET PANEL                                                        */
/* -------------------------------------------------------------------------- */

function buildTicketPanel() {
    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# Eclipse Support\n` +
            `Select the department below to open a ticket with the Eclipse team.`,
        ),
    );

    /*
     * STAFF APPLICATIONS
     */

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### 💼 Eclipse Staff applications\n` +
                    `Click the button below to apply for the position of Staff.`,
                ),
            )
            .setButtonAccessory(
                buildPanelButton(
                    CUSTOM_IDS.staff,
                    'Apply',
                    '💼',
                ),
            ),
    );

    /*
     * Divider after Staff Applications.
     */

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    /*
     * TEAM APPLICATIONS
     */

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ⚒️ Eclipse Team Applications\n` +
                    `Click the button below to join our team.`,
                ),
            )
            .setButtonAccessory(
                buildPanelButton(
                    CUSTOM_IDS.team,
                    'Join Team',
                    '⚒️',
                ),
            ),
    );

    /*
     * Divider after Team Applications.
     */

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    /*
     * GENERAL ENQUIRIES
     */

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### 📞 General Enquiries\n` +
                    `Click the button below if you need help from our Staff.`,
                ),
            )
            .setButtonAccessory(
                buildPanelButton(
                    CUSTOM_IDS.enquiries,
                    'Enquire',
                    '📞',
                ),
            ),
    );

    /*
     * Divider after General Enquiries.
     */

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    /*
     * PARTNERSHIPS
     */

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### 🤝 Partnerships\n` +
                    `Click the button below to partner with Eclipse.`,
                ),
            )
            .setButtonAccessory(
                buildPanelButton(
                    CUSTOM_IDS.partnerships,
                    'Partner',
                    '🤝',
                ),
            ),
    );

    /*
     * Divider after Partnerships.
     */

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    /*
     * OPTIONAL PANEL IMAGE
     */

    if (config.tickets.panelImageUrl) {
        container.addMediaGalleryComponents(
            (gallery) =>
                gallery.addItems(
                    (item) =>
                        item.setURL(
                            config.tickets.panelImageUrl,
                        ),
                ),
        );

        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true),
        );
    }

    /*
     * OPTIONAL FOOTER
     */

    if (config.tickets.panelFooter) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                config.tickets.panelFooter,
            ),
        );

        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true),
        );
    }

    /*
     * Hidden marker.
     *
     * The bot searches Discord for this marker on every
     * startup, so restarts do not create duplicate panels.
     */

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `\u200b${PANEL_MARKER}`,
        ),
    );

    return container;
}

/* -------------------------------------------------------------------------- */
/* AUTOMATIC PANEL CREATION                                                   */
/* -------------------------------------------------------------------------- */

async function ensureTicketPanel(client) {
    const channel = await client.channels.fetch(
        config.tickets.panelChannelId,
    );

    if (!channel) {
        throw new Error(
            `Ticket panel channel ${config.tickets.panelChannelId} could not be found.`,
        );
    }

    if (!channel.isTextBased()) {
        throw new Error(
            `Ticket panel channel ${config.tickets.panelChannelId} is not a text channel.`,
        );
    }

    console.log(
        '[Eclipse Tickets] Checking for existing ticket panel...',
    );

    const existingPanel =
        await findExistingPanel(channel);

    if (existingPanel) {
        console.log(
            `[Eclipse Tickets] Existing ticket panel found (${existingPanel.id}). No new panel will be sent.`,
        );

        return existingPanel;
    }

    console.log(
        '[Eclipse Tickets] No ticket panel found. Sending a new panel...',
    );

    const panel = await channel.send({
        components: [
            buildTicketPanel(),
        ],
        flags: MessageFlags.IsComponentsV2,
    });

    console.log(
        `[Eclipse Tickets] New ticket panel sent: ${panel.id}`,
    );

    return panel;
}

/* -------------------------------------------------------------------------- */
/* CENTRAL LOGGING                                                            */
/* -------------------------------------------------------------------------- */

async function sendCentralLog(
    client,
    {
        action,
        ticket = null,
        moderator = null,
        user = null,
        reason = null,
        extraFields = [],
        level = 'info',
    },
) {
    try {
        const channel =
            await client.channels.fetch(
                getLogChannelId(),
            );

        if (!channel?.isTextBased()) {
            return;
        }

        const colors = {
            info: 0x5865f2,
            success: 0x57f287,
            warning: 0xfee75c,
            danger: 0xed4245,
        };

        const embed = new EmbedBuilder()
            .setColor(
                colors[level] ?? colors.info,
            )
            .setTitle(
                `Eclipse • ${action}`,
            )
            .setTimestamp();

        if (ticket) {
            embed.addFields(
                {
                    name: 'Ticket',
                    value:
                        `\`${truncate(
                            ticket.channelName ||
                                ticket.channelId ||
                                'Unknown',
                            100,
                        )}\``,
                    inline: true,
                },
                {
                    name: 'Type',
                    value:
                        formatTicketType(
                            ticket.type,
                        ),
                    inline: true,
                },
                {
                    name: 'Priority',
                    value:
                        `${formatPriority(ticket.priority).emoji} ` +
                        `${formatPriority(ticket.priority).label}`,
                    inline: true,
                },
            );

            if (ticket.userId) {
                embed.addFields({
                    name: 'Opened By',
                    value:
                        formatUser(
                            ticket.userId,
                        ),
                    inline: true,
                });
            }

            embed.addFields({
                name: 'Claimed By',
                value: ticket.claimedBy
                    ? formatUser(
                        ticket.claimedBy,
                    )
                    : 'Unclaimed',
                inline: true,
            });

            if (ticket.channelId) {
                embed.addFields({
                    name: 'Channel',
                    value:
                        `<#${ticket.channelId}>`,
                    inline: true,
                });
            }
        }

        if (user) {
            embed.addFields({
                name: 'User',
                value:
                    formatUser(user),
                inline: true,
            });
        }

        if (moderator) {
            embed.addFields({
                name: 'Staff',
                value:
                    formatUser(moderator),
                inline: true,
            });
        }

        if (reason) {
            embed.addFields({
                name: 'Reason',
                value:
                    truncate(reason),
                inline: false,
            });
        }

        for (const field of extraFields) {
            if (!field?.name) {
                continue;
            }

            embed.addFields({
                name: field.name,
                value:
                    truncate(
                        field.value ??
                            'N/A',
                    ),
                inline:
                    field.inline ??
                    false,
            });
        }

        embed.setFooter({
            text: 'Eclipse Logging',
        });

        await channel.send({
            embeds: [embed],
        });
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to send central log:',
            error,
        );
    }
}

/* -------------------------------------------------------------------------- */
/* TICKET MESSAGE                                                             */
/* -------------------------------------------------------------------------- */

function buildTicketMessage(
    ticket,
    memberMention,
) {
    const priority =
        formatPriority(
            ticket.priority,
        );

    const supportRoleId =
        getSupportRoleId();

    const supportMention =
        supportRoleId
            ? `<@&${supportRoleId}>`
            : 'Ticket Support';

    const container =
        new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# Eclipse Support`,
        ),
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `Hey ${memberMention}, thank you for opening a ticket. A member of the Eclipse staff team will assist you shortly. ${supportMention}`,
        ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Ticket Type:** ${formatTicketType(
                ticket.type,
            )}\n` +
            `**Information:** ${
                ticket.question ||
                TICKET_TYPES[
                    ticket.type
                ]?.question ||
                'N/A'
            }\n` +
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

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `The Eclipse Support Team will assist you shortly,\n` +
            `In the meantime please provide your request and information to speed up the process,\n` +
            `We ask you to not ping our staff whilst this ticket is open.`,
        ),
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Priority:** ${priority.emoji} ${priority.label}`,
        ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    const actionRow =
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(
                    CUSTOM_IDS.claim,
                )
                .setLabel(
                    ticket.claimedBy
                        ? 'Unclaim'
                        : 'Claim',
                )
                .setEmoji('🙋')
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
        actionRow,
    );

    return container;
}

/* -------------------------------------------------------------------------- */
/* TICKET NAME                                                                */
/* -------------------------------------------------------------------------- */

async function findAvailableTicketName(
    guild,
    member,
    type,
) {
    const baseName =
        getBaseTicketName(
            member.user.username,
            type,
        );

    let name = baseName;
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
            `${baseName}-${number}`;
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

    const member =
        interaction.member;

    if (!guild || !member) {
        throw new Error(
            'This ticket can only be opened inside a server.',
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
        Number(openCount || 0) >=
        Number(
            config.tickets
                .maxOpenTicketsPerUser ||
                3,
        )
    ) {
        throw new Error(
            `You already have the maximum of ${
                config.tickets
                    .maxOpenTicketsPerUser ||
                3
            } open tickets.`,
        );
    }

    const channelName =
        await findAvailableTicketName(
            guild,
            member,
            type,
        );

    const supportRoleId =
        getSupportRoleId();

    const botMember =
        guild.members.me;

    const overwrites = [
        {
            id:
                guild.roles
                    .everyone.id,

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

    if (supportRoleId) {
        overwrites.push({
            id: supportRoleId,

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

    const channel =
        await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,

            parent:
                config.tickets
                    .categoryId,

            topic:
                getTicketTopic(
                    type,
                    interaction.user.id,
                ),

            permissionOverwrites:
                overwrites,
        });

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
                ticketType.question,
        });

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

    const allowedMentions = {
        users: [
            interaction.user.id,
        ],

        roles: supportRoleId
            ? [supportRoleId]
            : [],
    };

    await channel.send({
        components: [
            buildTicketMessage(
                freshTicket,
                `<@${interaction.user.id}>`,
            ),
        ],

        flags:
            MessageFlags.IsComponentsV2,

        allowedMentions,
    });

    await sendCentralLog(
        interaction.client,
        {
            action:
                'Ticket Opened',

            ticket:
                freshTicket,

            user:
                interaction.user.id,

            extraFields: [
                {
                    name:
                        'Category',

                    value:
                        formatTicketType(
                            type,
                        ),
                },
            ],

            level:
                'success',
        },
    );

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

    const botUserId =
        channel.client.user.id;

    const botMessage =
        messages.find(
            (message) => {
                if (
                    message.author.id !==
                    botUserId
                ) {
                    return false;
                }

                const components =
                    JSON.stringify(
                        message.components ??
                            [],
                    );

                return components.includes(
                    'Eclipse Support',
                );
            },
        );

    if (!botMessage) {
        return;
    }

    await botMessage.edit({
        components: [
            buildTicketMessage(
                ticket,
                `<@${ticket.userId}>`,
            ),
        ],

        flags:
            MessageFlags.IsComponentsV2,
    });
}

/* -------------------------------------------------------------------------- */
/* OPEN HANDLER                                                               */
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
/* TEAM SELECTION                                                             */
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
                        'Click to open a ticket to join as a Competitive Player.',

                    value:
                        'competitive',

                    emoji: '⚔️',
                },

                {
                    label:
                        'Creative Roster',

                    description:
                        'Click to open a ticket to join as a Creative Player.',

                    value:
                        'creative',

                    emoji: '🎨',
                },

                {
                    label:
                        'GFX/VFX Roster',

                    description:
                        'Click to open a ticket to join as part of the production team.',

                    value:
                        'production',

                    emoji: '🎬',
                },

                {
                    label:
                        'Content/Streamer Roster',

                    description:
                        'Click to open a ticket to join as part of the Content team.',

                    value:
                        'content',

                    emoji: '📹',
                },
            );

    await interaction.reply({
        content:
            `**Eclipse Team Applications**\n\n` +
            `Please select the roster you would like to apply for.`,

        components: [
            new ActionRowBuilder()
                .addComponents(menu),
        ],

        ephemeral: true,
    });
}

/* -------------------------------------------------------------------------- */
/* CLAIM / UNCLAIM                                                            */
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
                'This channel is not a registered Eclipse ticket.',
            ephemeral: true,
        });
    }

    const supportRoleId =
        getSupportRoleId();

    const isSupport =
        supportRoleId &&
        interaction.member.roles.cache.has(
            supportRoleId,
        );

    const isManager =
        interaction.member.permissions.has(
            PermissionFlagsBits
                .ManageChannels,
        );

    if (!isSupport && !isManager) {
        return interaction.reply({
            content:
                'You do not have permission to claim Eclipse tickets.',
            ephemeral: true,
        });
    }

    /*
     * UNCLAIM
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

        await refreshTicketMessage(
            interaction.channel,
            fresh,
        );

        await sendCentralLog(
            interaction.client,
            {
                action:
                    'Ticket Unclaimed',

                ticket:
                    fresh,

                moderator:
                    interaction.user.id,

                level:
                    'warning',
            },
        );

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

    const fresh = {
        ...ticket,
        ...(updated || {}),
        claimedBy:
            interaction.user.id,
    };

    await refreshTicketMessage(
        interaction.channel,
        fresh,
    );

    await sendCentralLog(
        interaction.client,
        {
            action:
                'Ticket Claimed',

            ticket:
                fresh,

            moderator:
                interaction.user.id,

            level:
                'success',
        },
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

    const supportRoleId =
        getSupportRoleId();

    const isSupport =
        supportRoleId &&
        interaction.member.roles.cache.has(
            supportRoleId,
        );

    const isManager =
        interaction.member.permissions.has(
            PermissionFlagsBits
                .ManageChannels,
        );

    if (!isSupport && !isManager) {
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

                    value:
                        'low',

                    emoji: '🟢',
                },

                {
                    label: 'High',

                    description:
                        'Ticket requires increased attention.',

                    value:
                        'high',

                    emoji: '🟠',
                },

                {
                    label: 'Urgent',

                    description:
                        'Ticket requires immediate attention.',

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

    const newChannelName =
        getPriorityChannelName(
            fresh,
        );

    if (
        interaction.channel.name !==
        newChannelName
    ) {
        await interaction.channel.setName(
            newChannelName,
            `Ticket priority changed to ${priority}`,
        );
    }

    await refreshTicketMessage(
        interaction.channel,
        fresh,
    );

    await sendCentralLog(
        interaction.client,
        {
            action:
                'Ticket Priority Changed',

            ticket:
                fresh,

            moderator:
                interaction.user.id,

            extraFields: [
                {
                    name:
                        'New Priority',

                    value:
                        `${formatPriority(priority).emoji} ` +
                        `${formatPriority(priority).label}`,
                },
            ],

            level:
                priority === 'urgent'
                    ? 'danger'
                    : priority === 'high'
                        ? 'warning'
                        : 'info',
        },
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

    const supportRoleId =
        getSupportRoleId();

    const isSupport =
        supportRoleId &&
        interaction.member.roles.cache.has(
            supportRoleId,
        );

    const isManager =
        interaction.member.permissions.has(
            PermissionFlagsBits
                .ManageChannels,
        );

    const isOpener =
        interaction.user.id ===
        ticket.userId;

    if (
        !isSupport &&
        !isManager &&
        !isOpener
    ) {
        return interaction.reply({
            content:
                'You do not have permission to close this ticket.',
            ephemeral: true,
        });
    }

    await interaction.reply({
        content:
            '🔒 This ticket is being closed. The channel will be deleted shortly.',
    });

    await sendCentralLog(
        interaction.client,
        {
            action:
                'Ticket Closed',

            ticket,

            moderator:
                interaction.user.id,

            level:
                'danger',
        },
    );

    try {
        await closeTicket(
            interaction.channel.id,
            interaction.user.id,
        );
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Database close failed:',
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
                    '[Eclipse Tickets] Failed to delete closed ticket:',
                    error,
                );
            }
        },
        3000,
    );
}

/* -------------------------------------------------------------------------- */
/* REGISTER                                                                   */
/* -------------------------------------------------------------------------- */

export async function registerTicketSystem(
    client,
) {
    /*
     * Discord.js v15:
     * "ready" was renamed to "clientReady".
     *
     * On every bot startup:
     * 1. Fetch the panel channel.
     * 2. Search the complete message history.
     * 3. If an Eclipse panel exists, do nothing.
     * 4. If it doesn't exist, create exactly one.
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
                    '[Eclipse Tickets] Failed to ensure ticket panel:',
                    error,
                );
            }
        },
    );

    /*
     * Ticket interactions.
     */

    client.on(
        'interactionCreate',
        async (interaction) => {
            try {
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
                            return showTeamSelection(
                                interaction,
                            );

                        case CUSTOM_IDS.enquiries:
                            return handleTicketOpen(
                                interaction,
                                'enquiries',
                            );

                        case CUSTOM_IDS.partnerships:
                            return handleTicketOpen(
                                interaction,
                                'partnerships',
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
                 * Team application selection.
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
                 * Priority selection.
                 */

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId.startsWith(
                        `${CUSTOM_IDS.priority}:`,
                    )
                ) {
                    return handlePrioritySelection(
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
                        await interaction.followUp(
                            {
                                content:
                                    'Something went wrong while processing that ticket action.',

                                ephemeral:
                                    true,
                            },
                        );
                    } else {
                        await interaction.reply(
                            {
                                content:
                                    'Something went wrong while processing that ticket action.',

                                ephemeral:
                                    true,
                            },
                        );
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
    sendCentralLog,
    TICKET_TYPES,
    PRIORITIES,
};

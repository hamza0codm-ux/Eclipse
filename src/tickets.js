import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ContainerBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SectionBuilder,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
} from 'discord.js';

import { config } from './config.js';

import {
    countOpenTickets,
    createTicket,
    getTicket,
    claimTicket,
    unclaimTicket,
    setTicketPriority,
    closeTicket,
} from './database.js';

const TICKET_TYPES = {
    staff: {
        label: 'Eclipse Staff applications',
        emoji: '💼',
        buttonId: 'eclipse_ticket_staff',
        description:
            'Click the button below to apply for the position of Staff.',
        question:
            'Before you start your application with our staff please can you confirm you meet all the requirements to be on our staff team.',
        nameSuffix: 'staffapplication',
    },

    team: {
        label: 'Eclipse Team Applications',
        emoji: '⚒️',
        buttonId: 'eclipse_ticket_team',
        description:
            'Click the button below to join our team.',
    },

    enquiries: {
        label: 'General Enquiries',
        emoji: ' ☎️',
        buttonId: 'eclipse_ticket_enquiries',
        description:
            'Click the button below if you need help from our Staff.',
        question:
            'How may we help you today?',
        nameSuffix: 'enquiries',
    },

    partnerships: {
        label: 'Partnerships',
        emoji: '🤝',
        buttonId: 'eclipse_ticket_partnerships',
        description:
            'Click the button below to partner with Eclipse.',
        question:
            'What is the name of your company/organisation and how long do you want to partner with us for?',
        nameSuffix: 'partnerships',
    },

    competitive: {
        label: 'Competitive Roster',
        emoji: '🏆',
        description:
            'Click to open a ticket to join as a Competitive Player.',
        question:
            'Please provide information about yourself and your competitive experience.',
        nameSuffix: 'competitive',
    },

    creative: {
        label: 'Creative Roster',
        emoji: '📋',
        description:
            'Click to open a ticket to join as a Creative Player.',
        question:
            'Please provide information about yourself and your creative experience.',
        nameSuffix: 'creative',
    },

    production: {
        label: 'GFX/VFX Roster',
        emoji: '🎨',
        description:
            'Click to open a ticket to join as part of the production team.',
        question:
            'Please provide information about yourself and your GFX/VFX experience.',
        nameSuffix: 'production',
    },

    content: {
        label: 'Content/Streamer Roster',
        emoji: '📹',
        description:
            'Click to open a ticket to join as part of the Content team.',
        question:
            'Please provide information about yourself and your content/streaming experience.',
        nameSuffix: 'content',
    },
};

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

function getSupportRoleId() {
    return config.ticketSupportRoleId || null;
}

function formatTicketType(type) {
    return TICKET_TYPES[type]?.label || type;
}

function getTicketType(type) {
    return TICKET_TYPES[type] || null;
}

function getTicketTopic(type, userId) {
    return `Eclipse ticket | Type: ${formatTicketType(type)} | User: ${userId}`;
}

function buildTicketPanel() {
    const container = new ContainerBuilder();

    /*
     * STAFF APPLICATIONS
     */

    const staffButton = new ButtonBuilder()
        .setCustomId(TICKET_TYPES.staff.buttonId)
        .setLabel('Apply for Staff')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💼');

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### 💼 ${TICKET_TYPES.staff.label}\n${TICKET_TYPES.staff.description}`,
                ),
            )
            .setButtonAccessory(staffButton),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    /*
     * TEAM APPLICATIONS
     */

    const teamButton = new ButtonBuilder()
        .setCustomId(TICKET_TYPES.team.buttonId)
        .setLabel('Join the Eclipse Team')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚒️');

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ⚒️ ${TICKET_TYPES.team.label}\n${TICKET_TYPES.team.description}`,
                ),
            )
            .setButtonAccessory(teamButton),
    );

    const teamMenu = new StringSelectMenuBuilder()
        .setCustomId('eclipse_team_roster')
        .setPlaceholder('Select a roster...')
        .addOptions(
            {
                label: 'Competitive Roster',
                description:
                    'Click to open a ticket to join as a Competitive Player.',
                value: 'competitive',
                emoji: '🏆',
            },
            {
                label: 'Creative Roster',
                description:
                    'Click to open a ticket to join as a Creative Player.',
                value: 'creative',
                emoji: '🎨',
            },
            {
                label: 'GFX/VFX Roster',
                description:
                    'Click to open a ticket to join as part of the production team.',
                value: 'production',
                emoji: '🎬',
            },
            {
                label: 'Content/Streamer Roster',
                description:
                    'Click to open a ticket to join as part of the Content team.',
                value: 'content',
                emoji: '📹',
            },
        );

    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(teamMenu),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    /*
     * GENERAL ENQUIRIES
     */

    const enquiriesButton = new ButtonBuilder()
        .setCustomId(TICKET_TYPES.enquiries.buttonId)
        .setLabel('Open General Enquiry')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📞');

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### 📞 ${TICKET_TYPES.enquiries.label}\n${TICKET_TYPES.enquiries.description}`,
                ),
            )
            .setButtonAccessory(enquiriesButton),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    /*
     * PARTNERSHIPS
     */

    const partnershipButton = new ButtonBuilder()
        .setCustomId(TICKET_TYPES.partnerships.buttonId)
        .setLabel('Partner with Eclipse')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🤝');

    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### 🤝 ${TICKET_TYPES.partnerships.label}\n${TICKET_TYPES.partnerships.description}`,
                ),
            )
            .setButtonAccessory(partnershipButton),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    if (config.tickets.panelImageUrl) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                config.tickets.panelImageUrl,
            ),
        );
    }

    if (config.tickets.panelFooter) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                config.tickets.panelFooter,
            ),
        );
    }

    return container;
}

function buildTicketMessage(ticket, userMention) {
    const container = new ContainerBuilder();

    const claimedBy =
        ticket.claimedBy
            ? `<@${ticket.claimedBy}>`
            : 'Unclaimed';

    const priority =
        PRIORITIES[ticket.priority] ||
        PRIORITIES.low;

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `Hey ${userMention}, thank you for opening a ticket. A member of the Eclipse staff team will assist you shortly. <@&${getSupportRoleId()}>`,
        ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            [
                `**Ticket Type:** ${formatTicketType(ticket.type)}`,
                `**Information:** ${ticket.question || 'No information provided.'}`,
                `**Status:** Open`,
                `**Claimed by:** ${claimedBy}`,
            ].join('\n'),
        ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            [
                '**The Eclipse Support Team will assist you shortly,**',
                '',
                '**In the meantime please provide your request and information to speed up the process,**',
                '',
                '**We ask you to not ping our staff whilst this ticket is open.**',
            ].join('\n'),
        ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true),
    );

    const claimButton = new ButtonBuilder()
        .setCustomId('eclipse_ticket_claim')
        .setLabel(
            ticket.claimedBy
                ? 'Unclaim'
                : 'Claim',
        )
        .setEmoji('🙋')
        .setStyle(
            ticket.claimedBy
                ? ButtonStyle.Secondary
                : ButtonStyle.Primary,
        );

    const priorityMenu = new StringSelectMenuBuilder()
        .setCustomId('eclipse_ticket_priority')
        .setPlaceholder(
            `${priority.emoji} Priority: ${priority.label}`,
        )
        .addOptions(
            {
                label: 'Low',
                description: 'Set ticket priority to Low.',
                value: 'low',
                emoji: '🟢',
                default: ticket.priority === 'low',
            },
            {
                label: 'High',
                description: 'Set ticket priority to High.',
                value: 'high',
                emoji: '🟠',
                default: ticket.priority === 'high',
            },
            {
                label: 'Urgent',
                description: 'Set ticket priority to Urgent.',
                value: 'urgent',
                emoji: '🚨',
                default: ticket.priority === 'urgent',
            },
        );

    const closeButton = new ButtonBuilder()
        .setCustomId('eclipse_ticket_close')
        .setLabel('Close')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger);

    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            claimButton,
            closeButton,
        ),
    );

    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            priorityMenu,
        ),
    );

    return container;
}

function buildLogContainer({
    title,
    description,
    fields = [],
}) {
    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `### ${title}\n${description}`,
        ),
    );

    if (fields.length) {
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true),
        );

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                fields
                    .map(
                        (field) =>
                            `**${field.name}:** ${field.value}`,
                    )
                    .join('\n'),
            ),
        );
    }

    return container;
}

async function sendCentralLog(
    client,
    {
        title,
        description,
        fields = [],
    },
) {
    try {
        const channel =
            await client.channels.fetch(
                config.tickets.logChannelId,
            );

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            console.error(
                '[Eclipse Tickets] Central log channel is not text based.',
            );
            return;
        }

        await channel.send({
            components: [
                buildLogContainer({
                    title,
                    description,
                    fields,
                }),
            ],
            flags:
                MessageFlags.IsComponentsV2,
        });
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to send central log:',
            error,
        );
    }
}

function hasTicketPanel(message) {
    if (!message) {
        return false;
    }

    if (
        message.author?.id !==
        message.client.user?.id
    ) {
        return false;
    }

    if (!message.components?.length) {
        return false;
    }

    const requiredIds = [
        'eclipse_ticket_staff',
        'eclipse_ticket_team',
        'eclipse_ticket_enquiries',
        'eclipse_ticket_partnerships',
    ];

    let found = 0;

    for (const component of message.components) {
        const json =
            typeof component.toJSON === 'function'
                ? component.toJSON()
                : component;

        const text =
            JSON.stringify(json);

        for (const id of requiredIds) {
            if (text.includes(id)) {
                found++;
            }
        }
    }

    return found >= 3;
}

async function findExistingTicketPanel(channel) {
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
            break;
        }

        for (const message of messages.values()) {
            if (hasTicketPanel(message)) {
                return message;
            }
        }

        before =
            messages.last()?.id;

        if (
            messages.size < 100 ||
            !before
        ) {
            break;
        }
    }

    return null;
}

async function ensureTicketPanel(client) {
    console.log(
        '[Eclipse Tickets] Starting ticket panel check...',
    );

    const channel =
        await client.channels.fetch(
            config.tickets.panelChannelId,
        );

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        throw new Error(
            'Eclipse ticket panel channel is not a text channel.',
        );
    }

    console.log(
        '[Eclipse Tickets] Searching Discord for existing ticket panel...',
    );

    const existingPanel =
        await findExistingTicketPanel(
            channel,
        );

    if (existingPanel) {
        console.log(
            `[Eclipse Tickets] Existing ticket panel found: ${existingPanel.id}`,
        );

        return existingPanel;
    }

    console.log(
        '[Eclipse Tickets] No existing ticket panel found. Creating one...',
    );

    const panel =
        await channel.send({
            components: [
                buildTicketPanel(),
            ],
            flags:
                MessageFlags.IsComponentsV2,
        });

    console.log(
        `[Eclipse Tickets] Ticket panel created: ${panel.id}`,
    );

    return panel;
}

async function findAvailableTicketName(
    guild,
    member,
    type,
) {
    const ticketType =
        getTicketType(type);

    const username =
        member.user.username
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, '')
            .slice(0, 70) ||
        'user';

    const suffix =
        ticketType?.nameSuffix ||
        type;

    const baseName =
        `${username}-${suffix}`;

    let name = baseName;
    let number = 1;

    while (
        guild.channels.cache.some(
            (channel) =>
                channel.name === name,
        )
    ) {
        number++;

        name =
            `${baseName}-${number}`;
    }

    return name;
}

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
        Number(openCount || 0) >=
        Number(
            config.tickets.maxOpenTicketsPerUser ||
                3,
        )
    ) {
        throw new Error(
            `You already have the maximum of ${
                config.tickets
                    .maxOpenTicketsPerUser || 3
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
            id: guild.roles.everyone.id,

            deny: [
                PermissionFlagsBits.ViewChannel,
            ],
        },

        {
            id: interaction.user.id,

            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        },
    ];

    if (supportRoleId) {
        overwrites.push({
            id: supportRoleId,

            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        });
    }

    /*
     * Explicitly give the bot permission to send
     * the Components V2 ticket message.
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

    const channel =
        await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: config.tickets.categoryId,

            topic: getTicketTopic(
                type,
                interaction.user.id,
            ),

            permissionOverwrites:
                overwrites,
        });

    console.log(
        `[Eclipse Tickets] Created ticket channel ${channel.id} (${channel.name})`,
    );

    let databaseTicket;

    try {
        databaseTicket =
            await createTicket({
                guildId: guild.id,
                channelId: channel.id,
                channelName,
                userId:
                    interaction.user.id,
                username:
                    interaction.user
                        .username,
                type,
                priority: 'low',
                question:
                    ticketType.question ||
                    null,
            });
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to save ticket to database:',
            error,
        );

        try {
            await channel.delete(
                'Failed to save Eclipse ticket to database',
            );
        } catch {
            // Ignore cleanup failure.
        }

        throw new Error(
            'The ticket could not be saved to the database.',
        );
    }

    /*
     * Normalize PostgreSQL snake_case
     * into the camelCase format used by
     * the Components V2 ticket message.
     */

    const freshTicket = {
        guildId: guild.id,

        channelId:
            channel.id,

        channelName,

        userId:
            interaction.user.id,

        username:
            interaction.user.username,

        type,

        priority:
            databaseTicket?.priority ||
            'low',

        question:
            databaseTicket?.question ||
            ticketType.question ||
            null,

        claimedBy:
            databaseTicket?.claimed_by ??
            databaseTicket?.claimedBy ??
            null,
    };

    /*
     * IMPORTANT:
     * Send the ticket message AFTER the channel
     * exists and AFTER the database entry exists.
     *
     * This is the message that was previously
     * failing to appear.
     */

    console.log(
        `[Eclipse Tickets] Sending ticket message to ${channel.id}...`,
    );

    try {
        await channel.send({
            components: [
                buildTicketMessage(
                    freshTicket,
                    `<@${interaction.user.id}>`,
                ),
            ],

            flags:
                MessageFlags.IsComponentsV2,

            allowedMentions: {
                users: [
                    interaction.user.id,
                ],

                roles: supportRoleId
                    ? [supportRoleId]
                    : [],
            },
        });

        console.log(
            `[Eclipse Tickets] Ticket message sent successfully in ${channel.id}.`,
        );
    } catch (error) {
        console.error(
            '[Eclipse Tickets] FAILED TO SEND TICKET MESSAGE:',
            error,
        );

        throw new Error(
            `Ticket channel was created, but the Eclipse ticket message could not be sent: ${
                error?.message ||
                'Unknown Discord error'
            }`,
        );
    }

    await sendCentralLog(
        interaction.client,
        {
            title: '🎫 Ticket Opened',

            description:
                'A new Eclipse ticket has been opened.',

            fields: [
                {
                    name: 'User',
                    value: `<@${interaction.user.id}>`,
                },
                {
                    name: 'Ticket Type',
                    value:
                        formatTicketType(
                            type,
                        ),
                },
                {
                    name: 'Channel',
                    value: `<#${channel.id}>`,
                },
                {
                    name: 'Priority',
                    value: '🟢 Low',
                },
            ],
        },
    );

    return channel;
}

async function refreshTicketMessage(
    channel,
) {
    try {
        const ticket =
            await getTicket(
                channel.id,
            );

        if (!ticket) {
            return;
        }

        const normalizedTicket = {
            ...ticket,

            channelId:
                ticket.channel_id ??
                ticket.channelId,

            guildId:
                ticket.guild_id ??
                ticket.guildId,

            userId:
                ticket.user_id ??
                ticket.userId,

            channelName:
                ticket.channel_name ??
                ticket.channelName,

            claimedBy:
                ticket.claimed_by ??
                ticket.claimedBy ??
                null,

            priority:
                ticket.priority ||
                'low',

            question:
                ticket.question ||
                null,

            type:
                ticket.type,
        };

        const messages =
            await channel.messages.fetch({
                limit: 100,
            });

        const botMessage =
            messages.find(
                (message) =>
                    message.author.id ===
                        channel.client.user.id &&
                    message.components?.length,
            );

        if (!botMessage) {
            return;
        }

        await botMessage.edit({
            components: [
                buildTicketMessage(
                    normalizedTicket,
                    `<@${normalizedTicket.userId}>`,
                ),
            ],

            flags:
                MessageFlags.IsComponentsV2,

            allowedMentions: {
                users: [
                    normalizedTicket.userId,
                ],

                roles:
                    getSupportRoleId()
                        ? [
                              getSupportRoleId(),
                          ]
                        : [],
            },
        });
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Failed to refresh ticket message:',
            error,
        );
    }
}

async function handleTicketOpen(
    interaction,
    type,
) {
    try {
        await interaction.deferReply({
            ephemeral: true,
        });

        const channel =
            await createTicketChannel(
                interaction,
                type,
            );

        await interaction.editReply({
            content:
                `Your Eclipse ticket has been created: <#${channel.id}>`,
        });
    } catch (error) {
        console.error(
            '[Eclipse Tickets] Ticket creation error:',
            error,
        );

        const message =
            error?.message ||
            'Something went wrong while creating your ticket.';

        if (
            interaction.deferred ||
            interaction.replied
        ) {
            await interaction.editReply({
                content:
                    `❌ ${message}`,
            }).catch(() => {});
        } else {
            await interaction.reply({
                content:
                    `❌ ${message}`,
                ephemeral: true,
            }).catch(() => {});
        }
    }
}

async function handleClaim(
    interaction,
) {
    const channel =
        interaction.channel;

    if (!channel) {
        return;
    }

    const ticket =
        await getTicket(
            channel.id,
        );

    if (!ticket) {
        return interaction.reply({
            content:
                '❌ This channel is not a registered Eclipse ticket.',
            ephemeral: true,
        });
    }

    const supportRoleId =
        getSupportRoleId();

    if (
        supportRoleId &&
        !interaction.member.roles.cache.has(
            supportRoleId,
        )
    ) {
        return interaction.reply({
            content:
                '❌ You do not have permission to claim Eclipse tickets.',
            ephemeral: true,
        });
    }

    const currentClaim =
        ticket.claimed_by ??
        ticket.claimedBy ??
        null;

    if (
        currentClaim ===
        interaction.user.id
    ) {
        await unclaimTicket(
            channel.id,
        );

        await interaction.reply({
            content:
                '🙋 You have unclaimed this ticket.',
            ephemeral: true,
        });

        await refreshTicketMessage(
            channel,
        );

        await sendCentralLog(
            interaction.client,
            {
                title:
                    '🙋 Ticket Unclaimed',

                description:
                    'A ticket was unclaimed.',

                fields: [
                    {
                        name: 'Ticket',
                        value: `<#${channel.id}>`,
                    },
                    {
                        name: 'Staff',
                        value: `<@${interaction.user.id}>`,
                    },
                ],
            },
        );

        return;
    }

    if (currentClaim) {
        return interaction.reply({
            content:
                `❌ This ticket is already claimed by <@${currentClaim}>.`,
            ephemeral: true,
        });
    }

    await claimTicket(
        channel.id,
        interaction.user.id,
    );

    await interaction.reply({
        content:
            '🙋 You have claimed this ticket.',
        ephemeral: true,
    });

    await refreshTicketMessage(
        channel,
    );

    await sendCentralLog(
        interaction.client,
        {
            title:
                '🙋 Ticket Claimed',

            description:
                'A ticket was claimed by a staff member.',

            fields: [
                {
                    name: 'Ticket',
                    value: `<#${channel.id}>`,
                },
                {
                    name: 'Staff',
                    value: `<@${interaction.user.id}>`,
                },
            ],
        },
    );
}

async function handlePriority(
    interaction,
) {
    const channel =
        interaction.channel;

    if (!channel) {
        return;
    }

    const supportRoleId =
        getSupportRoleId();

    if (
        supportRoleId &&
        !interaction.member.roles.cache.has(
            supportRoleId,
        )
    ) {
        return interaction.reply({
            content:
                '❌ You do not have permission to change ticket priority.',
            ephemeral: true,
        });
    }

    const priority =
        interaction.values?.[0];

    if (!PRIORITIES[priority]) {
        return interaction.reply({
            content:
                '❌ Invalid priority.',
            ephemeral: true,
        });
    }

    const updated =
        await setTicketPriority(
            channel.id,
            priority,
        );

    if (!updated) {
        return interaction.reply({
            content:
                '❌ This is not an active Eclipse ticket.',
            ephemeral: true,
        });
    }

    const prefix =
        PRIORITIES[priority].prefix;

    const ticket =
        await getTicket(
            channel.id,
        );

    if (ticket) {
        const username =
            ticket.username ||
            interaction.user.username;

        const suffix =
            TICKET_TYPES[
                ticket.type
            ]?.nameSuffix ||
            ticket.type;

        let newName =
            `${username}-${suffix}`;

        if (prefix) {
            newName =
                `${prefix}${newName}`;
        }

        /*
         * Preserve duplicate numbering when
         * changing priority.
         */

        const currentName =
            channel.name;

        const duplicateMatch =
            currentName.match(
                /-(\d+)$/,
            );

        if (duplicateMatch) {
            newName =
                `${newName}-${duplicateMatch[1]}`;
        }

        try {
            await channel.setName(
                newName,
                `Ticket priority changed to ${priority}`,
            );
        } catch (error) {
            console.error(
                '[Eclipse Tickets] Failed to rename priority ticket:',
                error,
            );
        }
    }

    await interaction.reply({
        content:
            `${PRIORITIES[priority].emoji} Ticket priority set to **${PRIORITIES[priority].label}**.`,
        ephemeral: true,
    });

    await refreshTicketMessage(
        channel,
    );

    await sendCentralLog(
        interaction.client,
        {
            title:
                '🎫 Ticket Priority Changed',

            description:
                'A ticket priority was changed.',

            fields: [
                {
                    name: 'Ticket',
                    value: `<#${channel.id}>`,
                },
                {
                    name: 'Changed By',
                    value: `<@${interaction.user.id}>`,
                },
                {
                    name: 'Priority',
                    value:
                        `${PRIORITIES[priority].emoji} ${PRIORITIES[priority].label}`,
                },
            ],
        },
    );
}

async function handleClose(
    interaction,
) {
    const channel =
        interaction.channel;

    if (!channel) {
        return;
    }

    const ticket =
        await getTicket(
            channel.id,
        );

    if (!ticket) {
        return interaction.reply({
            content:
                '❌ This is not a registered Eclipse ticket.',
            ephemeral: true,
        });
    }

    const supportRoleId =
        getSupportRoleId();

    const isSupport =
        supportRoleId
            ? interaction.member.roles.cache.has(
                  supportRoleId,
              )
            : false;

    const ownerId =
        ticket.user_id ??
        ticket.userId;

    if (
        interaction.user.id !==
            ownerId &&
        !isSupport
    ) {
        return interaction.reply({
            content:
                '❌ Only the ticket owner or Eclipse support staff can close this ticket.',
            ephemeral: true,
        });
    }

    await interaction.reply({
        content:
            '🔒 Closing this ticket...',
    });

    await closeTicket(
        channel.id,
        interaction.user.id,
    );

    await sendCentralLog(
        interaction.client,
        {
            title:
                '🔒 Ticket Closed',

            description:
                'An Eclipse ticket was closed.',

            fields: [
                {
                    name: 'Ticket',
                    value: channel.name,
                },
                {
                    name: 'Opened By',
                    value: `<@${ownerId}>`,
                },
                {
                    name: 'Closed By',
                    value: `<@${interaction.user.id}>`,
                },
            ],
        },
    );

    setTimeout(
        async () => {
            try {
                await channel.delete(
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

async function handleInteraction(
    interaction,
) {
    if (
        !interaction.isButton() &&
        !interaction.isStringSelectMenu()
    ) {
        return;
    }

    const customId =
        interaction.customId;

    /*
     * Main ticket buttons
     */

    if (
        customId ===
        TICKET_TYPES.staff.buttonId
    ) {
        return handleTicketOpen(
            interaction,
            'staff',
        );
    }

    if (
        customId ===
        TICKET_TYPES.team.buttonId
    ) {
        /*
         * The team button itself doesn't open
         * a ticket. The roster menu does.
         */

        return interaction.reply({
            content:
                '⚒️ Please select the roster you want to apply for from the menu below.',
            ephemeral: true,
        });
    }

    if (
        customId ===
        TICKET_TYPES.enquiries.buttonId
    ) {
        return handleTicketOpen(
            interaction,
            'enquiries',
        );
    }

    if (
        customId ===
        TICKET_TYPES.partnerships.buttonId
    ) {
        return handleTicketOpen(
            interaction,
            'partnerships',
        );
    }

    /*
     * Team roster selection
     */

    if (
        customId ===
        'eclipse_team_roster'
    ) {
        const type =
            interaction.values?.[0];

        if (
            !TICKET_TYPES[type]
        ) {
            return interaction.reply({
                content:
                    '❌ Invalid roster selection.',
                ephemeral: true,
            });
        }

        return handleTicketOpen(
            interaction,
            type,
        );
    }

    /*
     * Ticket controls
     */

    if (
        customId ===
        'eclipse_ticket_claim'
    ) {
        return handleClaim(
            interaction,
        );
    }

    if (
        customId ===
        'eclipse_ticket_priority'
    ) {
        return handlePriority(
            interaction,
        );
    }

    if (
        customId ===
        'eclipse_ticket_close'
    ) {
        return handleClose(
            interaction,
        );
    }
}

export async function registerTicketSystem(
    client,
) {
    client.on(
        'interactionCreate',
        async (interaction) => {
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
                        interaction.deferred ||
                        interaction.replied
                    ) {
                        await interaction.editReply({
                            content:
                                '❌ Something went wrong while processing this ticket action.',
                        });
                    } else {
                        await interaction.reply({
                            content:
                                '❌ Something went wrong while processing this ticket action.',
                            ephemeral: true,
                        });
                    }
                } catch {
                    // Ignore response failure.
                }
            }
        },
    );

    client.once(
        'clientReady',
        async () => {
            try {
                await ensureTicketPanel(
                    client,
                );
            } catch (error) {
                console.error(
                    '[Eclipse Tickets] Failed to ensure ticket panel:',
                    error,
                );
            }
        },
    );
}

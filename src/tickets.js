import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    PermissionFlagsBits,
    SectionBuilder,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    MessageFlags,
} from 'discord.js';

import { config } from './config.js';

import {
    closeTicket,
    createTicket,
    getOpenTicketsForUser,
    getTicket,
    getNextTicketNumber,
    claimTicket,
    unclaimTicket,
    setTicketPriority,
} from './database.js';

const PRIORITIES = {
    low: {
        name: 'Low',
        emoji: '🟢',
    },

    high: {
        name: 'High',
        emoji: '🟠',
    },

    urgent: {
        name: 'Urgent',
        emoji: '🚨',
    },
};

export async function registerTicketSystem(client) {
    client.on(
        'interactionCreate',
        async (interaction) => {
            try {
                if (
                    interaction.isButton() &&
                    interaction.customId.startsWith(
                        'ticket_',
                    )
                ) {
                    await handleButton(
                        interaction,
                    );

                    return;
                }

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId.startsWith(
                        'ticket_',
                    )
                ) {
                    await handleSelectMenu(
                        interaction,
                    );
                }
            } catch (error) {
                console.error(
                    '[TICKETS] Interaction error:',
                    error,
                );

                if (
                    !interaction.replied &&
                    !interaction.deferred
                ) {
                    await interaction.reply({
                        content:
                            'Something went wrong while processing this action.',

                        ephemeral: true,
                    }).catch(() => {});
                }
            }
        },
    );

    await ensureTicketPanel(client);

    console.log(
        '[TICKETS] Ticket system loaded.',
    );
}

/*
|--------------------------------------------------------------------------
| PANEL
|--------------------------------------------------------------------------
*/

function buildTicketPanel() {
    const container =
        new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(
                '# 🎫 Eclipse Support\n' +
                'Choose the type of support you need from the buttons below.',
            ),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder(),
    );

    /*
     * Discord Components V2 Sections.
     *
     * The button is placed on the right side
     * of each section.
     */

    container.addSectionComponents(
        createPanelSection(
            '💼',
            'Eclipse Staff Applications',
            'Click the button below to apply for the position of Staff.',
            'ticket_staff',
        ),

        createPanelSection(
            '⚒️',
            'Eclipse Team Applications',
            'Click the button below to join our team.',
            'ticket_team',
        ),

        createPanelSection(
            '📞',
            'General Enquiries',
            'Click the button below if you need help from our Staff.',
            'ticket_enquiries',
        ),

        createPanelSection(
            '🤝',
            'Partnerships',
            'Click the button below to partner with Eclipse.',
            'ticket_partnerships',
        ),
    );

    /*
     * IMAGE BELOW BUTTONS
     */

    if (config.tickets.panelImageUrl) {
        container.addSeparatorComponents(
            new SeparatorBuilder(),
        );

        container.addMediaGalleryComponents(
            new MediaGalleryBuilder()
                .addItems(
                    new MediaGalleryItemBuilder()
                        .setURL(
                            config.tickets.panelImageUrl,
                        ),
                ),
        );
    }

    /*
     * FOOTER PLACE
     */

    if (config.tickets.panelFooter) {
        container.addSeparatorComponents(
            new SeparatorBuilder(),
        );

        container.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(
                    config.tickets.panelFooter,
                ),
        );
    }

    return container;
}

function createPanelSection(
    emoji,
    title,
    description,
    customId,
) {
    const button =
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel(title)
            .setStyle(
                ButtonStyle.Secondary,
            )
            .setEmoji(emoji);

    return new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(
                    `### ${emoji} ${title}\n${description}`,
                ),
        )
        .setButtonAccessory(button);
}

async function ensureTicketPanel(client) {
    const channel =
        await client.channels.fetch(
            config.tickets.panelChannelId,
        ).catch(() => null);

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        console.error(
            '[TICKETS] Panel channel not found.',
        );

        return;
    }

    /*
     * Search Discord before creating a panel.
     */

    const messages =
        await channel.messages.fetch({
            limit: 100,
        });

    const existingPanel =
        messages.find(
            (message) => {
                if (
                    message.author?.id !==
                    client.user.id
                ) {
                    return false;
                }

                return message.components?.some(
                    (component) =>
                        component.components?.some(
                            (child) =>
                                [
                                    'ticket_staff',
                                    'ticket_team',
                                    'ticket_enquiries',
                                    'ticket_partnerships',
                                ].includes(
                                    child.customId,
                                ),
                        ),
                );
            },
        );

    if (existingPanel) {
        console.log(
            `[TICKETS] Existing panel found: ${existingPanel.id}`,
        );

        return;
    }

    const panel =
        buildTicketPanel();

    await channel.send({
        components: [
            panel,
        ],

        flags:
            MessageFlags.IsComponentsV2,
    });

    console.log(
        '[TICKETS] Ticket panel created.',
    );
}

/*
|--------------------------------------------------------------------------
| BUTTONS
|--------------------------------------------------------------------------
*/

async function handleButton(interaction) {
    switch (interaction.customId) {
        case 'ticket_staff':
            await startTicket(
                interaction,
                'staffapplication',
                null,
            );
            break;

        case 'ticket_team':
            await showTeamMenu(
                interaction,
            );
            break;

        case 'ticket_enquiries':
            await startTicket(
                interaction,
                'enquiries',
                null,
            );
            break;

        case 'ticket_partnerships':
            await startTicket(
                interaction,
                'partnerships',
                null,
            );
            break;

        case 'ticket_claim':
            await handleClaim(
                interaction,
            );
            break;

        case 'ticket_priority':
            await showPriorityMenu(
                interaction,
            );
            break;

        case 'ticket_close':
            await handleClose(
                interaction,
            );
            break;

        default:
            break;
    }
}

/*
|--------------------------------------------------------------------------
| TEAM MENU
|--------------------------------------------------------------------------
*/

async function showTeamMenu(interaction) {
    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                'ticket_team_select',
            )
            .setPlaceholder(
                'Select the roster you want to join',
            )
            .addOptions(
                {
                    label:
                        'Competitive Roster',

                    description:
                        'Click to open a ticket to join as a Competitive Player.',

                    value:
                        'competitive',

                    emoji:
                        '🏆',
                },

                {
                    label:
                        'Creative Roster',

                    description:
                        'Click to open a ticket to join as a Creative Player.',

                    value:
                        'creative',

                    emoji:
                        '🎨',
                },

                {
                    label:
                        'GFX/VFX Roster',

                    description:
                        'Click to open a ticket as part of the production team.',

                    value:
                        'production',

                    emoji:
                        '🎬',
                },

                {
                    label:
                        'Content/Streamer Roster',

                    description:
                        'Click to open a ticket as part of the Content team.',

                    value:
                        'content',

                    emoji:
                        '🎥',
                },
            );

    const container =
        new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        '# ⚒️ Eclipse Team Applications\n' +
                        'Select the roster you would like to apply for.',
                    ),
            )
            .addActionRowComponents(
                new ActionRowBuilder()
                    .addComponents(menu),
            );

    await interaction.reply({
        components: [
            container,
        ],

        flags:
            MessageFlags.IsComponentsV2 |
            MessageFlags.Ephemeral,
    });
}

/*
|--------------------------------------------------------------------------
| CREATE TICKET
|--------------------------------------------------------------------------
*/

async function startTicket(
    interaction,
    ticketType,
    subtype,
) {
    const guild =
        interaction.guild;

    if (!guild) {
        return;
    }

    const existing =
        await getOpenTicketsForUser(
            interaction.user.id,
            guild.id,
        );

    if (
        existing.length >=
        config.tickets
            .maxOpenTicketsPerUser
    ) {
        await interaction.reply({
            content:
                `You already have ${existing.length} open tickets. Please close one before opening another.`,

            ephemeral: true,
        });

        return;
    }

    const ticketNumber =
        await getNextTicketNumber(
            interaction.user.id,
            guild.id,
            ticketType,
        );

    const suffix =
        getTicketSuffix(
            ticketType,
            subtype,
        );

    let baseName =
        `${cleanUsername(interaction.user.username)}-${suffix}`;

    if (ticketNumber > 1) {
        baseName += `-${ticketNumber}`;
    }

    const permissions = [
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

    if (
        config.ticketSupportRoleId
    ) {
        permissions.push({
            id:
                config.ticketSupportRoleId,

            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ManageMessages,
            ],
        });
    }

    const channel =
        await guild.channels.create({
            name: baseName,

            type:
                ChannelType.GuildText,

            parent:
                config.tickets.categoryId,

            permissionOverwrites:
                permissions,
        });

    const ticket =
        await createTicket({
            guildId:
                guild.id,

            channelId:
                channel.id,

            userId:
                interaction.user.id,

            ticketType,

            subtype,

            ticketNumber,

            priority:
                'low',
        });

    await sendTicketMessage(
        channel,
        interaction.user,
        ticket,
    );

    await sendLog(
        guild,

        `🎫 **TICKET CREATED**\n` +
        `User: ${interaction.user}\n` +
        `Channel: ${channel}\n` +
        `Type: ${getDisplayTicketType(ticketType, subtype)}`,
    );

    if (
        interaction.deferred
    ) {
        await interaction.editReply({
            content:
                `Your ticket has been created: ${channel}`,
        });
    } else {
        await interaction.reply({
            content:
                `Your ticket has been created: ${channel}`,

            ephemeral: true,
        });
    }
}

function getTicketSuffix(
    ticketType,
    subtype,
) {
    if (
        ticketType === 'team'
    ) {
        return subtype || 'team';
    }

    return ticketType;
}

function cleanUsername(username) {
    return (
        username
            .toLowerCase()
            .replace(
                /[^a-z0-9_-]/g,
                '',
            )
            .slice(0, 60) ||
        'user'
    );
}

/*
|--------------------------------------------------------------------------
| TICKET MESSAGE
|--------------------------------------------------------------------------
*/

async function sendTicketMessage(
    channel,
    user,
    ticket,
) {
    const supportMention =
        config.ticketSupportRoleId
            ? `<@&${config.ticketSupportRoleId}>`
            : 'Eclipse staff';

    const priority =
        PRIORITIES[
            ticket.priority
        ];

    const container =
        new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `# 🎫 Eclipse Support\n\n` +
                        `Hey ${user}, thank you for opening a ticket. A member of the Eclipse staff team will assist you shortly. ${supportMention}`,
                    ),
            )

            .addSeparatorComponents(
                new SeparatorBuilder(),
            )

            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `**Ticket Type:** ${getDisplayTicketType(
                            ticket.ticket_type,
                            ticket.subtype,
                        )}\n` +

                        `**Information:** Please provide your request and information.\n` +

                        `**Status:** 🟢 Open\n` +

                        `**Claimed by:** Nobody\n` +

                        `**Priority:** ${priority.emoji} ${priority.name}`,
                    ),
            )

            .addSeparatorComponents(
                new SeparatorBuilder(),
            )

            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `The **Eclipse Support Team** will assist you shortly.\n\n` +

                        `In the meantime please provide your request and information to speed up the process.\n\n` +

                        `We ask you to not ping our staff whilst this ticket is open.`,
                    ),
            )

            .addSeparatorComponents(
                new SeparatorBuilder(),
            )

            .addActionRowComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                'ticket_claim',
                            )
                            .setLabel(
                                'Claim',
                            )
                            .setEmoji(
                                '🙋',
                            )
                            .setStyle(
                                ButtonStyle.Secondary,
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                'ticket_priority',
                            )
                            .setLabel(
                                'Priority',
                            )
                            .setEmoji(
                                '💼',
                            )
                            .setStyle(
                                ButtonStyle.Secondary,
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                'ticket_close',
                            )
                            .setLabel(
                                'Close',
                            )
                            .setEmoji(
                                '🔒',
                            )
                            .setStyle(
                                ButtonStyle.Danger,
                            ),
                    ),
            );

    await channel.send({
        components: [
            container,
        ],

        flags:
            MessageFlags.IsComponentsV2,
    });
}

/*
|--------------------------------------------------------------------------
| CLAIM
|--------------------------------------------------------------------------
*/

async function handleClaim(
    interaction,
) {
    const ticket =
        await getTicket(
            interaction.channelId,
        );

    if (
        !ticket ||
        ticket.status !== 'open'
    ) {
        await interaction.reply({
            content:
                'This is not an active ticket.',

            ephemeral: true,
        });

        return;
    }

    if (
        ticket.claimed_by ===
        interaction.user.id
    ) {
        await unclaimTicket(
            interaction.channelId,
        );

        await interaction.reply({
            content:
                'You have unclaimed this ticket.',

            ephemeral: true,
        });

        await sendLog(
            interaction.guild,

            `🙋 **TICKET UNCLAIMED**\n` +
            `Ticket: ${interaction.channel}\n` +
            `Staff: ${interaction.user}`,
        );

        return;
    }

    await claimTicket(
        interaction.channelId,
        interaction.user.id,
    );

    await interaction.reply({
        content:
            'You have claimed this ticket.',

        ephemeral: true,
    });

    await sendLog(
        interaction.guild,

        `🙋 **TICKET CLAIMED**\n` +
        `Ticket: ${interaction.channel}\n` +
        `Staff: ${interaction.user}`,
    );
}

/*
|--------------------------------------------------------------------------
| PRIORITY
|--------------------------------------------------------------------------
*/

async function showPriorityMenu(
    interaction,
) {
    const ticket =
        await getTicket(
            interaction.channelId,
        );

    if (!ticket) {
        await interaction.reply({
            content:
                'This is not a valid ticket.',

            ephemeral: true,
        });

        return;
    }

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                'ticket_priority_select',
            )
            .setPlaceholder(
                'Select ticket priority',
            )
            .addOptions(
                {
                    label:
                        'Low',

                    description:
                        'Normal response priority.',

                    value:
                        'low',

                    emoji:
                        '🟢',
                },

                {
                    label:
                        'High',

                    description:
                        'Requires a faster response.',

                    value:
                        'high',

                    emoji:
                        '🟠',
                },

                {
                    label:
                        'Urgent',

                    description:
                        'Requires immediate attention.',

                    value:
                        'urgent',

                    emoji:
                        '🚨',
                },
            );

    const container =
        new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        '# 💼 Ticket Priority\n' +
                        'Select the priority required for this ticket.',
                    ),
            )
            .addActionRowComponents(
                new ActionRowBuilder()
                    .addComponents(menu),
            );

    await interaction.reply({
        components: [
            container,
        ],

        flags:
            MessageFlags.IsComponentsV2 |
            MessageFlags.Ephemeral,
    });
}

async function handlePrioritySelect(
    interaction,
) {
    const priority =
        interaction.values[0];

    if (
        !PRIORITIES[priority]
    ) {
        return;
    }

    const ticket =
        await getTicket(
            interaction.channelId,
        );

    if (!ticket) {
        await interaction.reply({
            content:
                'Ticket not found.',

            ephemeral: true,
        });

        return;
    }

    await setTicketPriority(
        interaction.channelId,
        priority,
    );

    const priorityInfo =
        PRIORITIES[priority];

    const cleanName =
        interaction.channel.name
            .replace(
                /^(🟢|🟠|🚨)/u,
                '',
            );

    await interaction.channel.setName(
        `${priorityInfo.emoji}${cleanName}`,
    );

    await interaction.update({
        content:
            `Priority changed to ${priorityInfo.emoji} **${priorityInfo.name}**.`,

        components: [],
    });

    await sendLog(
        interaction.guild,

        `💼 **TICKET PRIORITY CHANGED**\n` +
        `Ticket: ${interaction.channel}\n` +
        `Staff: ${interaction.user}\n` +
        `Priority: ${priorityInfo.emoji} ${priorityInfo.name}`,
    );
}

/*
|--------------------------------------------------------------------------
| CLOSE
|--------------------------------------------------------------------------
*/

async function handleClose(
    interaction,
) {
    const ticket =
        await getTicket(
            interaction.channelId,
        );

    if (!ticket) {
        await interaction.reply({
            content:
                'This is not a ticket channel.',

            ephemeral: true,
        });

        return;
    }

    await interaction.reply({
        content:
            '🔒 Closing this ticket...',

        ephemeral: true,
    });

    await closeTicket(
        interaction.channelId,
    );

    await sendLog(
        interaction.guild,

        `🔒 **TICKET CLOSED**\n` +
        `Ticket: ${interaction.channel.name}\n` +
        `Closed by: ${interaction.user}\n` +
        `Owner: <@${ticket.user_id}>`,
    );

    setTimeout(
        async () => {
            await interaction.channel
                .delete(
                    'Eclipse ticket closed',
                )
                .catch(() => {});
        },
        1500,
    );
}

/*
|--------------------------------------------------------------------------
| SELECT MENUS
|--------------------------------------------------------------------------
*/

async function handleSelectMenu(
    interaction,
) {
    if (
        interaction.customId ===
        'ticket_team_select'
    ) {
        await handleTeamSelect(
            interaction,
        );

        return;
    }

    if (
        interaction.customId ===
        'ticket_priority_select'
    ) {
        await handlePrioritySelect(
            interaction,
        );
    }
}

async function handleTeamSelect(
    interaction,
) {
    const subtype =
        interaction.values[0];

    await interaction.deferReply({
        ephemeral: true,
    });

    await startTicket(
        interaction,
        'team',
        subtype,
    );
}

/*
|--------------------------------------------------------------------------
| LOGGING
|--------------------------------------------------------------------------
*/

async function sendLog(
    guild,
    content,
) {
    if (!guild) {
        return;
    }

    const channel =
        guild.channels.cache.get(
            config.tickets.logChannelId,
        );

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        return;
    }

    await channel.send({
        content,

        allowedMentions: {
            parse: [],
        },
    }).catch((error) => {
        console.error(
            '[LOGGING] Could not send log:',
            error,
        );
    });
}

/*
|--------------------------------------------------------------------------
| DISPLAY
|--------------------------------------------------------------------------
*/

function getDisplayTicketType(
    ticketType,
    subtype,
) {
    if (
        ticketType ===
        'staffapplication'
    ) {
        return '💼 Staff Application';
    }

    if (
        ticketType ===
        'enquiries'
    ) {
        return '📞 General Enquiry';
    }

    if (
        ticketType ===
        'partnerships'
    ) {
        return '🤝 Partnership';
    }

    if (
        ticketType === 'team'
    ) {
        const names = {
            competitive:
                '🏆 Competitive Roster',

            creative:
                '🎨 Creative Roster',

            production:
                '🎬 GFX/VFX Roster',

            content:
                '🎥 Content/Streamer Roster',
        };

        return (
            names[subtype] ||
            '⚒️ Team Application'
        );
    }

    return ticketType;
}

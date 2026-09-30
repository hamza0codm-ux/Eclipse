import {
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';

import { config } from './config.js';

const moderationCommands = [
    new SlashCommandBuilder()
        .setName('time')
        .setDescription('Timeout a member.')
        .addUserOption((option) =>
            option
                .setName('user')
                .setDescription('The member to timeout.')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('duration')
                .setDescription('Duration: 10m, 1h, 12h, 1d, 7d.')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription('Reason for the timeout.')
                .setRequired(false),
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers,
        ),

    new SlashCommandBuilder()
        .setName('untime')
        .setDescription('Remove a timeout from a member.')
        .addUserOption((option) =>
            option
                .setName('user')
                .setDescription('The member to untimeout.')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription('Reason for removing the timeout.')
                .setRequired(false),
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers,
        ),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member.')
        .addUserOption((option) =>
            option
                .setName('user')
                .setDescription('The member to kick.')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription('Reason for the kick.')
                .setRequired(false),
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.KickMembers,
        ),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member.')
        .addUserOption((option) =>
            option
                .setName('user')
                .setDescription('The member to ban.')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription('Reason for the ban.')
                .setRequired(false),
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers,
        ),

    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user.')
        .addStringOption((option) =>
            option
                .setName('user')
                .setDescription('The Discord user ID to unban.')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription('Reason for the unban.')
                .setRequired(false),
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers,
        ),

    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete messages in the current channel.')
        .addIntegerOption((option) =>
            option
                .setName('amount')
                .setDescription('Number of messages to delete, 1-100.')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true),
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages,
        ),
];

function parseDuration(input) {
    const value = String(input)
        .trim()
        .toLowerCase();

    const match = value.match(
        /^(\d+)\s*(s|m|h|d|w)$/,
    );

    if (!match) {
        return null;
    }

    const amount = Number(match[1]);
    const unit = match[2];

    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
    };

    const duration = amount * multipliers[unit];

    const maxDuration = 28 * 24 * 60 * 60 * 1000;

    if (
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > maxDuration
    ) {
        return null;
    }

    return duration;
}

function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);

    if (seconds % (7 * 24 * 60 * 60) === 0) {
        return `${seconds / (7 * 24 * 60 * 60)}w`;
    }

    if (seconds % (24 * 60 * 60) === 0) {
        return `${seconds / (24 * 60 * 60)}d`;
    }

    if (seconds % (60 * 60) === 0) {
        return `${seconds / (60 * 60)}h`;
    }

    if (seconds % 60 === 0) {
        return `${seconds / 60}m`;
    }

    return `${seconds}s`;
}

function truncate(value, length = 1024) {
    const text = String(value ?? 'N/A');

    if (text.length <= length) {
        return text;
    }

    return `${text.slice(0, length - 3)}...`;
}

function formatUser(user) {
    if (!user) {
        return 'N/A';
    }

    return `${user} (<@${user}>)`;
}

function canModerate(executorMember, targetMember) {
    if (!targetMember) {
        return true;
    }

    if (executorMember.id === targetMember.id) {
        return false;
    }

    if (
        targetMember.id === executorMember.guild.ownerId
    ) {
        return false;
    }

    if (
        executorMember.id !== executorMember.guild.ownerId &&
        targetMember.roles.highest.position >=
            executorMember.roles.highest.position
    ) {
        return false;
    }

    return true;
}

async function sendModerationLog(client, {
    action,
    target,
    moderator,
    reason,
    duration,
    channel,
    extraFields = [],
    level = 'danger',
}) {
    try {
        const logChannel = await client.channels.fetch(
            config.moderation.logChannelId,
        );

        if (!logChannel?.isTextBased()) {
            return;
        }

        const colors = {
            info: 0x5865F2,
            success: 0x57F287,
            warning: 0xFEE75C,
            danger: 0xED4245,
        };

        const embed = new EmbedBuilder()
            .setColor(colors[level] ?? colors.danger)
            .setTitle(`Eclipse • ${action}`)
            .setTimestamp();

        if (target) {
            embed.addFields({
                name: 'User',
                value: formatUser(
                    typeof target === 'string'
                        ? target
                        : target.id,
                ),
                inline: true,
            });
        }

        if (moderator) {
            embed.addFields({
                name: 'Moderator',
                value: formatUser(
                    typeof moderator === 'string'
                        ? moderator
                        : moderator.id,
                ),
                inline: true,
            });
        }

        if (duration) {
            embed.addFields({
                name: 'Duration',
                value: duration,
                inline: true,
            });
        }

        if (reason) {
            embed.addFields({
                name: 'Reason',
                value: truncate(reason),
                inline: false,
            });
        }

        if (channel) {
            embed.addFields({
                name: 'Channel',
                value:
                    typeof channel === 'string'
                        ? `<#${channel}>`
                        : `<#${channel.id}>`,
                inline: true,
            });
        }

        for (const field of extraFields) {
            if (!field?.name) {
                continue;
            }

            embed.addFields({
                name: field.name,
                value: truncate(field.value ?? 'N/A'),
                inline: field.inline ?? false,
            });
        }

        embed.setFooter({
            text: 'Eclipse Moderation Logging',
        });

        await logChannel.send({
            embeds: [embed],
        });
    } catch (error) {
        console.error(
            '[Eclipse Moderation] Failed to send moderation log:',
            error,
        );
    }
}

async function handleTime(interaction) {
    const targetUser = interaction.options.getUser('user');
    const durationInput =
        interaction.options.getString('duration');
    const reason =
        interaction.options.getString('reason') ||
        'No reason provided.';

    const duration = parseDuration(durationInput);

    if (!duration) {
        return interaction.reply({
            content:
                'Invalid duration. Use values such as `10m`, `1h`, `12h`, `1d`, or `7d`. Maximum duration is 28 days.',
            ephemeral: true,
        });
    }

    const targetMember =
        await interaction.guild.members
            .fetch(targetUser.id)
            .catch(() => null);

    if (!targetMember) {
        return interaction.reply({
            content:
                'That user is not currently a member of this server.',
            ephemeral: true,
        });
    }

    if (!canModerate(interaction.member, targetMember)) {
        return interaction.reply({
            content:
                'You cannot moderate this member because of the Discord role hierarchy.',
            ephemeral: true,
        });
    }

    try {
        await targetMember.timeout(
            duration,
            reason,
        );

        await interaction.reply({
            content:
                `⏱️ ${targetUser} has been timed out for **${formatDuration(duration)}**.`,
            ephemeral: true,
        });

        await sendModerationLog(interaction.client, {
            action: 'Member Timed Out',
            target: targetUser.id,
            moderator: interaction.user.id,
            reason,
            duration: formatDuration(duration),
            channel: interaction.channel.id,
            level: 'warning',
        });
    } catch (error) {
        console.error(
            '[Eclipse Moderation] Timeout failed:',
            error,
        );

        await interaction.reply({
            content:
                'I could not timeout that member. Check my permissions and role position.',
            ephemeral: true,
        });
    }
}

async function handleUntime(interaction) {
    const targetUser =
        interaction.options.getUser('user');

    const reason =
        interaction.options.getString('reason') ||
        'No reason provided.';

    const targetMember =
        await interaction.guild.members
            .fetch(targetUser.id)
            .catch(() => null);

    if (!targetMember) {
        return interaction.reply({
            content:
                'That user is not currently a member of this server.',
            ephemeral: true,
        });
    }

    if (!canModerate(interaction.member, targetMember)) {
        return interaction.reply({
            content:
                'You cannot moderate this member because of the Discord role hierarchy.',
            ephemeral: true,
        });
    }

    try {
        await targetMember.timeout(
            null,
            reason,
        );

        await interaction.reply({
            content:
                `✅ Timeout removed from ${targetUser}.`,
            ephemeral: true,
        });

        await sendModerationLog(interaction.client, {
            action: 'Timeout Removed',
            target: targetUser.id,
            moderator: interaction.user.id,
            reason,
            channel: interaction.channel.id,
            level: 'success',
        });
    } catch (error) {
        console.error(
            '[Eclipse Moderation] Untime failed:',
            error,
        );

        await interaction.reply({
            content:
                'I could not remove that timeout.',
            ephemeral: true,
        });
    }
}

async function handleKick(interaction) {
    const targetUser =
        interaction.options.getUser('user');

    const reason =
        interaction.options.getString('reason') ||
        'No reason provided.';

    const targetMember =
        await interaction.guild.members
            .fetch(targetUser.id)
            .catch(() => null);

    if (!targetMember) {
        return interaction.reply({
            content:
                'That user is not currently a member of this server.',
            ephemeral: true,
        });
    }

    if (!canModerate(interaction.member, targetMember)) {
        return interaction.reply({
            content:
                'You cannot kick this member because of the Discord role hierarchy.',
            ephemeral: true,
        });
    }

    try {
        await targetMember.kick(reason);

        await interaction.reply({
            content:
                `👢 ${targetUser.tag} has been kicked.`,
            ephemeral: true,
        });

        await sendModerationLog(interaction.client, {
            action: 'Member Kicked',
            target: targetUser.id,
            moderator: interaction.user.id,
            reason,
            channel: interaction.channel.id,
            level: 'danger',
        });
    } catch (error) {
        console.error(
            '[Eclipse Moderation] Kick failed:',
            error,
        );

        await interaction.reply({
            content:
                'I could not kick that member. Check my permissions and role position.',
            ephemeral: true,
        });
    }
}

async function handleBan(interaction) {
    const targetUser =
        interaction.options.getUser('user');

    const reason =
        interaction.options.getString('reason') ||
        'No reason provided.';

    const targetMember =
        await interaction.guild.members
            .fetch(targetUser.id)
            .catch(() => null);

    if (targetMember) {
        if (!canModerate(interaction.member, targetMember)) {
            return interaction.reply({
                content:
                    'You cannot ban this member because of the Discord role hierarchy.',
                ephemeral: true,
            });
        }
    }

    try {
        await interaction.guild.members.ban(
            targetUser.id,
            {
                reason,
            },
        );

        await interaction.reply({
            content:
                `🔨 ${targetUser.tag} has been banned.`,
            ephemeral: true,
        });

        await sendModerationLog(interaction.client, {
            action: 'Member Banned',
            target: targetUser.id,
            moderator: interaction.user.id,
            reason,
            channel: interaction.channel.id,
            level: 'danger',
        });
    } catch (error) {
        console.error(
            '[Eclipse Moderation] Ban failed:',
            error,
        );

        await interaction.reply({
            content:
                'I could not ban that user. Check my permissions and role position.',
            ephemeral: true,
        });
    }
}

async function handleUnban(interaction) {
    const userId =
        interaction.options.getString('user');

    const reason =
        interaction.options.getString('reason') ||
        'No reason provided.';

    if (!/^\d{17,20}$/.test(userId)) {
        return interaction.reply({
            content:
                'Please provide a valid Discord user ID.',
            ephemeral: true,
        });
    }

    try {
        await interaction.guild.members.unban(
            userId,
            reason,
        );

        await interaction.reply({
            content:
                `✅ <@${userId}> has been unbanned.`,
            ephemeral: true,
        });

        await sendModerationLog(interaction.client, {
            action: 'Member Unbanned',
            target: userId,
            moderator: interaction.user.id,
            reason,
            channel: interaction.channel.id,
            level: 'success',
        });
    } catch (error) {
        console.error(
            '[Eclipse Moderation] Unban failed:',
            error,
        );

        await interaction.reply({
            content:
                'I could not unban that user. They may not be banned.',
            ephemeral: true,
        });
    }
}

async function handlePurge(interaction) {
    const amount =
        interaction.options.getInteger('amount');

    if (
        !Number.isInteger(amount) ||
        amount < 1 ||
        amount > 100
    ) {
        return interaction.reply({
            content:
                'Purge amount must be between 1 and 100.',
            ephemeral: true,
        });
    }

    try {
        const deleted =
            await interaction.channel.bulkDelete(
                amount,
                true,
            );

        await interaction.reply({
            content:
                `🧹 Deleted **${deleted.size}** message${deleted.size === 1 ? '' : 's'}.`,
            ephemeral: true,
        });

        await sendModerationLog(interaction.client, {
            action: 'Messages Purged',
            moderator: interaction.user.id,
            channel: interaction.channel.id,
            extraFields: [
                {
                    name: 'Requested',
                    value: String(amount),
                    inline: true,
                },
                {
                    name: 'Deleted',
                    value: String(deleted.size),
                    inline: true,
                },
            ],
            level: 'warning',
        });
    } catch (error) {
        console.error(
            '[Eclipse Moderation] Purge failed:',
            error,
        );

        await interaction.reply({
            content:
                'I could not purge messages in this channel. Check my permissions.',
            ephemeral: true,
        });
    }
}

export async function registerModeration(client) {
    client.once('ready', async () => {
        try {
            const guild =
                await client.guilds.fetch(
                    config.discord.guildId,
                );

            await guild.commands.set(
                moderationCommands.map((command) =>
                    command.toJSON(),
                ),
            );

            console.log(
                '[Eclipse Moderation] Moderation commands registered.',
            );
        } catch (error) {
            console.error(
                '[Eclipse Moderation] Failed to register commands:',
                error,
            );
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }

        if (
            ![
                'time',
                'untime',
                'kick',
                'ban',
                'unban',
                'purge',
            ].includes(interaction.commandName)
        ) {
            return;
        }

        try {
            switch (interaction.commandName) {
                case 'time':
                    return handleTime(interaction);

                case 'untime':
                    return handleUntime(interaction);

                case 'kick':
                    return handleKick(interaction);

                case 'ban':
                    return handleBan(interaction);

                case 'unban':
                    return handleUnban(interaction);

                case 'purge':
                    return handlePurge(interaction);

                default:
                    return;
            }
        } catch (error) {
            console.error(
                '[Eclipse Moderation] Command error:',
                error,
            );

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content:
                        'Something went wrong while running that moderation command.',
                    ephemeral: true,
                });
            }
        }
    });
}

export {
    moderationCommands,
    sendModerationLog,
};

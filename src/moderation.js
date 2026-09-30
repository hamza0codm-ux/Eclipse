import {
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';

import { config } from './config.js';

export async function registerModeration(client) {
    const commands = [
        new SlashCommandBuilder()
            .setName('time')
            .setDescription(
                'Timeout a member.',
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.ModerateMembers.toString(),
            )
            .addUserOption(
                (option) =>
                    option
                        .setName('user')
                        .setDescription(
                            'The member to timeout.',
                        )
                        .setRequired(true),
            )
            .addStringOption(
                (option) =>
                    option
                        .setName('duration')
                        .setDescription(
                            'Duration, e.g. 10m, 1h, 1d.',
                        )
                        .setRequired(true),
            )
            .addStringOption(
                (option) =>
                    option
                        .setName('reason')
                        .setDescription(
                            'Reason for the timeout.',
                        )
                        .setRequired(false),
            ),

        new SlashCommandBuilder()
            .setName('untime')
            .setDescription(
                'Remove a timeout from a member.',
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.ModerateMembers.toString(),
            )
            .addUserOption(
                (option) =>
                    option
                        .setName('user')
                        .setDescription(
                            'The member.',
                        )
                        .setRequired(true),
            )
            .addStringOption(
                (option) =>
                    option
                        .setName('reason')
                        .setDescription(
                            'Reason for removing the timeout.',
                        )
                        .setRequired(false),
            ),

        new SlashCommandBuilder()
            .setName('kick')
            .setDescription(
                'Kick a member.',
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.KickMembers.toString(),
            )
            .addUserOption(
                (option) =>
                    option
                        .setName('user')
                        .setDescription(
                            'The member to kick.',
                        )
                        .setRequired(true),
            )
            .addStringOption(
                (option) =>
                    option
                        .setName('reason')
                        .setDescription(
                            'Reason for the kick.',
                        )
                        .setRequired(false),
            ),

        new SlashCommandBuilder()
            .setName('ban')
            .setDescription(
                'Ban a member.',
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.BanMembers.toString(),
            )
            .addUserOption(
                (option) =>
                    option
                        .setName('user')
                        .setDescription(
                            'The member to ban.',
                        )
                        .setRequired(true),
            )
            .addStringOption(
                (option) =>
                    option
                        .setName('reason')
                        .setDescription(
                            'Reason for the ban.',
                        )
                        .setRequired(false),
            ),

        new SlashCommandBuilder()
            .setName('unban')
            .setDescription(
                'Unban a user.',
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.BanMembers.toString(),
            )
            .addStringOption(
                (option) =>
                    option
                        .setName('user')
                        .setDescription(
                            'The user ID to unban.',
                        )
                        .setRequired(true),
            )
            .addStringOption(
                (option) =>
                    option
                        .setName('reason')
                        .setDescription(
                            'Reason for the unban.',
                        )
                        .setRequired(false),
            ),

        new SlashCommandBuilder()
            .setName('purge')
            .setDescription(
                'Delete messages from this channel.',
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.ManageMessages.toString(),
            )
            .addIntegerOption(
                (option) =>
                    option
                        .setName('amount')
                        .setDescription(
                            'Number of messages to delete (1-100).',
                        )
                        .setMinValue(1)
                        .setMaxValue(
                            config.moderation.maxPurge,
                        )
                        .setRequired(true),
            ),
    ];

    /*
     * Register commands to the configured guild.
     */

    const guild =
        await client.guilds.fetch(
            config.discord.guildId,
        );

    await guild.commands.set(
        commands.map((command) =>
            command.toJSON(),
        ),
    );

    client.on(
        'interactionCreate',
        async (interaction) => {
            if (
                !interaction.isChatInputCommand()
            ) {
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
                ].includes(
                    interaction.commandName,
                )
            ) {
                return;
            }

            try {
                await handleModeration(
                    interaction,
                );
            } catch (error) {
                console.error(
                    '[MODERATION] Error:',
                    error,
                );

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {
                    await interaction.editReply({
                        content:
                            'An error occurred while executing that command.',
                    }).catch(() => {});
                } else {
                    await interaction.reply({
                        content:
                            'An error occurred while executing that command.',
                        ephemeral: true,
                    }).catch(() => {});
                }
            }
        },
    );

    console.log(
        '[MODERATION] Commands registered.',
    );
}

async function handleModeration(
    interaction,
) {
    switch (
        interaction.commandName
    ) {
        case 'time':
            await timeoutUser(
                interaction,
            );
            break;

        case 'untime':
            await untimeoutUser(
                interaction,
            );
            break;

        case 'kick':
            await kickUser(
                interaction,
            );
            break;

        case 'ban':
            await banUser(
                interaction,
            );
            break;

        case 'unban':
            await unbanUser(
                interaction,
            );
            break;

        case 'purge':
            await purgeMessages(
                interaction,
            );
            break;
    }
}

/*
|--------------------------------------------------------------------------
| TIMEOUT
|--------------------------------------------------------------------------
*/

async function timeoutUser(
    interaction,
) {
    const user =
        interaction.options.getUser(
            'user',
        );

    const duration =
        interaction.options.getString(
            'duration',
        );

    const reason =
        interaction.options.getString(
            'reason',
        ) ||
        'No reason provided.';

    const member =
        await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

    if (!member) {
        await interaction.reply({
            content:
                'That user is not in this server.',
            ephemeral: true,
        });

        return;
    }

    if (
        !canModerate(
            interaction.member,
            member,
        )
    ) {
        await interaction.reply({
            content:
                'You cannot moderate this member because of role hierarchy.',
            ephemeral: true,
        });

        return;
    }

    const milliseconds =
        parseDuration(
            duration,
        );

    if (!milliseconds) {
        await interaction.reply({
            content:
                'Invalid duration. Use formats such as `10m`, `1h`, `12h`, `1d` or `7d`.',
            ephemeral: true,
        });

        return;
    }

    const maxTimeout =
        28 * 24 * 60 * 60 * 1000;

    if (
        milliseconds >
        maxTimeout
    ) {
        await interaction.reply({
            content:
                'Discord allows a maximum timeout of 28 days.',
            ephemeral: true,
        });

        return;
    }

    await member.timeout(
        milliseconds,
        reason,
    );

    await interaction.reply({
        content:
            `⏱️ ${user} has been timed out for **${formatDuration(milliseconds)}**.\nReason: ${reason}`,
    });

    await sendModerationLog(
        interaction,
        `⏱️ **TIMEOUT**\n` +
        `User: ${user} (${user.id})\n` +
        `Moderator: ${interaction.user}\n` +
        `Duration: ${formatDuration(milliseconds)}\n` +
        `Reason: ${reason}`,
    );
}

/*
|--------------------------------------------------------------------------
| UNTIME
|--------------------------------------------------------------------------
*/

async function untimeoutUser(
    interaction,
) {
    const user =
        interaction.options.getUser(
            'user',
        );

    const reason =
        interaction.options.getString(
            'reason',
        ) ||
        'No reason provided.';

    const member =
        await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

    if (!member) {
        await interaction.reply({
            content:
                'That user is not in this server.',
            ephemeral: true,
        });

        return;
    }

    if (
        !canModerate(
            interaction.member,
            member,
        )
    ) {
        await interaction.reply({
            content:
                'You cannot moderate this member because of role hierarchy.',
            ephemeral: true,
        });

        return;
    }

    await member.timeout(
        null,
        reason,
    );

    await interaction.reply({
        content:
            `🔓 Timeout removed from ${user}.\nReason: ${reason}`,
    });

    await sendModerationLog(
        interaction,
        `🔓 **UNTIMEOUT**\n` +
        `User: ${user} (${user.id})\n` +
        `Moderator: ${interaction.user}\n` +
        `Reason: ${reason}`,
    );
}

/*
|--------------------------------------------------------------------------
| KICK
|--------------------------------------------------------------------------
*/

async function kickUser(
    interaction,
) {
    const user =
        interaction.options.getUser(
            'user',
        );

    const reason =
        interaction.options.getString(
            'reason',
        ) ||
        'No reason provided.';

    const member =
        await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

    if (!member) {
        await interaction.reply({
            content:
                'That user is not in this server.',
            ephemeral: true,
        });

        return;
    }

    if (
        !canModerate(
            interaction.member,
            member,
        )
    ) {
        await interaction.reply({
            content:
                'You cannot kick this member because of role hierarchy.',
            ephemeral: true,
        });

        return;
    }

    if (!member.kickable) {
        await interaction.reply({
            content:
                'I cannot kick that member. Check my role hierarchy and permissions.',
            ephemeral: true,
        });

        return;
    }

    await member.kick(reason);

    await interaction.reply({
        content:
            `👢 ${user} has been kicked.\nReason: ${reason}`,
    });

    await sendModerationLog(
        interaction,
        `👢 **KICK**\n` +
        `User: ${user} (${user.id})\n` +
        `Moderator: ${interaction.user}\n` +
        `Reason: ${reason}`,
    );
}

/*
|--------------------------------------------------------------------------
| BAN
|--------------------------------------------------------------------------
*/

async function banUser(
    interaction,
) {
    const user =
        interaction.options.getUser(
            'user',
        );

    const reason =
        interaction.options.getString(
            'reason',
        ) ||
        'No reason provided.';

    const member =
        await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

    if (member) {
        if (
            !canModerate(
                interaction.member,
                member,
            )
        ) {
            await interaction.reply({
                content:
                    'You cannot ban this member because of role hierarchy.',
                ephemeral: true,
            });

            return;
        }

        if (!member.bannable) {
            await interaction.reply({
                content:
                    'I cannot ban that member. Check my role hierarchy and permissions.',
                ephemeral: true,
            });

            return;
        }
    }

    await interaction.guild.members.ban(
        user.id,
        {
            reason,
        },
    );

    await interaction.reply({
        content:
            `🔨 ${user} has been banned.\nReason: ${reason}`,
    });

    await sendModerationLog(
        interaction,
        `🔨 **BAN**\n` +
        `User: ${user} (${user.id})\n` +
        `Moderator: ${interaction.user}\n` +
        `Reason: ${reason}`,
    );
}

/*
|--------------------------------------------------------------------------
| UNBAN
|--------------------------------------------------------------------------
*/

async function unbanUser(
    interaction,
) {
    const userId =
        interaction.options.getString(
            'user',
        );

    const reason =
        interaction.options.getString(
            'reason',
        ) ||
        'No reason provided.';

    if (
        !/^\d{17,20}$/.test(
            userId,
        )
    ) {
        await interaction.reply({
            content:
                'Please provide a valid Discord user ID.',
            ephemeral: true,
        });

        return;
    }

    await interaction.guild.members.unban(
        userId,
        reason,
    );

    await interaction.reply({
        content:
            `🔓 User \`${userId}\` has been unbanned.\nReason: ${reason}`,
    });

    await sendModerationLog(
        interaction,
        `🔓 **UNBAN**\n` +
        `User ID: ${userId}\n` +
        `Moderator: ${interaction.user}\n` +
        `Reason: ${reason}`,
    );
}

/*
|--------------------------------------------------------------------------
| PURGE
|--------------------------------------------------------------------------
*/

async function purgeMessages(
    interaction,
) {
    const amount =
        interaction.options.getInteger(
            'amount',
        );

    if (
        !interaction.channel ||
        !interaction.channel.isTextBased()
    ) {
        await interaction.reply({
            content:
                'This command can only be used in a text channel.',
            ephemeral: true,
        });

        return;
    }

    await interaction.deferReply({
        ephemeral: true,
    });

    const deleted =
        await interaction.channel.bulkDelete(
            amount,
            true,
        );

    await interaction.editReply({
        content:
            `🧹 Deleted **${deleted.size}** message(s).`,
    });

    await sendModerationLog(
        interaction,
        `🧹 **PURGE**\n` +
        `Channel: ${interaction.channel}\n` +
        `Moderator: ${interaction.user}\n` +
        `Requested: ${amount}\n` +
        `Deleted: ${deleted.size}`,
    );
}

/*
|--------------------------------------------------------------------------
| ROLE HIERARCHY
|--------------------------------------------------------------------------
*/

function canModerate(
    moderator,
    target,
) {
    if (
        moderator.id ===
        target.id
    ) {
        return false;
    }

    if (
        target.id ===
        moderator.guild.ownerId
    ) {
        return false;
    }

    if (
        moderator.id ===
        moderator.guild.ownerId
    ) {
        return true;
    }

    return (
        moderator.roles.highest.position >
        target.roles.highest.position
    );
}

/*
|--------------------------------------------------------------------------
| DURATION
|--------------------------------------------------------------------------
*/

function parseDuration(
    input,
) {
    const match =
        /^(\d+)\s*(s|m|h|d|w)$/i.exec(
            input.trim(),
        );

    if (!match) {
        return null;
    }

    const amount =
        Number(match[1]);

    const unit =
        match[2].toLowerCase();

    const units = {
        s: 1000,

        m:
            60 *
            1000,

        h:
            60 *
            60 *
            1000,

        d:
            24 *
            60 *
            60 *
            1000,

        w:
            7 *
            24 *
            60 *
            60 *
            1000,
    };

    return (
        amount *
        units[unit]
    );
}

function formatDuration(
    milliseconds,
) {
    const seconds =
        Math.floor(
            milliseconds / 1000,
        );

    const days =
        Math.floor(
            seconds / 86400,
        );

    const hours =
        Math.floor(
            (seconds % 86400) /
            3600,
        );

    const minutes =
        Math.floor(
            (seconds % 3600) /
            60,
        );

    const secs =
        seconds % 60;

    const parts = [];

    if (days) {
        parts.push(
            `${days}d`,
        );
    }

    if (hours) {
        parts.push(
            `${hours}h`,
        );
    }

    if (minutes) {
        parts.push(
            `${minutes}m`,
        );
    }

    if (
        secs &&
        parts.length < 2
    ) {
        parts.push(
            `${secs}s`,
        );
    }

    return (
        parts.join(' ') ||
        '0s'
    );
}

/*
|--------------------------------------------------------------------------
| MODERATION LOG
|--------------------------------------------------------------------------
*/

async function sendModerationLog(
    interaction,
    content,
) {
    const guild =
        interaction.guild;

    if (!guild) {
        return;
    }

    const channel =
        guild.channels.cache.get(
            config.moderation.logChannelId,
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
            '[MODERATION] Log error:',
            error,
        );
    });
}

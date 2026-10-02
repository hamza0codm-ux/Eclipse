import {
    EmbedBuilder,
} from 'discord.js';

import { config } from './config.js';

export async function registerWelcome(client) {
    client.removeAllListeners(
        'guildMemberAdd',
    );

    client.on(
        'guildMemberAdd',
        async (member) => {
            try {
                const role =
                    member.guild.roles.cache.get(
                        config.welcome.autoRoleId,
                    );

                if (
                    role &&
                    !member.roles.cache.has(role.id)
                ) {
                    await member.roles
                        .add(role)
                        .catch((error) => {
                            console.error(
                                '[WELCOME] Auto-role error:',
                                error,
                            );
                        });
                }

                const channel =
                    member.guild.channels.cache.get(
                        config.welcome.channelId,
                    );

                if (
                    !channel ||
                    !channel.isTextBased()
                ) {
                    return;
                }

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            'Welcome to Eclipse',
                        )
                        .setDescription(
                            `${member}, make sure you check out these channels!\n\n` +
                            `<#${config.welcome.rulesChannelId}>\n` +
                            `<#${config.welcome.howToJoinChannelId}>\n` +
                            `<#${config.welcome.socialsChannelId}>`,
                        )
                        .setThumbnail(
                            member.user.displayAvatarURL({
                                size: 256,
                            }),
                        )
                        .setTimestamp();

                await channel.send({
                    content: `${member}`,

                    embeds: [
                        embed,
                    ],

                    allowedMentions: {
                        users: [
                            member.id,
                        ],
                    },
                });
            } catch (error) {
                console.error(
                    '[WELCOME] Member join error:',
                    error,
                );
            }
        },
    );

    console.log(
        '[WELCOME] Welcome + auto-role system loaded.',
    );
}

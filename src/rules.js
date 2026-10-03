import {
    EmbedBuilder,
} from 'discord.js';

const RULES_CHANNEL_ID = '1554214526478454976';

const RULES_MARKER = 'Eclipse Rules Panel';

const RULES_COLOR = 0xFF7B00;

function buildRulesEmbed() {
    return new EmbedBuilder()
        .setColor(RULES_COLOR)
        .setDescription(
            `**🌑 | Eclipse — Community Rules**

Welcome to **Eclipse**.

Our Discord is the home of our community, players and staff. Keep the server organised, welcoming and focused on esports.

**📌 | 1. Use Channels Correctly**

*Every channel has a purpose.*

> Use channels for their intended purpose.
> Keep unrelated conversations out of specialised channels.
> Follow any instructions provided in channel descriptions.

**👥 | 2. Be a Good Community Member**

*Eclipse should be a place where everyone can enjoy being part of the organisation.*

> Treat other members fairly.
> Don't deliberately provoke or annoy others.
> Respect different opinions.
> Don't bring personal arguments into the server.

**🚫 | 3. Don't Cause Drama**

*Keep personal issues away from the community.*

> Don't start arguments between members.
> Don't spread rumours.
> Don't encourage others to gang up on someone.
> Take personal disagreements to DMs or staff.

**🔔 | 4. Use Mentions Responsibly**

*Mentions should be used when they are actually needed.*

> Avoid unnecessary @everyone or @here mentions.
> Don't repeatedly mention individual members.
> Staff mentions should only be used when necessary.
> Don't abuse ticket or support mentions.

**🎨 | 5. Keep Content Appropriate**

*Everything shared within Eclipse should be suitable for the community.*

> No disturbing or extremely graphic content.
> No inappropriate profile pictures or usernames.
> No content designed to offend or shock other members.
> Follow Discord's Terms of Service.

**🔗 | 6. Links & Files**

*Help keep the server safe.*

> Don't share suspicious links.
> Don't upload harmful files.
> Don't send phishing links or scams.
> Don't distribute stolen or leaked content.
> Report anything suspicious to staff.

**🎮 | 7. Competitive Integrity**

*Eclipse takes competitive gaming seriously.*

> No cheating.
> No exploiting bugs for an unfair advantage.
> No account sharing where prohibited.
> No boosting or other forms of competitive manipulation.
> Follow the rules of every tournament and competition.

**📋 | 8. Eclipse Members**

*Represent the organisation properly.*

> Follow instructions from team leadership.
> Keep internal information private.
> Don't share team discussions or documents without permission.
> Use Eclipse branding only when authorised.
> Maintain professional behaviour when representing Eclipse.

**🤝 | 9. Partnerships & Recruitment**

*Keep official organisation business organised.*

> Recruitment should only take place through approved channels.
> Do not pretend to represent Eclipse.
> Partnership offers should be sent through the appropriate ticket.
> Do not make agreements on behalf of Eclipse without permission.

**🎫 | 10. Tickets & Support**

*Use the ticket system properly.*

> Select the correct ticket category.
> Provide accurate information.
> Don't create multiple tickets for the same issue.
> Don't abuse the ticket system.
> Be patient while waiting for a staff response.

**🌑 | 11. Eclipse Identity**

*Everyone contributes to the image of the organisation.*

> Don't impersonate Eclipse staff.
> Don't misuse Eclipse's name or branding.
> Don't intentionally damage the organisation's reputation.
> Remember that staff and players represent Eclipse both inside and outside the server.

**🌑 | ENFORCEMENT**

*Staff may take action when these rules are broken.*

*Possible actions include:*

> Verbal warnings
> Official warnings
> Temporary restrictions
> Removal from the server
> Removal from Eclipse
> Permanent bans

**Eclipse reserves the right to take action against behaviour that negatively affects the organisation or community, even if it is not specifically listed above.**

**Thank you for being part of Eclipse. 🌑**`,
        )
        .setFooter({
            text: RULES_MARKER,
        });
}

async function findRulesMessage(channel) {
    let before;

    // Search up to 1,000 messages so the bot can find the
    // existing panel even if it isn't one of the newest messages.
    for (let page = 0; page < 10; page++) {
        const options = {
            limit: 100,
        };

        if (before) {
            options.before = before;
        }

        let messages;

        try {
            messages = await channel.messages.fetch(options);
        } catch (error) {
            console.error(
                '[Eclipse Rules] Failed to search channel:',
                error,
            );

            return null;
        }

        if (!messages.size) {
            break;
        }

        const existing = messages.find((message) => {
            if (message.author?.id !== channel.client.user?.id) {
                return false;
            }

            if (!message.embeds?.length) {
                return false;
            }

            return message.embeds.some(
                (embed) => embed.footer?.text === RULES_MARKER,
            );
        });

        if (existing) {
            return existing;
        }

        const oldest = messages.last();

        if (!oldest || messages.size < 100) {
            break;
        }

        before = oldest.id;
    }

    return null;
}

function isRulesMessageCurrent(message, newEmbed) {
    const existingEmbed = message?.embeds?.find(
        (embed) => embed.footer?.text === RULES_MARKER,
    );

    if (!existingEmbed) {
        return false;
    }

    return (
        existingEmbed.description === newEmbed.data.description &&
        existingEmbed.color === newEmbed.data.color &&
        existingEmbed.footer?.text === newEmbed.data.footer?.text
    );
}

export async function sendEclipseRules(client) {
    if (!client) {
        throw new Error('[Eclipse Rules] Client was not provided.');
    }

    let channel;

    try {
        channel = await client.channels.fetch(RULES_CHANNEL_ID);
    } catch (error) {
        console.error(
            `[Eclipse Rules] Failed to fetch rules channel ${RULES_CHANNEL_ID}:`,
            error,
        );

        return null;
    }

    if (!channel?.isTextBased()) {
        console.error(
            `[Eclipse Rules] Channel ${RULES_CHANNEL_ID} is not a text channel.`,
        );

        return null;
    }

    console.log(
        '[Eclipse Rules] Searching for existing rules panel...',
    );

    const embed = buildRulesEmbed();

    const existingMessage = await findRulesMessage(channel);

    if (existingMessage) {
        if (isRulesMessageCurrent(existingMessage, embed)) {
            console.log(
                `[Eclipse Rules] Existing rules panel is already up to date (${existingMessage.id}).`,
            );

            return existingMessage;
        }

        try {
            await existingMessage.edit({
                embeds: [embed],
            });

            console.log(
                `[Eclipse Rules] Existing rules panel updated (${existingMessage.id}).`,
            );

            return existingMessage;
        } catch (error) {
            console.error(
                '[Eclipse Rules] Failed to update existing rules panel:',
                error,
            );

            return null;
        }
    }

    try {
        const message = await channel.send({
            embeds: [embed],
        });

        console.log(
            `[Eclipse Rules] Rules panel created (${message.id}).`,
        );

        return message;
    } catch (error) {
        console.error(
            '[Eclipse Rules] Failed to send rules panel:',
            error,
        );

        return null;
    }
}

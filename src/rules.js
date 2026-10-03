import {
    EmbedBuilder,
} from 'discord.js';

const RULES_CHANNEL_ID = '1554214526478454976';

// Never change this unless you intentionally want to create
// a completely new rules panel.
const RULES_MARKER = 'eclipse-rules-panel-v1';

const RULES_COLOR = 0xFF7B00;

/* ========================================================================== */
/* RULES EMBED */
/* ========================================================================== */

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

/* ========================================================================== */
/* FIND EXISTING RULES PANELS */
/* ========================================================================== */

/**
 * Searches Discord for ALL existing Eclipse rules panels.
 *
 * We deliberately search Discord instead of storing a message ID.
 * This means restarting the bot, redeploying Railway, or clearing a
 * database cannot cause a new rules message to be created.
 */
async function findExistingRulesMessages(channel) {
    const found = [];

    let before = undefined;

    // Search up to 2,000 messages.
    for (let page = 0; page < 20; page++) {
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
                '[Eclipse Rules] Failed to search rules channel:',
                error,
            );

            break;
        }

        if (!messages.size) {
            break;
        }

        for (const message of messages.values()) {
            // Only consider messages sent by this bot.
            if (
                !channel.client.user ||
                message.author?.id !== channel.client.user.id
            ) {
                continue;
            }

            if (!message.embeds?.length) {
                continue;
            }

            const isRulesPanel = message.embeds.some(
                (embed) =>
                    embed.footer?.text === RULES_MARKER,
            );

            if (isRulesPanel) {
                found.push(message);
            }
        }

        const oldestMessage = messages.last();

        if (!oldestMessage) {
            break;
        }

        if (messages.size < 100) {
            break;
        }

        before = oldestMessage.id;
    }

    return found;
}

/* ========================================================================== */
/* CHECK CONTENT */
/* ========================================================================== */

function rulesMessageIsCurrent(message, newEmbed) {
    const existingEmbed = message?.embeds?.find(
        (embed) =>
            embed.footer?.text === RULES_MARKER,
    );

    if (!existingEmbed) {
        return false;
    }

    const existingDescription =
        existingEmbed.description ?? null;

    const newDescription =
        newEmbed.data.description ?? null;

    const existingColor =
        existingEmbed.color ?? null;

    const newColor =
        newEmbed.data.color ?? null;

    const existingFooter =
        existingEmbed.footer?.text ?? null;

    const newFooter =
        newEmbed.data.footer?.text ?? null;

    return (
        existingDescription === newDescription &&
        existingColor === newColor &&
        existingFooter === newFooter
    );
}

/* ========================================================================== */
/* REMOVE DUPLICATES */
/* ========================================================================== */

async function removeDuplicateRulesPanels(messages) {
    if (messages.length <= 1) {
        return;
    }

    /*
     * Sort oldest -> newest.
     *
     * We keep the oldest existing rules panel because it is the original
     * panel in the channel and prevents unnecessary message replacement.
     */
    const sorted = [...messages].sort(
        (a, b) =>
            BigInt(a.id) < BigInt(b.id) ? -1 : 1,
    );

    const primary = sorted[0];

    for (const duplicate of sorted.slice(1)) {
        try {
            await duplicate.delete();

            console.log(
                `[Eclipse Rules] Removed duplicate rules panel (${duplicate.id}).`,
            );
        } catch (error) {
            console.error(
                `[Eclipse Rules] Failed to remove duplicate rules panel ${duplicate.id}:`,
                error,
            );
        }
    }

    return primary;
}

/* ========================================================================== */
/* SEND / UPDATE RULES */
/* ========================================================================== */

export async function sendEclipseRules(client) {
    if (!client) {
        throw new Error(
            '[Eclipse Rules] Discord client was not provided.',
        );
    }

    let channel;

    try {
        channel = await client.channels.fetch(
            RULES_CHANNEL_ID,
        );
    } catch (error) {
        console.error(
            `[Eclipse Rules] Failed to fetch channel ${RULES_CHANNEL_ID}:`,
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
        '[Eclipse Rules] Searching Discord for existing rules panel...',
    );

    const rulesEmbed = buildRulesEmbed();

    /*
     * IMPORTANT:
     *
     * We search BEFORE sending anything.
     *
     * This is what prevents a new panel from being created every time
     * the bot restarts.
     */
    const existingPanels =
        await findExistingRulesMessages(channel);

    /* ---------------------------------------------------------------------- */
    /* EXISTING PANEL FOUND                                                   */
    /* ---------------------------------------------------------------------- */

    if (existingPanels.length > 0) {
        console.log(
            `[Eclipse Rules] Found ${existingPanels.length} existing rules panel(s).`,
        );

        let primaryPanel;

        if (existingPanels.length > 1) {
            primaryPanel =
                await removeDuplicateRulesPanels(
                    existingPanels,
                );
        } else {
            primaryPanel = existingPanels[0];
        }

        if (!primaryPanel) {
            console.error(
                '[Eclipse Rules] Could not determine the primary rules panel.',
            );

            return null;
        }

        /*
         * If nothing changed, do absolutely nothing.
         */
        if (
            rulesMessageIsCurrent(
                primaryPanel,
                rulesEmbed,
            )
        ) {
            console.log(
                `[Eclipse Rules] Rules panel already up to date (${primaryPanel.id}).`,
            );

            return primaryPanel;
        }

        /*
         * Something changed.
         * Edit the existing panel instead of sending a new one.
         */
        try {
            await primaryPanel.edit({
                embeds: [rulesEmbed],
            });

            console.log(
                `[Eclipse Rules] Rules panel updated (${primaryPanel.id}).`,
            );

            return primaryPanel;
        } catch (error) {
            console.error(
                `[Eclipse Rules] Failed to update rules panel ${primaryPanel.id}:`,
                error,
            );

            return null;
        }
    }

    /* ---------------------------------------------------------------------- */
    /* NO PANEL FOUND                                                          */
    /* ---------------------------------------------------------------------- */

    console.log(
        '[Eclipse Rules] No existing rules panel found. Creating one...',
    );

    try {
        const message = await channel.send({
            embeds: [rulesEmbed],
        });

        console.log(
            `[Eclipse Rules] Rules panel created successfully (${message.id}).`,
        );

        return message;
    } catch (error) {
        console.error(
            '[Eclipse Rules] Failed to create rules panel:',
            error,
        );

        return null;
    }
}

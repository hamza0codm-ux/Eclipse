import {
    EmbedBuilder,
} from 'discord.js';

const RULES_CHANNEL_ID = '1554214526478454976';

const RULES_COLOR = 0xFF7B00;

const RULES_MARKER = null;

// Recognise the old panel as well.
const OLD_RULES_MARKER = null;

const RULES_DESCRIPTION = `**🌑 | Eclipse — Community Rules**

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

**Thank you for being part of Eclipse. 🌑**`;

/* ========================================================================== */
/* BUILD EMBED */
/* ========================================================================== */

function buildRulesEmbed() {
    return new EmbedBuilder()
        .setColor(RULES_COLOR)
        .setDescription(RULES_DESCRIPTION)
        .setFooter({
            text: RULES_MARKER,
        });
}

/* ========================================================================== */
/* CHECK IF MESSAGE IS A RULES PANEL */
/* ========================================================================== */

function isRulesPanel(message, botUserId) {
    if (!message) {
        return false;
    }

    if (message.author?.id !== botUserId) {
        return false;
    }

    if (!message.embeds?.length) {
        return false;
    }

    return message.embeds.some((embed) => {
        const footer = embed.footer?.text ?? '';
        const description = embed.description ?? '';

        /*
         * New marker.
         */
        if (footer === RULES_MARKER) {
            return true;
        }

        /*
         * Old marker.
         */
        if (footer === OLD_RULES_MARKER) {
            return true;
        }

        /*
         * Fallback detection.
         *
         * This catches the existing panel even if its footer is missing
         * or an older version of the file used a different marker.
         */
        if (
            description.includes(
                '**🌑 | Eclipse — Community Rules**',
            ) &&
            description.includes(
                '**🌑 | ENFORCEMENT**',
            ) &&
            description.includes(
                '**Thank you for being part of Eclipse. 🌑**',
            )
        ) {
            return true;
        }

        return false;
    });
}

/* ========================================================================== */
/* FIND EXISTING PANELS */
/* ========================================================================== */

async function findExistingRulesPanels(channel) {
    const found = [];

    const botUserId = channel.client.user?.id;

    if (!botUserId) {
        console.error(
            '[Eclipse Rules] Bot user ID is unavailable.',
        );

        return null;
    }

    let before;

    /*
     * Search up to 2,000 messages.
     */
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
            /*
             * THIS IS THE IMPORTANT FIX.
             *
             * We return null instead of an empty array.
             *
             * null means:
             * "We could not determine whether a panel exists."
             *
             * Therefore the caller MUST NOT create a new panel.
             */
            console.error(
                '[Eclipse Rules] Failed to read rules channel history.',
            );

            console.error(error);

            return null;
        }

        if (!messages || messages.size === 0) {
            break;
        }

        for (const message of messages.values()) {
            if (
                isRulesPanel(
                    message,
                    botUserId,
                )
            ) {
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

    return [
        ...new Map(
            found.map((message) => [
                message.id,
                message,
            ]),
        ).values(),
    ];
}

/* ========================================================================== */
/* CHECK IF CURRENT */
/* ========================================================================== */

function rulesMessageIsCurrent(
    message,
    newEmbed,
) {
    if (!message?.embeds?.length) {
        return false;
    }

    const existingEmbed = message.embeds.find(
        (embed) => {
            const footer = embed.footer?.text ?? '';

            return (
                footer === RULES_MARKER ||
                footer === OLD_RULES_MARKER ||
                (
                    (embed.description ?? '').includes(
                        '**🌑 | Eclipse — Community Rules**',
                    ) &&
                    (embed.description ?? '').includes(
                        '**🌑 | ENFORCEMENT**',
                    )
                )
            );
        },
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

async function removeDuplicateRulesPanels(
    messages,
) {
    if (messages.length <= 1) {
        return messages[0] ?? null;
    }

    const sorted = [...messages].sort(
        (a, b) => {
            const aId = BigInt(a.id);
            const bId = BigInt(b.id);

            if (aId < bId) {
                return -1;
            }

            if (aId > bId) {
                return 1;
            }

            return 0;
        },
    );

    const primary = sorted[0];

    for (const duplicate of sorted.slice(1)) {
        try {
            await duplicate.delete();

            console.log(
                `[Eclipse Rules] Removed duplicate rules panel ${duplicate.id}.`,
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
/* SEND / UPDATE */
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

        /*
         * NEVER create a new panel if we cannot access
         * the channel.
         */
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

    const existingPanels =
        await findExistingRulesPanels(channel);

    /*
     * ================================================================
     * CRITICAL SAFETY CHECK
     * ================================================================
     *
     * null does NOT mean "no panel".
     *
     * null means "we could not search".
     *
     * Therefore DO NOT SEND.
     */
    if (existingPanels === null) {
        console.error(
            '[Eclipse Rules] Could not verify whether an existing panel exists.',
        );

        console.error(
            '[Eclipse Rules] REFUSING TO CREATE A NEW RULES PANEL.',
        );

        return null;
    }

    /*
     * ================================================================
     * EXISTING PANEL
     * ================================================================
     */

    if (existingPanels.length > 0) {
        console.log(
            `[Eclipse Rules] Found ${existingPanels.length} existing rules panel(s).`,
        );

        const primaryPanel =
            await removeDuplicateRulesPanels(
                existingPanels,
            );

        if (!primaryPanel) {
            console.error(
                '[Eclipse Rules] Could not determine primary rules panel.',
            );

            return null;
        }

        /*
         * If the existing panel is already correct,
         * DO ABSOLUTELY NOTHING.
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
         * Existing panel is old/outdated.
         *
         * EDIT IT instead of creating a new message.
         */
        try {
            await primaryPanel.edit({
                embeds: [
                    rulesEmbed,
                ],
            });

            console.log(
                `[Eclipse Rules] Existing rules panel updated (${primaryPanel.id}).`,
            );

            return primaryPanel;
        } catch (error) {
            console.error(
                `[Eclipse Rules] Failed to update existing rules panel ${primaryPanel.id}:`,
                error,
            );

            return null;
        }
    }

    /*
     * ================================================================
     * NO PANEL FOUND
     * ================================================================
     *
     * We only reach this point when Discord successfully allowed us
     * to search the channel and we genuinely found zero panels.
     */

    console.log(
        '[Eclipse Rules] No existing rules panel found.',
    );

    console.log(
        '[Eclipse Rules] Creating the first rules panel...',
    );

    try {
        const message = await channel.send({
            embeds: [
                rulesEmbed,
            ],
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

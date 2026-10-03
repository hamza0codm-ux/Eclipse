import {
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
} from 'discord.js';

const SOCIALS_CHANNEL_ID = '1554243360842063942';

const SOCIALS_COLOR = 0xFF7B00;

const TWITTER_URL = 'https://x.com/eclipsexesports';
const YOUTUBE_URL = 'https://www.youtube.com/@eclipsexesports';

const TWITTER_EMOJI_ID = '1556055082221572188';
const YOUTUBE_EMOJI_ID = '1556054997861539951';

/* ========================================================================== */
/* BUILD PANEL */
/* ========================================================================== */

function buildSocialsComponents() {
    const container = new ContainerBuilder()
        .setAccentColor(SOCIALS_COLOR)

        // ------------------------------------------------------------------
        // TITLE
        // ------------------------------------------------------------------

        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '# **Eclipse Socials**',
            ),
        )

        // ------------------------------------------------------------------
        // TWITTER
        // ------------------------------------------------------------------

        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        '<:Twitter:1556055082221572188> **Twitter/X**\n' +
                        'Follow Eclipse for the latest updates, announcements and news.',
                    ),
                )
                .setButtonAccessory(
                    new ButtonBuilder()
                        .setLabel('Twitter/X')
                        .setEmoji({
                            id: TWITTER_EMOJI_ID,
                        })
                        .setStyle(ButtonStyle.Link)
                        .setURL(TWITTER_URL),
                ),
        )

        // ------------------------------------------------------------------
        // LARGE DIVIDER
        // ------------------------------------------------------------------

        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(2),
        )

        // ------------------------------------------------------------------
        // YOUTUBE
        // ------------------------------------------------------------------

        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        '<:YouTube:1556054997861539951> **YouTube**\n' +
                        'Watch Eclipse videos, updates and content.',
                    ),
                )
                .setButtonAccessory(
                    new ButtonBuilder()
                        .setLabel('YouTube')
                        .setEmoji({
                            id: YOUTUBE_EMOJI_ID,
                        })
                        .setStyle(ButtonStyle.Link)
                        .setURL(YOUTUBE_URL),
                ),
        );

    return [container];
}

/* ========================================================================== */
/* FIND EXISTING PANELS */
/* ========================================================================== */

async function findExistingSocialsPanels(channel) {
    const found = [];

    const botUserId = channel.client.user?.id;

    if (!botUserId) {
        console.error(
            '[Eclipse Socials] Bot user ID is unavailable.',
        );

        return null;
    }

    let before;

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
                '[Eclipse Socials] Failed to read channel history.',
            );

            console.error(error);

            /*
             * Never create a new panel if history cannot be checked.
             */
            return null;
        }

        if (!messages || messages.size === 0) {
            break;
        }

        for (const message of messages.values()) {
            if (message.author?.id !== botUserId) {
                continue;
            }

            if (!message.components?.length) {
                continue;
            }

            const json = JSON.stringify(
                message.components.map((component) =>
                    component.toJSON(),
                ),
            );

            /*
             * Detect the panel by its actual content.
             *
             * No footer or hidden marker is needed.
             */
            if (
                json.includes('Eclipse Socials') &&
                json.includes('Twitter/X') &&
                json.includes('YouTube') &&
                json.includes(TWITTER_URL) &&
                json.includes(YOUTUBE_URL)
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
/* REMOVE DUPLICATES */
/* ========================================================================== */

async function removeDuplicatePanels(messages) {
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
                `[Eclipse Socials] Removed duplicate panel ${duplicate.id}.`,
            );
        } catch (error) {
            console.error(
                `[Eclipse Socials] Failed to remove duplicate panel ${duplicate.id}:`,
                error,
            );
        }
    }

    return primary;
}

/* ========================================================================== */
/* CHECK IF CURRENT */
/* ========================================================================== */

function isCurrentSocialsPanel(message) {
    if (!message?.components?.length) {
        return false;
    }

    const existingJson = JSON.stringify(
        message.components.map((component) =>
            component.toJSON(),
        ),
    );

    const currentJson = JSON.stringify(
        buildSocialsComponents().map((component) =>
            component.toJSON(),
        ),
    );

    return existingJson === currentJson;
}

/* ========================================================================== */
/* SEND / UPDATE */
/* ========================================================================== */

export async function sendEclipseSocials(client) {
    if (!client) {
        throw new Error(
            '[Eclipse Socials] Discord client was not provided.',
        );
    }

    let channel;

    try {
        channel = await client.channels.fetch(
            SOCIALS_CHANNEL_ID,
        );
    } catch (error) {
        console.error(
            `[Eclipse Socials] Failed to fetch channel ${SOCIALS_CHANNEL_ID}:`,
            error,
        );

        return null;
    }

    if (!channel?.isTextBased()) {
        console.error(
            `[Eclipse Socials] Channel ${SOCIALS_CHANNEL_ID} is not a text channel.`,
        );

        return null;
    }

    console.log(
        '[Eclipse Socials] Searching for existing socials panel...',
    );

    const existingPanels =
        await findExistingSocialsPanels(channel);

    /*
     * Could not check history.
     *
     * DO NOT CREATE.
     */
    if (existingPanels === null) {
        console.error(
            '[Eclipse Socials] Could not verify whether a panel exists.',
        );

        console.error(
            '[Eclipse Socials] REFUSING TO CREATE A NEW SOCIALS PANEL.',
        );

        return null;
    }

    /* ---------------------------------------------------------------------- */
    /* EXISTING PANEL                                                         */
    /* ---------------------------------------------------------------------- */

    if (existingPanels.length > 0) {
        console.log(
            `[Eclipse Socials] Found ${existingPanels.length} existing panel(s).`,
        );

        const primaryPanel =
            await removeDuplicatePanels(existingPanels);

        if (!primaryPanel) {
            return null;
        }

        /*
         * Already correct.
         */
        if (isCurrentSocialsPanel(primaryPanel)) {
            console.log(
                `[Eclipse Socials] Panel already up to date (${primaryPanel.id}).`,
            );

            return primaryPanel;
        }

        /*
         * Changed content.
         *
         * Edit the existing message.
         */
        try {
            await primaryPanel.edit({
                components: buildSocialsComponents(),
                flags: MessageFlags.IsComponentsV2,
            });

            console.log(
                `[Eclipse Socials] Existing panel updated (${primaryPanel.id}).`,
            );

            return primaryPanel;
        } catch (error) {
            console.error(
                `[Eclipse Socials] Failed to update panel ${primaryPanel.id}:`,
                error,
            );

            return null;
        }
    }

    /* ---------------------------------------------------------------------- */
    /* NO PANEL                                                               */
    /* ---------------------------------------------------------------------- */

    console.log(
        '[Eclipse Socials] No existing socials panel found.',
    );

    try {
        const message = await channel.send({
            components: buildSocialsComponents(),
            flags: MessageFlags.IsComponentsV2,
        });

        console.log(
            `[Eclipse Socials] Socials panel created (${message.id}).`,
        );

        return message;
    } catch (error) {
        console.error(
            '[Eclipse Socials] Failed to create socials panel:',
            error,
        );

        return null;
    }
}

import {
    ActionRowBuilder,
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

        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(2),
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
                        .setLabel(' <:Twitter:1556055082221572188> Twitter/X')
                        .setStyle(ButtonStyle.Link)
                        .setURL(TWITTER_URL),
                ),
        )

        // ------------------------------------------------------------------
        // LARGE DIVIDER AFTER TWITTER
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
                        .setLabel('<:YouTube:1556054997861539951> YouTube')
                        .setStyle(ButtonStyle.Link)
                        .setURL(YOUTUBE_URL),
                ),
        )

        // ------------------------------------------------------------------
        // MARKER
        // ------------------------------------------------------------------

        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `-# ${SOCIALS_MARKER}`,
            ),
        );

    return [container];
}

/* ========================================================================== */
/* COMPONENT COMPARISON */
/* ========================================================================== */

function getComponentData(components) {
    return components.map((component) => {
        return component.toJSON();
    });
}

/* ========================================================================== */
/* FIND EXISTING PANEL */
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
            console.error(
                '[Eclipse Socials] Failed to read channel history.',
            );

            console.error(error);

            /*
             * IMPORTANT:
             * Never create a new panel if we cannot verify
             * whether one already exists.
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

            const rawComponents =
                message.components.map((component) =>
                    component.toJSON(),
                );

            const json = JSON.stringify(rawComponents);

            /*
             * Primary marker detection.
             */
            if (json.includes(SOCIALS_MARKER)) {
                found.push(message);
                continue;
            }

            /*
             * Fallback detection.
             *
             * This allows older versions of the panel to be found
             * even if the marker was not present.
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

    const currentComponents =
        buildSocialsComponents();

    const existingJson = JSON.stringify(
        getComponentData(message.components),
    );

    const currentJson = JSON.stringify(
        getComponentData(currentComponents),
    );

    return existingJson === currentJson;
}

/* ========================================================================== */
/* SEND / UPDATE SOCIALS */
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
     * Discord history could not be checked.
     *
     * DO NOT CREATE A PANEL.
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

    /*
     * ================================================================
     * EXISTING PANEL
     * ================================================================
     */

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
         * Content changed.
         * Edit instead of creating another message.
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

    /*
     * ================================================================
     * NO PANEL FOUND
     * ================================================================
     */

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

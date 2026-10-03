import {
    EmbedBuilder,
} from 'discord.js';

const REQUIREMENTS_CHANNEL_ID = '1554243021296640123';

const REQUIREMENTS_MARKER = 'Eclipse Team Requirements';

const REQUIREMENTS_COLOR = 0xFF7B00;

function buildRequirementsEmbed() {
    return new EmbedBuilder()
        .setColor(REQUIREMENTS_COLOR)
        .setDescription(
            `**__Eclipse Team Requirements__**

*🌐 \\ Open a ticket in <#1554243090460450936> after you have read the requirements.*

**Competitive Roster Requirements:**
> - Must have 2.5k Power Ranking.
> - Academy must have 500 Power Ranking.

**Creative Roster Requirements:**
> - Must send 5 good quality clips.
> - Must show good mechanics within your clips.

**Content/Streamer Roster Requirements:**
> - 10k TikTok followers.
> - 1k Twitch followers.
> - 5k Youtube subscribers.

**GFX/VFX Roster Requirements:**
> - Must have amazing quality graphics.
> - Must produce your OWN work.
> - Paid positions.`,
        )
        .setFooter({
            text: REQUIREMENTS_MARKER,
        });
}

async function findExistingRequirementsMessage(channel) {
    let before;

    // Search up to 1,000 messages.
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
                '[Eclipse Requirements] Failed to search channel:',
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
                (embed) =>
                    embed.footer?.text === REQUIREMENTS_MARKER,
            );
        });

        if (existing) {
            return existing;
        }

        const oldestMessage = messages.last();

        if (!oldestMessage || messages.size < 100) {
            break;
        }

        before = oldestMessage.id;
    }

    return null;
}

function requirementsMessageIsCurrent(message, newEmbed) {
    const existingEmbed = message?.embeds?.find(
        (embed) =>
            embed.footer?.text === REQUIREMENTS_MARKER,
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

export async function sendEclipseRequirements(client) {
    if (!client) {
        throw new Error(
            '[Eclipse Requirements] Client was not provided.',
        );
    }

    let channel;

    try {
        channel = await client.channels.fetch(
            REQUIREMENTS_CHANNEL_ID,
        );
    } catch (error) {
        console.error(
            `[Eclipse Requirements] Failed to fetch channel ${REQUIREMENTS_CHANNEL_ID}:`,
            error,
        );

        return null;
    }

    if (!channel?.isTextBased()) {
        console.error(
            `[Eclipse Requirements] Channel ${REQUIREMENTS_CHANNEL_ID} is not a text channel.`,
        );

        return null;
    }

    console.log(
        '[Eclipse Requirements] Searching for existing requirements panel...',
    );

    const embed = buildRequirementsEmbed();

    const existingMessage =
        await findExistingRequirementsMessage(channel);

    // Existing panel found.
    if (existingMessage) {
        if (
            requirementsMessageIsCurrent(
                existingMessage,
                embed,
            )
        ) {
            console.log(
                `[Eclipse Requirements] Existing panel is already up to date (${existingMessage.id}).`,
            );

            return existingMessage;
        }

        // Content changed, so edit the existing panel.
        try {
            await existingMessage.edit({
                embeds: [embed],
            });

            console.log(
                `[Eclipse Requirements] Existing panel updated (${existingMessage.id}).`,
            );

            return existingMessage;
        } catch (error) {
            console.error(
                '[Eclipse Requirements] Failed to update existing panel:',
                error,
            );

            return null;
        }
    }

    // No existing panel found, so create one.
    try {
        const message = await channel.send({
            embeds: [embed],
        });

        console.log(
            `[Eclipse Requirements] Requirements panel created (${message.id}).`,
        );

        return message;
    } catch (error) {
        console.error(
            '[Eclipse Requirements] Failed to create requirements panel:',
            error,
        );

        return null;
    }
}

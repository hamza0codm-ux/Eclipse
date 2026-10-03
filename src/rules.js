import {
    EmbedBuilder,
} from 'discord.js';

const RULES_CHANNEL_ID = '1554214526478454976';

export async function sendEclipseRules(client) {
    const channel = await client.channels.fetch(
        RULES_CHANNEL_ID,
    );

    if (!channel?.isTextBased()) {
        throw new Error(
            `Rules channel ${RULES_CHANNEL_ID} was not found or is not a text channel.`,
        );
    }

    const embed = new EmbedBuilder()
        .setColor(0xFF7B00)
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
        );

    await channel.send({
        embeds: [embed],
    });

    console.log(
        `[Eclipse Rules] Rules embed sent to ${RULES_CHANNEL_ID}.`,
    );
}

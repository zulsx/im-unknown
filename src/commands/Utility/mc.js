export async function run(message, args) {
    if (!message.guild) return;

    try {
        const members = await message.guild.members.fetch();
        
        const totalMembers = members.size;
        const bots = members.filter(m => m.user.bot).size;
        const humans = totalMembers - bots;
        const guildName = message.guild.name;

        const responseText = 
            `**${guildName}**\n\n` +
            `### Members in ${guildName}\n` +
            `> Total Members: \`${totalMembers}\`\n` +
            `> Humans: \`${humans}\`\n` +
            `> Bots: \`${bots}\``;

        await message.channel.send(responseText);
    } catch (error) {
        console.error('Error fetching members:', error);
    }
}
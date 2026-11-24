export default {
    name: 'mc',
    aliases: ['membercount'],
    description: 'Shows server member, human, and bot count',
    
    async execute(message, args) {
        if (!message.guild) return;

        try {
            // Fetch members to ensure full cache
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
    },

    // In case your handler calls run() instead of execute()
    async run(message, args) {
        return this.execute(message, args);
    }
};
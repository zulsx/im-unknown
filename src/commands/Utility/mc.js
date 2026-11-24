export default {
    name: 'mc',
    aliases: ['membercount'],
    description: 'Displays the server member count',

    async execute(message, args, client) {
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
            console.error('Error in mc command:', error);
        }
    },

    // Standard run fallback if your handler looks for run instead of execute
    async run(message, args, client) {
        return this.execute(message, args, client);
    }
};
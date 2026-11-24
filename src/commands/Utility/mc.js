export default {
    name: 'mc',
    async execute(message) {
        if (!message.guild) return;

        try {
            const members = await message.guild.members.fetch();
            const totalMembers = members.size;
            const humans = members.filter((m) => !m.user.bot).size;
            const bots = members.filter((m) => m.user.bot).size;

            await message.channel.send(
                `**${message.guild.name}**\n\n` +
                `### Members in ${message.guild.name}\n` +
                `> Total Members: \`${totalMembers}\`\n` +
                `> Humans: \`${humans}\`\n` +
                `> Bots: \`${bots}\``
            );
        } catch (err) {
            console.error('Error in mc command:', err);
            await message.channel.send('Couldn\'t fetch member count. Check that Server Members Intent is enabled.');
        }
    },
};
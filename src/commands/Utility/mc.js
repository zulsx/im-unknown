import { Client, GatewayIntentBits } from 'discord.js';

// Make sure Guilds and GuildMembers intents are enabled in your Client setup
// const client = new Client({
//     intents: [
//         GatewayIntentBits.Guilds,
//         GatewayIntentBits.GuildMessages,
//         GatewayIntentBits.MessageContent,
//         GatewayIntentBits.GuildMembers
//     ]
// });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content.trim().toLowerCase() === ',mc') {
        try {
            // Fetch all members to ensure cache is fully populated
            const members = await message.guild.members.fetch();
            
            const totalMembers = members.size;
            const humans = members.filter(m => !m.user.bot).size;
            const bots = members.filter(m => m.user.bot).size;
            const guildName = message.guild.name;

            const responseText = 
                `**${guildName}**\n\n` +
                `### Members in ${guildName}\n` +
                `> Total Members: \`${totalMembers}\`\n` +
                `> Humans: \`${humans}\`\n` +
                `> Bots: \`${bots}\``;

            await message.channel.send(responseText);
        } catch (error) {
            console.error('Failed to fetch members or send message:', error);
        }
    }
});
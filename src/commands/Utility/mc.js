/**
 * Member Count Command (,mc)
 * Replicating Greed Bot's clean quote-styled member summary.
 */

async function handleMemberCount(message) {
    if (!message || !message.guild) return;

    try {
        const members = await message.guild.members.fetch();

        const totalMembers = members.size;
        const bots = members.filter(m => m.user?.bot).size;
        const humans = totalMembers - bots;
        const guildName = message.guild.name;

        // Formatted to match Greed bot's clean text output
        const responseText = 
            `**${guildName}**\n\n` +
            `### Members in ${guildName}\n` +
            `> Total Members: \`${totalMembers}\`\n` +
            `> Humans: \`${humans}\`\n` +
            `> Bots: \`${bots}\``;

        await message.channel.send(responseText);
    } catch (error) {
        console.error('Error executing mc command:', error);
    }
}

// Universal object covering execute, run, callback, and common aliases
const commandData = {
    name: 'mc',
    aliases: ['membercount', 'members'],
    description: 'Shows server total members, humans, and bots count.',
    
    execute: (message, args, client) => handleMemberCount(message),
    run: (message, args, client) => handleMemberCount(message),
    callback: (message, args, client) => handleMemberCount(message),
};

// Named export fallbacks for loaders importing named exports
export const name = commandData.name;
export const aliases = commandData.aliases;
export const execute = commandData.execute;
export const run = commandData.run;

// Default ES module export
export default commandData;
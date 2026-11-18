import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';

// 1. Initialize the client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers // Required to manage/give roles to members
    ]
});

// Replace these with your actual IDs
const CLIENT_ID = 'YOUR_CLIENT_ID';
const GUILD_ID = 'YOUR_GUILD_ID';
const TOKEN = 'YOUR_BOT_TOKEN';
const TARGET_ROLE_ID = 'YOUR_ROLE_ID';

// 2. Register the slash command
const commands = [
    new SlashCommandBuilder()
        .setName('role')
        .setDescription('Get the assigned role!')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// 3. Handle the command execution
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'role') {
        try {
            const member = interaction.member;
            const role = interaction.guild.roles.cache.get(TARGET_ROLE_ID);

            if (!role) {
                return await interaction.reply({ 
                    content: 'The specified role does not exist on this server.', 
                    ephemeral: true 
                });
            }

            // Check if the user already has the role
            if (member.roles.cache.has(TARGET_ROLE_ID)) {
                return await interaction.reply({ 
                    content: 'You already have this role!', 
                    ephemeral: true 
                });
            }

            // Assign the role
            await member.roles.add(role);
            await interaction.reply({ 
                content: `Successfully gave you the **${role.name}** role!`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: 'There was an error while trying to assign the role. Make sure the bot has the "Manage Roles" permission and its role is positioned higher than the target role.', 
                ephemeral: true 
            });
        }
    }
});

client.login(TOKEN);
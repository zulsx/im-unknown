import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionFlagsBits } from 'discord.js';
import 'dotenv/config';

// 1. Initialize the client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// Load credentials safely from environment variables
const CLIENT_ID = 1572086862963544105;
const GUILD_ID = 1567277756168020109;
const TOKEN = MTU3MjA4Njg2Mjk2MzU0NDEwNQ.G9XKvI.bYqrANpBr-SIVQD7fVNWJ5O72MSFd4GtbPUJ4s;

// 2. Register the slash command with a user and role option
const commands = [
    new SlashCommandBuilder()
        .setName('role')
        .setDescription('Assign any role to a user.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to give the role to')
                .setRequired(true))
        .addRoleOption(option => 
            option.setName('target_role')
                .setDescription('The role you want to give')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    try {
        console.log('Refreshing application (/) commands...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// 3. Handle the command execution dynamically
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'role') {
        try {
            const targetUser = interaction.options.getMember('user');
            const targetRole = interaction.options.getRole('target_role');

            if (targetUser.roles.cache.has(targetRole.id)) {
                return await interaction.reply({ 
                    content: `${targetUser.user.tag} already has the **${targetRole.name}** role!`, 
                    ephemeral: true 
                });
            }

            await targetUser.roles.add(targetRole);
            await interaction.reply({ 
                content: `Successfully gave **${targetRole.name}** to ${targetUser}!`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: 'Failed to assign the role. Check that my bot role is higher than the target role in server settings and that I have "Manage Roles" permission.', 
                ephemeral: true 
            });
        }
    }
});

client.login(TOKEN);

import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionFlagsBits } from 'discord.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const CLIENT_ID = 'YOUR_CLIENT_ID';
const GUILD_ID = 'YOUR_GUILD_ID';
const TOKEN = 'YOUR_BOT_TOKEN';

// 1. Register the slash command with an interactive role option
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
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) // Restrict command to mods/admins
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

// 2. Handle command execution dynamically
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'role') {
        try {
            // Get the user and role chosen in the command fields
            const targetUser = interaction.options.getMember('user');
            const targetRole = interaction.options.getRole('target_role');

            // Check if the user already has the role
            if (targetUser.roles.cache.has(targetRole.id)) {
                return await interaction.reply({ 
                    content: `${targetUser.user.tag} already has the **${targetRole.name}** role!`, 
                    ephemeral: true 
                });
            }

            // Assign the chosen role
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
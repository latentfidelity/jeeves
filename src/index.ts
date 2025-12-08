import { Client, Events, GatewayIntentBits } from 'discord.js';
import commands from './commands';
import config from './config';
import { handleAutomodMessage } from './lib/automod';
import { initScheduler } from './lib/scheduler';
import { ensureStaff } from './lib/staff';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commandMap = new Map(commands.map((command) => [command.data.name, command]));

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Jeeves is online as ${readyClient.user.tag}`);
  initScheduler(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commandMap.get(interaction.commandName);

  if (!command) {
    await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    return;
  }

  try {
    if (command.requiredRole) {
      const ok = await ensureStaff(interaction, command.requiredRole);
      if (!ok) return;
    }
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error handling command ${interaction.commandName}`, error);
    const message = 'Something went wrong while executing that command.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection', error);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await handleAutomodMessage(message);
  } catch (error) {
    console.error('Automod handler failed', error);
  }
});

client.login(config.token);

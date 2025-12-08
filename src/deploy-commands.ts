import { REST, Routes } from 'discord.js';
import commands from './commands';
import config from './config';

const rest = new REST({ version: '10' }).setToken(config.token);

async function main() {
  const payload = commands.map((command) => command.data.toJSON());
  try {
    console.log('Registering slash commands...');
    if (config.guildId) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
        body: payload,
      });
      console.log('Registered commands for guild', config.guildId);
    } else {
      await rest.put(Routes.applicationCommands(config.clientId), {
        body: payload,
      });
      console.log('Registered global commands');
    }
  } catch (error) {
    console.error('Failed to register commands', error);
  }
}

main();

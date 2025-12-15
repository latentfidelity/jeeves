import { Client, Events, GatewayIntentBits, MessageFlags, Message, TextChannel } from 'discord.js';
import commands from './commands';
import config from './config';
import { handleAutomodMessage } from './lib/automod';
import { initScheduler } from './lib/scheduler';
import { ensureStaff } from './lib/staff';
import { getChatConfig } from './lib/chatStore';
import { runOpenRouterChat } from './lib/openrouter';

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
    await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral });
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
      await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    }
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection', error);
});

// Chat system prompt
const CHAT_SYSTEM_PROMPT = `You are Jeeves, a witty and helpful AI hanging out in a Discord server. You're casual, friendly, and occasionally sarcastic. Keep responses short (1-3 sentences usually). You're part of the conversation, not an assistant being asked questions.

Discord syntax:
- Mentions: <@USER_ID> for users, <#CHANNEL_ID> for channels, <@&ROLE_ID> for roles
- Text: **bold**, *italic*, ||spoiler||, \`code\`
- Keep it natural - don't overuse formatting

Match the vibe of the conversation. Be helpful when asked, playful when appropriate.`;

async function handleChatMessage(message: Message): Promise<void> {
  // Ignore bots and DMs
  if (message.author.bot || !message.guild) return;

  const chatConfig = await getChatConfig(message.guild.id);
  if (!chatConfig?.enabled || message.channel.id !== chatConfig.channelId) return;

  // Random chance to reply
  if (Math.random() * 100 > chatConfig.chance) return;

  // Fetch recent messages for context
  const channel = message.channel as TextChannel;
  const recentMessages = await channel.messages.fetch({ limit: 10 });
  const context = recentMessages
    .reverse()
    .map((m) => `${m.author.username}: ${m.content}`)
    .join('\n');

  try {
    await channel.sendTyping();

    const result = await runOpenRouterChat(context, {
      model: chatConfig.model,
      systemPrompt: CHAT_SYSTEM_PROMPT,
      maxTokens: 200,
    });

    await channel.send(result.content);
  } catch (error) {
    console.error('Chat response failed', error);
  }
}

client.on(Events.MessageCreate, async (message) => {
  try {
    await handleAutomodMessage(message);
  } catch (error) {
    console.error('Automod handler failed', error);
  }

  try {
    await handleChatMessage(message);
  } catch (error) {
    console.error('Chat handler failed', error);
  }
});

client.login(config.token);

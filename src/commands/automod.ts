import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addRule, AutomodAction, AutomodType, listRules, removeRule } from '../lib/automodStore';
import { parseDuration } from '../lib/duration';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Manage Jeeves automod rules')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add an automod rule')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Type of rule')
            .setRequired(true)
            .addChoices(
              { name: 'keyword (substring match)', value: 'keyword' },
              { name: 'invite links', value: 'invite' },
              { name: 'generic links', value: 'link' },
            ),
        )
        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription('What to do when rule matches')
            .setRequired(true)
            .addChoices(
              { name: 'delete message', value: 'delete' },
              { name: 'warn user', value: 'warn' },
              { name: 'timeout user', value: 'timeout' },
            ),
        )
        .addStringOption((option) =>
          option
            .setName('pattern')
            .setDescription('Keyword to match (required for keyword rules)')
            .setMaxLength(200),
        )
        .addStringOption((option) =>
          option.setName('timeout').setDescription('Timeout duration (e.g. 10m) if action=timeout'),
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason noted in logs').setMaxLength(512),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List automod rules for this server'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove an automod rule by ID')
        .addStringOption((option) =>
          option.setName('id').setDescription('Rule ID to remove').setRequired(true),
        ),
    ),
  requiredRole: 'administrator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const type = interaction.options.getString('type', true) as AutomodType;
      const action = interaction.options.getString('action', true) as AutomodAction;
      const pattern = interaction.options.getString('pattern') || undefined;
      const reason = interaction.options.getString('reason') || undefined;
      const timeoutInput = interaction.options.getString('timeout') || undefined;

      if (type === 'keyword' && !pattern) {
        await interaction.reply({ content: 'Pattern is required for keyword rules.', ephemeral: true });
        return;
      }

      let timeoutMs: number | undefined;
      if (action === 'timeout') {
        if (!timeoutInput) {
          await interaction.reply({ content: 'Timeout duration is required when action=timeout.', ephemeral: true });
          return;
        }
        timeoutMs = parseDuration(timeoutInput) || undefined;
        if (!timeoutMs) {
          await interaction.reply({ content: 'Invalid timeout duration. Use values like 10m or 1h.', ephemeral: true });
          return;
        }
      }

      const rule = await addRule(interaction.guild.id, { type, pattern, action, timeoutMs, reason });
      await interaction.reply({
        content: `Added automod rule \`${rule.id}\` (${rule.type} -> ${rule.action}).`,
        ephemeral: true,
      });
      return;
    }

    if (sub === 'list') {
      const rules = await listRules(interaction.guild.id);
      if (!rules.length) {
        await interaction.reply({ content: 'No automod rules configured.', ephemeral: true });
        return;
      }

      const description = rules
        .map(
          (r) =>
            `• \`${r.id}\` ${r.type}${r.pattern ? ` "${r.pattern}"` : ''} → ${r.action}${
              r.timeoutMs ? ` (${r.timeoutMs / 1000}s timeout)` : ''
            }${r.reason ? ` — ${r.reason}` : ''}`,
        )
        .join('\n');

      await interaction.reply({ content: description, ephemeral: true });
      return;
    }

    if (sub === 'remove') {
      const id = interaction.options.getString('id', true);
      const removed = await removeRule(interaction.guild.id, id);
      if (!removed) {
        await interaction.reply({ content: `No rule found with ID ${id}.`, ephemeral: true });
        return;
      }
      await interaction.reply({ content: `Removed automod rule ${id}.`, ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },
};

export default command;

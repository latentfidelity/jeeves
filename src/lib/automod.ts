import { Message } from 'discord.js';
import { addCase } from './caseStore';
import { getGuildConfig } from './configStore';
import { addInfraction } from './infractions';
import { listRules, AutomodRule } from './automodStore';
import { createActionEmbed, sendModLog } from './modLog';
import { addWarning } from './warnStore';
import { tryNotifyUser } from './notify';

function matchesRule(rule: AutomodRule, content: string): boolean {
  const lower = content.toLowerCase();
  if (rule.type === 'keyword' && rule.pattern) {
    return lower.includes(rule.pattern.toLowerCase());
  }
  if (rule.type === 'invite') {
    return /(discord\.gg\/|discord\.com\/invite\/)/i.test(content);
  }
  if (rule.type === 'link') {
    return /https?:\/\//i.test(content);
  }
  return false;
}

export async function handleAutomodMessage(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;
  const rules = await listRules(message.guild.id);
  if (!rules.length) return;

  const matchedRule = rules.find((rule) => matchesRule(rule, message.content));
  if (!matchedRule) return;

  const reason = matchedRule.reason || `Automod: ${matchedRule.type}`;
  const config = await getGuildConfig(message.guild.id);

  if (matchedRule.action === 'delete') {
    if (message.deletable) {
      await message.delete().catch(() => {});
    }
    const caseEntry = await addCase({
      action: 'automod_delete',
      userId: message.author.id,
      moderatorId: message.client.user?.id || 'automod',
      reason,
      context: { rule: matchedRule.id },
    });

    const embed = createActionEmbed({
      action: 'Automod: Delete',
      targetTag: message.author.tag,
      targetId: message.author.id,
      moderatorTag: message.client.user?.tag || 'Jeeves',
      moderatorId: message.client.user?.id || 'automod',
      reason,
      caseId: caseEntry.id,
      extraFields: [
        { name: 'Rule', value: matchedRule.id, inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      ],
    });

    await sendModLog(message.guild, embed);
    return;
  }

  if (matchedRule.action === 'warn') {
    const warnings = await addWarning(message.guild.id, message.author.id, {
      reason,
      moderatorId: message.client.user?.id || 'automod',
      createdAt: Date.now(),
    });
    await addInfraction(message.guild.id, message.author.id, 'warning');

    const caseEntry = await addCase({
      action: 'automod_warn',
      userId: message.author.id,
      moderatorId: message.client.user?.id || 'automod',
      reason,
      context: { rule: matchedRule.id, warnings: warnings.length.toString() },
    });

    if (config.dmActions !== false) {
      await tryNotifyUser(
        message.author,
        `You received an automatic warning in ${message.guild.name}. Reason: ${reason}`,
      );
    }

    const embed = createActionEmbed({
      action: 'Automod: Warn',
      targetTag: message.author.tag,
      targetId: message.author.id,
      moderatorTag: message.client.user?.tag || 'Jeeves',
      moderatorId: message.client.user?.id || 'automod',
      reason,
      caseId: caseEntry.id,
      extraFields: [
        { name: 'Rule', value: matchedRule.id, inline: true },
        { name: 'Warnings', value: warnings.length.toString(), inline: true },
      ],
    });

    await sendModLog(message.guild, embed);
    return;
  }

  if (matchedRule.action === 'timeout' && matchedRule.timeoutMs) {
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member || !member.moderatable) return;

    await member.timeout(matchedRule.timeoutMs, reason).catch(() => {});
    await addInfraction(message.guild.id, message.author.id, 'timeout');

    const caseEntry = await addCase({
      action: 'automod_timeout',
      userId: message.author.id,
      moderatorId: message.client.user?.id || 'automod',
      reason,
      context: { rule: matchedRule.id, duration: `${matchedRule.timeoutMs}ms` },
    });

    if (config.dmActions !== false) {
      await tryNotifyUser(
        message.author,
        `You were timed out automatically in ${message.guild.name} for ${Math.round(
          matchedRule.timeoutMs / 1000,
        )}s. Reason: ${reason}`,
      );
    }

    const embed = createActionEmbed({
      action: 'Automod: Timeout',
      targetTag: message.author.tag,
      targetId: message.author.id,
      moderatorTag: message.client.user?.tag || 'Jeeves',
      moderatorId: message.client.user?.id || 'automod',
      reason,
      caseId: caseEntry.id,
      extraFields: [
        { name: 'Rule', value: matchedRule.id, inline: true },
        { name: 'Duration', value: `${Math.round(matchedRule.timeoutMs / 1000)}s`, inline: true },
      ],
    });

    await sendModLog(message.guild, embed);
  }
}

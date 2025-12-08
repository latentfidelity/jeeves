import { Client, TextChannel } from 'discord.js';
import { promises as fs } from 'fs';
import path from 'path';

type TaskType = 'unlock' | 'slowmode_clear' | 'role_remove';

type Task = {
  id: string;
  type: TaskType;
  guildId: string;
  channelId?: string;
  roleId?: string;
  userId?: string;
  runAt: number;
};

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'schedule.json');

let tasks: Task[] = [];
let timers = new Map<string, NodeJS.Timeout>();
let clientRef: Client | null = null;

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify([], null, 2), 'utf8');
  }
}

async function loadTasks(): Promise<void> {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(dataFile, 'utf8');
    tasks = JSON.parse(raw) as Task[];
  } catch (error) {
    console.error('Failed to load scheduler tasks', error);
    tasks = [];
  }
}

async function saveTasks(): Promise<void> {
  await fs.writeFile(dataFile, JSON.stringify(tasks, null, 2), 'utf8');
}

function createTaskId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function executeTask(task: Task): Promise<void> {
  if (!clientRef) return;
  try {
    if (task.type === 'unlock' && task.channelId) {
      const guild = await clientRef.guilds.fetch(task.guildId);
      const channel = (await guild.channels.fetch(task.channelId)) as TextChannel | null;
      if (channel) {
        const everyone = guild.roles.everyone;
        await channel.permissionOverwrites.edit(everyone, {
          SendMessages: null,
          SendMessagesInThreads: null,
          AddReactions: null,
        });
      }
    } else if (task.type === 'slowmode_clear' && task.channelId) {
      const guild = await clientRef.guilds.fetch(task.guildId);
      const channel = (await guild.channels.fetch(task.channelId)) as TextChannel | null;
      if (channel) {
        await channel.setRateLimitPerUser(0, 'Scheduled slowmode reset');
      }
    } else if (task.type === 'role_remove' && task.userId && task.roleId) {
      const guild = await clientRef.guilds.fetch(task.guildId);
      const member = await guild.members.fetch(task.userId);
      await member.roles.remove(task.roleId, 'Scheduled role removal');
    }
  } catch (error) {
    console.warn('Scheduler task execution failed', task, error);
  } finally {
    tasks = tasks.filter((t) => t.id !== task.id);
    timers.delete(task.id);
    await saveTasks();
  }
}

function scheduleTimeout(task: Task): void {
  const delay = Math.max(0, task.runAt - Date.now());
  const timer = setTimeout(() => executeTask(task), delay);
  timers.set(task.id, timer);
}

export async function initScheduler(client: Client): Promise<void> {
  clientRef = client;
  await loadTasks();
  for (const task of tasks) {
    scheduleTimeout(task);
  }
}

async function addTask(task: Omit<Task, 'id'>): Promise<Task> {
  const newTask: Task = { ...task, id: createTaskId() };
  tasks.push(newTask);
  await saveTasks();
  scheduleTimeout(newTask);
  return newTask;
}

export async function scheduleUnlock(guildId: string, channelId: string, runAt: number): Promise<Task> {
  return addTask({ guildId, channelId, type: 'unlock', runAt });
}

export async function scheduleSlowmodeClear(guildId: string, channelId: string, runAt: number): Promise<Task> {
  return addTask({ guildId, channelId, type: 'slowmode_clear', runAt });
}

export async function scheduleRoleRemoval(
  guildId: string,
  userId: string,
  roleId: string,
  runAt: number,
): Promise<Task> {
  return addTask({ guildId, userId, roleId, type: 'role_remove', runAt });
}

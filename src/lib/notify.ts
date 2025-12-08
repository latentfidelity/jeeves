import { User } from 'discord.js';

export async function tryNotifyUser(user: User, message: string): Promise<boolean> {
  try {
    await user.send(message);
    return true;
  } catch (error) {
    console.warn(`Could not DM user ${user.id}`, error);
    return false;
  }
}

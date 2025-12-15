import { Command } from '../types/Command';
import ban from './ban';
import caseLookup from './case';
import clearwarnings from './clearwarnings';
import banlist from './banlist';
import forceban from './forceban';
import kick from './kick';
import lockdown from './lockdown';
import reason from './reason';
import diagnostics from './diagnostics';
import guide from './guide';
import help from './help';
import report from './report';
import backup from './backup';
import configCommand from './config';
import ask from './ask';
import credits from './credits';
import automod from './automod';
import say from './say';
import note from './note';
import ping from './ping';
import purge from './purge';
import slowmode from './slowmode';
import softban from './softban';
import timeout from './timeout';
import nick from './nick';
import role from './role';
import unban from './unban';
import untimeout from './untimeout';
import userinfo from './userinfo';
import warn from './warn';
import warnings from './warnings';
import massban from './massban';
import delwarn from './delwarn';
import masskick from './masskick';
import appeal from './appeal';
import infractions from './infractions';
import history from './history';
import temprole from './temprole';
import chat from './chat';

const commands: Command[] = [
  ban,
  caseLookup,
  clearwarnings,
  banlist,
  forceban,
  kick,
  lockdown,
  reason,
  diagnostics,
  guide,
  help,
  backup,
  configCommand,
  ask,
  credits,
  automod,
  say,
  report,
  appeal,
  nick,
  note,
  ping,
  purge,
  role,
  slowmode,
  softban,
  timeout,
  massban,
  masskick,
  delwarn,
  unban,
  untimeout,
  userinfo,
  warn,
  warnings,
  infractions,
  history,
  temprole,
  chat,
];

export default commands;

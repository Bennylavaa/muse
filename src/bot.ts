import { Client, Collection, User, Message, MessagePayload, InteractionReplyOptions } from 'discord.js';
import { inject, injectable } from 'inversify';
import ora from 'ora';
import { TYPES } from './types.js';
import container from './inversify.config.js';
import Command from './commands/index.js';
import debug from './utils/debug.js';
import handleGuildCreate from './events/guild-create.js';
import handleVoiceStateUpdate from './events/voice-state-update.js';
import errorMsg from './utils/error-msg.js';
import { isUserInVoice } from './utils/channels.js';
import Config from './services/config.js';
import { generateDependencyReport } from '@discordjs/voice';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import registerCommandsOnGuild from './utils/register-commands-on-guild.js';
import { ChatInputCommandInteraction } from 'discord.js';

@injectable()
export default class {
  private readonly client: Client;
  private readonly config: Config;
  private readonly shouldRegisterCommandsOnBot: boolean;
  private readonly commandsByName!: Collection<string, Command>;
  private readonly commandsByButtonId!: Collection<string, Command>;

  constructor(@inject(TYPES.Client) client: Client, @inject(TYPES.Config) config: Config) {
    this.client = client;
    this.config = config;
    this.shouldRegisterCommandsOnBot = config.REGISTER_COMMANDS_ON_BOT;
    this.commandsByName = new Collection();
    this.commandsByButtonId = new Collection();
  }

  public async register(): Promise<void> {
    // Load in commands
    for (const command of container.getAll<Command>(TYPES.Command)) {
      try {
        command.slashCommand.toJSON();
      } catch (error) {
        console.error(error);
        throw new Error(`Could not serialize /${command.slashCommand.name ?? ''} to JSON`);
      }

      if (command.slashCommand.name) {
        this.commandsByName.set(command.slashCommand.name, command);
      }

      if (command.handledButtonIds) {
        for (const buttonId of command.handledButtonIds) {
          this.commandsByButtonId.set(buttonId, command);
        }
      }
    }

    // Register event handlers
    this.client.on('messageCreate', async (message: Message) => {
      if (message.author.bot || !message.guild) return;

      if (message.content.startsWith('?play')) {
        console.log('Play command received'); // Debug log
        const query = message.content.slice(6).trim(); // Extract the query after ?play
        const command = this.commandsByName.get('play');

        if (command && command.execute) {
          // Create a mock interaction
          const interaction = {
            guild: message.guild,
            member: message.member,
            reply: async (response: string | MessagePayload | InteractionReplyOptions) => message.reply(response as any),
            options: {
              getString: () => query,
            } as any,
          } as unknown as ChatInputCommandInteraction;

          try {
            await command.execute(interaction);
          } catch (error) {
            console.error('Error executing play command:', error);
            message.reply('There was an error trying to execute that command.');
          }
        } else {
          message.reply('Could not find the play command.');
        }
      }
    });

    const spinner = ora('📡 connecting to Discord...').start();

    this.client.once('ready', async () => {
      debug(generateDependencyReport());

      // Update commands
      const rest = new REST({ version: '10' }).setToken(this.config.DISCORD_TOKEN);
      if (this.shouldRegisterCommandsOnBot) {
        spinner.text = '📡 updating commands on bot...';
        await rest.put(
          Routes.applicationCommands(this.client.user!.id),
          { body: this.commandsByName.map(command => command.slashCommand.toJSON()) },
        );
      } else {
        spinner.text = '📡 updating commands in all guilds...';

        await Promise.all([
          ...this.client.guilds.cache.map(async guild => {
            await registerCommandsOnGuild({
              rest,
              guildId: guild.id,
              applicationId: this.client.user!.id,
              commands: this.commandsByName.map(c => c.slashCommand),
            });
          }),
          rest.put(Routes.applicationCommands(this.client.user!.id), { body: [] }),
        ]);
      }

      this.client.user!.setPresence({
        activities: [
          {
            name: this.config.BOT_ACTIVITY,
            type: this.config.BOT_ACTIVITY_TYPE,
            url: this.config.BOT_ACTIVITY_URL === '' ? undefined : this.config.BOT_ACTIVITY_URL,
          },
        ],
        status: this.config.BOT_STATUS,
      });

      spinner.succeed(`Ready! Invite the bot with https://discordapp.com/oauth2/authorize?client_id=${this.client.user?.id ?? ''}&scope=bot%20applications.commands&permissions=36700160`);
    });

    this.client.on('error', console.error);
    this.client.on('debug', debug);
    this.client.on('guildCreate', handleGuildCreate);
    this.client.on('voiceStateUpdate', handleVoiceStateUpdate);
    await this.client.login();
  }
}

import { Client, Collection, User, GuildMember } from 'discord.js';
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

@injectable()
export default class {
  private readonly client: Client;
  private readonly config: Config;
  private readonly shouldRegisterCommandsOnBot: boolean;
  private readonly commandsByName!: Collection<string, Command>;
  private readonly commandsByButtonId!: Collection<string, Command>;

  // Define user IDs exempt from the VC requirement at class level
  private exemptUserIds = ["1215330175563071509", "1207844365838323812", "1217539821740757032"];

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
    this.client.on('interactionCreate', async interaction => {
      try {
        if (interaction.isCommand()) {
          const command = this.commandsByName.get(interaction.commandName);
          if (!command || !interaction.isChatInputCommand()) return;

          if (!interaction.guild) {
            await interaction.reply(errorMsg('you can\'t use this bot in a DM'));
            return;
          }

          const requiresVC = command.requiresVC instanceof Function ? command.requiresVC(interaction) : command.requiresVC;

          // VC check with exempt user IDs
          if (requiresVC && interaction.member && 
              !this.exemptUserIds.includes(interaction.member.user.id) && 
              !isUserInVoice(interaction.guild, interaction.member as GuildMember)) {
            await interaction.reply({ content: errorMsg('gotta be in a voice channel'), ephemeral: true });
            return;
          }

          if (command.execute) {
            await command.execute(interaction);
          }
        } else if (interaction.isButton()) {
          const command = this.commandsByButtonId.get(interaction.customId);
          if (command && command.handleButtonInteraction) {
            await command.handleButtonInteraction(interaction);
          }
        } else if (interaction.isAutocomplete()) {
          const command = this.commandsByName.get(interaction.commandName);
          if (command && command.handleAutocompleteInteraction) {
            await command.handleAutocompleteInteraction(interaction);
          }
        }
      } catch (error: unknown) {
        debug(error);
        try {
          if ((interaction.isCommand() || interaction.isButton()) && (interaction.replied || interaction.deferred)) {
            await interaction.editReply(errorMsg(error as Error));
          } else if (interaction.isCommand() || interaction.isButton()) {
            await interaction.reply({ content: errorMsg(error as Error), ephemeral: true });
          }
        } catch {}
      }
    });

    this.client.on('messageCreate', async message => {
      const content = message.content;
      if (content.startsWith('/play')) {
        const args = content.split(' ').slice(1);
        const songQuery: string = args.join(' '); // Explicitly typing songQuery

        const userId = message.author.id;
        const member = message.member as GuildMember; // Ensure member is of type GuildMember

        if (member && (this.exemptUserIds.includes(userId) || isUserInVoice(message.guild!, member))) {
          const user: User = member.user; // Extract User from GuildMember
          // Here, you would call your function to queue the song
          // For example: await queueSong(songQuery, user);
          await message.reply('Song queued successfully!'); // Placeholder reply
        } else {
          await message.reply('You need to be in a voice channel to queue a song.');
        }
      }
    });

    const spinner = ora('📡 connecting to Discord...').start();

    this.client.once('ready', async () => {
      debug(generateDependencyReport());

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

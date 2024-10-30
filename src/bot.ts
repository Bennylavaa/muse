import { Client, Collection, User, Message } from 'discord.js';
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
      // Make sure we can serialize to JSON without errors
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
        const exemptUserIds = ["1215330175563071509", "1207844365838323812", "1217539821740757032"]; // Replace with actual exempt user IDs

        if (interaction.isCommand()) {
          const command = this.commandsByName.get(interaction.commandName);

          if (!command || !interaction.isChatInputCommand()) {
            return;
          }

          if (!interaction.guild) {
            await interaction.reply(errorMsg('you can\'t use this bot in a DM'));
            return;
          }

          const requiresVC = command.requiresVC instanceof Function ? command.requiresVC(interaction) : command.requiresVC;

          // Modified VC check with exempt user IDs
          if (requiresVC && interaction.member && !exemptUserIds.includes(interaction.member.user.id) && !isUserInVoice(interaction.guild, interaction.member.user as User)) {
            await interaction.reply({ content: errorMsg('gotta be in a voice channel'), ephemeral: true });
            return;
          }

          if (command.execute) {
            await command.execute(interaction);
          }
        } else if (interaction.isButton()) {
          const command = this.commandsByButtonId.get(interaction.customId);

          if (!command) {
            return;
          }

          if (command.handleButtonInteraction) {
            await command.handleButtonInteraction(interaction);
          }
        } else if (interaction.isAutocomplete()) {
          const command = this.commandsByName.get(interaction.commandName);

          if (!command) {
            return;
          }

          if (command.handleAutocompleteInteraction) {
            await command.handleAutocompleteInteraction(interaction);
          }
        }
      } catch (error: unknown) {
        debug(error);

        // This can fail if the message was deleted, and we don't want to crash the whole bot
        try {
          if ((interaction.isCommand() || interaction.isButton()) && (interaction.replied || interaction.deferred)) {
            await interaction.editReply(errorMsg(error as Error));
          } else if (interaction.isCommand() || interaction.isButton()) {
            await interaction.reply({ content: errorMsg(error as Error), ephemeral: true });
          }
        } catch {}
      }
    });

    // Listen for message commands like ?play
    this.client.on('messageCreate', async (message: Message) => {
      // Ignore messages from bots or DMs
      if (message.author.bot || !message.guild) return;

      // Check if the message starts with the command prefix
      if (message.content.startsWith('?play')) {
        const query = message.content.slice(6).trim(); // Extract the query after ?play
        const command = this.commandsByName.get('play'); // Assuming 'play' is your command name

        if (command && command.execute) {
          // Create a mock interaction
          const interaction: Partial<ChatInputCommandInteraction> = {
            guild: message.guild,
            member: message.member,
            reply: async (response) => message.reply(response), // Use message.reply directly
            options: {
              getString: () => query,
            } as any, // Use 'any' to avoid type issues, this can be improved with better typing
          };

          await command.execute(interaction as ChatInputCommandInteraction);
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
          // Remove commands registered on bot (if they exist)
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

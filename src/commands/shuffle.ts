import {ChatInputCommandInteraction} from 'discord.js';
import {TYPES} from '../types.js';
import {inject, injectable} from 'inversify';
import PlayerManager from '../managers/player.js';
import Command from './index.js';
import {SlashCommandBuilder} from '@discordjs/builders';
import {pickLine, sayings} from '../utils/stepdad.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('shuffle the queue. Same garbage, different order');

  public requiresVC = true;

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const player = this.playerManager.get(interaction.guild!.id);

    if (player.isQueueEmpty()) {
      throw new Error('not enough songs to shuffle. Add some music first, then we\'ll talk.');
    }

    player.shuffle();

    await interaction.reply(pickLine(sayings.shuffle));
  }
}

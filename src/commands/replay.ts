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
    .setName('replay')
    .setDescription('play it AGAIN, from the top');

  public requiresVC = true;

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const player = this.playerManager.get(interaction.guild!.id);

    const currentSong = player.getCurrent();

    if (!currentSong) {
      throw new Error('nothing is playing. Take your headphones out once in a while.');
    }

    if (currentSong.isLive) {
      throw new Error('can\'t replay a livestream. It\'s LIVE. That\'s the whole point.');
    }

    await Promise.all([
      player.seek(0),
      interaction.deferReply(),
    ]);

    await interaction.editReply(pickLine(sayings.replay));
  }
}

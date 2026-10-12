import {ChatInputCommandInteraction} from 'discord.js';
import {SlashCommandBuilder} from '@discordjs/builders';
import {TYPES} from '../types.js';
import {inject, injectable} from 'inversify';
import PlayerManager from '../managers/player.js';
import Command from './index.js';
import {prettyTime} from '../utils/time.js';
import durationStringToSeconds from '../utils/duration-string-to-seconds.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('fseek')
    .setDescription('fast-forward the current song. Patience is a virtue, you know')
    .addStringOption(option => option
      .setName('time')
      .setDescription('an interval expression or number of seconds (1m, 30s, 100)')
      .setRequired(true));

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
      throw new Error('can\'t seek in a livestream. It\'s LIVE, sport. Look it up.');
    }

    const seekValue = interaction.options.getString('time');

    if (!seekValue) {
      throw new Error('missing seek value. Seek to WHERE? I can\'t read your mind.');
    }

    const seekTime = durationStringToSeconds(seekValue);

    if (!Number.isFinite(seekTime) || seekTime <= 0) {
      throw new Error('invalid seek value. Try again, and this time use your brain.');
    }

    if (seekTime + player.getPosition() > currentSong.length) {
      throw new Error('can\'t seek past the end of the song. Always rushing. That\'s your whole problem.');
    }

    await Promise.all([
      player.forwardSeek(seekTime),
      interaction.deferReply(),
    ]);

    await interaction.editReply(`jumped to ${prettyTime(player.getPosition())}. Happy? Didn't think so.`);
  }
}

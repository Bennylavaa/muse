import {URL} from 'url';
import {inject, injectable} from 'inversify';
import * as spotifyURI from 'spotify-uri';
import Spotify from 'spotify-web-api-node';
import got from 'got';
import {TYPES} from '../types.js';
import ThirdParty from './third-party.js';
import shuffle from 'array-shuffle';
import {QueuedPlaylist} from './player.js';

export interface SpotifyTrack {
  name: string;
  artist: string;
}

interface SpotifyEmbedEntity {
  name?: string;
  title?: string;
  trackList?: Array<{title?: string; subtitle?: string}>;
}

interface SpotifyEmbedData {
  props?: {pageProps?: {state?: {data?: {entity?: SpotifyEmbedEntity}}}};
}

@injectable()
export default class {
  private readonly spotify: Spotify;

  constructor(@inject(TYPES.ThirdParty) thirdParty: ThirdParty) {
    this.spotify = thirdParty.spotify;
  }

  async getAlbum(url: string, playlistLimit: number): Promise<[SpotifyTrack[], QueuedPlaylist]> {
    const uri = spotifyURI.parse(url) as spotifyURI.Album;
    let [{body: album}, {body: tracksResponse}] = await Promise.all([this.spotify.getAlbum(uri.id), this.spotify.getAlbumTracks(uri.id, {limit: 50})]);
    const items = [...tracksResponse.items];

    while (tracksResponse.next) {
      // eslint-disable-next-line no-await-in-loop
      ({body: tracksResponse} = await this.spotify.getAlbumTracks(uri.id, {
        limit: parseInt(new URL(tracksResponse.next).searchParams.get('limit') ?? '50', 10),
        offset: parseInt(new URL(tracksResponse.next).searchParams.get('offset') ?? '0', 10),
      }));

      items.push(...tracksResponse.items);
    }

    const tracks = this.limitTracks(items, playlistLimit).map(this.toSpotifyTrack);
    const playlist = {title: album.name, source: album.href};

    return [tracks, playlist];
  }

  async getPlaylist(url: string, playlistLimit: number): Promise<[SpotifyTrack[], QueuedPlaylist]> {
    const uri = spotifyURI.parse(url) as spotifyURI.Playlist;
    // Since Spotify's February 2026 API changes, the Web API only returns playlist
    // contents to the playlist's owner, so read the public embed player instead.
    const {name, tracks} = await this.getEmbedTracks('playlist', uri.id);

    return [this.limitTracks(tracks, playlistLimit), {title: name, source: `https://open.spotify.com/playlist/${uri.id}`}];
  }

  async getTrack(url: string): Promise<SpotifyTrack> {
    const uri = spotifyURI.parse(url) as spotifyURI.Track;
    const {body} = await this.spotify.getTrack(uri.id);

    return this.toSpotifyTrack(body);
  }

  async getArtist(url: string, playlistLimit: number): Promise<SpotifyTrack[]> {
    const uri = spotifyURI.parse(url) as spotifyURI.Artist;
    // The Web API's artist top tracks endpoint was removed in February 2026.
    const {tracks} = await this.getEmbedTracks('artist', uri.id);

    return this.limitTracks(tracks, playlistLimit);
  }

  private async getEmbedTracks(type: 'playlist' | 'artist', id: string): Promise<{name: string; tracks: SpotifyTrack[]}> {
    let html: string;
    try {
      html = await got(`https://open.spotify.com/embed/${type}/${encodeURIComponent(id)}`, {
        headers: {'user-agent': 'Mozilla/5.0'},
        timeout: {request: 10_000},
      }).text();
    } catch {
      throw new Error(`couldn't load that Spotify ${type}. Is it private?`);
    }

    const match = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s.exec(html);
    let entity: SpotifyEmbedEntity | undefined;
    try {
      entity = match ? (JSON.parse(match[1]) as SpotifyEmbedData).props?.pageProps?.state?.data?.entity : undefined;
    } catch {}

    if (!entity?.trackList) {
      throw new Error(`couldn't read that Spotify ${type}. Is it private?`);
    }

    const tracks = entity.trackList
      .filter(track => track.title && track.subtitle)
      .map(track => ({
        name: track.title!,
        // Featured artists are joined with commas; keep the primary artist like the Web API path does.
        artist: track.subtitle!.split(',')[0].trim(),
      }));

    return {name: entity.name ?? entity.title ?? `Spotify ${type}`, tracks};
  }

  private toSpotifyTrack(track: SpotifyApi.TrackObjectSimplified): SpotifyTrack {
    return {
      name: track.name,
      artist: track.artists[0].name,
    };
  }

  private limitTracks<T>(tracks: T[], limit: number) {
    return tracks.length > limit ? shuffle(tracks).slice(0, limit) : tracks;
  }
}

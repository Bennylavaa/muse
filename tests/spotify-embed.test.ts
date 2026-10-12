import 'reflect-metadata';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const gotMock = vi.hoisted(() => vi.fn());
vi.mock('got', () => ({default: gotMock}));

const {default: SpotifyAPI} = await import('../src/services/spotify-api.js');

const embedPage = (entity: unknown) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: {pageProps: {state: {data: {entity}}}},
})}</script></html>`;

const respondWith = (html: string) => {
  gotMock.mockReturnValue({text: async () => html});
};

describe('SpotifyAPI embed fallback', () => {
  beforeEach(() => {
    gotMock.mockReset();
  });

  it('reads playlist tracks from the embed player without the Web API', async () => {
    respondWith(embedPage({
      name: 'Road Trip',
      trackList: [
        {title: 'Highway to Hell', subtitle: 'AC/DC'},
        {title: 'Under Pressure', subtitle: 'Queen, David Bowie'},
        {title: 'Untitled'},
      ],
    }));
    const api = new SpotifyAPI({spotify: {}} as never);

    await expect(api.getPlaylist('https://open.spotify.com/playlist/abc123?si=xyz', 50)).resolves.toEqual([
      [{name: 'Highway to Hell', artist: 'AC/DC'}, {name: 'Under Pressure', artist: 'Queen'}],
      {title: 'Road Trip', source: 'https://open.spotify.com/playlist/abc123'},
    ]);
    expect(gotMock).toHaveBeenCalledWith('https://open.spotify.com/embed/playlist/abc123', expect.anything());
  });

  it('samples artist top tracks down to the playlist limit', async () => {
    respondWith(embedPage({
      name: 'AC/DC',
      trackList: [{title: 'Thunderstruck', subtitle: 'AC/DC'}, {title: 'Back In Black', subtitle: 'AC/DC'}],
    }));
    const api = new SpotifyAPI({spotify: {}} as never);

    const tracks = await api.getArtist('spotify:artist:artist-id', 1);

    expect(tracks).toHaveLength(1);
    expect(gotMock).toHaveBeenCalledWith('https://open.spotify.com/embed/artist/artist-id', expect.anything());
  });

  it('reports an unreadable embed page as a private playlist', async () => {
    respondWith('<html>nothing here</html>');
    const api = new SpotifyAPI({spotify: {}} as never);

    await expect(api.getPlaylist('spotify:playlist:private-id', 50)).rejects.toThrow('couldn\'t read that Spotify playlist. Is it private?');
  });

  it('reports a failed embed request as a private playlist', async () => {
    gotMock.mockReturnValue({text: async () => {
      throw new Error('404');
    }});
    const api = new SpotifyAPI({spotify: {}} as never);

    await expect(api.getPlaylist('spotify:playlist:missing-id', 50)).rejects.toThrow('couldn\'t load that Spotify playlist. Is it private?');
  });
});

import site from '../data/site.json';

export interface Channel {
  id: string;
  name: string;
  label: string;
  stream: string;
  onAir: boolean;
  airtimeInfo: boolean;
  /** Switch the big Live button to this input by itself while someone broadcasts on it. */
  autoLive: boolean;
}

/**
 * Every live input the station uses, in the order set in Station settings.
 * Inputs switched off with "Show on the website" are left out.
 * Each gets a simple code (ch1, ch2, ...) so buttons can point at it.
 */
export const channels: Channel[] = site.channels
  .filter((c: any) => c.show !== false && c.stream)
  .map((c: any, i: number) => ({
    id: `ch${i + 1}`,
    name: c.name || `Channel ${i + 1}`,
    label: c.label || '',
    stream: c.stream,
    onAir: !!c.onAir,
    airtimeInfo: !!c.airtimeInfo,
    autoLive: !!c.autoLive && !!(c.statusUrl || '').trim(),
  }));

/**
 * The home input: the one ticked "On air now" in Station settings.
 * While a partner input with "Switch on automatically" is broadcasting, the player
 * uses that one instead (see player.ts), and comes back here when it ends.
 */
export const liveChannel: Channel = channels.find((c) => c.onAir) ?? channels[0];

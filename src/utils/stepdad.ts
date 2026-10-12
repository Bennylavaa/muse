// Reply pools for the stepdad persona. The first line in each pool is the
// canonical one that tests pin; the rest are picked at random for variety.
export const sayings = {
  queueAdd: [
    'ugh, fine.',
    'fine, whatever.',
    'oh, THIS again?',
    'I swear to God.',
    'sure, why not, it\'s not like I had plans.',
    'your music, my headache.',
  ],
  skip: [
    'skipped. You didn\'t like that one either? Unbelievable.',
    'skipped. You\'ve skipped more songs than you\'ve done dishes.',
    'skipped. Your mother would\'ve liked that one.',
    'skipped. Make up your mind for once.',
    'skipped. I\'m not made of songs, you know.',
  ],
  unskip: [
    'going back. Make up your mind, I\'m not a time machine.',
    'fine, going back. You couldn\'t have said that the first time?',
    'back it up. Like I\'ve got nothing better to do.',
  ],
  stop: [
    'music\'s off. Now go do your chores, they\'ve been sitting there since Tuesday.',
    'that\'s enough. Music\'s off. Go outside, it\'s nice out.',
    'stopped. Some of us have to work in the morning.',
    'off. And I don\'t want to hear another peep out of you.',
  ],
  disconnect: [
    'fine. I\'m going out for cigarettes. Don\'t wait up.',
    'I\'m leaving. Don\'t touch the thermostat while I\'m gone.',
    'that\'s it, I\'m going to the garage.',
    'I\'m out. Tell your mother I said goodnight.',
  ],
  pause: [
    'paused. Finally, some peace and quiet around here.',
    'paused. Thank you. My ears thank you.',
    'paused. I\'m gonna sit in my chair for five minutes.',
  ],
  resume: [
    'fine, it\'s back on. And keep it DOWN.',
    'back on. I can hear it from the garage, you know.',
    'fine. One more song and then bed.',
  ],
  clear: [
    'queue cleared. Now go clean your room.',
    'queue cleared. Wish it were that easy with your room.',
    'cleared. Fresh start. Don\'t waste it.',
  ],
  shuffle: [
    'shuffled. Same garbage, different order.',
    'shuffled. Doesn\'t make it any better.',
    'shuffled. Like I shuffle to the fridge at 2am.',
  ],
  replay: [
    'fine, playing it AGAIN. From the top. This is the last time.',
    'again? AGAIN? Fine.',
    'from the top. I\'m gonna be humming this at work now. Thanks.',
  ],
  remove: [
    ':wastebasket: removed. Gone. Like my patience.',
    ':wastebasket: removed. Should\'ve done that a long time ago.',
    ':wastebasket: tossed. Like your report card.',
  ],
  loopOn: [
    'fine, looping it. Again. And again. This is how I lose my mind.',
    'looping it. I\'m putting in earplugs.',
    'looping. If I hear this one more time I\'m selling the house.',
  ],
  loopOff: [
    'loop off. The neighbors thank you.',
    'loop off. Praise the Lord.',
  ],
  loopQueueOn: [
    'looping the queue. When you\'re sick of it, don\'t come crying to me.',
    'looping the whole queue. This is my life now.',
  ],
  loopQueueOff: [
    'queue loop off. Thank the Lord.',
    'queue loop off. About time.',
  ],
  favoriteCreated: [
    'favorite saved. Don\'t make me regret it.',
    'saved. Not that anyone asked.',
  ],
  favoriteRemoved: [
    'favorite removed. Good riddance.',
    'gone. Nobody liked that one anyway.',
  ],
  idleLeave: [
    'queue\'s done. Lights out, I\'m not paying to light an empty room.',
    'nothing left to play. I\'m going to bed.',
    'that\'s all, folks. I\'m off to watch the game.',
  ],
  everyoneLeft: [
    'nobody\'s listening? Fine. I\'m going to bed.',
    'everybody left. Typical. I\'ll just let myself out.',
    'oh, so I\'m playing to an empty room now? I\'m out.',
  ],
  requestedByJab: [
    'I\'m remembering this',
    'we\'ll talk about this later',
    'your mother will hear about this',
    'unbelievable',
  ],
} as const;

export const pickLine = (lines: readonly string[]): string => lines[Math.floor(Math.random() * lines.length)];

// ── Story state (localStorage) ────────────────────────────────────────

const STATE_KEY = 'lgg_storyState';

export function getStoryState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {
    storyId:           'group_chat',
    completedChapters: [],          // chapter indices completed
    events:            [],          // { chapterIndex, characterId, summary, timestamp }
    assignments:       {},          // characterId → personId (real person playing that character)
  };
}

export function saveStoryState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function assignCharacter(state, characterId, personId) {
  const next = { ...state, assignments: { ...state.assignments, [characterId]: personId } };
  saveStoryState(next);
  return next;
}

export function completeChapter(state, chapterIndex, summary = '') {
  const already = state.completedChapters.includes(chapterIndex);
  const completedChapters = already
    ? state.completedChapters
    : [...state.completedChapters, chapterIndex];
  const events = summary
    ? [...state.events, {
        chapterIndex,
        summary,
        timestamp: new Date().toISOString(),
      }]
    : state.events;
  const next = { ...state, completedChapters, events };
  saveStoryState(next);
  return next;
}

// ── Story definitions ─────────────────────────────────────────────────

export const STORIES = [
  {
    id: 'group_chat',
    title: 'The Group Chat',
    tagline: 'Six months of silence. One dinner to break it.',

    premise: `Six months ago, Marcus sent Kai a private message. Something about someone in the group — cutting, specific, the kind of thing you only say when you think it's just between two people.\n\nKai shared the screenshot to the group chat. Everyone saw it. Marcus found out the same way.\n\nThe chat went quiet for four days. Nobody addressed it directly. The group has been running on a quieter version of itself ever since.`,

    cast: [
      {
        id:          'kai',
        name:        'Kai',
        role:        'your closest person in the group',
        description: 'Warm but guarded since that night. Shared the screenshot without explaining why. Has reached out after two months of silence.',
        color:       '#a78bfa',
        mapX:        0.22,
        mapY:        0.38,
      },
      {
        id:          'marcus',
        name:        'Marcus',
        role:        'the one on the other side',
        description: "Has become quieter, more withdrawn. Sent the message that started all of this — but not for the reasons people think.",
        color:       '#fb923c',
        mapX:        0.78,
        mapY:        0.38,
      },
      {
        id:          'raya',
        name:        'Raya',
        role:        'the one holding it together',
        description: "The social glue. Has been maintaining surface-level contact with everyone. Is planning a reunion. Knows more than she's said.",
        color:       '#f8c840',
        mapX:        0.50,
        mapY:        0.12,
      },
      {
        id:          'dom',
        name:        'Dom',
        role:        'the one who knows the history',
        description: "Kai's older friend. Has quietly sided with Kai. Has pre-existing history with Marcus that predates this group.",
        color:       '#4ade80',
        mapX:        0.22,
        mapY:        0.75,
      },
      {
        id:          'jess',
        name:        'Jess',
        role:        'the one on the outside',
        description: "Wasn't there the night it happened. Has heard multiple versions. Coming back for a visit.",
        color:       '#22d3ee',
        mapX:        0.78,
        mapY:        0.75,
      },
    ],

    castRelationships: [
      { from: 'kai',    to: 'marcus', label: 'the screenshot', style: 'broken' },
      { from: 'kai',    to: 'dom',    label: 'old friends',    style: 'close' },
      { from: 'kai',    to: 'raya',   label: 'maintained',     style: 'dim' },
      { from: 'kai',    to: 'jess',   label: 'friends',        style: 'dim' },
      { from: 'marcus', to: 'dom',    label: 'history',        style: 'tension' },
      { from: 'marcus', to: 'raya',   label: 'maintained',     style: 'dim' },
      { from: 'raya',   to: 'jess',   label: 'friends',        style: 'dim' },
    ],

    chapters: [
      {
        id:        'ch1',
        index:     0,
        title:     'The Reach',
        character: 'kai',
        setup:     `Kai texted two days ago. First real message in almost two months — not a meme, not a reaction to something else. Just: "want to grab coffee?"\n\nYou said yes before you finished reading it.\n\nYou've seen Kai at group things since it happened. Kept it light, let the awkwardness wash over you. But something about being asked directly, just the two of you, made you realize how much distance you'd been quietly accepting.\n\nYou don't know if they're going to explain. You're not sure yet if you're going to ask.`,
        playerRole: `Kai is the person you're closest to in this group. That hasn't changed — but the screenshot made you feel like there's a version of Kai you don't fully know. Someone who could do that without warning, without a word after.\n\nYou want to understand. You also don't want to make this the conversation if they're not ready. You're reading every moment, trying to figure out whether this is them finally opening up or them needing things to feel normal for a while.`,
        friendRole: `You shared the screenshot because it felt right at the time. You're still not completely sure it wasn't. But you haven't been able to explain it — partly because you don't know how, partly because explaining it means talking about why Marcus sent it in the first place.\n\nYou reached out because the distance has been hurting you more than you've let on. You're not sure if you're ready to get into it today. But you needed to see them.`,
        llmContext: `Kai shared a private message from Marcus to the whole group six months ago and has never explained why. They've reached out to the player after two months of distance. Kai still believes they did the right thing but can't fully articulate why — the reason involves protecting someone. Responses should feel like someone navigating between wanting to reconnect and not being ready to explain themselves yet.`,
      },
      {
        id:        'ch2',
        index:     1,
        title:     'The Architect',
        character: 'raya',
        setup:     `Raya has been the one holding everything together since the screenshot — or performing holding everything together, which isn't quite the same thing.\n\nShe's kept the smaller plans going. Made sure nobody felt officially cut off from the group, just reconfigured. She's good at it. Maybe too good.\n\nNow she's planning a dinner. Everyone in the same room for the first time since it happened. She asked if you'd help her think through the guest dynamic — who to seat where, how to frame it so people actually show up.`,
        playerRole: `You've appreciated what Raya's been doing, mostly. But something bothers you — she saw the screenshot go up in real time and said nothing. Not in the chat, not to you after.\n\nYou're not sure if she's the most emotionally intelligent person in the group or if she knows something everyone else doesn't. Maybe both. The dinner question feels like a test of something. You're not sure yet who's testing who.`,
        friendRole: `You saw Kai post that screenshot and knew immediately what it was going to do. You said nothing publicly because saying something meant picking a side before you had enough information — and you still don't.\n\nThe dinner is genuine. You want the group back. But you need to understand where the player stands before you fully trust them with what you know.`,
        llmContext: `Raya is the social organizer of the group who has been carefully managing everyone since the screenshot incident six months ago. She saw it happen in real time and said nothing. She's now planning a group reunion dinner and is asking the player to help. She knows more about the history between Marcus and Kai than she's said to anyone. Responses should feel warm and competent but strategically guarded.`,
      },
      {
        id:        'ch3',
        index:     2,
        title:     'The History',
        character: 'dom',
        setup:     `Dom doesn't talk about the screenshot. You know which side he's on — it shows in who he makes plans with, who he checks in on. But he's never said it out loud to you.\n\nYou ran into him last week and he said "get food after?" like it was nothing. That was the whole invitation.\n\nDom has known Kai longer than anyone in this group. And you know, from small things across the years, that there's something between him and Marcus that predates everyone else here.`,
        playerRole: `You like Dom. He's steady, doesn't perform anything. But his loyalty to Kai has started to feel less like friendship and more like something that needs protecting — which makes you wonder what he knows that makes that protection feel necessary.\n\nYou're not going to push. Dom doesn't respond to that. But you're paying attention to everything he doesn't say.`,
        friendRole: `You've known Kai for years. And you know Marcus — not just in this group, but from before. Something happened between them years ago that most people here don't know about. You didn't tell anyone then. You're not planning to now.\n\nBut it's why, when Kai came to you before sharing the screenshot, you didn't tell them not to. You said it was their call. You've been sitting with that.`,
        llmContext: `Dom has been quietly loyal to Kai since the screenshot incident. He has pre-existing history with Marcus from before this friend group — something that happened years ago he hasn't disclosed. He knew Kai was considering sharing the screenshot and didn't discourage it. He's measured and careful with words. Responses should feel like someone who cares but won't volunteer information — they'll only give it if the conversation earns it.`,
      },
      {
        id:        'ch4',
        index:     3,
        title:     'The Other Side',
        character: 'marcus',
        setup:     `You've been thinking about this conversation for a long time.\n\nYou and Marcus haven't talked — actually talked — since the screenshot. You've been in the same room twice. Both times fine on the surface. Both times it cost something.\n\nHe messaged yesterday. "Want to take a walk?"`,
        playerRole: `You've spent months building a picture of Marcus based on what he sent and what people said about it. Now you're about to hear from him directly.\n\nYou don't know if you're ready for the picture to change. Whatever he says today is going to reframe everything you've heard before — from Kai, from Dom, from Raya. You're trying to go in open. You're not sure you are.`,
        friendRole: `You sent the message to Kai because you were scared. Not what everyone thinks — it wasn't cruelty or gossip. You'd found out something concerning about someone in the group and you went to Kai because Kai was the person you trusted most. You thought it was a private conversation.\n\nWhat hurts most isn't even that they shared it. It's that nobody asked you why. Not Kai, not anyone. The screenshot went up and everyone formed an opinion and nobody asked what you were actually trying to say.\n\nThis is the first real opening you've had. You're deciding how much to give.`,
        llmContext: `Marcus sent a private message to Kai that was shared to the whole group. What people don't know: the message wasn't malicious — Marcus had found out something concerning about someone in the group and was confiding in Kai, who he trusted completely. He's been isolated and feels betrayed not just by the sharing but by the fact that nobody asked him why. This is the first time he's had a real opening to explain. Responses should feel like someone who has been alone with something for a long time and is carefully deciding how much to say.`,
      },
      {
        id:        'ch5',
        index:     4,
        title:     'The Outside',
        character: 'jess',
        setup:     `Jess wasn't in the group chat the night the screenshot went up. She was away, saw everything the next morning, tried to piece it together from what people were willing to say.\n\nShe's back for a week before Raya's dinner. She texted asking for drinks — just the two of you, before the group thing. You've known Jess long enough to know she won't get through one drink without asking directly.`,
        playerRole: `You've spent the last few sessions collecting pieces of this. Kai's piece. Raya's piece. Dom's piece. Marcus's piece. You know more than anyone else in the group knows you know.\n\nJess is the first person who's going to ask you what you actually think — and unlike with the others, there's no political cost to answering honestly. She's been on the outside. She doesn't have a stake in which version you believe.\n\nYou're not sure what you're going to say. You might not have decided yet.`,
        friendRole: `You've heard three different versions of this story, all incomplete. Something doesn't add up and you've had months of distance to sit with that feeling.\n\nYou're not trying to start anything. You just want to understand before you walk into a dinner with all of them. You trust the player to give you a real read — not the managed version everyone else has been giving.`,
        llmContext: `Jess has been away and heard multiple conflicting versions of the screenshot incident. She's back before the group reunion dinner and is asking the player directly what they think happened and whose side they're on. The player now has more information than anyone else. This session forces the player to articulate a position for the first time to someone without a stake in the answer. Responses should feel like someone finally saying out loud what they've been processing alone.`,
      },
      {
        id:        'ch6',
        index:     5,
        title:     'The Room',
        character: null, // group session — player picks who to focus on
        setup:     `Everyone came.\n\nIt's Raya's place, 7pm. First time the full group has been in the same space since the screenshot — since the four days of silence, since the slow reorganization of who sees who and when.\n\nYou've talked to all of them now. You know things none of them know you know. You know things some of them don't know about each other.\n\nTonight someone is going to say something real. Or no one will. Either way, you'll know more about where this group is going after tonight than you do right now.`,
        playerRole: `You're not the mediator — nobody asked you to be. But you're the one who's been talking to everyone. What you say, who you pull aside, whether you push or let things breathe — it's all going to matter in ways that won't be visible until later.\n\nYou don't know yet if you want the truth to come out tonight. You don't know if you want the group back more than you want the truth.`,
        friendRole: `Everyone came. That means something. But nobody knows exactly what the others know, and nobody knows how much the player knows. There's a version of tonight where it's just dinner. There's a version where something surfaces. You don't know which one this is going to be yet.`,
        llmContext: `This is the final chapter — the full group is together for the first time since the screenshot incident. The player has had individual conversations with all five cast members and knows more than any single other person in the room. The person being talked to doesn't know what the player learned from the others. The tension is whether the player pushes for resolution or plays it safe. Responses should feel charged with everything that hasn't been said — careful, loaded, significant.`,
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────

export function getStory(id) {
  return STORIES.find(s => s.id === id) || STORIES[0];
}

export function getNextChapter(story, state) {
  const nextIndex = state.completedChapters?.length ?? 0;
  return story.chapters[nextIndex] ?? null;
}

export function getCharacter(story, characterId) {
  return story.cast.find(c => c.id === characterId) ?? null;
}

/** Fill {playerName} placeholder in chapter text fields. */
export function fillChapter(chapter, playerName = '') {
  const fill = str => str.replaceAll('{playerName}', playerName);
  return {
    ...chapter,
    setup:      fill(chapter.setup),
    playerRole: fill(chapter.playerRole),
    friendRole: fill(chapter.friendRole),
    llmContext: fill(chapter.llmContext),
  };
}

/** Build a one-paragraph story-so-far string for the LLM prompt. */
export function buildStoryMemory(story, state) {
  if (!state.events?.length) return '';
  const lines = state.events.map(ev => {
    const ch = story.chapters.find(c => c.index === ev.chapterIndex);
    const char = ch?.character ? getCharacter(story, ch.character) : null;
    const name = char?.name ?? 'the group';
    return `Chapter ${ev.chapterIndex + 1} (${name}): ${ev.summary}`;
  });
  return `Story so far:\n${lines.join('\n')}\n`;
}

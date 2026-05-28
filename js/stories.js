// ── Story state (localStorage) ────────────────────────────────────────

const STATE_KEY = 'honne_storyState';

function emptyProgress() {
  return { completedChapters: [], events: [], assignments: {} };
}

export function getStoryState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old flat shape → new nested shape
      if (parsed && !parsed.progress) {
        return {
          activeStoryId: parsed.storyId || 'group_chat',
          progress: {
            [parsed.storyId || 'group_chat']: {
              completedChapters: parsed.completedChapters || [],
              events:            parsed.events            || [],
              assignments:       parsed.assignments       || {},
            },
          },
        };
      }
      return parsed;
    }
  } catch (_) {}
  return { activeStoryId: 'group_chat', progress: {} };
}

export function saveStoryState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

/** Get progress for a specific story (never undefined). */
export function getStoryProgress(state, storyId) {
  return state.progress?.[storyId] ?? emptyProgress();
}

/** Switch the active story. */
export function setActiveStory(state, storyId) {
  const next = { ...state, activeStoryId: storyId };
  saveStoryState(next);
  return next;
}

export function assignCharacter(state, storyId, characterId, personId) {
  const prev = getStoryProgress(state, storyId);
  const next = {
    ...state,
    progress: {
      ...state.progress,
      [storyId]: {
        ...prev,
        assignments: { ...prev.assignments, [characterId]: personId },
      },
    },
  };
  saveStoryState(next);
  return next;
}

export function completeChapter(state, storyId, chapterIndex, summary = '') {
  const prev    = getStoryProgress(state, storyId);
  const already = prev.completedChapters.includes(chapterIndex);
  const completedChapters = already
    ? prev.completedChapters
    : [...prev.completedChapters, chapterIndex];
  const events = summary
    ? [...prev.events, { chapterIndex, summary, timestamp: new Date().toISOString() }]
    : prev.events;
  const next = {
    ...state,
    progress: {
      ...state.progress,
      [storyId]: { ...prev, completedChapters, events },
    },
  };
  saveStoryState(next);
  return next;
}

// ── Story definitions ─────────────────────────────────────────────────

export const STORIES = [

  // ── 1 person ──────────────────────────────────────────────────────
  {
    id:       'before_you_go',
    title:    'Before You Go',
    tagline:  'One last evening. Say the thing.',
    players:  1,

    premise: `Sam is leaving in three days. Not for a trip — for real this time. New country, new chapter. You've rescheduled twice already. Tonight is what you actually have.\n\nSame place you always go. You ordered Sam's usual before thinking about it. There are things you've meant to say for a long time. You're not sure tonight changes that. But tonight is the last chance to find out.`,

    cast: [
      {
        id:          'sam',
        name:        'Sam',
        role:        'your closest friend, leaving in three days',
        description: 'Has known you longer than most. Warm but carrying something today. Trying to keep things light while also being completely present with you.',
        color:       '#a78bfa',
        mapX:        0.50,
        mapY:        0.45,
      },
    ],

    castRelationships: [],

    chapters: [
      {
        id:        'ch1',
        index:     0,
        title:     'The Usual Place',
        character: 'sam',
        setup:     `You got there first for once. Ordered Sam's usual without thinking — the one they've had at least a hundred times here. They walked in, saw it on the table, and something crossed their face you couldn't quite read.\n\nYou've been meeting here for years. The place is unchanged. Everything else is.`,
        playerRole: `You're trying to hold the evening steady — keep it feeling like the ones before, because the ones before were good. You keep almost saying the real thing. Each time you pull back to something easier.`,
        friendRole: `Sam knows something is waiting to be said. They're not sure if you're going to say it. They're grateful you're here. They're trying not to think too hard about the fact that you're almost out of evenings.`,
        llmContext: `Sam is the player's closest friend who is moving abroad in three days. They're at their regular spot. Both are trying to keep things normal while something heavier sits underneath. Sam loves the player but is pacing themselves emotionally — goodbyes are hard and there are still three days to get through. Responses should feel warm and present, but careful — someone genuinely glad to be here but protecting themselves a little.`,
      },
      {
        id:        'ch2',
        index:     1,
        title:     'The Doorstep',
        character: 'sam',
        setup:     `Coffee turned into dinner. Dinner turned into a walk. Neither of you planned any of it but you both kept finding reasons not to end the night.\n\nNow you're outside Sam's place. Late. The walk ended here the way it was always going to.`,
        playerRole: `This is the moment. Not because you decided it was — just because there isn't another one. Whatever you've been circling around all evening, this is when it either comes out or doesn't. You're not sure yet which way it goes.`,
        friendRole: `Sam knows this is the real part of the night. Has known for a while the conversation was building toward something. Is not going to rush you — is going to let you lead, even if you don't know yet what you're leading toward.`,
        llmContext: `This is the goodbye — late night, outside Sam's place. The whole evening has been building to this. Sam is completely present and giving the player space to say what they actually mean. The move is real; it starts in three days. This is the last moment. Responses should feel like someone being completely open — not performing ease, but actually there with you, giving you room.`,
      },
    ],
  },

  // ── 2 people ──────────────────────────────────────────────────────
  {
    id:       'the_middle',
    title:    'The Middle',
    tagline:  'Two stories. One of them might be true.',
    players:  2,

    premise: `Two weeks ago, something happened between River and Casey. You weren't there. You've heard River's version. You've heard Casey's version. They are not the same story.\n\nBoth of them have kept talking to you like normal. You've been careful — not agreeing with either, not pushing. Tonight Priya is having people over. For the first time since it happened, all three of you will be in the same room.`,

    cast: [
      {
        id:          'river',
        name:        'River',
        role:        'the one who came to you first',
        description: 'Reached out the night it happened. Has been watchful since — not dramatic, just careful. Wants to know where you stand without asking directly.',
        color:       '#a78bfa',
        mapX:        0.28,
        mapY:        0.45,
      },
      {
        id:          'casey',
        name:        'Casey',
        role:        'the other side',
        description: "Took a few days to reach out. Told you a version without acknowledging you might have heard another. Seems to assume you're already on their side.",
        color:       '#fb923c',
        mapX:        0.72,
        mapY:        0.45,
      },
    ],

    castRelationships: [
      { from: 'river', to: 'casey', label: 'what happened', style: 'broken' },
    ],

    chapters: [
      {
        id:        'ch1',
        index:     0,
        title:     'River Asks',
        character: 'river',
        setup:     `River messaged asking to meet for twenty minutes before the party. Didn't say why — you both knew why.\n\nYou're at the place they suggested. River is already there, watching the door.`,
        playerRole: `You know more than River thinks. You've heard Casey's version. You haven't told River that. You're trying to listen without tipping anything in a direction you can't take back.`,
        friendRole: `River wants to know what you know and where you stand. Has been trying to figure out who's actually on their side. Doesn't know you've been talking to Casey. Will be reading everything you say very carefully.`,
        llmContext: `River had a falling out with Casey two weeks ago. They came to the player first. Tonight, before a party, River is trying to gauge whether the player believes their version and where their loyalty lies. River doesn't know the player has also heard Casey's version. Responses should feel measured — someone who cares about the friendship but is also quietly assessing allegiances.`,
      },
      {
        id:        'ch2',
        index:     1,
        title:     'Casey Assumes',
        character: 'casey',
        setup:     `You made it to the party. Warm, loud enough that you don't have to project. Twenty minutes in, Casey appeared at your elbow.\n\n"Hey — can we step outside for a sec?"`,
        playerRole: `You've heard both versions now. Casey doesn't know you talked to River before this. You're in the middle of something that isn't yours — and what you say is going to matter to both of them in ways you can't fully predict.`,
        friendRole: `Casey assumes the player is already sympathetic — or at least available to be. Is going to talk openly, possibly saying things the player can now cross-reference against what River said. Isn't aware this is a cross-reference situation.`,
        llmContext: `Casey had a falling out with River two weeks ago. Casey reached out to the player a few days after and has assumed, without quite checking, that the player is on their side. Tonight at a party they've pulled the player aside. Casey doesn't know the player spoke with River right before this. Casey may say things that contradict River's version. Responses should feel open and slightly self-assured — someone not worried about being believed.`,
      },
      {
        id:        'ch3',
        index:     2,
        title:     'Both of Them',
        character: null,
        setup:     `You went back inside. Five minutes later you were in a conversation with both of them.\n\nNobody announced it. It just happened the way these things do at parties — someone moved, and suddenly River and Casey were both talking to you in the same circle.\n\nYou are the only person in this room who has heard both versions of what happened.`,
        playerRole: `You've been neutral for two weeks. You've heard everything. This is the moment where you either hold that position or you don't — and whether you mean to or not, what you say in the next few minutes is going to say something about where you actually stand.`,
        friendRole: `River and Casey are both present. Neither knows what the other told you tonight. The conversation could go anywhere — and probably will go somewhere nobody planned.`,
        llmContext: `The player is now in a conversation with both River and Casey at a party. Neither person knows what the other said to the player tonight. The player knows more than either of them realizes. On the surface this looks like a normal party conversation. Respond as whichever of River or Casey feels most natural, or blend both presences. The tension is whether the player reveals what they know or keeps playing neutral.`,
      },
    ],
  },

  // ── 3 people ──────────────────────────────────────────────────────
  {
    id:       'new_here',
    title:    'New Here',
    tagline:  "Three weeks in. You're still reading the room.",
    players:  3,

    premise: `New job, new city. Three weeks in.\n\nThe people you've spent the most time with are Jamie, Alex, and Noor. They've known each other for over a year. You're the newest variable — not unwelcome, just unread.\n\nYou've been watching carefully. You think you're starting to understand who they are. You might be wrong about at least one of them.`,

    cast: [
      {
        id:          'jamie',
        name:        'Jamie',
        role:        'the one who reached out first',
        description: 'Friendly without being overwhelming. Invited you to lunch on day three. Easy to like. Possibly easy to underestimate.',
        color:       '#4ade80',
        mapX:        0.50,
        mapY:        0.18,
      },
      {
        id:          'alex',
        name:        'Alex',
        role:        'the quiet one who notices everything',
        description: "Doesn't say much in groups but watches everything. Had one conversation with you that made you feel like they'd figured something out about you that you hadn't said.",
        color:       '#22d3ee',
        mapX:        0.22,
        mapY:        0.75,
      },
      {
        id:          'noor',
        name:        'Noor',
        role:        'the one everyone listens to',
        description: "Not officially in charge of anything. Somehow in charge of everything. Has been pleasant to you but hasn't quite let you in yet.",
        color:       '#f8c840',
        mapX:        0.78,
        mapY:        0.75,
      },
    ],

    castRelationships: [
      { from: 'jamie', to: 'alex',  label: 'old friends', style: 'close' },
      { from: 'jamie', to: 'noor',  label: 'close',       style: 'close' },
      { from: 'alex',  to: 'noor',  label: 'tension',     style: 'tension' },
    ],

    chapters: [
      {
        id:        'ch1',
        index:     0,
        title:     'The Welcome',
        character: 'jamie',
        setup:     `Jamie suggested lunch on day three. You'd been eating at your desk. They walked over and said "we go to this place on Tuesdays, you should come." Just like that.\n\nYou've been going every Tuesday since. Today it's just the two of you.`,
        playerRole: `Jamie is easy to be around and you're grateful. But you've started to wonder if you actually know them. The warmth is real — but there might be a version of Jamie you haven't seen yet.`,
        friendRole: `Jamie genuinely likes the player and wanted someone new in the group. Today is low-stakes. But Jamie is also paying attention to who the player is, and would tell them something real about the group if asked the right way.`,
        llmContext: `Jamie was the first to welcome the player at their new job three weeks ago. They have Tuesday lunches together. Today it's just the two of them. Jamie is warm and genuine but also knows the group dynamics well — including the tension between Alex and Noor — and would share it if the player opened the right door. Responses should feel natural and friendly but with a layer of "I know things I could tell you."`,
      },
      {
        id:        'ch2',
        index:     1,
        title:     'The Observer',
        character: 'alex',
        setup:     `Alex caught you in the kitchen on Thursday afternoon. You were making tea. They were refilling their water. The kind of conversation you can leave after ninety seconds.\n\nAlex didn't leave after ninety seconds. Said something that made you stay.`,
        playerRole: `Alex has been quiet around you in groups, which you'd read as indifference. But this one-on-one is different — sharper, more direct. You're paying closer attention than you expected to be.`,
        friendRole: `Alex has been watching the player since they arrived and has formed some assessments. This kitchen conversation was deliberate. Alex wants to know something specific about the player without asking directly. May hint at the situation with Noor.`,
        llmContext: `Alex is quiet in groups but perceptive and direct one-on-one. They've been observing the player since they joined. This kitchen conversation was intentional — Alex wanted to get the player alone. Alex has a complicated dynamic with Noor that they haven't discussed openly. They may probe the player's read on the group before revealing anything. Responses should feel careful and intelligent — not unfriendly, but definitely assessing.`,
      },
      {
        id:        'ch3',
        index:     2,
        title:     'The Check-In',
        character: 'noor',
        setup:     `Noor sent a calendar invite for Friday afternoon. Subject: "quick catch-up." No other context.\n\nYou've had maybe four real conversations with Noor in three weeks. You don't know if this is routine or specific to you.`,
        playerRole: `You've talked to Jamie and Alex. You have some sense of the shape of this group from two angles. Noor is the one you understand least. You're going in open, but you're paying attention to everything.`,
        friendRole: `Noor scheduled this intentionally. Three weeks in is when they check on new people — to get a read, explain how things actually work, and decide whether to bring someone in more fully. This is an assessment. Noor will share real things if the player shows they can be trusted with them.`,
        llmContext: `Noor is the unofficial anchor of this work group — not the manager, but the person with the most influence. Three weeks in, they do a check-in with new people to decide if they're worth investing in. Noor knows about the tension with Alex and has views on it they haven't shared widely. Responses should feel warm but precise — someone choosing words carefully while being genuinely interested in who the player is.`,
      },
      {
        id:        'ch4',
        index:     3,
        title:     'Friday Drinks',
        character: null,
        setup:     `After-work drinks, two blocks from the office. All three of them are there. You've now had individual time with each of them.\n\nYou know things about each of them that the others don't know you know.`,
        playerRole: `Three weeks in, you have more of a map now. Tonight is the first time you'll be in a group with all three after having real one-on-ones with each. You're watching how they actually are with each other.`,
        friendRole: `Jamie is easy. Alex is watchful. Noor is measured. The player is still the new variable in a dynamic that's been stable for over a year. Everyone is curious — in their own way — about how the player fits.`,
        llmContext: `The player's first real social outing with all three new colleagues after individual conversations with each. They've accumulated observations about the group. Tonight at drinks the three colleagues are together. The player can observe the dynamics they heard about playing out live. Respond as whichever character feels most present, or blend them. The tone should feel like a work social — warm on the surface, undercurrents underneath.`,
      },
    ],
  },

  // ── 4 people ──────────────────────────────────────────────────────
  {
    id:       'move_out',
    title:    'The Move Out',
    tagline:  "The lease ends in three weeks. So does this.",
    players:  4,

    premise: `You've lived with Eli, Mara, and Dani for almost a year. The lease is up at the end of the month. Everyone is going different directions.\n\nThe last few weeks have been a specific kind of limbo — everything slowly packing down to habit and cardboard, but still three more weeks of mornings in the same kitchen. You don't quite know how to be with each other when the thing that held you together is almost over.`,

    cast: [
      {
        id:          'eli',
        name:        'Eli',
        role:        'the one you got closest to',
        description: 'Easy to live with. You fell into a rhythm early — same schedule, same sense of humor about the house. Going back home. Hasn\'t said how he really feels about that.',
        color:       '#a78bfa',
        mapX:        0.28,
        mapY:        0.28,
      },
      {
        id:          'mara',
        name:        'Mara',
        role:        'the one who held it together',
        description: "Remembered the bin schedule, the lease renewal, whose turn it was to buy milk. Moving in with her partner. Seems ready to go — which makes the rest of you feel something you haven't named.",
        color:       '#f8c840',
        mapX:        0.72,
        mapY:        0.28,
      },
      {
        id:          'dani',
        name:        'Dani',
        role:        'the one you never quite got to',
        description: "Quiet. Kept to themselves. You shared the kitchen for a year and never crossed into real territory. There's a version of them you got glimpses of. You never got the full picture.",
        color:       '#4ade80',
        mapX:        0.28,
        mapY:        0.72,
      },
      {
        id:          'felix',
        name:        'Felix',
        role:        'the one who announced it first',
        description: "Sent the group message three months ago saying he wasn't renewing. Which started everything. Has been the most visibly cheerful about the move — which is either healthy or a performance.",
        color:       '#fb923c',
        mapX:        0.72,
        mapY:        0.72,
      },
    ],

    castRelationships: [
      { from: 'eli',   to: 'mara',  label: 'solid',      style: 'close' },
      { from: 'eli',   to: 'dani',  label: 'cordial',    style: 'dim' },
      { from: 'mara',  to: 'dani',  label: 'something',  style: 'tension' },
      { from: 'eli',   to: 'felix', label: 'easy',        style: 'dim' },
      { from: 'mara',  to: 'felix', label: 'fine',        style: 'dim' },
      { from: 'dani',  to: 'felix', label: 'distant',     style: 'dim' },
    ],

    chapters: [
      {
        id:        'ch1',
        index:     0,
        title:     'The Closest One',
        character: 'eli',
        setup:     `Eli knocked on your door last Sunday and said "want to get out of the house?" No other context. You've done this dozens of times over the past year — just walking, no particular direction.\n\nExcept this time you both know it's one of the last times.`,
        playerRole: `Eli is the person in the house you actually got close to. Which makes this harder. You're trying to talk like normal. You're not sure you're managing it.`,
        friendRole: `Eli is also trying to be normal. Is not succeeding entirely. Something about going back home feels unresolved — not bad, just incomplete — and you're the one person he'd actually talk to about it if the conversation opened up that way.`,
        llmContext: `Eli and the player have been the closest of the housemates over the past year. They're on a walk together, one of their usual ones, but both aware it's near the end. Eli is going back home and has mixed feelings about it he hasn't fully processed. He's not sad in a heavy way — more wistful, and looking for the player to be real with him. Responses should feel warm and genuine, easy to be around, but with something slightly unfinished underneath.`,
      },
      {
        id:        'ch2',
        index:     1,
        title:     'The One Who\'s Ready',
        character: 'mara',
        setup:     `Mara is the most organized person you've ever lived with. The house ran because of her. Moving in with her partner is clearly the right next step — she talks about the new place like she's already there.\n\nShe made tea this morning and sat across from you and said, "I feel like we never just talked, just us."`,
        playerRole: `Mara's readiness has been slightly strange to watch. Part of you admires it. Part of you wonders what it means that she seems so fine. You're curious about the version of this year that's in her head.`,
        friendRole: `Mara has been holding the house together for a year and is genuinely ready to stop. Moving in with her partner is what she's wanted. But "ready" doesn't mean the year meant nothing — she's noticed things, has opinions she's kept to herself, and would share them with the right person at the right moment.`,
        llmContext: `Mara was the practical anchor of the house for the past year. She's moving in with her partner and is genuinely ready — not performing it. But she's also perceptive and has opinions about the housemates she's mostly kept to herself. This morning tea conversation is rare for them. She'd share something real if the player gave her an opening. Responses should feel grounded and clear-eyed — someone who has processed things and is speaking from that.`,
      },
      {
        id:        'ch3',
        index:     2,
        title:     'The One You Missed',
        character: 'dani',
        setup:     `Dani was in the living room last night, just sitting. No laptop, no phone. You asked if they wanted company and they said "yeah, sure" like it was something they'd been waiting for someone to offer.\n\nYou've shared a kitchen for a year. This is the longest conversation you've had.`,
        playerRole: `Dani was always slightly at the edge of the house dynamic — polite, present, but never quite in. You've wondered what was there. Now you're finding out and you're aware that you're almost out of time.`,
        friendRole: `Dani kept to themselves not because they didn't want connection — because they weren't sure it was available. Is surprised to be having this conversation. Is more open than you might expect. Has something to say about the year that they haven't had a chance to say to anyone.`,
        llmContext: `Dani has been the quietest housemate — kept to themselves, never quite integrated. But it was shyness more than preference. This late-night living room conversation is rare and unexpected. Dani is actually quite thoughtful and has been watching the house dynamic for a year with more insight than anyone realized. Responses should feel a little tentative at first, then warmer — like someone who's been waiting to be actually asked.`,
      },
      {
        id:        'ch4',
        index:     3,
        title:     'The Cheerful One',
        character: 'felix',
        setup:     `Felix started the whole thing with one message three months ago. "Hey so I'm not renewing, just wanted to give everyone time to figure it out." Sent at 10am on a Tuesday. Very Felix.\n\nHe's been the most upbeat about the move. Takes it in stride. You've never been sure if that's genuine or if something else is going on.`,
        playerRole: `You've been a little annoyed at Felix's cheerfulness. It's hard to be nostalgic around someone who doesn't seem to need to be. You're curious — and maybe slightly hoping — that there's more going on underneath.`,
        friendRole: `Felix is genuinely fine about the move. But "fine" doesn't mean he hasn't thought about it. He sent that message because he knew he was the one who'd have to do it — and that decision cost something he hasn't said to anyone. He'd tell you if you asked in the right way.`,
        llmContext: `Felix was the one who announced he wasn't renewing the lease, starting the whole move-out process. He's been upbeat about it — genuinely, mostly — but sending that message was a bigger decision than he's let on, and he's aware that it changed the house dynamic even if nobody said so. Responses should feel easy and a bit deflecting at first, but willing to go deeper if the player pushes past the surface.`,
      },
      {
        id:        'ch5',
        index:     4,
        title:     'The Last Night',
        character: null,
        setup:     `Someone suggested a house dinner on the last Thursday before the lease ends. Mara cooked. Felix brought wine. Eli made dessert. Dani showed up with candles because "it seemed right."\n\nYou're all at the table. The boxes are in the background. This is it.`,
        playerRole: `You've talked to each of them now — really talked. You know things about this year that none of them know you know. You're sitting at this table aware that it's the last time you'll all be here, and that something about that matters more than you expected it to.`,
        friendRole: `Eli, Mara, Dani, and Felix are all at the table. Everyone showed up. Nobody's leaving early. The conversation is going to go somewhere real tonight — it's just a question of when and who starts it.`,
        llmContext: `The final house dinner before everyone moves out. All four housemates are together. The player has had real individual conversations with each of them and knows the undercurrents of this house well. The mood is warm but weighted — everyone is aware this is ending. Respond as whichever housemate feels most present in the moment, or blend them. Something honest is likely to be said tonight. The responses should feel like the last night of something good.`,
      },
    ],
  },

  // ── 5 people ──────────────────────────────────────────────────────
  {
    id:       'group_chat',
    title:    'The Group Chat',
    tagline:  'Six months of silence. One dinner to break it.',
    players:  5,

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
        setup:     `Kai texted two days ago. First real message in almost two months — not a meme, not a reaction to something else. Just: "want to grab coffee?"\n\nYou said yes before you finished reading it.\n\nYou've seen Kai at group things since it happened. Kept it light, let the awkwardness wash over you. But something about being asked directly, just the two of you, made you realize how much distance you'd been quietly accepting.`,
        playerRole: `Kai is the person you're closest to in this group. That hasn't changed — but the screenshot made you feel like there's a version of Kai you don't fully know. Someone who could do that without warning, without a word after.\n\nYou want to understand. You also don't want to make this the conversation if they're not ready. You're reading every moment, trying to figure out whether this is them finally opening up or them needing things to feel normal for a while.`,
        friendRole: `You shared the screenshot because it felt right at the time. You're still not completely sure it wasn't. But you haven't been able to explain it — partly because you don't know how, partly because explaining it means talking about why Marcus sent it in the first place.\n\nYou reached out because the distance has been hurting you more than you've let on. You're not sure if you're ready to get into it today. But you needed to see them.`,
        llmContext: `Kai shared a private message from Marcus to the whole group six months ago and has never explained why. They've reached out to the player after two months of distance. Kai still believes they did the right thing but can't fully articulate why — the reason involves protecting someone. Responses should feel like someone navigating between wanting to reconnect and not being ready to explain themselves yet.`,
      },
      {
        id:        'ch2',
        index:     1,
        title:     'The Architect',
        character: 'raya',
        setup:     `Raya has been the one holding everything together since the screenshot — or performing holding everything together, which isn't quite the same thing.\n\nShe's kept the smaller plans going. Made sure nobody felt officially cut off from the group, just reconfigured. She's good at it. Maybe too good.\n\nNow she's planning a dinner. Everyone in the same room for the first time since it happened.`,
        playerRole: `You've appreciated what Raya's been doing, mostly. But something bothers you — she saw the screenshot go up in real time and said nothing. Not in the chat, not to you after.\n\nYou're not sure if she's the most emotionally intelligent person in the group or if she knows something everyone else doesn't. Maybe both.`,
        friendRole: `You saw Kai post that screenshot and knew immediately what it was going to do. You said nothing publicly because saying something meant picking a side before you had enough information — and you still don't.\n\nThe dinner is genuine. You want the group back. But you need to understand where the player stands before you fully trust them with what you know.`,
        llmContext: `Raya is the social organizer who has been carefully managing everyone since the screenshot incident. She saw it happen in real time and said nothing. She's now planning a group reunion dinner. She knows more about the history between Marcus and Kai than she's told anyone. Responses should feel warm and competent but strategically guarded.`,
      },
      {
        id:        'ch3',
        index:     2,
        title:     'The History',
        character: 'dom',
        setup:     `Dom doesn't talk about the screenshot. You know which side he's on — it shows in who he makes plans with. But he's never said it out loud to you.\n\nYou ran into him last week and he said "get food after?" like it was nothing. That was the whole invitation.\n\nDom has known Kai longer than anyone in this group. And you know there's something between him and Marcus that predates everyone else here.`,
        playerRole: `You like Dom. He's steady, doesn't perform anything. But his loyalty to Kai has started to feel less like friendship and more like something that needs protecting — which makes you wonder what he knows that makes that protection feel necessary.\n\nYou're not going to push. Dom doesn't respond to that.`,
        friendRole: `You've known Kai for years. And you know Marcus — not just in this group, but from before. Something happened between them years ago that most people here don't know about. You didn't tell anyone then. You're not planning to now.\n\nBut it's why, when Kai came to you before sharing the screenshot, you didn't tell them not to. You said it was their call. You've been sitting with that.`,
        llmContext: `Dom has been quietly loyal to Kai since the screenshot incident. He has pre-existing history with Marcus from before this friend group — something that happened years ago he hasn't disclosed. He knew Kai was considering sharing the screenshot and didn't discourage it. He's measured and careful with words. Responses should feel like someone who cares but won't volunteer information — they'll only give it if the conversation earns it.`,
      },
      {
        id:        'ch4',
        index:     3,
        title:     'The Other Side',
        character: 'marcus',
        setup:     `You've been thinking about this conversation for a long time.\n\nYou and Marcus haven't talked — actually talked — since the screenshot. You've been in the same room twice. Both times fine on the surface. Both times it cost something.\n\nHe messaged yesterday. "Want to take a walk?"`,
        playerRole: `You've spent months building a picture of Marcus based on what he sent and what people said about it. Now you're about to hear from him directly.\n\nYou don't know if you're ready for the picture to change. Whatever he says today is going to reframe everything you've heard before.`,
        friendRole: `You sent the message to Kai because you were scared. Not what everyone thinks — it wasn't cruelty or gossip. You'd found out something concerning about someone in the group and you went to Kai because Kai was the person you trusted most. You thought it was a private conversation.\n\nWhat hurts most isn't even that they shared it. It's that nobody asked you why. Not Kai, not anyone. The screenshot went up and everyone formed an opinion and nobody asked what you were actually trying to say.\n\nThis is the first real opening you've had.`,
        llmContext: `Marcus sent a private message to Kai that was shared to the whole group. What people don't know: the message wasn't malicious — Marcus had found out something concerning about someone in the group and was confiding in Kai, who he trusted completely. He's been isolated and feels betrayed not just by the sharing but by the fact that nobody asked him why. This is the first time he's had a real opening to explain. Responses should feel like someone who has been alone with something for a long time and is carefully deciding how much to say.`,
      },
      {
        id:        'ch5',
        index:     4,
        title:     'The Outside',
        character: 'jess',
        setup:     `Jess wasn't in the group chat the night the screenshot went up. She was away, saw everything the next morning, tried to piece it together from what people were willing to say.\n\nShe's back for a week before Raya's dinner. She texted asking for drinks — just the two of you, before the group thing.`,
        playerRole: `You've spent the last few sessions collecting pieces of this. Kai's piece. Raya's piece. Dom's piece. Marcus's piece. You know more than anyone else in the group knows you know.\n\nJess is the first person who's going to ask you what you actually think — and unlike with the others, there's no political cost to answering honestly.`,
        friendRole: `You've heard three different versions of this story, all incomplete. Something doesn't add up and you've had months of distance to sit with that feeling.\n\nYou're not trying to start anything. You just want to understand before you walk into a dinner with all of them. You trust the player to give you a real read.`,
        llmContext: `Jess has been away and heard multiple conflicting versions of the screenshot incident. She's back before the group reunion dinner and is asking the player directly what they think happened. The player now has more information than anyone else. This session forces the player to articulate a position for the first time to someone without a stake in the answer. Responses should feel like someone finally saying out loud what they've been processing alone.`,
      },
      {
        id:        'ch6',
        index:     5,
        title:     'The Room',
        character: null,
        setup:     `Everyone came.\n\nIt's Raya's place, 7pm. First time the full group has been in the same space since the screenshot — since the four days of silence, since the slow reorganization of who sees who and when.\n\nYou've talked to all of them now. You know things none of them know you know. You know things some of them don't know about each other.\n\nTonight someone is going to say something real. Or no one will.`,
        playerRole: `You're not the mediator — nobody asked you to be. But you're the one who's been talking to everyone. What you say, who you pull aside, whether you push or let things breathe — it's all going to matter in ways that won't be visible until later.`,
        friendRole: `Everyone came. That means something. But nobody knows exactly what the others know, and nobody knows how much the player knows. There's a version of tonight where it's just dinner. There's a version where something surfaces.`,
        llmContext: `This is the final chapter — the full group together for the first time since the screenshot incident. The player has had individual conversations with all five cast members and knows more than any single other person in the room. The tension is whether the player pushes for resolution or plays it safe. Responses should feel charged with everything that hasn't been said — careful, loaded, significant.`,
      },
    ],
  },

];

// ── Helpers ───────────────────────────────────────────────────────────

export function getStory(id) {
  return STORIES.find(s => s.id === id) ?? STORIES[0];
}

export function getNextChapter(story, progress) {
  const nextIndex = progress?.completedChapters?.length ?? 0;
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
export function buildStoryMemory(story, progress) {
  if (!progress?.events?.length) return '';
  const lines = progress.events.map(ev => {
    const ch   = story.chapters.find(c => c.index === ev.chapterIndex);
    const char = ch?.character ? getCharacter(story, ch.character) : null;
    const name = char?.name ?? 'the group';
    return `Chapter ${ev.chapterIndex + 1} (${name}): ${ev.summary}`;
  });
  return `Story so far:\n${lines.join('\n')}\n`;
}

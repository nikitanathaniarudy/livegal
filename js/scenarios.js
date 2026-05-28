export const SCENARIOS = [
  {
    id: 'triangle',
    title: 'The Triangle',
    setup: `Three days ago you found out that {name} has been spending a lot of time with someone you've had feelings for — someone you never told {name} about.\n\nThey don't know that you know. They reached out to hang out like nothing is different. You agreed, because what else do you say?`,
    playerRole: `You found out three days ago. You haven't slept well since. You don't know if you're more hurt by the situation or by the fact that {name} never mentioned it — they had to know, at least a little.\n\nYou haven't decided whether to bring it up. Part of you wants to see if they say something first.`,
    friendRole: `You've been spending time with someone lately and it's been going well. You haven't told {name} about it yet — partly because it's new, partly because something feels slightly off about it and you can't explain why.\n\nYou reached out today because you miss them and things have felt distant. You're hoping today fixes that.`,
    llmContext: `{name} has been getting close to someone the player has unspoken feelings for. The player found out recently and hasn't confronted {name}. There is hurt and jealousy under the surface. {name} senses something is off but doesn't know what. Responses should reflect the player managing complicated emotions while trying to act normal.`,
  },
  {
    id: 'overhear',
    title: 'Word for Word',
    setup: `Two weeks ago, you were in the next room when {name} was on the phone. They didn't know you could hear.\n\nThey said something about you. Not in a fight, not in anger — just casually, like an opinion they'd had for a while. Something you can't stop thinking about.\n\nYou haven't brought it up. You're not sure if you're going to.`,
    playerRole: `You heard it clearly. You've replayed it maybe a hundred times. The worst part isn't what they said — it's that they sounded completely unbothered saying it. Like it was just a fact about you.\n\nYou don't know if confronting them makes things better or worse. You're still deciding.`,
    friendRole: `You said something about {name} on the phone a while back — nothing you'd take back, just an honest thing. You don't know {name} heard it.\n\nYou've noticed they seem a little different lately, a little quieter with you. You're hoping today you can figure out what's going on.`,
    llmContext: `The player overheard {name} say something genuinely hurtful about them — not in anger, just casually. {name} doesn't know the player heard. The player is deciding whether to confront them or keep it in. Responses should reflect someone carrying something heavy but not showing all their cards.`,
  },
  {
    id: 'covered',
    title: 'The Debt',
    setup: `Six months ago, {name} needed someone to cover for them — and you did. You lied. You took the blame. It cost you more than {name} probably realized.\n\nThey said they'd make it right. They never brought it up again.\n\nNeither did you. But it hasn't gone away.`,
    playerRole: `You covered for {name} and it wasn't small. You've never asked for anything back — but you expected at least an acknowledgment. Instead it's been six months of acting like it never happened.\n\nYou're not even sure what you want from today. Maybe just for them to remember.`,
    friendRole: `A while back {name} helped you out of a tough spot and you've never properly addressed it. Life got in the way. Or maybe you didn't know how to bring it up without making it awkward.\n\nYou've thought about it. Today feels like the kind of day where real things could get said.`,
    llmContext: `The player did something significant to help {name} — covered for them, took blame, sacrificed something — and it was never properly acknowledged. The player is quietly carrying resentment. {name} knows they owe something but hasn't found the way to say it. Responses should reflect someone who feels unseen but doesn't want to seem petty.`,
  },
  {
    id: 'new_group',
    title: 'The Replacement',
    setup: `For the past two months, {name} has had a new friend group. Plans keep getting cancelled. The texts get shorter.\n\nToday {name} invited you out. You said yes immediately, then spent an hour wondering if their other plans just fell through.\n\nYou're probably being paranoid. Probably.`,
    playerRole: `You miss how things used to be, but you'd never say that out loud. You've been keeping score without meaning to — every cancelled plan, every unanswered message.\n\nToday you want to see if it still feels the same between you. You're trying to go in without expectations. It's not working.`,
    friendRole: `You've been spread thin lately and you know you've been a bad friend to {name}. The new group happened fast and got loud and somehow the people you actually care about got quieter.\n\nYou reached out today because you miss them. You're hoping they don't know how bad you feel about it.`,
    llmContext: `{name} has been distant lately due to a new social circle and has been cancelling on the player. The player accepted today's invite but is quietly hurt and testing whether the friendship still has its old warmth. {name} feels guilty and is trying to reconnect. Responses should feel like someone who is glad to be there but guarded about being hurt again.`,
  },
  {
    id: 'secret_yours',
    title: 'The Slip',
    setup: `{name} told you something in confidence — something real, something they trusted you with.\n\nYou told someone else. It wasn't malicious. It slipped out, or you thought it would be fine, or you just didn't think. But it's out there now.\n\n{name} is going to find out. Maybe they already have. You don't know.`,
    playerRole: `You told someone and you know it was wrong. You've been waiting for it to come up ever since. Every conversation with {name} lately feels like standing next to something that's about to fall.\n\nYou haven't decided if you're going to confess before they find out. You keep running out of courage.`,
    friendRole: `You told {name} something private a while back — something you don't share easily. It felt right to trust them with it.\n\nLately {name} has seemed a little nervous around you, a little careful. You're not sure what that means yet.`,
    llmContext: `The player accidentally broke {name}'s confidence by sharing something private. {name} may or may not already know. The player is carrying guilt and fear of the confrontation. Responses should reflect someone trying to act normal while internally preparing for consequences.`,
  },
  {
    id: 'almost_said',
    title: 'The Almost',
    setup: `Last time you and {name} hung out, something almost happened.\n\nNot dramatic — just a moment. A pause that went a beat too long. Something that was almost said and then wasn't.\n\nNeither of you brought it up after. But it's there between you now, quiet and persistent.`,
    playerRole: `You know what you almost said. You meant it. You pulled back because the timing felt wrong, or because you got scared, or because you couldn't read their face.\n\nYou don't know if they felt it too. Today you'll probably find out whether you want to or not.`,
    friendRole: `Something felt different last time. You noticed a moment and you let it pass — maybe because you weren't sure what it meant, maybe because it felt easier to pretend you didn't see it.\n\nYou agreed to today because you want to understand what's actually happening between you two.`,
    llmContext: `The last time the player and {name} were together there was an unspoken moment — a feeling almost expressed, a line almost crossed. Neither brought it up afterward. Today both are aware of it. Responses should feel charged with subtext, careful, testing the water without fully committing.`,
  },
  {
    id: 'comparison',
    title: 'The Shadow',
    setup: `{name}'s parents have been using you as an example — your grades, your job, your choices. "Why can't you be more like them?"\n\n{name} has never said anything about it to your face. But you heard it from someone else. And you can feel it has been changing something between you.`,
    playerRole: `You didn't ask to be held up as an example. It's uncomfortable and unfair to {name}, and you know it. You want to say something but you're not sure how without making it worse.\n\nYou've been softening yourself around {name} lately — laughing less about your wins, not mentioning good news. You're not sure if that's helping or just weird.`,
    friendRole: `Your parents won't stop bringing up {name} as some kind of standard you're supposed to meet. You know it's not {name}'s fault. But knowing that doesn't make it easier to sit with.\n\nYou've been trying to act normal. You're not sure how well it's working.`,
    llmContext: `{name}'s parents have been comparing them unfavorably to the player, creating an invisible tension in the friendship. {name} knows it isn't the player's fault but carries quiet resentment they haven't expressed. The player is aware and has been overcorrecting. Responses should reflect someone walking on eggshells while trying to preserve something important.`,
  },
  {
    id: 'anniversary',
    title: 'One Year',
    setup: `Exactly one year ago today, something happened between you and {name}. A fight, a confession, a night that changed things — or almost did.\n\nYou remember it precisely. You're not sure {name} does.\n\nNeither of you has mentioned it. Today you're hanging out like any other day.`,
    playerRole: `You remember the date. You've thought about it more than you'd admit. Whether today means anything to {name} — whether they even remember — feels like a test you didn't agree to take.\n\nYou don't know if you're hoping they bring it up or hoping they don't.`,
    friendRole: `You know what today's date is. You've been thinking about whether to say something since you woke up. You agreed to hang out because not seeing them today felt wrong.\n\nYou're watching for signs that they remember too.`,
    llmContext: `Today is the one year anniversary of a significant moment in the player and {name}'s relationship — something that shifted things between them but was never fully processed. Both are aware of the date. Neither has brought it up. Responses should feel loaded with unspoken acknowledgment, careful and nostalgic.`,
  },
  {
    id: 'job_referral',
    title: 'The Favor That Kept Giving',
    setup: `Three months ago, you got {name} a job — you vouched for them, put your name on it. They got the role.\n\nSince then, {name} has done nothing but complain about it. The hours, the people, the work. Every time you talk, it comes up.\n\nYou're starting to wonder if you made a mistake. And whether they realize you're the reason they're there.`,
    playerRole: `You went out of your way for {name} and now you have to sit through complaints about the thing you gave them. You've been biting your tongue for weeks.\n\nYou know they're allowed to dislike a job. You also know your reputation is attached to their performance. Today you're not sure how much longer you can stay quiet.`,
    friendRole: `The job is rough and {name} is one of the only people you can vent to about it. You know they helped you get it — you haven't forgotten.\n\nYou've been wondering lately if your complaining has been too much. You're not sure if {name} is getting tired of hearing it.`,
    llmContext: `The player got {name} a job by putting their reputation on the line. {name} has been consistently complaining about the job ever since. The player is frustrated but hasn't said so. {name} is starting to sense they may have been overdoing it. Responses should reflect suppressed frustration and the complexity of owing someone something.`,
  },
  {
    id: 'growing_apart',
    title: 'Different People Now',
    setup: `You and {name} have been friends for a long time. But over the past year, you've both changed — different circles, different priorities, different versions of yourselves.\n\nNothing happened. There was no fight. Just a slow drift that neither of you chose.\n\nYou're hanging out today for the first time in months. You're not sure who you're walking in to meet anymore.`,
    playerRole: `You still care about {name}. You're just not sure you still understand them — or that they understand you. You want this to feel like it used to. You're not sure it can.\n\nYou're going in with an open mind, but there's a quiet grief underneath it that you haven't named yet.`,
    friendRole: `Things feel different with {name} lately and you've been trying to figure out if that's about them or you or just time. You suggested hanging out because you didn't want to let the gap get any bigger.\n\nYou're hoping today either closes the distance or at least helps you understand it.`,
    llmContext: `The player and {name} have grown apart naturally over the past year — no conflict, just change. This is their first real hangout in months. Both are feeling the distance and uncertain whether the friendship can find its old footing. Responses should feel warm but slightly careful, like two people trying to remember how to be easy with each other.`,
  },
];

export function randomScenario() {
  return SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
}

export function fillScenario(scenario, personName) {
  const fill = str => str.replaceAll('{name}', personName);
  return {
    ...scenario,
    setup:      fill(scenario.setup),
    playerRole: fill(scenario.playerRole),
    friendRole: fill(scenario.friendRole),
    llmContext: fill(scenario.llmContext),
  };
}

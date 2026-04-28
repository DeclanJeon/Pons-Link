import { nanoid } from 'nanoid';
import type { CurrentFocus, InsightCardData, SelfUnderstandingCoreInput, SelfUnderstandingResult } from '../types/selfUnderstanding';

const focusSummaryMap: Record<CurrentFocus, string> = {
  traits: 'You tend to organize things internally first, then bring strength into relationships and action.',
  relationships: 'In relationships, trust and rhythm may matter more than speed.',
  growth: 'When things feel unstable, rebuilding your standard may fit better than rushing to a conclusion.',
  strengths: 'Your strengths may come alive more through clear meaning than through pressure.',
};

const timeModeTone = {
  exact: 'Your input is specific enough to read the detailed flow.',
  approximate: 'It is better to read the broad flow and keep the details flexible.',
  unknown: 'You can start with the default flow now and refine it later.',
};

const makeCard = (label: string, summary: string, interpretation: string, example: string, meaning: string, action: string, tags?: string[]): InsightCardData => ({
  id: nanoid(),
  label,
  summary,
  interpretation,
  example,
  meaning,
  action,
  tags,
});

export const generateSelfUnderstandingResult = (input: SelfUnderstandingCoreInput): SelfUnderstandingResult => {
  const focusSummary = focusSummaryMap[input.currentFocus];
  const tone = timeModeTone[input.birthTimeMode];

  return {
    generatedAt: new Date().toISOString(),
    overview: makeCard(
      'Core summary',
      focusSummary,
      `${tone} You may feel most comfortable when you define your inner standard before moving outward. That slower, more deliberate rhythm can become a strength when you give yourself room to understand before reacting.`,
      'For example, your ideas may land more naturally after you have had time to organize them instead of responding immediately in a crowded setting.',
      'This suggests that understanding may come before speed in both relationships and decisions.',
      'Before rushing a decision today, write down the one standard that makes the choice feel right to you.',
      ['Deep focus', 'Careful connection', 'Standard-led'],
    ),
    strengths: [
      makeCard(
        'When your strengths show up',
        'Your focus and persuasion can sharpen when the meaning is clear.',
        'When you know why something matters, immersion can deepen and that depth can become trust for the people around you.',
        'You may feel more stable in a role with clear context or in a project that feels personally meaningful.',
        'You are closer to someone who moves well when the context is organized, not merely when outcomes are demanded.',
        'Before listing tasks, write one sentence about why the work matters.',
        ['Meaning', 'Focus', 'Trust'],
      ),
    ],
    traits: [
      makeCard(
        'Core traits',
        focusSummary,
        'You may have a strong pattern of organizing things inwardly before acting outwardly. Because of that, understood choices and deeper connections can feel more natural than pure spontaneity or shallow contact.',
        'A slowly built relationship may feel more stable than one that becomes close too quickly.',
        'When describing yourself, depth and sincerity may fit better than speed or breadth.',
        'Today, try acknowledging one natural way you operate instead of forcing yourself to change it.',
      ),
      makeCard(
        'Strength activation point',
        'Your strengths may appear most clearly when you have time to think and a meaningful context.',
        'Immediate reactions can scatter your energy when things are unclear, but structured thinking can reveal strong focus.',
        'Writing notes before a meeting may help you speak more precisely than improvising on the spot.',
        'An environment that leaves room to organize your thoughts may fit better than one that only pushes harder.',
        'Before an important conversation or task, take five minutes to map your thoughts.',
        ['Organize', 'Immerse', 'Prepare'],
      ),
      makeCard(
        'Pattern under pressure',
        'Being rushed before you understand the situation can make you pressure yourself too much.',
        'This can look like low energy or over-control, but it is closer to a defensive pattern that appears when your standard gets shaken.',
        'When there are too many options and no clear criteria, you may freeze or cling too tightly to one option.',
        'The issue may be less about ability and more about a collapsed standard.',
        'Ask whether you are stuck because you do not know enough or because the choice still does not make sense to you.',
      ),
      makeCard(
        'Natural recovery style',
        'Recovery may feel more natural after you organize things privately and reconnect selectively.',
        'Instead of pressuring yourself to bounce back immediately, quietly revisiting your standard and choosing only necessary connections may fit better.',
        'A short time alone followed by a conversation with one trusted person may help you recover faster.',
        'For you, recovery may begin with organization and calm rather than stimulation.',
        'Take a short moment today not just to empty your mind, but to organize yourself.',
      ),
    ],
    relationships: [
      makeCard(
        'Relationship rhythm',
        'Slowly built trust may matter more than fast intimacy.',
        'Even if you seem quiet at first, deeper connection can appear once you feel safe enough to open up.',
        'You may feel more comfortable with someone who can have sincere conversations at important moments than with someone who contacts you constantly.',
        'The core of connection may be rhythm and sincerity rather than quantity.',
        'Before matching another person’s pace, notice the moment when you actually feel trust.',
      ),
      makeCard(
        'How comfort appears',
        'You may feel steady in relationships where there is room to explain and no pressure to perform.',
        'When you feel respected even before you have said everything, you may open up more naturally.',
        'A conversation that does not force a quick conclusion may feel especially comfortable.',
        'Comfort may come more from respect than from constant activity.',
        'Think of one conversation that felt comfortable today and write down why.',
      ),
      makeCard(
        'Likely friction point',
        'Friction may appear when someone reaches conclusions too quickly or pushes emotion too strongly.',
        'The issue may not be that the other person is cold or aggressive, but that your speeds and interpretation styles differ.',
        'If you are still thinking and someone demands an immediate answer, you may close off defensively.',
        'Relationship conflict may be about rhythm differences more than who is right or wrong.',
        'Try saying briefly that you need a little time before answering.',
      ),
      makeCard(
        'What to remember in conversation',
        'Separating the wish to be understood from the wish to solve things quickly can make conversations less tangled.',
        'If you first know whether you want empathy or a solution, you can ask the other person more clearly.',
        'A sentence like “Right now I want to be understood more than fixed” can stabilize a conversation.',
        'Conversation quality can rise from clear requests more than from more information.',
        'Before the next conversation, write one sentence about the kind of conversation you need.',
      ),
      makeCard(
        'Re-aligning after conflict',
        'After conflict, it may fit better to calmly see what went out of sync rather than decide everything immediately.',
        'Separating rhythm differences from expectation differences can make repair more possible.',
        'Instead of “they hurt me,” naming that “our pace was different” can make another attempt easier.',
        'Repair can start from reinterpretation, not from denying emotion.',
        'When revisiting a difficult moment, write it once as a rhythm difference instead of a judgment of the person.',
      ),
    ],
    growth: [
      makeCard(
        'Decision style',
        'You may sustain energy longer when the choice makes sense to you.',
        'A slower but convincing choice may fit better than a fast decision that only looks good from the outside.',
        'A direction you can explain to yourself may feel more stable than one others simply recommend.',
        'Your decision standard may be closer to understanding and sustainability than speed.',
        'For one decision today, write why you are choosing it before you decide.',
      ),
      makeCard(
        'Energy rhythm',
        'Busy, highly stimulating environments can drain you quickly.',
        'When the meaning is clear and the flow makes sense, your energy may last longer.',
        'A day with one or two deep priorities may feel better than a day split across many shallow tasks.',
        'Energy is influenced not only by stamina, but also by contextual fit.',
        'Leave only the most important task for today and reduce the rest one step at a time.',
      ),
      makeCard(
        'Reaction under instability',
        'When your standard becomes blurry, you may alternate between stopping and pushing too hard.',
        'That does not mean the season is bad; it may simply signal that your standard needs to be rebuilt first.',
        'You may delay a decision for a while, then suddenly want to cut everything off at once.',
        'Instability may be more useful when seen as a signal to re-align rather than as failure.',
        'Before treating discomfort only as a problem to fix, write down which standard disappeared.',
      ),
      makeCard(
        'How balance returns',
        'Balance may return when you subtract and rebuild standards rather than doing more.',
        'The moment you distinguish what matters from what can pause, mental noise can decrease.',
        'Choosing one standard to protect today may organize your energy better than trying to solve five tasks.',
        'Balance may come from clearer priorities, not from perfection.',
        'Leave one standard you do not want to lose today.',
      ),
      makeCard(
        'Today’s decision standard',
        'Right now, it may fit better to use your own understanding rather than someone else’s pace as the standard.',
        'When things shake, holding a standard you can keep may feel steadier than rushing toward the “right” answer.',
        'A question like “Does this choice make me clearer?” can become a useful standard.',
        'Today’s standard is closer to alignment than prediction.',
        'If you face a decision today, ask whether the choice makes you clearer.',
      ),
    ],
  };
};

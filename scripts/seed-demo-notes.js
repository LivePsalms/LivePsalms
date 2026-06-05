/* eslint-disable */
/**
 * Demo seed: 20 notes for showcasing the notepad.
 *
 * - Each note carries a stable ID so cross-note links resolve into graph edges.
 * - Bodies include real verse references (e.g. "John 15:5", "Psalm 23:1") which
 *   the editor's VERSE_REGEX picks up as scripture-reference edges.
 *
 * Usage:
 *   1. Open the running app in your browser.
 *   2. Open DevTools → Console.
 *   3. Paste the entire contents of this file and press Enter.
 *   4. Refresh the page.
 *
 * Safe to re-run: it APPENDS to any existing notes (it does not wipe).
 * To start fresh first, run:  localStorage.removeItem('notepad_notes')
 */
(() => {
  const NOTES_KEY = 'notepad_notes';

  const uuid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

  // Stable internal keys → UUIDs, so a note can reference another by key.
  const KEYS = [
    'psalm23','morning','prodigal','hesed','hurry','manna','psalm13','names',
    'beatitudes','quiet','exodusPattern','gratitude','resurrection','forgotten',
    'wisdom','breadFish','longObedience','sabbath','examen','vine',
  ];
  const ID = Object.fromEntries(KEYS.map((k) => [k, uuid()]));
  const TITLE = {
    psalm23: 'Psalm 23 — The Shepherd I Need',
    morning: 'Morning Prayer — May 5',
    prodigal: 'Sermon Notes — "The Prodigal Father"',
    hesed: 'Theme Study — Hesed (Steadfast Love)',
    hurry: 'Reflection — The Cost of Hurry',
    manna: 'Sermon Notes — "Mountain and Manna"',
    psalm13: 'Lament — Psalm 13',
    names: 'Theme Study — The Names of God',
    beatitudes: 'Sermon Notes — "Beatitudes, Reread"',
    quiet: 'Reflection — Quiet as a Discipline',
    exodusPattern: 'Theme Study — The Exodus Pattern',
    gratitude: 'Gratitude List — This Week',
    resurrection: 'Sermon Notes — "Resurrection Garden"',
    forgotten: 'Reflection — On Being Forgotten',
    wisdom: 'Theme Study — Wisdom in Proverbs',
    breadFish: 'Sermon Notes — "Bread and Fish"',
    longObedience: 'Reflection — The Long Obedience',
    sabbath: 'Theme Study — Sabbath',
    examen: 'Evening Examen',
    vine: 'Sermon Notes — "The Vine and the Branches"',
  };

  // ---- TipTap node helpers ----
  const text = (t, marks) => {
    const node = { type: 'text', text: t };
    if (marks) node.marks = marks;
    return node;
  };
  const bold = (t) => text(t, [{ type: 'bold' }]);
  const italic = (t) => text(t, [{ type: 'italic' }]);
  // noteLink mark: produces a graph edge from the containing note → targetKey
  const link = (label, targetKey) =>
    text(label, [{
      type: 'noteLink',
      attrs: { noteId: ID[targetKey], noteTitle: TITLE[targetKey] },
    }]);
  const p = (...children) => ({
    type: 'paragraph',
    content: children.length ? children.flat() : [text('')],
  });
  const h = (level, t) => ({
    type: 'heading',
    attrs: { level },
    content: [text(t)],
  });
  const li = (...children) => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content: children.length ? children.flat() : [text('')] }],
  });
  const ul = (...items) => ({ type: 'bulletList', content: items });
  const ol = (...items) => ({ type: 'orderedList', content: items });
  const quote = (t) => ({
    type: 'blockquote',
    content: [{ type: 'paragraph', content: [italic(t)] }],
  });
  const doc = (...nodes) => JSON.stringify({ type: 'doc', content: nodes });

  // ---- Word-count helper ----
  const countWords = (json) => {
    try {
      const parsed = JSON.parse(json);
      const walk = (n) => {
        if (!n) return '';
        if (n.type === 'text' && typeof n.text === 'string') return n.text + ' ';
        if (Array.isArray(n.content)) return n.content.map(walk).join(' ');
        return '';
      };
      const t = walk(parsed).trim();
      return t ? t.split(/\s+/).length : 0;
    } catch {
      return 0;
    }
  };

  // ---- 20 notes ----
  const seeds = [
    {
      key: 'psalm23',
      type: 'devotion',
      tags: ['psalms', 'comfort', 'shepherd'],
      nodes: [
        h(2, 'Psalm 23 — The Shepherd I Need'),
        p(bold('"The Lord is my shepherd; I shall not want." — Psalm 23:1')),
        p(text('I keep returning to this verse on the loud days. The image is small but it carries everything: a shepherd who knows the field, the weather, and the sheep. Provision is not a transaction here — it is presence.')),
        h(3, 'What I want to remember'),
        ul(
          li(text('Green pastures are not earned; they are led-into.')),
          li(text('Still waters get found by walking, not by striving.')),
          li(text('Even the dark valley is a path through, never a dead end. Psalm 23:4 is meant for the walking, not the watching.')),
        ),
        p(text('When the protest comes — and it does — I keep '), link('Psalm 13', 'psalm13'), text(' nearby. Trust without lament is just performance.')),
        p(text('And when I am tempted to rush even rest, '), link('The Cost of Hurry', 'hurry'), text(' reminds me that pasture has a pace.')),
        quote('I will dwell in the house of the Lord forever.'),
      ],
    },
    {
      key: 'morning',
      type: 'devotion',
      tags: ['prayer', 'morning'],
      nodes: [
        h(2, 'Morning Prayer'),
        p(text('Father, before the noise begins, quiet me. Before the inbox, before the calendar, before the list — quiet me.')),
        p(text('Let my first yes today be to you. Let my first listen be for you. Let my first word be a thank you. Lamentations 3:23 — your mercies are new this morning.')),
        p(text('At day\'s end I will return with the '), link('Evening Examen', 'examen'), text('.')),
        p(italic('Amen.')),
      ],
    },
    {
      key: 'prodigal',
      type: 'sermon',
      tags: ['luke-15', 'grace', 'sermon-notes'],
      nodes: [
        h(2, 'The Prodigal Father — Luke 15:11-32'),
        p(bold('Pastor: '), text('Rev. M. Anderson')),
        p(bold('Big idea: '), text('The scandal of the parable is not the son who left, but the father who runs.')),
        h(3, 'Outline'),
        ol(
          li(text('A son who wanted the inheritance more than the father.')),
          li(text('A father who watched the road every day. Luke 15:20 — "while he was still a long way off…"')),
          li(text('A robe, a ring, sandals — restoration, not probation.')),
          li(text('An older brother whose obedience hid his distance.')),
        ),
        p(text('This is '), link('hesed', 'hesed'), text(' in narrative form — covenant love that runs.')),
        h(3, 'Quote to keep'),
        quote('"While he was still a long way off, his father saw him and was filled with compassion." — v.20'),
      ],
    },
    {
      key: 'hesed',
      type: 'theme',
      tags: ['hebrew', 'love', 'word-study'],
      nodes: [
        h(2, 'Hesed — חֶסֶד'),
        p(text('A covenant word. Not affection that fades when convenient — loyalty that stays when it costs.')),
        h(3, 'Where it shows up'),
        ul(
          li(text('Psalm 136:1 — "his hesed endures forever" (and 25 more times in the same psalm).')),
          li(text('Ruth — Boaz toward Naomi and Ruth.')),
          li(text('Hosea 2:19 — God toward an unfaithful Israel.')),
        ),
        p(text('English needs three words to translate it: '), bold('love'), text(', '), bold('mercy'), text(', '), bold('faithfulness'), text('. Maybe that is the point — no single word in our language can carry it alone.')),
        p(text('Hesed is the lens through which '), link('the Prodigal Father', 'prodigal'), text(' makes sense. It is also the engine behind the '), link('Names of God', 'names'), text('.')),
      ],
    },
    {
      key: 'hurry',
      type: 'devotion',
      tags: ['rest', 'sabbath', 'reflection'],
      nodes: [
        h(2, 'The Cost of Hurry'),
        p(text('Hurry is not the same as productivity. I confused them for years.')),
        p(text('Jesus walked. He walked between cities. He walked away from crowds. He walked toward the cross. None of it was hurried, and all of it was on time. Mark 6:31 — "come away by yourselves and rest a while."')),
        p(text('The cure is not slowness for its own sake; it is the discipline of '), link('quiet', 'quiet'), text(' and the practice of '), link('Sabbath', 'sabbath'), text('.')),
        quote('Ruthlessly eliminate hurry from your life. — Dallas Willard'),
      ],
    },
    {
      key: 'manna',
      type: 'sermon',
      tags: ['exodus', 'sermon-notes'],
      nodes: [
        h(2, 'Mountain and Manna'),
        p(bold('Text: '), text('Exodus 16:4')),
        p(text('Bread that comes daily and cannot be hoarded. The lesson is in the perishability — God meant for us to come back.')),
        h(3, 'Three movements'),
        ol(
          li(text('Grumbling in the wilderness.')),
          li(text('Bread from heaven, measured by need.')),
          li(text('A Sabbath built into the gathering itself — see '), link('Sabbath', 'sabbath'), text('.')),
        ),
        p(text('Manna sits inside the larger '), link('Exodus Pattern', 'exodusPattern'), text('. And the multiplication motif returns at '), link('Bread and Fish', 'breadFish'), text('.')),
      ],
    },
    {
      key: 'psalm13',
      type: 'devotion',
      tags: ['psalms', 'lament'],
      nodes: [
        h(2, 'Psalm 13 — How Long, O Lord?'),
        quote('How long, O Lord? Will you forget me forever? — Psalm 13:1'),
        p(text('What surprises me about Psalm 13 is the turn. It begins in protest and ends in trust — but the trust is not pretended. The psalmist does not bury the question; he carries it into the answer.')),
        p(italic('"But I have trusted in your steadfast love." — Psalm 13:5')),
        p(text('Read alongside '), link('Psalm 23', 'psalm23'), text(', it makes the green pastures honest.')),
      ],
    },
    {
      key: 'names',
      type: 'theme',
      tags: ['names-of-god', 'theology'],
      nodes: [
        h(2, 'The Names of God'),
        p(text('A name in scripture is rarely a label — it is a revelation. Each name is a doorway into something true about God. Exodus 3:14 — "I AM WHO I AM."')),
        ul(
          li(text('Yahweh — I AM. The self-existent one.')),
          li(text('El Shaddai — God Almighty, sufficient.')),
          li(text('Jehovah Jireh — The Lord will provide. Genesis 22:14.')),
          li(text('Jehovah Rapha — The Lord who heals.')),
          li(text('Jehovah Shalom — The Lord is peace.')),
          li(text('Adonai — Lord, Master.')),
          li(text('Immanuel — God with us.')),
        ),
        p(text('Each name is '), link('hesed', 'hesed'), text(' under another angle.')),
      ],
    },
    {
      key: 'beatitudes',
      type: 'sermon',
      tags: ['matthew-5', 'sermon-on-the-mount', 'sermon-notes'],
      nodes: [
        h(2, 'Beatitudes, Reread'),
        p(text('A blessing is not a reward. It is a declaration. Jesus is not telling us how to earn favor — he is telling us where favor already rests. Matthew 5:3 onward.')),
        h(3, 'A list, slowly'),
        ul(
          li(text('Blessed are the poor in spirit — those who know they are not enough.')),
          li(text('Blessed are those who mourn — those who do not pretend the world is fine.')),
          li(text('Blessed are the meek — those who do not need to win the room.')),
          li(text('Blessed are those who hunger for righteousness — the appetite carried by '), link('Wisdom in Proverbs', 'wisdom'), text('.')),
        ),
        p(text('The beatitudes are the long arc of '), link('the Long Obedience', 'longObedience'), text(' — and they read like '), link('the Vine and the Branches', 'vine'), text(' from a different angle.')),
      ],
    },
    {
      key: 'quiet',
      type: 'devotion',
      tags: ['silence', 'discipline'],
      nodes: [
        h(2, 'Quiet as a Discipline'),
        p(text('I used to think silence was the absence of sound. It is actually the presence of attention. Psalm 46:10 — "be still, and know that I am God."')),
        p(text('Five minutes a day, no input — no podcast, no scrolling, no music. Just sit. The first week is brutal. The second week, something shifts.')),
        p(text('It is the same posture I bring to the '), link('Evening Examen', 'examen'), text(', and the antidote to '), link('hurry', 'hurry'), text('.')),
      ],
    },
    {
      key: 'exodusPattern',
      type: 'theme',
      tags: ['exodus', 'typology'],
      nodes: [
        h(2, 'The Exodus Pattern'),
        p(text('Slavery → deliverance → wilderness → covenant → land. This shape repeats through scripture — and through a life of faith. Exodus 14:14 names the posture: "the Lord will fight for you, and you have only to be silent."')),
        ol(
          li(text('Egypt: the place we cannot free ourselves from.')),
          li(text('Red Sea: the deliverance we did not build.')),
          li(text('Wilderness: the long unlearning of slave habits — see '), link('Mountain and Manna', 'manna'), text('.')),
          li(text('Sinai: the covenant that names us as a people.')),
          li(text('Land: the promise lived in, not just longed for.')),
        ),
        p(text('Built into the covenant is '), link('Sabbath', 'sabbath'), text(' — a weekly rehearsal of liberation.')),
      ],
    },
    {
      key: 'gratitude',
      type: 'devotion',
      tags: ['gratitude', 'weekly'],
      nodes: [
        h(2, 'Gratitude — This Week'),
        p(text('1 Thessalonians 5:18 — "give thanks in all circumstances." A practice I am still learning.')),
        ul(
          li(text('A walk at dusk with no phone.')),
          li(text('Coffee on the porch before anyone else was awake.')),
          li(text('A friend who asked the second question.')),
          li(text('Rain heavy enough to slow the day down.')),
          li(text('A passage I had read fifty times that broke open new.')),
        ),
        p(text('Gratitude is the daily face of '), link('the Long Obedience', 'longObedience'), text('.')),
      ],
    },
    {
      key: 'resurrection',
      type: 'sermon',
      tags: ['john-20', 'easter', 'sermon-notes'],
      nodes: [
        h(2, 'Resurrection Garden — John 20'),
        p(text('Mary mistook him for the gardener. The text often calls this an error. I am not so sure. John 20:16 — "Mary." She turned and said, "Rabbouni!"')),
        p(text('The first garden ended in exile. This one begins in recognition. He '), italic('is'), text(' the gardener — the one who replants what was lost.')),
        p(text('It echoes '), link('the Beatitudes', 'beatitudes'), text(' — those who mourn '), italic('shall'), text(' be comforted. And it answers the ache in '), link('On Being Forgotten', 'forgotten'), text('.')),
      ],
    },
    {
      key: 'forgotten',
      type: 'devotion',
      tags: ['identity', 'reflection'],
      nodes: [
        h(2, 'On Being Forgotten'),
        p(text('Most of the people in scripture are unnamed. The boy with the loaves. The woman at the well. The man let down through the roof.')),
        p(text('Isaiah 49:15 — "Can a woman forget her nursing child… even these may forget, yet I will not forget you."')),
        p(text('I find that comforting. The story does not need my name to remember me. The same Lord who calls Mary by name in '), link('the resurrection garden', 'resurrection'), text(' is calling.')),
      ],
    },
    {
      key: 'wisdom',
      type: 'theme',
      tags: ['proverbs', 'wisdom'],
      nodes: [
        h(2, 'Wisdom in Proverbs'),
        p(text('Wisdom in Proverbs is not knowledge. It is skill — the skill of living well with what is true. Proverbs 9:10 — "the fear of the Lord is the beginning of wisdom."')),
        h(3, 'Three contrasts the book keeps drawing'),
        ul(
          li(text('Wise vs. foolish.')),
          li(text('Diligent vs. slothful.')),
          li(text('Righteous vs. wicked.')),
        ),
        p(text('The contrasts are not flattering categories — they are mirrors. Read slowly. The hunger Jesus blesses in '), link('the Beatitudes', 'beatitudes'), text(' is the same hunger Proverbs forms.')),
      ],
    },
    {
      key: 'breadFish',
      type: 'sermon',
      tags: ['john-6', 'sermon-notes'],
      nodes: [
        h(2, 'Bread and Fish — John 6'),
        p(text('Five loaves, two fish, twelve baskets left over. The math does not work, and that is exactly the point. John 6:11.')),
        h(3, 'What I am taking home'),
        ol(
          li(text('What I bring is not the limit; what he does with it is.')),
          li(text('The leftovers are evidence — they outlive the meal. Same logic as '), link('Mountain and Manna', 'manna'), text('.')),
          li(text('The crowd was fed, but the disciples handed it out. Connection, not effort — see '), link('the Vine and the Branches', 'vine'), text('.')),
        ),
      ],
    },
    {
      key: 'longObedience',
      type: 'devotion',
      tags: ['perseverance', 'discipleship'],
      nodes: [
        h(2, 'The Long Obedience'),
        p(text('Eugene Peterson called the Christian life '), italic('a long obedience in the same direction'), text('. I felt that this morning. Hebrews 12:1 — "let us run with endurance the race set before us."')),
        p(text('There is no shortcut to becoming a person who keeps showing up. The only way is the slow way. The good news is that the slow way actually works.')),
        p(text('The shape of it is '), link('the Beatitudes', 'beatitudes'), text(' lived out across years; the daily fuel is '), link('gratitude', 'gratitude'), text('.')),
      ],
    },
    {
      key: 'sabbath',
      type: 'theme',
      tags: ['sabbath', 'rest', 'theology'],
      nodes: [
        h(2, 'Sabbath'),
        p(text('Sabbath is not a reward for the productive. It is a refusal to define ourselves by production.')),
        h(3, 'Two reasons given in scripture'),
        ol(
          li(text('Genesis 2:2 — God rested. We are made in that image.')),
          li(text('Deuteronomy 5:15 — we were slaves. We do not return to that yoke.')),
        ),
        p(text('Creation and liberation. Sabbath holds them together. It is the antidote to '), link('hurry', 'hurry'), text(' and the heart of '), link('the Exodus Pattern', 'exodusPattern'), text('.')),
      ],
    },
    {
      key: 'examen',
      type: 'devotion',
      tags: ['examen', 'prayer', 'evening'],
      nodes: [
        h(2, 'Evening Examen'),
        ol(
          li(text('Where did I sense gratitude today?')),
          li(text('Where did I sense resistance, and what was underneath it?')),
          li(text('Where did I love, and where did I withhold love?')),
          li(text('What is one thing I want to bring into tomorrow?')),
        ),
        p(italic('"Search me, O God, and know my heart." — Psalm 139:23')),
        p(text('Pair with the '), link('Morning Prayer', 'morning'), text(' to bookend the day, and with '), link('Quiet as a Discipline', 'quiet'), text(' to make space for the listening.')),
      ],
    },
    {
      key: 'vine',
      type: 'sermon',
      tags: ['john-15', 'abide', 'sermon-notes'],
      nodes: [
        h(2, 'The Vine and the Branches — John 15'),
        p(bold('Key word: '), italic('abide.')),
        p(text('Abiding is not striving. It is staying. The fruit comes from the connection, not the effort. John 15:5 — "apart from me you can do nothing."')),
        h(3, 'Where I tend to disconnect'),
        ul(
          li(text('When I am too busy to be still — see '), link('The Cost of Hurry', 'hurry'), text('.')),
          li(text('When I am ashamed and try to fix it on my own first.')),
          li(text('When success makes me forget I am a branch and not a root.')),
        ),
        p(text('Same lesson as '), link('Bread and Fish', 'breadFish'), text(': what I bring is not the limit.')),
        quote('"Apart from me you can do nothing." — v.5'),
      ],
    },
  ];

  const now = new Date();
  const newNotes = seeds.map((s, i) => {
    const content = doc(...s.nodes);
    const created = new Date(now.getTime() - (seeds.length - i) * 1000 * 60 * 60 * 6).toISOString();
    return {
      id: ID[s.key],
      title: TITLE[s.key],
      content,
      folderId: 'root',
      type: s.type,
      tags: s.tags,
      wordCount: countWords(content),
      createdAt: created,
      updatedAt: created,
    };
  });

  const existing = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
  // Drop any prior demo notes that share the new IDs (re-runs).
  const newIds = new Set(newNotes.map((n) => n.id));
  const filtered = existing.filter((n) => !newIds.has(n.id));
  const combined = filtered.concat(newNotes);
  localStorage.setItem(NOTES_KEY, JSON.stringify(combined));

  console.log(
    `[seed] Added ${newNotes.length} demo notes. Total now: ${combined.length}. Refresh to see them.`
  );
})();

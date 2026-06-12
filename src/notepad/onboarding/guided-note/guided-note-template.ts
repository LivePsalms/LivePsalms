/** A first-study note seeded with inline "try it" prompts. content is TipTap
 *  doc JSON stringified — the shape StorageAdapter.createNote stores. */
export function buildGuidedNote(): { title: string; content: string } {
  const doc = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Your first study note' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Welcome! This note walks you through three things that make studying here powerful. Edit freely — it is yours.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '1. Link a verse — type a reference like John 3:16 and it becomes a living link.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '2. Highlight a line — select any text and pick a highlight color from the toolbar.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '3. Ask Lamplight — open the Lamplight panel to discover connections to your other notes.' }] },
    ],
  };
  return { title: 'Your first study note', content: JSON.stringify(doc) };
}

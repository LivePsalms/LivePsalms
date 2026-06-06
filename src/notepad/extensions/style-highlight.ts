import { Mark, mergeAttributes } from '@tiptap/core';
import { getStyleAsset } from '../styles/manifest';

export function highlightBackgroundStyle(displayUrl: string | undefined): string {
  if (!displayUrl) return '';
  return (
    `background-image:url(${displayUrl});` +
    'background-size:100% 100%;' +
    'background-repeat:no-repeat;' +
    'border-radius:3px;' +
    'padding:0 2px;' +
    '-webkit-box-decoration-break:clone;' +
    'box-decoration-break:clone;'
  );
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    styleHighlight: {
      setStyleHighlight: (swatchId: string) => ReturnType;
      unsetStyleHighlight: () => ReturnType;
      toggleStyleHighlight: (swatchId: string) => ReturnType;
    };
  }
}

export const StyleHighlight = Mark.create({
  name: 'styleHighlight',

  addAttributes() {
    return {
      swatchId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-style-highlight'),
        renderHTML: (attrs) => ({ 'data-style-highlight': attrs.swatchId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-style-highlight]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const swatchId = HTMLAttributes['data-style-highlight'] as string | undefined;
    const asset = swatchId ? getStyleAsset(swatchId) : undefined;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        style: highlightBackgroundStyle(asset?.displayUrl),
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setStyleHighlight:
        (swatchId) =>
        ({ commands }) =>
          commands.setMark(this.name, { swatchId }),
      unsetStyleHighlight:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
      toggleStyleHighlight:
        (swatchId) =>
        ({ commands }) =>
          commands.toggleMark(this.name, { swatchId }),
    };
  },
});

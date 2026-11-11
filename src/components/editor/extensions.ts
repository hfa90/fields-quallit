import { Node, mergeAttributes, type Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { TableKit } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Youtube from '@tiptap/extension-youtube'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import { lowlight, type CalloutType } from './shared'
export { lowlight, CALLOUTS, type CalloutType } from './shared'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type: CalloutType) => ReturnType
      toggleCallout: (type: CalloutType) => ReturnType
    }
  }
}

/** Bloco de destaque: Info / Dica / Atenção / Cuidado / Resultado */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: el => el.getAttribute('data-callout') || 'info',
        renderHTML: attrs => ({ 'data-callout': attrs.type, class: `callout callout-${attrs.type}` }),
      },
    }
  },
  parseHTML() { return [{ tag: 'div[data-callout]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes), 0] },
  addCommands() {
    return {
      setCallout: type => ({ commands }) => commands.wrapIn(this.name, { type }),
      toggleCallout: type => ({ commands, editor }) =>
        editor.isActive(this.name, { type }) ? commands.lift(this.name) : commands.wrapIn(this.name, { type }),
    }
  },
})

export function buildExtensions(placeholder?: string): Extensions {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' } },
    }),
    Image.configure({ allowBase64: false, HTMLAttributes: { loading: 'lazy' } }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    TableKit.configure({ table: { resizable: true } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Youtube.configure({ nocookie: true, width: 640, height: 360 }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'plaintext' }),
    Typography,
    Callout,
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') return 'Título da seção'
        return placeholder ?? 'Escreva aqui… use "/" ou a barra de ferramentas para formatar'
      },
    }),
  ]
}

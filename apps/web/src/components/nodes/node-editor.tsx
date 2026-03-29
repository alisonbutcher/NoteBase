'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef } from 'react';

interface NodeEditorProps {
  content: string;
  placeholder?: string;
  autoFocus?: boolean;
  onSave: (content: string) => void;
  onEnter?: () => void;
  onDelete?: () => void;
}

export function NodeEditor({
  content,
  placeholder = 'Write something…',
  autoFocus = false,
  onSave,
  onEnter,
  onDelete,
}: NodeEditorProps) {
  const savedContent = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable block-level features we don't need per-node
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      handleKeyDown(view, event) {
        // Enter = save + create new node
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          const text = view.state.doc.textContent;
          onSave(text);
          onEnter?.();
          return true;
        }
        // Backspace on empty node = delete
        if (event.key === 'Backspace') {
          const { empty } = view.state.selection;
          const text = view.state.doc.textContent;
          if (empty && text.length === 0) {
            event.preventDefault();
            onDelete?.();
            return true;
          }
        }
        return false;
      },
    },
    onBlur({ editor }) {
      const text = editor.getText();
      if (text !== savedContent.current) {
        savedContent.current = text;
        onSave(text);
      }
    },
  });

  // Sync external content changes (e.g. after save/reload)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getText();
    if (current !== content && content !== savedContent.current) {
      editor.commands.setContent(content);
      savedContent.current = content;
    }
  }, [content, editor]);

  return <EditorContent editor={editor} className="flex-1 min-w-0" />;
}

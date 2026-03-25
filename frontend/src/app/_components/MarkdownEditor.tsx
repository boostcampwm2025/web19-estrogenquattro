"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";

interface MarkdownEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
}

export default function MarkdownEditor({
  content,
  onChange,
  placeholder = "내용을 입력하세요...",
  className = "",
}: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
    onUpdate: ({ editor: updatedEditor }) => {
      const md = updatedEditor.storage.markdown.getMarkdown() as string;
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[180px] px-3 py-2 text-sm",
      },
      handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
        event.stopPropagation();
        return false;
      },
    },
  });

  // Sync external content changes (e.g. reset after submit)
  useEffect(() => {
    if (!editor) return;
    const currentMd = editor.storage.markdown.getMarkdown();
    if (content !== currentMd) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* 툴바 */}
      <div className="border-retro-border-darker flex flex-wrap items-center gap-1 border-b-2 bg-amber-50 px-2 py-1">
        <ToolbarButton
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          label="H1"
        />
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          label="H2"
        />
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          label="H3"
        />
        <ToolbarDivider />
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="B"
          shortcut="Ctrl+B"
          bold
        />
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="I"
          shortcut="Ctrl+I"
          italic
        />
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="S"
          shortcut="Ctrl+Shift+X"
          strike
        />
        <ToolbarDivider />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="• 목록"
        />
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="1. 목록"
        />
        <ToolbarDivider />
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="인용"
        />
        <ToolbarButton
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          label="코드"
        />
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          label="—"
        />
      </div>

      {/* 에디터 */}
      <EditorContent
        editor={editor}
        className="tiptap-editor flex-1 overflow-y-auto"
      />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  shortcut,
  bold,
  italic,
  strike,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  shortcut?: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`cursor-pointer rounded px-1.5 py-0.5 text-xs transition-colors ${
        active
          ? "bg-amber-300 font-bold text-amber-900"
          : "text-amber-700 hover:bg-amber-200"
      } ${bold ? "font-bold" : ""} ${italic ? "italic" : ""} ${strike ? "line-through" : ""}`}
    >
      {label}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-4 w-px bg-amber-300" />;
}

// Inline CMS text editor. When admin isEditing, clicking this renders the
// text as contentEditable. On blur it saves to the server (PATCH /api/content).
// Non-admin users see a plain render with zero extra DOM.

import { useRef, type ElementType, type ReactNode } from 'react';
import { useFriendsList } from '../lib/state';

interface Props {
  contentKey: string;
  fallback: string;
  tag?: ElementType;
  className?: string;
  multiline?: boolean;
  children?: ReactNode;
}

export function EditableText({
  contentKey,
  fallback,
  tag: Tag = 'span',
  className,
  multiline = false,
}: Props) {
  const { isEditing, siteContent, updateContent } = useFriendsList();
  const ref = useRef<HTMLElement>(null);
  const value = siteContent[contentKey] ?? fallback;

  function onBlur() {
    if (!ref.current) return;
    const next = ref.current.textContent?.trim() ?? '';
    if (!next) { ref.current.textContent = value; return; }
    if (next !== value) {
      updateContent(contentKey, next).catch(() => {
        if (ref.current) ref.current.textContent = value;
      });
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!multiline && e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
    if (e.key === 'Escape') {
      if (ref.current) ref.current.textContent = value;
      (e.currentTarget as HTMLElement).blur();
    }
  }

  const editClass = isEditing ? `${className ?? ''} editable-field`.trim() : className;

  return (
    <Tag
      ref={ref as React.RefObject<HTMLElement & HTMLDivElement & HTMLParagraphElement>}
      className={editClass || undefined}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onBlur={isEditing ? onBlur : undefined}
      onKeyDown={isEditing ? onKeyDown : undefined}
    >
      {value}
    </Tag>
  );
}

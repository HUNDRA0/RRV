import { useEffect, useRef } from 'react';

interface EditableProps {
  value: string;
  onChange: (next: string) => void;
  edit: boolean;
  className?: string;
  placeholder?: string;
  as?: 'div' | 'span' | 'h2';
}

export function Editable({ value, onChange, edit, className, placeholder, as = 'div' }: EditableProps) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value || '';
    }
  }, [value]);
  const Tag = as;
  return (
    <Tag
      // @ts-expect-error - ref typing across element variants
      ref={ref}
      contentEditable={edit}
      suppressContentEditableWarning
      className={className}
      data-placeholder={placeholder}
      onBlur={(e: React.FocusEvent<HTMLElement>) => onChange(e.currentTarget.innerText)}
      spellCheck={false}
    />
  );
}

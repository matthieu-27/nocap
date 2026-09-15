import type { ReactElement } from 'react';

import { Input } from './ui/input';
import { Label } from './ui/label';

interface AuthFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}

// The labeled field row shared by every auth form field (frame 04 field
// shapes) — Label + Input with the same gap rhythm.
export function AuthField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = true,
}: AuthFieldProps): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

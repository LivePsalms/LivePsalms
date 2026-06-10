import { evaluatePassword } from './password-rules';

export interface PasswordChecklistProps {
  password: string;
}

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  const rules = evaluatePassword(password);
  return (
    <ul className="flex flex-col gap-1 mt-1" aria-label="Password requirements">
      {rules.map((r) => (
        <li
          key={r.id}
          data-met={r.met}
          className="flex items-center gap-2 text-[11px]"
          style={{
            color: r.met ? '#27ae60' : 'var(--silica)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          <span aria-hidden="true">{r.met ? '✓' : '○'}</span>
          {r.label}
        </li>
      ))}
    </ul>
  );
}

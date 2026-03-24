import { ReactNode } from 'react';

export function SettingsSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2">
      <h4>{children}</h4>
    </div>
  );
}

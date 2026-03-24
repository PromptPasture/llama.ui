import { Input, Label } from '../../../components';
import { LabeledField } from './LabeledField';
import { BaseInputProps } from './types';

export function SettingsModalCheckbox({
  field,
  value,
  onChange,
}: BaseInputProps & { value: boolean }) {
  return (
    <LabeledField configKey={field.translateKey || field.key}>
      {({ label, note }) => (
        <Label variant="form-control" className="mb-3">
          <div className="flex flex-row items-center mb-1">
            <Input
              variant="toggle"
              checked={value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={field.disabled}
            />
            <span className="ml-2">{label}</span>
          </div>
          {note && (
            <div
              className="text-xs opacity-75 max-w-80 mt-1"
              dangerouslySetInnerHTML={{ __html: note }}
            />
          )}
        </Label>
      )}
    </LabeledField>
  );
}

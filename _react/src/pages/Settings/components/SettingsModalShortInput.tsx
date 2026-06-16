import { Input, Label } from '../../../components';
import { CONFIG_DEFAULT } from '../../../config';
import { LabeledField } from './LabeledField';
import { BaseInputProps } from './types';

export function SettingsModalShortInput({
  field,
  value,
  onChange,
}: BaseInputProps & { value: string | number }) {
  return (
    <LabeledField configKey={field.translateKey || field.key}>
      {({ label, note }) => (
        <Label variant="form-control" className="mb-3">
          <div tabIndex={0} role="button" className="font-bold mb-1 md:hidden">
            {label}
          </div>
          <Label variant="input-bordered" className="mb-1">
            <div
              tabIndex={0}
              role="button"
              className="font-bold hidden md:block"
            >
              {label}
            </div>
            <Input
              className="grow"
              placeholder={`Default: ${CONFIG_DEFAULT[field.key] || 'none'}`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={field.disabled}
            />
          </Label>
          {note && (
            <div
              className="text-xs opacity-75 max-w-80"
              dangerouslySetInnerHTML={{ __html: note }}
            />
          )}
        </Label>
      )}
    </LabeledField>
  );
}

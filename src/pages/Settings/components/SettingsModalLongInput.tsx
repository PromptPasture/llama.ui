import { Label, TextArea } from '../../../components';
import { CONFIG_DEFAULT } from '../../../config';
import { LabeledField } from './LabeledField';
import { BaseInputProps } from './types';

export function SettingsModalLongInput({
  field,
  value,
  onChange,
}: BaseInputProps & { value: string }) {
  return (
    <LabeledField configKey={field.translateKey || field.key}>
      {({ label, note }) => (
        <Label variant="form-control" className="max-w-80 mb-3">
          <div className="text-sm opacity-60 mb-1">{label}</div>
          <TextArea
            size="default"
            placeholder={`Default: ${CONFIG_DEFAULT[field.key] || 'none'}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={field.disabled}
          />
          {note && (
            <div
              className="text-xs opacity-75 mt-1"
              dangerouslySetInnerHTML={{ __html: note }}
            />
          )}
        </Label>
      )}
    </LabeledField>
  );
}

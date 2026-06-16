import { useMemo } from 'react';
import { Input, Label } from '../../../components';
import { LabeledField } from './LabeledField';
import { BaseInputProps } from './types';

export function SettingsModalRangeInput({
  field,
  value,
  min,
  max,
  step,
  onChange,
}: BaseInputProps & {
  value: number;
  min: number;
  max: number;
  step: number;
}) {
  const values = useMemo(() => {
    const fractionDigits =
      Math.floor(step) === step ? 0 : step.toString().split('.')[1].length || 0;

    const length = Math.floor((max - min) / step) + 1;
    return Array.from({ length }, (_, i) =>
      Number(min + i * step).toFixed(fractionDigits)
    );
  }, [max, min, step]);

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
            <div className="grow px-2">
              <Input
                className="range-xs [--range-fill:0]"
                variant="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={field.disabled}
              />
              <div className="flex justify-between text-xs">
                {values.map((v) => (
                  <span key={v}>{v}</span>
                ))}
              </div>
            </div>
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

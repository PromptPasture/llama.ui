import { useEffect, useMemo } from 'react';
import { Dropdown, Label } from '../../../components';
import { DropdownOption } from '../../../types/settings';
import { normalizeUrl } from '../../../utils/url-helpers';
import { LabeledField } from './LabeledField';
import { BaseInputProps } from './types';

export function SettingsModalDropdown({
  field,
  options,
  filterable = false,
  value,
  onChange,
}: BaseInputProps & {
  options: DropdownOption[];
  filterable?: boolean;
  value: string;
}) {
  const renderOption = (option: DropdownOption) => (
    <span className="truncate">
      {option.icon && (
        <img
          src={normalizeUrl(option.icon, import.meta.env.BASE_URL)}
          className="inline h-5 w-5 mr-2"
        />
      )}
      {option.label}
    </span>
  );

  const disabled = useMemo(() => options.length < 2, [options]);
  const selectedValue = useMemo(() => {
    const selectedOption = options.find((option) => option.value === value);
    return selectedOption ? (
      <span className="max-w-48 truncate text-nowrap">
        {selectedOption.label}
      </span>
    ) : (
      ''
    );
  }, [options, value]);

  useEffect(() => {
    if (
      options.length > 0 &&
      !options.some((option) => option.value === value)
    ) {
      onChange(options[0].value);
    }
  }, [options, value, onChange]);

  return (
    <LabeledField configKey={field.translateKey || field.key}>
      {({ label, note }) => (
        <div className="form-control flex flex-col justify-center mb-3">
          <div className="font-bold mb-1 md:hidden">{label}</div>
          <Label
            className={disabled ? 'bg-base-200' : ''}
            variant="input-bordered"
          >
            <div className="font-bold hidden md:block">{label}</div>

            <Dropdown
              className="grow"
              entity={field.key}
              options={options}
              filterable={filterable}
              optionsSize={filterable ? 'small' : 'medium'}
              currentValue={selectedValue}
              renderOption={renderOption}
              isSelected={(option) => value === option.value}
              onSelect={(option) => onChange(option.value)}
            />
          </Label>

          {note && (
            <div
              className="text-xs opacity-75 max-w-80"
              dangerouslySetInnerHTML={{ __html: note }}
            />
          )}
        </div>
      )}
    </LabeledField>
  );
}

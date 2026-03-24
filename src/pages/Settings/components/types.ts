import { SettingFieldInput } from '../../../types/settings';

export interface BaseInputProps {
  field: SettingFieldInput;
  onChange: (value: string | number | boolean) => void;
}

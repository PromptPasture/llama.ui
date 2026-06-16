import type { ConfigurationKey } from '.';

export enum SettingInputType {
  SHORT_INPUT,
  LONG_INPUT,
  RANGE_INPUT,
  CHECKBOX,
  DROPDOWN,
  CUSTOM,
  SECTION,
}

export type SettingFieldInputType = Exclude<
  SettingInputType,
  SettingInputType.CUSTOM | SettingInputType.SECTION
>;

export interface BaseSettingField {
  key: ConfigurationKey;
  disabled?: boolean;
  translateKey?: string;
  [key: string]: unknown;
}

export interface SettingFieldInput extends BaseSettingField {
  type: SettingFieldInputType;
}

export interface DropdownOption {
  value: string | number;
  label: string;
  icon?: string;
}

export interface SettingFieldDropdown extends BaseSettingField {
  type: SettingInputType.DROPDOWN;
  options: DropdownOption[];
  filterable: boolean;
}

export type SettingField = SettingFieldInput | SettingFieldDropdown;

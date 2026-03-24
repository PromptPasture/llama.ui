import { ReactElement, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface LabeledFieldProps {
  children: (props: LabeledFieldState) => ReactNode;
  configKey: string;
}

interface LabeledFieldState {
  label: string | ReactElement;
  note?: string | TrustedHTML;
}

export function LabeledField({ children, configKey }: LabeledFieldProps) {
  const { t } = useTranslation();

  const { label, note } = useMemo(() => {
    if (!configKey) return { label: '', note: '' };

    return {
      label:
        t(`settings.parameters.${configKey}.label`, {
          defaultValue: configKey,
        }) || configKey,
      note: t(`settings.parameters.${configKey}.note`, {
        defaultValue: '',
      }),
    };
  }, [t, configKey]);

  return <>{children({ label, note })}</>;
}

import { useTranslation } from 'react-i18next';

export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-h2">{t(titleKey)}</h1>
      <p className="text-body text-muted">En construcción</p>
    </div>
  );
}

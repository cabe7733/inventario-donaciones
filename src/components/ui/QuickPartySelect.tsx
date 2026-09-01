import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from '@phosphor-icons/react';
import { fetchParties, type Party, type PartyKind } from '../../lib/donorOps';
import { AutocompleteOrCreate, type AocItem } from './AutocompleteOrCreate';
import { PersonaFormModal } from '../../features/personas/PersonaFormModal';

interface Props {
  kind: PartyKind;
  value: string | null;
  onChange: (id: string | null) => void;
  required?: boolean;
  error?: string;
  label?: string;
}

export function QuickPartySelect({ kind, value, onChange, required, error, label }: Props) {
  const { t } = useTranslation();
  const [parties, setParties] = useState<Party[]>([]);
  const [showQuickForm, setShowQuickForm] = useState(false);

  useEffect(() => {
    fetchParties(kind).then(setParties);
  }, [kind]);

  const items = useMemo<AocItem[]>(
    () => parties.map((p) => ({
      id: p.id,
      label: p.full_name,
      sublabel: p.id_number ? `${p.id_number}${p.phone ? ` · ${p.phone}` : ''}` : p.phone ?? undefined,
    })),
    [parties],
  );

  const defaultLabel = kind === 'donor'
    ? t('personas.quickSelectDonor')
    : t('personas.quickSelectRecipient');

  const handleCreate = async (_label: string): Promise<string> => {
    setShowQuickForm(true);
    return '';
  };

  const onQuickFormClose = async () => {
    setShowQuickForm(false);
    const refreshed = await fetchParties(kind);
    setParties(refreshed);
    if (refreshed.length > 0) {
      const newest = refreshed[0];
      onChange(newest.id);
    }
  };

  const registerLabel = kind === 'donor'
    ? t('personas.registerNewDonor')
    : t('personas.registerNewRecipient');

  return (
    <div className="flex flex-col gap-2">
      <AutocompleteOrCreate
        label={label ?? defaultLabel}
        value={value}
        onChange={onChange}
        items={items}
        onCreate={handleCreate}
        required={required}
        error={error}
        placeholder={kind === 'donor' ? t('ordenes.searchOrCreateDonor') : t('ordenes.searchOrCreateRecipient')}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowQuickForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-caption font-medium text-accent-600 hover:bg-accent-50"
        >
          <Plus size={14} aria-hidden="true" />
          {registerLabel}
        </button>
      </div>
      {showQuickForm && (
        <PersonaFormModal
          party={null}
          kind={kind}
          onClose={onQuickFormClose}
        />
      )}
    </div>
  );
}

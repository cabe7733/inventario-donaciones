import { useQuery } from '@tanstack/react-query';
import { fetchWarehouses } from '../../lib/warehouseOps';
import { Field, inputClass } from './Field';
import { clsx } from 'clsx';

interface WarehouseSelectProps {
  id?: string;
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  error?: string;
  label?: string;
}

export function WarehouseSelect({ id = 'warehouse', value, onChange, required, error, label }: WarehouseSelectProps) {
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => fetchWarehouses(),
  });

  return (
    <Field id={id} label={label ?? 'Bodega'} required={required} error={error}>
      <select
        id={id}
        className={clsx(
          inputClass,
          'appearance-none bg-[url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMyA1bDMgMyAzLTMiIHN0cm9rZT0iIzZFNkU2NyIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=)] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-10',
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">Seleccionar bodega...</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.code} — {w.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

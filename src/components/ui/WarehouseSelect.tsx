import { useQuery } from '@tanstack/react-query';
import { fetchWarehouses } from '../../lib/warehouseOps';
import { Field, inputClass } from './Field';

interface WarehouseSelectProps {
  id?: string;
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  error?: string;
  label?: string;
}

// Selector de bodega activa del centro. Mobile-first: select nativo, h-11.
export function WarehouseSelect({ id = 'warehouse', value, onChange, required, error, label }: WarehouseSelectProps) {
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => fetchWarehouses(),
  });

  return (
    <Field id={id} label={label ?? 'Bodega'} required={required} error={error}>
      <select
        id={id}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">Seleccionar bodega...</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

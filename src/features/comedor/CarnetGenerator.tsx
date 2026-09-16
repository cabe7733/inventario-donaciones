import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from '@phosphor-icons/react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchComedorPeople } from '../../lib/comedorOps';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

export function CarnetGenerator({ onClose }: { onClose: () => void }) {
  const { data: people = [], isLoading } = useQuery({ queryKey: ['comedor-people'], queryFn: fetchComedorPeople });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => setSelected((prev) => prev.size === people.length ? new Set() : new Set(people.map((p) => p.id)));
  const toPrint = people.filter((p) => selected.size === 0 || selected.has(p.id));

  return (
    <Modal open onClose={onClose} title="Generar carnets" size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-body-sm text-muted">{people.length} personas registradas</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={toggleAll}>{selected.size === people.length ? 'Deseleccionar' : 'Seleccionar todos'}</Button>
            <Button onClick={() => window.print()} disabled={!toPrint.length}><Printer size={18} /> Imprimir</Button>
          </div>
        </div>
        {isLoading ? <p className="text-body-sm text-muted">Cargando...</p> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-3">
            {people.map((p) => (
              <label key={p.id} className={`carnet flex flex-col items-center rounded-lg border p-3 transition-colors print:break-inside-avoid ${selected.has(p.id) ? 'border-primary bg-primary-50' : 'border-border bg-card'}`}>
                <input type="checkbox" className="sr-only" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                <QRCodeSVG value={p.id} size={80} />
                <p className="mt-2 text-center text-xs font-semibold leading-tight">{p.nombre} {p.apellido ?? ''}</p>
              </label>
            ))}
          </div>
        )}
      </div>
      <style>{`@media print { body * { display: none !important; } .carnet, .carnet * { display: flex !important; } .carnet { break-inside: avoid; page-break-inside: avoid; } }`}</style>
    </Modal>
  );
}

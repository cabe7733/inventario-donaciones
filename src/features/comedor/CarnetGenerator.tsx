import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, IdentificationCard } from '@phosphor-icons/react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchComedorPeople } from '../../lib/comedorOps';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

export function CarnetGenerator({ onClose }: { onClose: () => void }) {
  const { data: people = [], isLoading } = useQuery({
    queryKey: ['comedor-people'],
    queryFn: fetchComedorPeople,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === people.length ? new Set() : new Set(people.map((p) => p.id)),
    );

  const toPrint = people.filter((p) => selected.size === 0 || selected.has(p.id));

  return (
    <Modal open onClose={onClose} title="Generar carnets de comedor" size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <p className="text-body-sm font-medium text-text-primary">
              {people.length} personas registradas
            </p>
            <p className="text-caption text-text-tertiary">
              {selected.size > 0
                ? `${selected.size} seleccionadas para imprimir`
                : 'Selecciona personas o imprime todas'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={toggleAll}>
              {selected.size === people.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </Button>
            <Button onClick={() => window.print()} disabled={!toPrint.length}>
              <Printer size={18} /> Imprimir carnets
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-body-sm text-text-secondary">
            Cargando personas...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-4" id="printable-carnets">
            {toPrint.map((p) => (
              <label
                key={p.id}
                className={`carnet-card relative flex flex-col justify-between rounded-xl border p-4 shadow-sm transition-all cursor-pointer select-none print:shadow-none ${
                  selected.has(p.id)
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20 ring-2 ring-primary-400'
                    : 'border-border bg-surface-card hover:border-primary-300'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only print:hidden"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />

                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
                  <div className="flex items-center gap-1.5 text-primary-700 dark:text-primary-300">
                    <IdentificationCard size={18} />
                    <span className="text-caption font-bold tracking-wide uppercase">
                      Comedor Comunitario
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-text-tertiary uppercase">
                    ID: {p.id.slice(0, 8)}
                  </span>
                </div>

                {/* Body: QR & Details */}
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-white p-2 shadow-inner ring-1 ring-border">
                    <QRCodeSVG value={p.id} size={90} level="M" />
                  </div>
                  <div className="flex flex-col justify-center min-w-0 flex-1">
                    <p className="text-body font-bold text-text-primary leading-snug truncate">
                      {p.nombre} {p.apellido ?? ''}
                    </p>
                    {p.numero_documento && (
                      <p className="text-caption font-mono text-text-secondary mt-0.5">
                        C.C. {p.numero_documento}
                      </p>
                    )}
                    {p.celular && (
                      <p className="text-caption text-text-tertiary">
                        Tel: {p.celular}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer notice */}
                <div className="mt-3 pt-2 border-t border-border/40 text-center text-[10px] text-text-tertiary">
                  Escanear código QR para registrar asistencia diaria
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-carnets, #printable-carnets * {
            visibility: visible !important;
          }
          #printable-carnets {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 16px !important;
            padding: 16px !important;
          }
          .carnet-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            border: 1.5px solid #cbd5e1 !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
        }
      `}</style>
    </Modal>
  );
}

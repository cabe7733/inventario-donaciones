import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Info } from '@phosphor-icons/react';
import { QrCheckinScanner } from '../../components/ui/QrCheckinScanner';
import { fetchComedorPersonById, registerVisit } from '../../lib/comedorOps';
import { useAuth } from '../../components/auth/AuthProvider';
import { useToast } from '../../components/ui/Toast';

export function ComedorCheckinPage() {
  const { centerId } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const lastScan = useRef<{ id: string; time: number } | null>(null);
  const [lastResult, setLastResult] = useState<{ nombre: string; ok: boolean; msg: string } | null>(null);

  const handleScan = useCallback(async (personId: string) => {
    if (!centerId) return;
    const now = Date.now();
    if (lastScan.current?.id === personId && now - lastScan.current.time < 4000) return;
    lastScan.current = { id: personId, time: now };

    const person = await fetchComedorPersonById(personId);
    if (!person) {
      setLastResult({ nombre: '', ok: false, msg: 'Carnet no reconocido' });
      toast.push({ message: 'Carnet no reconocido', tone: 'error' });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    try {
      await registerVisit(centerId, person.id, today);
      await queryClient.invalidateQueries({ queryKey: ['comedor-people'] });
      setLastResult({ nombre: `${person.nombre} ${person.apellido ?? ''}`.trim(), ok: true, msg: 'Bienvenido/a' });
      toast.push({ message: `Bienvenido/a ${person.nombre}`, tone: 'success' });
    } catch {
      setLastResult({ nombre: `${person.nombre} ${person.apellido ?? ''}`.trim(), ok: false, msg: 'Ya registrado hoy' });
      toast.push({ message: `${person.nombre} ya está registrado hoy`, tone: 'info' });
    }
  }, [centerId, queryClient, toast]);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header><h1 className="text-h2">Check-in QR</h1><p className="text-body-sm text-muted">Escanea el carnet de la persona para registrar su visita</p></header>
      <div className="mx-auto w-full max-w-md">
        <QrCheckinScanner onScan={handleScan} />
      </div>
      {lastResult && (
        <div className={`mx-auto flex items-center gap-2 rounded-lg px-4 py-3 text-body-sm ${lastResult.ok ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>
          {lastResult.ok ? <CheckCircle size={20} /> : <Info size={20} />}
          <span><strong>{lastResult.nombre ? `${lastResult.nombre}: ` : ''}</strong>{lastResult.msg}</span>
        </div>
      )}
    </div>
  );
}

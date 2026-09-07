import { Question } from '@phosphor-icons/react';
import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Modal } from '../ui/Modal';

const HELP: Record<string, { title: string; body: string; steps: string[] }> = {
  '/medicamentos': { title: 'Medicamentos', body: 'Consulta y administra el inventario farmacéutico del centro por medicamento y lote.', steps: ['Registra los datos del medicamento.', 'Agrega lotes, vencimientos y cantidades.', 'Usa fórmulas médicas para despachar; no retires medicamentos directamente.'] },
  '/formulas': { title: 'Fórmulas médicas', body: 'Registra fórmulas y despacha medicamentos del inventario global.', steps: ['Selecciona el destinatario.', 'Busca medicamentos y revisa el stock disponible.', 'Registra o despacha la fórmula si tu usuario está autorizado.'] },
  '/comedor': { title: 'Comedor', body: 'Registra personas y sus visitas al comedor comunitario.', steps: ['Escanea la cédula o diligencia los datos manualmente.', 'Revisa los datos autocompletados.', 'Guarda la persona y registra la visita.'] },
  '/config': { title: 'Configuración', body: 'Administra catálogos, bodegas y reglas operativas del centro.', steps: ['Elige el catálogo que deseas administrar.', 'Los cambios aplican a los formularios del centro.', 'Solo administradores pueden modificar la configuración.'] },
  '/salidas': { title: 'Salidas', body: 'Consulta las salidas históricas del inventario.', steps: ['Revisa los movimientos registrados.', 'Las nuevas salidas médicas se realizan desde Fórmulas médicas.'] },
};

export function ContextHelp() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const help = Object.entries(HELP).find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? { title: 'Ayuda', body: 'Consulta esta guía para entender el módulo actual.', steps: ['Usa los botones visibles para realizar las acciones disponibles.', 'Los campos marcados son obligatorios.', 'Si no puedes realizar una acción, revisa tus permisos.'] };
  return <><button type="button" aria-label={`Ayuda: ${help.title}`} onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-neutral-100 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"><Question size={22} /></button><Modal open={open} onClose={() => setOpen(false)} title={help.title}><div className="flex flex-col gap-4"><p className="text-body text-muted">{help.body}</p><ol className="list-decimal space-y-2 pl-5 text-body-sm">{help.steps.map((step) => <li key={step}>{step}</li>)}</ol></div></Modal></>;
}

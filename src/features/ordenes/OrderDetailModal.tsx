import { useEffect, useState } from 'react';
import { Package, User, Warehouse, Truck, Calendar, Note } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatDateShort, formatNumber, formatTime } from '../../lib/format';
import type { OrderWithRefs } from '../../lib/orderOps';
import { supabase } from '../../lib/supabase';

interface OrderDetailModalProps {
  order: OrderWithRefs | null;
  open: boolean;
  onClose: () => void;
}

export function OrderDetailModal({ order, open, onClose }: OrderDetailModalProps) {
  const [partyDetails, setPartyDetails] = useState<{
    full_name: string;
    id_number?: string;
    phone?: string;
    email?: string;
    entity_name?: string;
    entity_rfc?: string;
    recipient_type?: string;
  } | null>(null);
  const [warehouseName, setWarehouseName] = useState<string>('');
  const [authorizerName, setAuthorizerName] = useState<string>('');

  useEffect(() => {
    if (!order) return;
    setPartyDetails(null);
    setWarehouseName('');
    setAuthorizerName('');

    const loadParty = async () => {
      if (order.order_type === 'entrada' && order.donor_id) {
        const { data } = await supabase
          .from('donors')
          .select('full_name, id_number, phone, email, entity_name, entity_rfc')
          .eq('id', order.donor_id)
          .single();
        if (data) setPartyDetails(data);
      } else if (order.order_type === 'salida' && order.recipient_id) {
        const { data } = await supabase
          .from('recipients')
          .select('full_name, id_number, phone, email, entity_name, entity_rfc, recipient_type')
          .eq('id', order.recipient_id)
          .single();
        if (data) setPartyDetails(data);
      }
    };

    const loadWarehouse = async () => {
      if (order.warehouse_id) {
        const { data } = await supabase
          .from('warehouses')
          .select('name')
          .eq('id', order.warehouse_id)
          .single();
        if (data) setWarehouseName(data.name);
      }
    };

    const loadAuthorizer = async () => {
      if (order.order_type === 'salida' && order.inventory_authorizer_id) {
        const { data } = await supabase
          .from('inventory_exit_authorizers')
          .select('name')
          .eq('id', order.inventory_authorizer_id)
          .single();
        if (data) setAuthorizerName(data.name);
      }
    };

    loadParty();
    loadWarehouse();
    loadAuthorizer();
  }, [order]);

  if (!order) return null;

  const isEntrada = order.order_type === 'entrada';
  const productItems = (order.order_items ?? []).filter((it) => it.item_type === 'product');

  return (
    <Modal open={open} onClose={onClose} title={`Detalle de ${isEntrada ? 'Entrada' : 'Salida'} de Productos`}>
      <div className="flex flex-col gap-4">
        {/* Header Badge */}
        <div className="flex items-center justify-between rounded-lg bg-surface border border-border p-3">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-caption font-bold ${
                isEntrada ? 'bg-success-500/15 text-success-700' : 'bg-secondary-500/15 text-secondary-700'
              }`}
            >
              {isEntrada ? '+' : '−'}
            </span>
            <div>
              <p className="text-body font-semibold capitalize">{isEntrada ? 'Entrada' : 'Salida'}</p>
              <p className="text-caption text-muted">
                {formatDateShort(order.created_at.split('T')[0])} · {formatTime(order.created_at)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-numeric-lg font-bold ${isEntrada ? 'text-success-700' : 'text-secondary-700'}`}>
              {productItems.reduce((sum, it) => sum + it.qty, 0)} items
            </p>
          </div>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-3 text-caption">
          <div className="flex items-center gap-2 rounded-lg border border-border p-2 bg-surface">
            <Calendar size={16} className="text-muted shrink-0" />
            <div>
              <p className="text-muted">Fecha de orden</p>
              <p className="font-semibold text-fg">{formatDateShort(order.order_date.split('T')[0])}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border p-2 bg-surface">
            <Calendar size={16} className="text-muted shrink-0" />
            <div>
              <p className="text-muted">Creado</p>
              <p className="font-semibold text-fg">{formatDateShort(order.created_at.split('T')[0])}</p>
            </div>
          </div>
        </div>

        {/* Donante / Beneficiario */}
        {partyDetails && (
          <div className="rounded-lg border border-border p-3 bg-card">
            <div className="flex items-center gap-2 text-caption font-medium text-muted mb-2">
              <User size={16} />
              <span>{isEntrada ? 'Donante' : 'Beneficiario'}</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-caption">
              <div>
                <p className="text-muted">Nombre</p>
                <p className="font-semibold text-fg">{partyDetails.full_name}</p>
              </div>
              {partyDetails.id_number && (
                <div>
                  <p className="text-muted">Documento</p>
                  <p className="font-semibold text-fg">{partyDetails.id_number}</p>
                </div>
              )}
              {partyDetails.phone && (
                <div>
                  <p className="text-muted">Teléfono</p>
                  <p className="font-semibold text-fg">{partyDetails.phone}</p>
                </div>
              )}
              {partyDetails.email && (
                <div>
                  <p className="text-muted">Email</p>
                  <p className="font-semibold text-fg">{partyDetails.email}</p>
                </div>
              )}
              {partyDetails.entity_name && (
                <div className="sm:col-span-2">
                  <p className="text-muted">Entidad</p>
                  <p className="font-semibold text-fg">{partyDetails.entity_name}</p>
                </div>
              )}
              {partyDetails.entity_rfc && (
                <div>
                  <p className="text-muted">RFC/NIT</p>
                  <p className="font-semibold text-fg">{partyDetails.entity_rfc}</p>
                </div>
              )}
              {partyDetails.recipient_type && (
                <div>
                  <p className="text-muted">Tipo</p>
                  <p className="font-semibold text-fg capitalize">{partyDetails.recipient_type}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bodega */}
        {warehouseName && (
          <div className="flex items-center gap-2 rounded-lg border border-border p-3 bg-surface">
            <Warehouse size={18} className="text-muted shrink-0" />
            <div>
              <p className="text-caption text-muted">Bodega</p>
              <p className="font-semibold text-fg">{warehouseName}</p>
            </div>
          </div>
        )}

        {/* Vehículo (solo entradas) */}
        {isEntrada && (order.vehicle_plate || order.vehicle_type || order.vehicle_color) && (
          <div className="rounded-lg border border-border p-3 bg-card">
            <div className="flex items-center gap-2 text-caption font-medium text-muted mb-2">
              <Truck size={16} />
              <span>Vehículo</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 text-caption">
              {order.vehicle_plate && (
                <div>
                  <p className="text-muted">Placa</p>
                  <p className="font-semibold text-fg">{order.vehicle_plate}</p>
                </div>
              )}
              {order.vehicle_type && (
                <div>
                  <p className="text-muted">Tipo</p>
                  <p className="font-semibold text-fg capitalize">{order.vehicle_type}</p>
                </div>
              )}
              {order.vehicle_color && (
                <div>
                  <p className="text-muted">Color</p>
                  <p className="font-semibold text-fg capitalize">{order.vehicle_color}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Autorizador (solo salidas) */}
        {!isEntrada && authorizerName && (
          <div className="flex items-center gap-2 rounded-lg border border-border p-3 bg-surface">
            <User size={18} className="text-muted shrink-0" />
            <div>
              <p className="text-caption text-muted">Autorizado por</p>
              <p className="font-semibold text-fg">{authorizerName}</p>
            </div>
          </div>
        )}

        {/* Items - Solo productos */}
        {productItems.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-surface">
              <p className="text-label font-semibold text-fg">Productos ({productItems.length})</p>
            </div>
            <div className="divide-y divide-border">
              {productItems.map((item) => (
                <div key={item.id} className="p-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Package size={18} className="text-primary-600" />
                    <div>
                      <p className="text-body font-medium text-fg">{item.item_id}</p>
                      {item.notes && <p className="text-caption text-muted">{item.notes}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-numeric font-semibold ${isEntrada ? 'text-success-700' : 'text-secondary-700'}`}>
                      {isEntrada ? '+' : '−'}{formatNumber(item.qty)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notas */}
        {order.notes && (
          <div className="rounded-lg border border-border p-3 bg-surface">
            <div className="flex items-center gap-1.5 text-caption font-medium text-muted mb-1">
              <Note size={16} />
              <span>Observaciones</span>
            </div>
            <p className="text-body text-fg whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {/* Botón cerrar */}
        <div className="flex justify-end pt-2 border-t border-border">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  );
}
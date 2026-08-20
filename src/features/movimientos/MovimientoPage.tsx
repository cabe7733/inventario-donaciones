import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Eraser } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { deviceId, newId, nowISO } from '../../lib/ids';
import { registerProductMovement, StockError } from '../../lib/movements';
import { todayKey } from '../../lib/format';
import type { MovementKind } from '../../db/types';
import { AutocompleteOrCreate, type AocItem } from '../../components/ui/AutocompleteOrCreate';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';

function combineDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date();
  return new Date(y, m - 1, d, dt.getHours(), dt.getMinutes()).toISOString();
}

export function MovimientoPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [params] = useSearchParams();
  const initial = params.get('tipo') === 'salida' ? 'salida' : 'entrada';

  const products = useLiveQuery(() => db.products.where('_deleted').equals(0).toArray(), []);

  const [kind, setKind] = useState<MovementKind>(initial);
  const [productId, setProductId] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
  const [nota, setNota] = useState('');
  const [dateKey, setDateKey] = useState(todayKey());
  const [error, setError] = useState<string>();

  useEffect(() => setKind(initial ?? 'entrada'), [initial]);

  const productItems = useMemo<AocItem[]>(
    () =>
      (products ?? [])
        .filter((p) => p.isActive === 1)
        .map((p) => ({ id: p.id, label: p.name })),
    [products],
  );

  const selected = useMemo(
    () => products?.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  const createProduct = async (label: string) => {
    const id = newId();
    await db.products.add({
      id,
      name: label,
      aliases: [],
      categoryId: null,
      unitId: '',
      minStock: null,
      totalStock: 0,
      isActive: 1,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _version: 1,
      _deleted: 0,
      _syncedAt: null,
      _deviceId: deviceId(),
      _clientUuid: newId(),
    });
    return id;
  };

  const save = async () => {
    setError(undefined);
    if (!productId) {
      setError(t('movimientos.error.product'));
      return;
    }
    try {
      const qtyNum = Number.parseInt(qty, 10);
      if (!(qtyNum >= 1)) {
        setError(t('movimientos.error.qty'));
        return;
      }
      await registerProductMovement({
        kind,
        itemType: 'product',
        itemId: productId,
        qty: qtyNum,
        fecha: combineDate(dateKey),
        nota,
      });
      const p = products?.find((x) => x.id === productId);
      toast.push({
        message:
          kind === 'entrada'
            ? t('movimientos.entradaOk', { name: p?.name ?? '', qty })
            : t('movimientos.salidaOk', { name: p?.name ?? '', qty }),
        tone: kind === 'entrada' ? 'success' : 'neutral',
      });
      setQty('1');
      setNota('');
    } catch (e) {
      if (e instanceof StockError) {
        toast.push({ message: e.message, tone: 'error' });
      } else {
        toast.push({ message: t('common.error'), tone: 'error' });
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-h2">
          {kind === 'entrada' ? t('movimientos.entrada') : t('movimientos.salida')}
        </h1>
      </header>

      <Segmented<MovementKind>
        ariaLabel={t('movimientos.kind.select')}
        value={kind}
        onChange={setKind}
        options={[
          {
            value: 'entrada',
            label: t('movimientos.entrada'),
            icon: <ArrowDownRight size={18} aria-hidden="true" />,
          },
          {
            value: 'salida',
            label: t('movimientos.salida'),
            icon: <ArrowUpRight size={18} aria-hidden="true" />,
          },
        ]}
      />

      <AutocompleteOrCreate
        id="m-product"
        label={t('movimientos.producto')}
        required
        value={productId}
        onChange={setProductId}
        items={productItems}
        onCreate={createProduct}
        error={error}
        hint={selected ? t('movimientos.stockDisponible', { stock: String(selected.totalStock) }) : undefined}
      />

      <Field id="m-qty" label={t('movimientos.cantidad')} required>
        <input
          id="m-qty"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          className={inputClass}
          value={qty}
          onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => {
            if (e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault();
          }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field id="m-fecha" label={t('movimientos.fecha')}>
          <input
            id="m-fecha"
            type="date"
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-body text-fg"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
          />
        </Field>
        <Field id="m-nota" label={t('movimientos.nota')}>
          <input
            id="m-nota"
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-body text-fg placeholder:text-muted"
            placeholder={t('movimientos.nota.placeholder')}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button
          variant="ghost"
          className="flex-1"
          onClick={() => {
            setProductId(null);
            setQty('1');
            setNota('');
            setError(undefined);
          }}
        >
          <Eraser size={18} aria-hidden="true" />
          {t('movimientos.limpiar')}
        </Button>
        <Button
          className="flex-[2]"
          variant={kind === 'salida' ? 'danger' : 'primary'}
          onClick={() => void save()}
        >
          {kind === 'entrada' ? t('movimientos.registrarEntrada') : t('movimientos.registrarSalida')}
        </Button>
      </div>

      <p className="text-caption text-muted">{t('movimientos.hint')}</p>
    </div>
  );
}
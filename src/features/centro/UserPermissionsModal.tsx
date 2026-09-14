import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../components/auth/AuthProvider';
import {
  fetchMemberPermissions,
  saveMemberPermissions,
  type UserModulePermission,
} from '../../lib/permissions';

interface UserPermissionsModalProps {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  userName: string;
}

export function UserPermissionsModal({
  open,
  onClose,
  userId,
  userName,
}: UserPermissionsModalProps) {
  const toast = useToast();
  const [permissions, setPermissions] = useState<UserModulePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    setError(null);
    fetchMemberPermissions(userId)
      .then((data) => setPermissions(data))
      .catch((err) => setError(err.message || 'Error al cargar permisos'))
      .finally(() => setLoading(false));
  }, [open, userId]);

  const toggleAction = (
    moduleId: string,
    field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete',
  ) => {
    setPermissions((prev) =>
      prev.map((item) => {
        if (item.module_id !== moduleId) return item;
        const updated = { ...item, [field]: !item[field] };
        // Si se deshabilita ver, se deshabilitan las demás acciones
        if (field === 'can_view' && !updated.can_view) {
          updated.can_create = false;
          updated.can_edit = false;
          updated.can_delete = false;
        }
        // Si se habilita crear, editar o eliminar, se auto-habilita ver
        if (field !== 'can_view' && updated[field]) {
          updated.can_view = true;
        }
        return updated;
      }),
    );
  };

  const { centerId } = useAuth();

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await saveMemberPermissions(
        userId,
        permissions.map((p) => ({
          module_id: p.module_id,
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        })),
        centerId,
      );
      toast.push({ message: 'Permisos actualizados correctamente', tone: 'success' });
      onClose();
    } catch (err: unknown) {
      toast.push({
        message: err instanceof Error ? err.message : 'Error al guardar permisos',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Permisos de módulo: ${userName}`}
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        <p className="text-caption text-muted">
          Asigna permisos individuales de lectura (Ver), creación (Crear), modificación (Editar) y eliminación (Eliminar) para cada módulo.
        </p>

        {loading ? (
          <div className="py-8 text-center text-body text-muted">Cargando permisos...</div>
        ) : error ? (
          <div className="rounded-lg border border-danger-500/40 bg-danger-500/10 p-3 text-caption text-danger-700">
            {error}
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-left text-body">
              <thead className="sticky top-0 bg-surface border-b border-border text-caption text-muted font-medium">
                <tr>
                  <th className="p-3">Módulo</th>
                  <th className="p-3 text-center">Ver</th>
                  <th className="p-3 text-center">Crear</th>
                  <th className="p-3 text-center">Editar</th>
                  <th className="p-3 text-center">Eliminar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {permissions.map((perm) => (
                  <tr key={perm.module_id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="p-3">
                      <p className="font-medium text-fg">{perm.module_name}</p>
                      <p className="text-caption text-muted">{perm.module_id}</p>
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={perm.can_view}
                        onChange={() => toggleAction(perm.module_id, 'can_view')}
                        className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={perm.can_create}
                        onChange={() => toggleAction(perm.module_id, 'can_create')}
                        className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={perm.can_edit}
                        onChange={() => toggleAction(perm.module_id, 'can_edit')}
                        className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={perm.can_delete}
                        onChange={() => toggleAction(perm.module_id, 'can_delete')}
                        className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={loading || saving}>
            {saving ? 'Guardando...' : 'Guardar permisos'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

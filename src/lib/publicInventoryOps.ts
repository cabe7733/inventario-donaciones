import { supabase } from './supabase';

export interface PublicInventoryItem {
  product_id: string;
  center_id: string;
  center_name: string;
  categoria: string;
  nombre_producto: string;
  cantidad_actual: number;
  umbral_minimo: number;
  nivel_urgencia: 'sin_existencias' | 'escaso' | 'regular' | 'abastecido' | 'muy_abastecido';
  fecha_ultima_actualizacion: string;
}

export async function fetchPublicInventoryResumen(centerId?: string): Promise<PublicInventoryItem[]> {
  try {
    // Try calling the RPC function
    const { data, error } = await supabase.rpc('get_public_inventario_resumen', {
      p_center_id: centerId || null,
    });

    if (!error && data) {
      return data as PublicInventoryItem[];
    }
  } catch {
    // Fallback if RPC fails
  }

  // Fallback to reading the public view directly
  try {
    let query = supabase.from('public_inventario_resumen').select('*');
    if (centerId) {
      query = query.eq('center_id', centerId);
    }
    const { data, error } = await query;
    if (!error && data) {
      return data as PublicInventoryItem[];
    }
  } catch {
    // View fallback
  }

  // Final fallback: construct from products table
  let prodQuery = supabase
    .from('products')
    .select('id, center_id, name, total_stock, min_stock, umbral_minimo, updated_at, categories(name)')
    .eq('is_active', true)
    .eq('deleted', false);

  if (centerId) {
    prodQuery = prodQuery.eq('center_id', centerId);
  }

  const { data: prods } = await prodQuery;
  if (!prods) return [];

  return prods.map((p: any) => {
    const stock = Number(p.total_stock ?? 0);
    const threshold = Number(p.umbral_minimo || p.min_stock || 10);
    let level: PublicInventoryItem['nivel_urgencia'] = 'abastecido';

    if (stock === 0) {
      level = 'sin_existencias';
    } else if (stock <= 0.25 * threshold) {
      level = 'escaso';
    } else if (stock <= 0.75 * threshold) {
      level = 'regular';
    } else if (stock <= 1.5 * threshold) {
      level = 'abastecido';
    } else {
      level = 'muy_abastecido';
    }

    return {
      product_id: p.id,
      center_id: p.center_id,
      center_name: 'Centro de Acopio',
      categoria: p.categories?.name || 'General',
      nombre_producto: p.name,
      cantidad_actual: stock,
      umbral_minimo: threshold,
      nivel_urgencia: level,
      fecha_ultima_actualizacion: p.updated_at || new Date().toISOString(),
    };
  });
}

export async function fetchLatestInventoryUpdateDate(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('movements')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      return data[0].created_at;
    }
  } catch {
    // ignore
  }
  return null;
}

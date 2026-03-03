import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { registrarLog } from '../lib/logger';
import Button from '../components/common/Button';
import { FileSpreadsheet, Download, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function ExportPage() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tipoExport, setTipoExport] = useState<'accesos' | 'logs' | 'personas'>('accesos');
  const [loading, setLoading] = useState(false);

  const exportar = async () => {
    if (!desde || !hasta) {
      toast.error('Debe seleccionar un rango de fechas');
      return;
    }

    setLoading(true);
    try {
      let data: Record<string, unknown>[] = [];
      let fileName = '';

      if (tipoExport === 'accesos') {
        const { data: registros, error } = await supabase
          .from('registros_acceso')
          .select(`
            *,
            persona:personas(nombre_completo, primer_apellido, segundo_apellido, carnet_identidad, numero_solapin),
            puerta:puertas(nombre),
            guardia:usuarios(nombre)
          `)
          .gte('fecha_hora', desde)
          .lte('fecha_hora', hasta + 'T23:59:59')
          .order('fecha_hora', { ascending: false });

        if (error) throw error;

        data = (registros || []).map((r: any) => ({
          'Fecha/Hora': format(new Date(r.fecha_hora), "dd/MM/yyyy HH:mm:ss", { locale: es }),
          'Nombre': `${r.persona?.nombre_completo || ''} ${r.persona?.primer_apellido || ''} ${r.persona?.segundo_apellido || ''}`.trim(),
          'Carnet Identidad': r.persona?.carnet_identidad || '',
          'Solapín': r.persona?.numero_solapin || '',
          'Puerta': r.puerta?.nombre || '',
          'Tipo Acceso': r.tipo_acceso === 'activo' ? 'Activo' : 'Inactivo',
          'Estado': r.estado === 'permitido' ? 'Permitido' : 'Denegado',
          'Motivo': r.motivo_acceso || '',
          'Observaciones': r.observaciones || '',
          'Guardia': r.guardia?.nombre || '',
        }));
        fileName = `accesos_uci_${desde}_${hasta}`;
      } else if (tipoExport === 'logs') {
        const { data: logs, error } = await supabase
          .from('logs_sistema')
          .select('*')
          .gte('created_at', desde)
          .lte('created_at', hasta + 'T23:59:59')
          .order('created_at', { ascending: false });

        if (error) throw error;

        data = (logs || []).map((l: any) => ({
          'Fecha/Hora': format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es }),
          'Acción': l.accion,
          'Entidad': l.entidad || '',
          'ID Entidad': l.entidad_id || '',
          'Detalles': JSON.stringify(l.detalles || {}),
          'Usuario ID': l.usuario_id || '',
        }));
        fileName = `logs_uci_${desde}_${hasta}`;
      } else if (tipoExport === 'personas') {
        const { data: personas, error } = await supabase
          .from('personas')
          .select('*')
          .order('nombre_completo');

        if (error) throw error;

        data = (personas || []).map((p: any) => ({
          'Nombre': p.nombre_completo,
          'Primer Apellido': p.primer_apellido,
          'Segundo Apellido': p.segundo_apellido || '',
          'Carnet Identidad': p.carnet_identidad,
          'Solapín': p.numero_solapin || '',
          'Fecha Registro': format(new Date(p.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es }),
        }));
        fileName = `personas_uci_${format(new Date(), 'yyyy-MM-dd')}`;
      }

      if (data.length === 0) {
        toast.error('No hay datos para el rango seleccionado');
        setLoading(false);
        return;
      }

      // Crear Excel
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Datos');

      // Auto-width columns
      const colWidths = Object.keys(data[0]).map((key) => ({
        wch: Math.max(
          key.length,
          ...data.map((row) => String(row[key] || '').length)
        ) + 2,
      }));
      ws['!cols'] = colWidths;

      // Descargar
      XLSX.writeFile(wb, `${fileName}.xlsx`);

      await registrarLog('exportacion_excel', 'sistema', undefined, {
        tipo: tipoExport,
        desde,
        hasta,
        registros: data.length,
      });

      toast.success(`Exportados ${data.length} registros`);
    } catch (err) {
      toast.error('Error exportando datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-uci-gray-900 flex items-center gap-2">
          <FileSpreadsheet size={28} className="text-uci-primary" />
          Exportar Datos
        </h2>
        <p className="text-uci-gray-500 mt-1">
          Descargar el histórico de datos en formato Excel
        </p>
      </div>

      <div className="bg-white rounded-xl border border-uci-gray-200 p-6 shadow-card space-y-6">
        {/* Tipo de exportación */}
        <div>
          <label className="block text-sm font-medium text-uci-gray-700 mb-2">
            Tipo de datos a exportar
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'accesos', label: 'Registros de Acceso', desc: 'Entradas y denegaciones' },
              { value: 'logs', label: 'Logs del Sistema', desc: 'Todas las acciones' },
              { value: 'personas', label: 'Personas', desc: 'Directorio registrado' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTipoExport(opt.value as any)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  tipoExport === opt.value
                    ? 'border-uci-primary bg-uci-light'
                    : 'border-uci-gray-200 hover:border-uci-gray-300'
                }`}
              >
                <p className="font-medium text-sm text-uci-gray-800">{opt.label}</p>
                <p className="text-xs text-uci-gray-500 mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Rango de fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-uci-gray-700 mb-1.5 flex items-center gap-1">
              <Calendar size={14} />
              Desde
            </label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-uci-gray-700 mb-1.5 flex items-center gap-1">
              <Calendar size={14} />
              Hasta
            </label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
            />
          </div>
        </div>

        <Button
          onClick={exportar}
          loading={loading}
          size="lg"
          icon={<Download size={18} />}
          className="w-full"
        >
          Descargar Excel
        </Button>
      </div>
    </div>
  );
}

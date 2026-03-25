import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePersonLookup, useRegistrarAcceso } from '../hooks/useAccessControl';
import { supabase } from '../lib/supabase';
import { registrarLog } from '../lib/logger';
import Button from '../components/common/Button';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import type { Puerta, TipoAcceso, EstadoAcceso } from '../types';
import {
  ScanLine,
  CheckCircle2,
  XCircle,
  Ban,
  User,
  Building2,
  BadgeCheck,
  Clock,
  AlertTriangle,
  MapPin,
  CreditCard,
  Home,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

type EntradaTipoActual = 'carnet_manual' | 'carnet_escan' | 'solapin' | 'desconocida';

interface AccessControlPagePersistedState {
  inputValue: string;
  carnetActual: string;
  puertaSeleccionada: string;
  motivo: string;
  observaciones: string;
  nombreManual: string;
  apellido1Manual: string;
  apellido2Manual: string;
  entradaTipoActual: EntradaTipoActual;
}

const ACCESS_PAGE_STORAGE_KEY = 'access_control_page_state_v1';

const DEFAULT_PAGE_STATE: AccessControlPagePersistedState = {
  inputValue: '',
  carnetActual: '',
  puertaSeleccionada: '',
  motivo: '',
  observaciones: '',
  nombreManual: '',
  apellido1Manual: '',
  apellido2Manual: '',
  entradaTipoActual: 'desconocida',
};

function cargarEstadoPaginaPersistido(): AccessControlPagePersistedState {
  if (typeof window === 'undefined') {
    return DEFAULT_PAGE_STATE;
  }

  try {
    const raw = window.sessionStorage.getItem(ACCESS_PAGE_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PAGE_STATE;
    }

    const parsed = JSON.parse(raw) as Partial<AccessControlPagePersistedState>;
    return { ...DEFAULT_PAGE_STATE, ...parsed };
  } catch {
    return DEFAULT_PAGE_STATE;
  }
}

export default function AccessControlPage() {
  const estadoPersistido = cargarEstadoPaginaPersistido();
  const { usuario } = useAuth();
  const {
    loading: lookupLoading,
    error: lookupError,
    persona,
    personaLocal,
    found,
    isActive,
    ultimasEntradas,
    buscarPorEntrada,
    resetear,
  } = usePersonLookup();
  const { registrarAcceso, loading: registroLoading } = useRegistrarAcceso();

  const [inputValue, setInputValue] = useState(estadoPersistido.inputValue);
  const [carnetActual, setCarnetActual] = useState(estadoPersistido.carnetActual);
  const [puertas, setPuertas] = useState<Puerta[]>([]);
  const [puertaSeleccionada, setPuertaSeleccionada] = useState(estadoPersistido.puertaSeleccionada);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [motivo, setMotivo] = useState(estadoPersistido.motivo);
  const [observaciones, setObservaciones] = useState(estadoPersistido.observaciones);
  const [accionPendiente, setAccionPendiente] = useState<EstadoAcceso | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<{ estado: EstadoAcceso; nombre: string } | null>(null);
  const [nombreManual, setNombreManual] = useState(estadoPersistido.nombreManual);
  const [apellido1Manual, setApellido1Manual] = useState(estadoPersistido.apellido1Manual);
  const [apellido2Manual, setApellido2Manual] = useState(estadoPersistido.apellido2Manual);
  const [entradaTipoActual, setEntradaTipoActual] = useState<EntradaTipoActual>(estadoPersistido.entradaTipoActual);
  const inputRef = useRef<HTMLInputElement>(null);

  const tieneDatosLocalesConNombre = !!personaLocal &&
    personaLocal.nombre_completo !== 'Desconocido' &&
    personaLocal.primer_apellido !== 'Desconocido';
  const puedePermitirNoEncontrado = entradaTipoActual === 'carnet_escan' || tieneDatosLocalesConNombre;

  // Cargar puertas
  useEffect(() => {
    const cargarPuertas = async () => {
      const { data } = await supabase
        .from('puertas')
        .select('*')
        .eq('activa', true)
        .order('nombre');
      
      if (data) {
        setPuertas(data);
      }
    };
    cargarPuertas();
  }, [usuario]);

  // Auto-focus en el input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const data: AccessControlPagePersistedState = {
      inputValue,
      carnetActual,
      puertaSeleccionada,
      motivo,
      observaciones,
      nombreManual,
      apellido1Manual,
      apellido2Manual,
      entradaTipoActual,
    };

    try {
      window.sessionStorage.setItem(ACCESS_PAGE_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignorar errores de persistencia en sesión
    }
  }, [
    inputValue,
    carnetActual,
    puertaSeleccionada,
    motivo,
    observaciones,
    nombreManual,
    apellido1Manual,
    apellido2Manual,
    entradaTipoActual,
  ]);

  const handleLookupSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();

    const entrada = inputValue.trim();
    if (!entrada || lookupLoading) {
      return;
    }

    const { carnetIdentidad, tipoEntrada, entradaEscaneada } = await buscarPorEntrada(entrada);
    setEntradaTipoActual(tipoEntrada);

    if (tipoEntrada === 'carnet_escan' && entradaEscaneada) {
      setNombreManual(entradaEscaneada.nombres);
      setApellido1Manual(entradaEscaneada.primerApellido);
      setApellido2Manual(entradaEscaneada.segundoApellido);
    } else {
      setNombreManual('');
      setApellido1Manual('');
      setApellido2Manual('');
    }

    setCarnetActual(carnetIdentidad || entrada);
    setInputValue('');
  };

  // Procesar decisión de acceso
  const procesarAcceso = async (estado: EstadoAcceso) => {
    if (!puertaSeleccionada) {
      toast.error('Debe seleccionar una puerta antes de registrar el acceso');
      return;
    }

    if (estado === 'permitido' && !found && !puedePermitirNoEncontrado) {
      toast.error('Persona no encontrada. Solo puede permitirse si viene por carnet escaneado o ya tiene datos previos.');
      return;
    }

    // Si es inactivo o no encontrado y se permite, pedir motivo (y nombre si no se encontró)
    if (estado === 'permitido' && !isActive) {
      setAccionPendiente(estado);
      setShowReasonModal(true);
      return;
    }

    await ejecutarRegistro(estado);
  };

  const ejecutarRegistro = async (estado: EstadoAcceso, motivoParam?: string) => {
    if (!puertaSeleccionada || !usuario) {
      toast.error('Debe seleccionar una puerta');
      return;
    }

    try {
      const tipoAcceso: TipoAcceso = isActive ? 'activo' : 'inactivo';

      await registrarAcceso({
        persona,
        carnetIdentidad: carnetActual,
        puertaId: puertaSeleccionada,
        guardiaId: usuario.id,
        tipoAcceso,
        estado,
        motivoAcceso: motivoParam || motivo || undefined,
        observaciones: observaciones || undefined,
        nombreManual: nombreManual || undefined,
        apellido1Manual: apellido1Manual || undefined,
        apellido2Manual: apellido2Manual || undefined,
      });

      const nombre = persona
        ? `${persona.nombre_completo} ${persona.primer_apellido}`
        : personaLocal && personaLocal.nombre_completo !== 'Desconocido'
        ? `${personaLocal.nombre_completo} ${personaLocal.primer_apellido}`
        : nombreManual
        ? `${nombreManual} ${apellido1Manual}`
        : carnetActual;

      setLastResult({ estado, nombre });
      setShowResult(true);

      if (estado === 'permitido') {
        toast.success(`Acceso permitido: ${nombre}`);
      } else {
        toast.error(`Acceso denegado: ${nombre}`);
      }

      // Limpiar después de 4 segundos
      setTimeout(() => {
        resetearTodo();
      }, 4000);
    } catch (err) {
      toast.error('Error al registrar acceso');
      console.error(err);
    }
  };

  const confirmarMotivo = () => {
    if (!motivo.trim()) {
      toast.error('Debe especificar un motivo');
      return;
    }
    if (entradaTipoActual === 'carnet_escan' && !found) {
      if (!nombreManual.trim() || !apellido1Manual.trim()) {
        toast.error('No se pudieron extraer correctamente nombre y apellidos del carnet escaneado.');
        return;
      }
    }
    setShowReasonModal(false);
    if (accionPendiente) {
      ejecutarRegistro(accionPendiente, motivo);
    }
  };

  const cancelar = async () => {
    await registrarLog('acceso_cancelado', 'acceso', undefined, {
      carnet: carnetActual,
      guardia: usuario?.id,
    });
    resetearTodo();
    toast('Operación cancelada', { icon: '✕' });
  };

  const resetearTodo = () => {
    resetear();
    setInputValue('');
    setCarnetActual('');
    setEntradaTipoActual('desconocida');
    setMotivo('');
    setObservaciones('');
    setNombreManual('');
    setApellido1Manual('');
    setApellido2Manual('');
    setAccionPendiente(null);
    setShowReasonModal(false);
    setShowResult(false);
    setLastResult(null);
    inputRef.current?.focus();
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Título */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-uci-gray-900 flex items-center gap-2">
          <ScanLine size={28} className="text-uci-primary" />
          Control de Acceso
        </h2>
        <p className="text-uci-gray-500 mt-1">
          Ingrese o escanee carnet/solapín y confirme con Enter o el botón Buscar
        </p>
      </div>

      {/* Selector de puerta */}
      <div className="bg-white rounded-xl border border-uci-gray-200 p-4 mb-6 shadow-card">
        <div className="flex items-center gap-3">
          <MapPin size={18} className="text-uci-primary" />
          <label className="text-sm font-medium text-uci-gray-700">Puerta:</label>
          <select
            value={puertaSeleccionada}
            onChange={(e) => setPuertaSeleccionada(e.target.value)}
            className={`flex-1 max-w-xs px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none ${
              puertaSeleccionada ? 'border-uci-gray-300' : 'border-amber-400 bg-amber-50'
            }`}
          >
            <option value="">— Seleccione una puerta —</option>
            {puertas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.ubicacion ? `— ${p.ubicacion}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Campo de escaneo */}
      <div className="bg-white rounded-xl border-2 border-uci-primary/20 p-8 mb-6 shadow-card text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <CreditCard size={24} className="text-uci-primary" />
          <h3 className="text-lg font-semibold text-uci-gray-800">
            Identificación de Persona
          </h3>
        </div>
        <p className="text-sm text-uci-gray-500 mb-4">
          Soporta carnet manual, carnet escaneado, solapín manual y solapín escaneado
        </p>
        <form onSubmit={handleLookupSubmit} className="w-full max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Carnet o solapín (manual o escaneado)"
              className="flex-1 px-4 py-3 border-2 border-uci-gray-300 rounded-xl text-base font-mono focus:ring-2 focus:ring-uci-primary focus:border-uci-primary outline-none transition-all placeholder:text-uci-gray-300 placeholder:text-sm"
              autoFocus
              autoComplete="off"
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={lookupLoading}
              className="sm:min-w-[140px]"
            >
              Buscar
            </Button>
          </div>
        </form>
        {lookupLoading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-uci-primary">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">Buscando en el directorio UCI...</span>
          </div>
        )}
        {lookupError && (
          <div className="mt-4 flex items-center justify-center gap-2 text-status-danger">
            <AlertTriangle size={18} />
            <span className="text-sm">{lookupError}</span>
          </div>
        )}
      </div>

      {/* Resultado de la búsqueda */}
      {carnetActual && !lookupLoading && !showResult && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Tarjeta de persona */}
          <div className="bg-white rounded-xl border border-uci-gray-200 shadow-card overflow-hidden">
            {/* Status banner */}
            <div
              className={`px-6 py-3 ${
                !found
                  ? 'bg-red-50 border-b border-red-200'
                  : isActive
                  ? 'bg-emerald-50 border-b border-emerald-200'
                  : 'bg-amber-50 border-b border-amber-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {!found ? (
                  <>
                    <XCircle size={20} className="text-status-danger" />
                    <span className="font-semibold text-red-800">
                      Persona NO registrada en el sistema UCI
                    </span>
                  </>
                ) : isActive ? (
                  <>
                    <CheckCircle2 size={20} className="text-status-success" />
                    <span className="font-semibold text-emerald-800">
                      Persona AUTORIZADA — Usuario activo
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={20} className="text-status-warning" />
                    <span className="font-semibold text-amber-800">
                      Persona con BAJA — Usuario inactivo
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Datos de la persona */}
            <div className="p-6">
              {persona ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow
                    icon={<User size={16} />}
                    label="Nombre completo"
                    value={`${persona.nombre_completo} ${persona.primer_apellido} ${persona.segundo_apellido}`}
                  />
                  <InfoRow
                    icon={<CreditCard size={16} />}
                    label="Carnet de Identidad"
                    value={persona.carnet_identidad}
                  />
                  <InfoRow
                    icon={<BadgeCheck size={16} />}
                    label="No. Solapín"
                    value={persona.numero_solapin}
                  />
                  <InfoRow
                    icon={<Building2 size={16} />}
                    label="Rol Universitario"
                    value={persona.nombre_rol_universitario}
                  />
                  <InfoRow
                    icon={<Building2 size={16} />}
                    label="Estructura"
                    value={persona.nombre_estructura_credencial}
                  />
                  <InfoRow
                    icon={<BadgeCheck size={16} />}
                    label="Responsabilidad"
                    value={persona.nombre_responsabilidad}
                  />
                  <InfoRow
                    icon={<Home size={16} />}
                    label="Interno"
                    value={persona.interno ? 'Sí' : 'No'}
                  />
                  <InfoRow
                    icon={<Home size={16} />}
                    label="Apartamento UCI"
                    value={persona.apartamento_uci || '—'}
                  />
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-uci-gray-600">Estado:</span>
                      {persona.baja ? (
                        <StatusBadge status="danger" label="Baja" />
                      ) : (
                        <StatusBadge status="success" label="Activo" />
                      )}
                    </div>
                  </div>
                </div>
              ) : personaLocal && personaLocal.nombre_completo !== 'Desconocido' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow
                    icon={<User size={16} />}
                    label="Nombre completo"
                    value={`${personaLocal.nombre_completo} ${personaLocal.primer_apellido} ${personaLocal.segundo_apellido || ''}`}
                  />
                  <InfoRow
                    icon={<CreditCard size={16} />}
                    label="Carnet de Identidad"
                    value={personaLocal.carnet_identidad}
                  />
                  {personaLocal.numero_solapin && (
                    <InfoRow
                      icon={<BadgeCheck size={16} />}
                      label="No. Solapín"
                      value={personaLocal.numero_solapin}
                    />
                  )}
                  <div className="md:col-span-2">
                    <p className="text-xs text-uci-gray-500 italic">
                      Datos recuperados de visitas anteriores. Esta persona no aparece en el directorio UCI.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-uci-gray-600 mb-2">
                    No se encontraron datos para el identificador:{' '}
                    <span className="font-mono font-bold">{carnetActual}</span>
                  </p>
                  <p className="text-sm text-uci-gray-500">
                    Esta persona no aparece en el directorio UCI. Solo se puede permitir entrada si
                    vino por carnet escaneado o ya tenía datos registrados previamente.
                  </p>
                </div>
              )}
            </div>

            {/* Últimas entradas */}
            {ultimasEntradas.length > 0 && (
              <div className="border-t border-uci-gray-200 px-6 py-4">
                <h4 className="text-sm font-semibold text-uci-gray-700 mb-3 flex items-center gap-2">
                  <Clock size={16} />
                  Últimas 3 entradas
                </h4>
                <div className="space-y-2">
                  {ultimasEntradas.map((entrada) => (
                    <div
                      key={entrada.id}
                      className="flex items-center justify-between px-3 py-2 bg-uci-gray-50 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <StatusBadge
                          status={entrada.estado === 'permitido' ? 'success' : 'danger'}
                          label={entrada.estado === 'permitido' ? 'Permitido' : 'Denegado'}
                          size="sm"
                        />
                        <span className="text-uci-gray-600">
                          {(entrada as any).puerta?.nombre || 'Puerta desconocida'}
                        </span>
                      </div>
                      <span className="text-uci-gray-500">
                        {format(new Date(entrada.fecha_hora), "dd/MM/yyyy HH:mm", { locale: es })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Campo de observaciones */}
          {isActive && (
            <div className="bg-white rounded-xl border border-uci-gray-200 p-4 shadow-card">
              <label className="block text-sm font-medium text-uci-gray-700 mb-2">
                Observaciones (opcional)
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Añadir observaciones..."
                rows={2}
                className="w-full px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none resize-none"
              />
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="success"
              size="lg"
              onClick={() => procesarAcceso('permitido')}
              loading={registroLoading}
              disabled={!found && !puedePermitirNoEncontrado}
              icon={<CheckCircle2 size={20} />}
              className="min-w-[200px]"
            >
              Permitir Acceso
            </Button>
            <Button
              variant="danger"
              size="lg"
              onClick={() => procesarAcceso('denegado')}
              loading={registroLoading}
              icon={<Ban size={20} />}
              className="min-w-[200px]"
            >
              Denegar Acceso
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={cancelar}
              icon={<XCircle size={20} />}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Resultado final (feedback visual) */}
      {showResult && lastResult && (
        <div
          className={`rounded-2xl p-12 text-center shadow-lg animate-in fade-in duration-300 ${
            lastResult.estado === 'permitido'
              ? 'bg-emerald-50 border-2 border-emerald-300'
              : 'bg-red-50 border-2 border-red-300'
          }`}
        >
          {lastResult.estado === 'permitido' ? (
            <CheckCircle2 size={80} className="mx-auto text-status-success mb-4" />
          ) : (
            <XCircle size={80} className="mx-auto text-status-danger mb-4" />
          )}
          <h3
            className={`text-3xl font-bold mb-2 ${
              lastResult.estado === 'permitido' ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            {lastResult.estado === 'permitido' ? 'ACCESO PERMITIDO' : 'ACCESO DENEGADO'}
          </h3>
          <p className="text-lg text-uci-gray-600">{lastResult.nombre}</p>
          <p className="text-sm text-uci-gray-400 mt-4">
            Regresando al escáner en unos segundos...
          </p>
        </div>
      )}

      {/* Modal de motivo (para inactivos/no registrados) */}
      <Modal
        isOpen={showReasonModal}
        onClose={() => {
          setShowReasonModal(false);
          setAccionPendiente(null);
        }}
        title="Motivo de Acceso Requerido"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle size={18} className="text-status-warning mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              Esta persona no está registrada como activa en el sistema UCI.
              Debe especificar el motivo por el cual se le permite la entrada.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">
              Motivo de acceso <span className="text-status-danger">*</span>
            </label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none mb-2"
            >
              <option value="">Seleccione un motivo...</option>
              <option value="Banco Metropolitano">Banco Metropolitano</option>
              <option value="Policlínico">Policlínico</option>
              <option value="Dirección de Recursos Humanos">Dirección de Recursos Humanos</option>
              <option value="Secretaría General">Secretaría General</option>
              <option value="Matrícula de Pregrado">Matrícula de Pregrado</option>
              <option value="Dirección de Posgrado">Dirección de Posgrado</option>
              <option value="Formación Doctoral">Formación Doctoral</option>
              <option value="Trámite docente">Trámite docente</option>
              <option value="Otro">Otro (especificar en observaciones)</option>
            </select>
          </div>
          {/* Campos de nombre para personas no encontradas en el sistema */}
          {!found && entradaTipoActual === 'carnet_escan' && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800">
                Datos extraídos del carnet escaneado
              </p>
              <div>
                <label className="block text-sm font-medium text-uci-gray-700 mb-1">
                  Nombre(s)
                </label>
                <input
                  type="text"
                  value={nombreManual}
                  readOnly
                  placeholder="Nombre(s) detectados"
                  className="w-full px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-uci-gray-700 mb-1">
                    Primer apellido
                  </label>
                  <input
                    type="text"
                    value={apellido1Manual}
                    readOnly
                    placeholder="Primer apellido detectado"
                    className="w-full px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-uci-gray-700 mb-1">
                    Segundo apellido
                  </label>
                  <input
                    type="text"
                    value={apellido2Manual}
                    readOnly
                    placeholder="Segundo apellido detectado"
                    className="w-full px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
                  />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">
              Observaciones adicionales
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalles adicionales..."
              rows={3}
              className="w-full px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowReasonModal(false);
                setAccionPendiente(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="success" onClick={confirmarMotivo} icon={<CheckCircle2 size={18} />}>
              Confirmar y Permitir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Componente auxiliar para mostrar filas de información
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-uci-gray-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-uci-gray-500">{label}</p>
        <p className="text-sm font-medium text-uci-gray-800">{value || '—'}</p>
      </div>
    </div>
  );
}

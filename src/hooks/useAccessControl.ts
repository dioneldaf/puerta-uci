import { useState, useCallback, useEffect } from 'react';
import { buscarPersonaUCIPorCampo } from '../lib/uciApi';
import { supabase } from '../lib/supabase';
import { registrarLog } from '../lib/logger';
import type { UCIPersonaAPI, Persona, RegistroAccesoCompleto, TipoAcceso, EstadoAcceso } from '../types';

export interface PersonaLookupState {
  loading: boolean;
  error: string | null;
  persona: UCIPersonaAPI | null;
  personaLocal: Persona | null;
  found: boolean;
  isActive: boolean;
  ultimasEntradas: RegistroAccesoCompleto[];
}

export type TipoEntradaLookup =
  | 'carnet_manual'
  | 'carnet_escan'
  | 'solapin'
  | 'desconocida';

export interface EntradaEscaneadaData {
  carnetIdentidad: string;
  nombres: string;
  primerApellido: string;
  segundoApellido: string;
}

export interface LookupEntradaResult {
  carnetIdentidad: string;
  tipoEntrada: TipoEntradaLookup;
  entradaEscaneada: EntradaEscaneadaData | null;
}

const ACCESS_LOOKUP_STORAGE_KEY = 'access_control_lookup_state_v1';

const DEFAULT_LOOKUP_STATE: PersonaLookupState = {
  loading: false,
  error: null,
  persona: null,
  personaLocal: null,
  found: false,
  isActive: false,
  ultimasEntradas: [],
};

function cargarLookupStatePersistido(): PersonaLookupState {
  if (typeof window === 'undefined') {
    return DEFAULT_LOOKUP_STATE;
  }

  try {
    const raw = window.sessionStorage.getItem(ACCESS_LOOKUP_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_LOOKUP_STATE;
    }

    const parsed = JSON.parse(raw) as Partial<PersonaLookupState>;
    return {
      ...DEFAULT_LOOKUP_STATE,
      ...parsed,
      // Nunca rehidratar el estado de carga como true
      loading: false,
    };
  } catch {
    return DEFAULT_LOOKUP_STATE;
  }
}

function normalizarEspacios(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

function capitalizarPalabras(texto: string): string {
  const limpio = normalizarEspacios(texto);
  if (!limpio) {
    return '';
  }

  return limpio
    .split(' ')
    .map((palabra) =>
      palabra
        .split('-')
        .map((segmento) => {
          if (!segmento) {
            return segmento;
          }

          const lower = segmento.toLocaleLowerCase('es-ES');
          return lower.charAt(0).toLocaleUpperCase('es-ES') + lower.slice(1);
        })
        .join('-')
    )
    .join(' ');
}

function extraerCarnetDesdeEscaneo(entrada: string): string | null {
  const match = entrada.match(/CI:([0-9]{11})/);
  return match ? match[1] : null;
}

function parsearCarnetEscaneado(entrada: string): EntradaEscaneadaData | null {
  const carnetIdentidad = extraerCarnetDesdeEscaneo(entrada);
  if (!carnetIdentidad) {
    return null;
  }

  const nombresMatch = entrada.match(/N:(.*?)A:/);
  const apellidosMatch = entrada.match(/A:(.*?)CI:/);

  const nombres = normalizarEspacios(nombresMatch?.[1] || '');
  const apellidosTexto = normalizarEspacios(apellidosMatch?.[1] || '');
  const partesApellido = apellidosTexto ? apellidosTexto.split(' ') : [];
  const primerApellido = partesApellido[0] || '';
  const segundoApellido = partesApellido.slice(1).join(' ');

  return {
    carnetIdentidad,
    nombres: capitalizarPalabras(nombres),
    primerApellido: capitalizarPalabras(primerApellido),
    segundoApellido: capitalizarPalabras(segundoApellido),
  };
}

export function usePersonLookup() {
  const [state, setState] = useState<PersonaLookupState>(cargarLookupStatePersistido);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.sessionStorage.setItem(ACCESS_LOOKUP_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignorar errores de persistencia en sesión
    }
  }, [state]);

  const buscarPorEntrada = useCallback(async (entradaCruda: string): Promise<LookupEntradaResult> => {
    const entrada = entradaCruda.trim();
    if (!entrada) {
      return {
        carnetIdentidad: '',
        tipoEntrada: 'desconocida',
        entradaEscaneada: null,
      };
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let apiResult: { found: boolean; persona: UCIPersonaAPI | null; isActive: boolean } = {
        found: false,
        persona: null,
        isActive: false,
      };
      let apiError: string | null = null;
      let criterioBusqueda = 'desconocido';
      let carnetNormalizado: string | null = null;
      let tipoEntrada: TipoEntradaLookup = 'desconocida';
      let entradaEscaneada: EntradaEscaneadaData | null = null;

      if (/^[0-9]{11}/.test(entrada)) {
        // 1) Carnet manual (11 números al inicio)
        carnetNormalizado = entrada.slice(0, 11);
        criterioBusqueda = 'carnet_identidad_manual';
        tipoEntrada = 'carnet_manual';
        try {
          apiResult = await buscarPersonaUCIPorCampo('carnet_identidad', carnetNormalizado);
        } catch (err) {
          apiError = err instanceof Error ? err.message : 'Error consultando API UCI';
          console.warn('Error en API UCI, se intentará con datos locales:', err);
        }
      } else if (entrada.startsWith('N:')) {
        // 2) Carnet escaneado (extraer CI:XXXXXXXXXXX)
        entradaEscaneada = parsearCarnetEscaneado(entrada);
        criterioBusqueda = 'carnet_identidad_escan';
        tipoEntrada = 'carnet_escan';

        if (entradaEscaneada?.carnetIdentidad) {
          carnetNormalizado = entradaEscaneada.carnetIdentidad;
          try {
            apiResult = await buscarPersonaUCIPorCampo('carnet_identidad', entradaEscaneada.carnetIdentidad);
          } catch (err) {
            apiError = err instanceof Error ? err.message : 'Error consultando API UCI';
            console.warn('Error en API UCI, se intentará con datos locales:', err);
          }
        }
      } else {
        // 3/4) Solapín manual o escaneado
        criterioBusqueda = 'numero_solapin';
        tipoEntrada = 'solapin';
        try {
          apiResult = await buscarPersonaUCIPorCampo('numero_solapin', entrada);
          if (!apiResult.found) {
            criterioBusqueda = 'solapin_codigobarra';
            apiResult = await buscarPersonaUCIPorCampo('solapin_codigobarra', entrada);
          }
        } catch (err) {
          apiError = err instanceof Error ? err.message : 'Error consultando API UCI';
          console.warn('Error en API UCI para solapín:', err);
        }
      }

      if (apiResult.persona?.carnet_identidad) {
        carnetNormalizado = apiResult.persona.carnet_identidad;
      }

      // Buscar en la BD local por carnet (solo si hay carnet normalizado)
      let personaLocal: Persona | null = null;
      let ultimasEntradas: RegistroAccesoCompleto[] = [];

      let personaExistente: Persona | null = null;
      if (carnetNormalizado) {
        const { data } = await supabase
          .from('personas')
          .select('*')
          .eq('carnet_identidad', carnetNormalizado)
          .single();

        personaExistente = (data as Persona | null) || null;
      } else if (tipoEntrada === 'solapin') {
        const { data } = await supabase
          .from('personas')
          .select('*')
          .eq('numero_solapin', entrada)
          .single();

        personaExistente = (data as Persona | null) || null;
        if (personaExistente?.carnet_identidad) {
          carnetNormalizado = personaExistente.carnet_identidad;
        }
      }

      if (personaExistente) {
        personaLocal = personaExistente;

        // Cargar últimas 3 entradas
        const { data: entradasDirectas } = await supabase
          .from('registros_acceso')
          .select(`
            *,
            persona:personas(nombre_completo, primer_apellido, segundo_apellido, carnet_identidad, numero_solapin),
            puerta:puertas(nombre, ubicacion),
            guardia:usuarios(nombre, email)
          `)
          .eq('persona_id', personaExistente.id)
          .order('fecha_hora', { ascending: false })
          .limit(3);

        ultimasEntradas = (entradasDirectas || []) as unknown as RegistroAccesoCompleto[];
      }

      // 3. Si la API falló pero tenemos datos locales, no mostrar error al guardia
      const showError = apiError && !personaLocal ? apiError : null;

      await registrarLog('persona_buscada', 'persona', carnetNormalizado || entrada, {
        entrada_original: entrada,
        criterio_busqueda: criterioBusqueda,
        tipo_entrada: tipoEntrada,
        carnet_resuelto: carnetNormalizado,
        encontrada: apiResult.found,
        activa: apiResult.isActive,
        datosLocales: !!personaLocal,
        errorApi: apiError,
        nombre: apiResult.persona
          ? `${apiResult.persona.nombre_completo} ${apiResult.persona.primer_apellido}`
          : personaLocal
          ? `${personaLocal.nombre_completo} ${personaLocal.primer_apellido} (local)`
          : 'No encontrada',
      });

      setState({
        loading: false,
        error: showError,
        persona: apiResult.persona,
        personaLocal,
        found: apiResult.found,
        isActive: apiResult.isActive,
        ultimasEntradas,
      });

      return {
        carnetIdentidad: apiResult.persona?.carnet_identidad || personaLocal?.carnet_identidad || carnetNormalizado || entrada,
        tipoEntrada,
        entradaEscaneada,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMsg,
      }));

      return {
        carnetIdentidad: entrada,
        tipoEntrada: 'desconocida',
        entradaEscaneada: null,
      };
    }
  }, []);

  const buscarPorCarnet = useCallback(async (carnet: string) => {
    return buscarPorEntrada(carnet);
  }, [buscarPorEntrada]);

  const resetear = useCallback(() => {
    setState(DEFAULT_LOOKUP_STATE);
  }, []);

  return { ...state, buscarPorCarnet, buscarPorEntrada, resetear };
}

/**
 * Hook para registrar accesos
 */
export function useRegistrarAcceso() {
  const [loading, setLoading] = useState(false);

  const registrarAcceso = async (params: {
    persona: UCIPersonaAPI | null;
    carnetIdentidad: string;
    puertaId: string;
    guardiaId: string;
    tipoAcceso: TipoAcceso;
    estado: EstadoAcceso;
    motivoAcceso?: string;
    observaciones?: string;
    nombreManual?: string;
    apellido1Manual?: string;
    apellido2Manual?: string;
  }) => {
    setLoading(true);
    try {
      // 1. Buscar o crear persona en BD local
      let personaId: string;
      
      const { data: personaExistente } = await supabase
        .from('personas')
        .select('id')
        .eq('carnet_identidad', params.carnetIdentidad)
        .single();

      if (personaExistente) {
        personaId = personaExistente.id;

        // Si la persona tiene datos "Desconocido" y se proveen datos manuales, actualizar
        if (params.nombreManual || params.apellido1Manual) {
          const { data: personaActual } = await supabase
            .from('personas')
            .select('nombre_completo, primer_apellido')
            .eq('id', personaId)
            .single();

          if (personaActual && (
            personaActual.nombre_completo === 'Desconocido' ||
            personaActual.primer_apellido === 'Desconocido'
          )) {
            const updateData: Record<string, string> = {};
            if (params.nombreManual && personaActual.nombre_completo === 'Desconocido') {
              updateData.nombre_completo = params.nombreManual;
            }
            if (params.apellido1Manual && personaActual.primer_apellido === 'Desconocido') {
              updateData.primer_apellido = params.apellido1Manual;
            }
            if (params.apellido2Manual) {
              updateData.segundo_apellido = params.apellido2Manual;
            }
            if (Object.keys(updateData).length > 0) {
              await supabase.from('personas').update(updateData).eq('id', personaId);
              await registrarLog('persona_actualizada', 'persona', personaId, {
                carnet: params.carnetIdentidad,
                datosActualizados: updateData,
              });
            }
          }
        }
      } else {
        // Crear persona nueva
        const nombreCompleto = params.persona
          ? `${params.persona.primer_nombre || ''} ${params.persona.segundo_nombre || ''}`.trim()
          : params.nombreManual || 'Desconocido';
        
        const { data: nuevaPersona, error: errorPersona } = await supabase
          .from('personas')
          .insert({
            nombre_completo: nombreCompleto,
            primer_apellido: params.persona?.primer_apellido || params.apellido1Manual || 'Desconocido',
            segundo_apellido: params.persona?.segundo_apellido || params.apellido2Manual || null,
            carnet_identidad: params.carnetIdentidad,
            numero_solapin: params.persona?.numero_solapin || null,
          })
          .select('id')
          .single();

        if (errorPersona) throw errorPersona;
        personaId = nuevaPersona.id;

        await registrarLog('persona_creada', 'persona', personaId, {
          carnet: params.carnetIdentidad,
          nombre: nombreCompleto,
        });
      }

      // 2. Crear registro de acceso
      const { data: registro, error: errorRegistro } = await supabase
        .from('registros_acceso')
        .insert({
          persona_id: personaId,
          puerta_id: params.puertaId,
          guardia_id: params.guardiaId,
          tipo_acceso: params.tipoAcceso,
          estado: params.estado,
          motivo_acceso: params.motivoAcceso || null,
          observaciones: params.observaciones || null,
        })
        .select()
        .single();

      if (errorRegistro) throw errorRegistro;

      // 3. Log
      const accionLog = params.estado === 'permitido' ? 'acceso_permitido' : 'acceso_denegado';
      await registrarLog(accionLog, 'acceso', registro.id, {
        persona_id: personaId,
        carnet: params.carnetIdentidad,
        puerta_id: params.puertaId,
        tipo_acceso: params.tipoAcceso,
        estado: params.estado,
        motivo: params.motivoAcceso,
      });

      return registro;
    } catch (err) {
      await registrarLog('error_sistema', 'acceso', undefined, {
        error: err instanceof Error ? err.message : 'Error desconocido',
        carnet: params.carnetIdentidad,
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { registrarAcceso, loading };
}

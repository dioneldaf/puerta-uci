import { useState, useCallback } from 'react';
import { buscarPersonaUCI } from '../lib/uciApi';
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

export function usePersonLookup() {
  const [state, setState] = useState<PersonaLookupState>({
    loading: false,
    error: null,
    persona: null,
    personaLocal: null,
    found: false,
    isActive: false,
    ultimasEntradas: [],
  });

  const buscarPorCarnet = useCallback(async (carnet: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // 1. Buscar en API UCI (puede fallar por red, etc.)
      let apiResult: { found: boolean; persona: UCIPersonaAPI | null; isActive: boolean } = {
        found: false,
        persona: null,
        isActive: false,
      };
      let apiError: string | null = null;

      try {
        apiResult = await buscarPersonaUCI(carnet);
      } catch (err) {
        apiError = err instanceof Error ? err.message : 'Error consultando API UCI';
        console.warn('Error en API UCI, se intentará con datos locales:', err);
      }

      // 2. Siempre buscar en la BD local (persona + últimas entradas)
      let personaLocal: Persona | null = null;
      let ultimasEntradas: RegistroAccesoCompleto[] = [];

      const { data: personaExistente } = await supabase
        .from('personas')
        .select('*')
        .eq('carnet_identidad', carnet)
        .single();

      if (personaExistente) {
        personaLocal = personaExistente as Persona;

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

      await registrarLog('persona_buscada', 'persona', carnet, {
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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMsg,
      }));
    }
  }, []);

  const resetear = useCallback(() => {
    setState({
      loading: false,
      error: null,
      persona: null,
      personaLocal: null,
      found: false,
      isActive: false,
      ultimasEntradas: [],
    });
  }, []);

  return { ...state, buscarPorCarnet, resetear };
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

import type { UCISearchResponse, UCIPersonaAPI } from '../types';

const UCI_API_URL = import.meta.env.VITE_UCI_API_URL || '/api/uci/sgu-directorio/_search';
const UCI_API_AUTH = import.meta.env.VITE_UCI_API_AUTH || 'Basic Y2FjY2VzbzpTaVRyMipzc2R5dDUzQUswMjQt';

type UCISearchField = 'carnet_identidad' | 'numero_solapin' | 'solapin_codigobarra';

/**
 * Buscar persona en el directorio UCI por carnet de identidad
 */
export async function buscarPersonaUCI(carnetIdentidad: string): Promise<{
  found: boolean;
  persona: UCIPersonaAPI | null;
  isActive: boolean;
}> {
  return buscarPersonaUCIPorCampo('carnet_identidad', carnetIdentidad);
}

/**
 * Buscar persona en el directorio UCI por un campo específico
 */
export async function buscarPersonaUCIPorCampo(campo: UCISearchField, valor: string): Promise<{
  found: boolean;
  persona: UCIPersonaAPI | null;
  isActive: boolean;
}> {
  try {
    const query = `${campo}:${valor}`;
    const url = `${UCI_API_URL}?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': UCI_API_AUTH,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error en API UCI: ${response.status} ${response.statusText}`);
    }

    const data: UCISearchResponse = await response.json();

    if (data.hits.total.value === 0 || data.hits.hits.length === 0) {
      return { found: false, persona: null, isActive: false };
    }

    const persona = data.hits.hits[0]._source;
    const isActive = !persona.baja;

    return { found: true, persona, isActive };
  } catch (error) {
    console.error('Error buscando persona en UCI:', error);
    throw error;
  }
}

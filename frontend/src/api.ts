// Centraliza la lectura de respuestas para no mostrar errores internos de JSON.
export async function consultarJson(url: string, options?: RequestInit, respuestaInvalida = 'No se pudo leer la respuesta del servidor. Intentá nuevamente.') {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'veterinaria', ...options?.headers },
  });
  if (response.status === 401) {
    window.dispatchEvent(new Event('sesion-vencida'));
    throw new Error('La sesión venció. Iniciá sesión nuevamente.');
  }
  if (response.status === 204) return null;
  let data;
  try { data = await response.json(); }
  catch { throw new Error(respuestaInvalida); }
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo completar la operación');
  return data;
}

// Usar para los listados de veterinarios, dueños y gestores.
// Solo una respuesta vacía válida representa un listado sin registros.
export async function consultarListado<T>(url: string): Promise<T[]> {
  const data = await consultarJson(url, undefined, 'No se pudo cargar el listado. El servidor devolvió una respuesta inválida.');
  if (data === null) return [];
  if (!Array.isArray(data)) throw new Error('No se pudo cargar el listado. El servidor devolvió una respuesta inválida.');
  return data;
}

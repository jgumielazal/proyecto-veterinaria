import { useState } from 'react';
export type DatosMascota = {
  id: number; nombre: string; especie: string; edad: number; raza: string;
  pedigree: boolean; descripcion: string; fecha: string | null;
  reportes: { id: number; texto: string; fecha: string | null }[];
};
export function resumirReporte(texto: string) {
  const caracteres = Array.from(texto);
  return caracteres.length > 100 ? caracteres.slice(0, 100).join('') + '…' : texto;
}
function fechaVisible(fecha: string | null) {
  return fecha ? fecha.split('-').reverse().join('/') : '-';
}
export function DatosAnimal({ mascota }: { mascota: DatosMascota }) {
  return (
      <dl className="veterinario-perfil datos-animal">
        <dt>Nombre</dt><dd>{mascota.nombre}</dd>
        <dt>Especie</dt><dd>{mascota.especie}</dd>
        <dt>Edad (años)</dt><dd>{mascota.edad}</dd>
        <dt>Raza</dt><dd>{mascota.raza || '-'}</dd>
        <dt>Pedigree</dt><dd>{mascota.pedigree ? 'Sí' : 'No'}</dd>
        <dt>Descripción</dt><dd className="reporte-texto">{mascota.descripcion || '-'}</dd>
        <dt>Fecha de subida al sistema</dt><dd>{fechaVisible(mascota.fecha)}</dd>
      </dl>
  );
}
export default function DetalleMascota({ mascota, onVolver, onActualizar }: { mascota: DatosMascota; onVolver: () => void; onActualizar?: () => void }) {
  const [verTodos, setVerTodos] = useState(false);
  const ultimo = mascota.reportes[0];
  const expandible = mascota.reportes.length > 1 || (ultimo && Array.from(ultimo.texto).length > 100);
  return <div>
    <button className="secondary admin-back" onClick={onVolver}>Volver al listado de mascotas</button>
    <section aria-labelledby="datos-mascota">
      <div className="section-header"><h2 id="datos-mascota">Datos de la mascota</h2>{onActualizar && <button onClick={onActualizar}>Actualizar</button>}</div>
      <DatosAnimal mascota={mascota} />
    </section>
    <section aria-labelledby="reportes-mascota">
      <h2 id="reportes-mascota">Reportes</h2>
      <div id="contenido-reportes">
        {!ultimo ? <p>-</p> : <ul className="reportes-lista">
          {(verTodos ? mascota.reportes : [ultimo]).map(reporte => <li key={reporte.id}>
            <p><strong>{reporte.fecha ? <time dateTime={reporte.fecha}>{fechaVisible(reporte.fecha)}</time> : '-'}</strong></p>
            <p className="reporte-texto">{verTodos ? reporte.texto : resumirReporte(reporte.texto)}</p>
          </li>)}
        </ul>}
      </div>
      {expandible && <button className="secondary" aria-expanded={verTodos} aria-controls="contenido-reportes" onClick={() => setVerTodos(!verTodos)}>{verTodos ? 'Ver menos' : 'Ver más'}</button>}
    </section>
  </div>;
}

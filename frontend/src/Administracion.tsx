import { useEffect, useRef, useState } from 'react';
import Veterinarios from './Veterinarios';
import ListadoVeterinarios from './ListadoVeterinarios';

const secciones = [
  { nombre: 'Veterinarios', descripcion: 'Elegí una opción para gestionar veterinarios.' },
  { nombre: 'Dueños', descripcion: 'Sección de dueños de mascotas.' },
  { nombre: 'Administración', descripcion: 'Sección de administración general.' },
] as const;
type Seccion = typeof secciones[number]['nombre'];

export default function Administracion() {
  const [seccion, setSeccion] = useState<Seccion | null>(null);
  const [opcionVeterinarios, setOpcionVeterinarios] = useState<'Crear veterinario' | 'Listado de veterinarios' | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeraVista = useRef(true);

  useEffect(() => {
    if (primeraVista.current) primeraVista.current = false;
    else titulo.current?.focus();
  }, [seccion, opcionVeterinarios]);

  return <main>
    {seccion && <div className="actions admin-back"><button className="secondary" onClick={() => {
      if (opcionVeterinarios) setOpcionVeterinarios(null);
      else setSeccion(null);
    }}>← {opcionVeterinarios ? 'Volver a Veterinarios' : 'Volver al menú principal'}</button>
      {opcionVeterinarios && <button type="button" className="secondary" onClick={() => {
        setOpcionVeterinarios(null);
        setSeccion(null);
      }}>Ir al menú principal</button>}
    </div>}
    <header>
      <p>Panel de administrador</p>
      <h1 ref={titulo} tabIndex={-1}>{opcionVeterinarios ?? seccion ?? 'Menú principal'}</h1>
      <p>{opcionVeterinarios ? 'Veterinarios' : seccion ? secciones.find(item => item.nombre === seccion)?.descripcion : 'Elegí una sección para continuar.'}</p>
    </header>
    {seccion === null ? <nav className="admin-menu" aria-label="Menú principal del administrador">
      {secciones.map(item => <button key={item.nombre} className="admin-card" onClick={() => setSeccion(item.nombre)}>
        <span className="admin-card-title">{item.nombre}</span>
        <span className="admin-card-description">{item.descripcion}</span>
        <span className="admin-card-link">Ingresar →</span>
      </button>)}
    </nav> : seccion === 'Veterinarios' ? (
      opcionVeterinarios === null ? <nav className="admin-menu" aria-label="Opciones de veterinarios">
        <button className="admin-card" onClick={() => setOpcionVeterinarios('Crear veterinario')}>
          <span className="admin-card-title">Crear veterinario</span>
          <span className="admin-card-description">Creá una cuenta para un veterinario.</span>
          <span className="admin-card-link">Ingresar →</span>
        </button>
        <button className="admin-card" onClick={() => setOpcionVeterinarios('Listado de veterinarios')}>
          <span className="admin-card-title">Listado de veterinarios</span>
          <span className="admin-card-description">Consultá los profesionales registrados y accedé a sus perfiles.</span>
          <span className="admin-card-link">Ingresar →</span>
        </button>
      </nav> : opcionVeterinarios === 'Crear veterinario' ? <Veterinarios /> : <ListadoVeterinarios />
    ) : <section>
      <h2>{seccion === 'Dueños' ? 'Gestión de dueños' : 'Administración general'}</h2>
      <p>Las funciones de esta sección todavía no están disponibles.</p>
    </section>}
  </main>;
}

# Usuarios y mascotas (MVP local)

La migración `migrations/003_usuarios_sesiones.sql` agrega usuarios, sesiones y el dueño de cada mascota. Ya fue aplicada a la base local. Para otra instalación, ejecutar las migraciones en orden desde la raíz:

```sh
docker compose up -d
docker compose exec -T postgres psql -U veterinaria -d veterinaria -v ON_ERROR_STOP=1 < backend/migrations/001_crear_mascotas.sql
docker compose exec -T postgres psql -U veterinaria -d veterinaria -v ON_ERROR_STOP=1 < backend/migrations/002_baja_logica_mascotas.sql
docker compose exec -T postgres psql -U veterinaria -d veterinaria -v ON_ERROR_STOP=1 < backend/migrations/003_usuarios_sesiones.sql
docker compose exec -T postgres psql -U veterinaria -d veterinaria -v ON_ERROR_STOP=1 < backend/migrations/004_tipos_usuario.sql
```

Arrancar backend con `cd backend && npm start` y frontend en otra terminal con `cd frontend && npm run dev`. Abrir http://localhost:5173. No hacen falta secretos ni dependencias nuevas para uso local.

- POST `/auth/login`: JSON con email y contraseña. Para cuentas pendientes basta el email. El registro público fue retirado.
- GET `/auth/me`: usuario actual.
- POST `/auth/logout`: revoca la sesión.
- Las escrituras requieren el encabezado `X-Requested-With: veterinaria`; el frontend lo envía automáticamente. Desde el frontend las rutas llevan `/api` por el proxy de Vite.
- Cookies HttpOnly y SameSite=Strict; sesiones en PostgreSQL que vencen a los 7 días. Contraseñas con scrypt y sal aleatoria. El login no tiene límite de intentos ni período de espera.
- Todas las operaciones de mascotas requieren sesión. El dueño lo determina el backend, nunca el cuerpo enviado por el cliente.
- Las mascotas anteriores se conservan sin dueño y no son accesibles por las cuentas nuevas. No se asignan automáticamente.

Con los tres servicios activos, ejecutar desde la raíz `node backend/tests/auth.cjs`. La prueba usa dos cuentas temporales, comprueba aislamiento y limpia únicamente sus propios datos. No automatiza la interfaz visual.

Esto está configurado para desarrollo local. Para publicarlo se necesita HTTPS, `NODE_ENV=production` (activa la cookie Secure), y un proxy que sirva `/api` hacia el backend; el proxy de Vite es de desarrollo.

## Tipos de usuario

La migración `004_tipos_usuario.sql` agrega `usuarios.tipo`, obligatorio y limitado a `cliente` (dueño), `veterinario` o `admin`. El alta de clientes está disponible para administradores y veterinarios y fija el rol `cliente` en el servidor. El formulario y la ruta de registro público se eliminaron. Las cuentas existentes conservan su acceso.

Los clientes tienen acceso de solo lectura a sus propias mascotas. Las respuestas de autenticación incluyen `id`, `email` y `tipo`.
El administrador ve un menú principal con Veterinarios, Dueños y Administración al iniciar sesión. Dentro de Veterinarios están Crear veterinario y Listado de veterinarios; el listado incluye activos e inactivos y permite abrir el perfil de solo lectura, editar sus datos o darlo de baja lógica. El botón Ir al menú principal sigue disponible; Dueños permite añadir y listar dueños, editar sus datos y gestionar sus mascotas y reportes. Administración todavía no tiene funciones disponibles. Los veterinarios usan el mismo menú principal, que muestra únicamente Dueños con esas mismas funciones. El servidor permite a veterinarios solo las rutas `/admin/duenos` y sus subrutas; las demás rutas `/admin` siguen siendo exclusivas del administrador.


## Alta de veterinarios por administradores

La migración `005_datos_veterinarios.sql` agrega nombre y matrícula a los usuarios.
La migración `006_especialidad_veterinarios.sql` agrega especialidad.
Aplicar ambas antes de usar esta función. Los campos son opcionales en las cuentas
anteriores; el alta de veterinarios exige nombre, email, contraseña, matrícula y
especialidad, sin valores vacíos.

POST `/admin/veterinarios` recibe `{ "nombre": "Ana Pérez", "email": "ana@example.com", "password": "contraseña segura", "matricula": "MP-123", "especialidad": "Clínica general" }`.
Requiere sesión de administrador y el encabezado de escritura habitual. El servidor
consulta el rol vigente en la base y fija `veterinario` al crear la cuenta; no inicia
una sesión a nombre del veterinario ni cambia la sesión del administrador.
Devuelve 201 al crear, 400 por datos inválidos, 409 por email duplicado,
401 sin sesión y 403 si el usuario no es administrador.
La matrícula se guarda como texto (hasta 80 caracteres), sin imponer unicidad
porque puede depender de la jurisdicción. Las contraseñas se guardan con scrypt.

Prueba de integración: desde backend, `node --require tsx/cjs tests/admin.cjs`.
Usa un servidor temporal y limpia únicamente las cuentas creadas por la prueba.

## Gestión de veterinarios

Requiere aplicar `007_estado_usuarios.sql` mediante el ejecutor de migraciones.

- GET `/admin/veterinarios`: lista profesionales activos e inactivos.
- GET `/admin/veterinarios/:id`: perfil con nombre, email, matrícula, especialidad y activo.
- PUT `/admin/veterinarios/:id`: modifica nombre, email, matrícula y especialidad; conserva contraseña, rol y estado.
- DELETE `/admin/veterinarios/:id`: establece `activo = false`, sin eliminar el usuario. Repetir la baja es seguro.

Todas las rutas requieren sesión de administrador; las escrituras requieren el encabezado habitual. Devuelven 404 si no existe un veterinario con ese identificador. Los usuarios inactivos no pueden iniciar sesión y sus sesiones existentes dejan de autenticar. No se exponen hashes de contraseñas.

## DNI de usuarios

La migración `008_dni_usuarios.sql` agrega `dni` como texto obligatorio, único y de exactamente ocho dígitos ASCII. Conserva ceros iniciales. El índice único permite búsquedas por DNI; el listado de dueños incluye un filtro por DNI completo o parcial.

Asigna DNI ficticios `11111111`, `22222222`, etc. por posición en `ORDER BY id`, sin usar el valor del ID como número de orden. Si hay más de nueve usuarios, detiene la migración sin cambios para evitar valores inválidos o repetidos; se debe definir otra secuencia para ese caso.

El alta de clientes y el alta/edición de veterinarios requieren `dni` como cadena de ocho dígitos sin puntos ni espacios. Un DNI inválido devuelve 400 y un duplicado devuelve 409. El login sigue usando email y contraseña. Las bajas lógicas conservan su DNI reservado.

Prueba de migración: `node --require tsx/cjs tests/dni.cjs` desde backend; utiliza tablas temporales y revierte todo al terminar.

## Alta de dueños desde administración

POST `/admin/duenos` requiere sesión de admin o veterinario y recibe `nombre` (nombre y apellido obligatorios, hasta 150 caracteres), `dni` y `email`. Siempre crea un cliente, no establece cookies ni inicia sesión como el dueño. Guarda la cuenta en estado pendiente con contraseña nula. El dueño elige su contraseña en el primer ingreso.

GET `/admin/duenos` devuelve únicamente `id`, `nombre`, `dni` y `email` de usuarios de tipo cliente, con acceso para administradores y veterinarios. En Dueños → Listado de dueños, la tabla filtra por DNI completo o parcial. Los nombres no registrados y los resultados vacíos se muestran con `-`.

GET `/admin/duenos/:id` muestra los datos del dueño y sus mascotas activas. Está disponible para administradores y veterinarios, filtra por el ID del dueño y no cambia la sesión. El botón Detalle del listado abre esta vista de lectura; conserva el acceso al menú principal y permite volver al listado.

## Activación en el primer ingreso

`011_activacion_usuarios.sql` agrega `estado_activacion` (`pendiente` o `activada`). Una cuenta pendiente requiere `password_hash IS NULL`; una activada requiere un hash no vacío. `activo` representa la baja lógica y es independiente de la activación. Las cuentas existentes conservan sus hashes y quedan activadas.

El alta administrativa de dueños guarda una cuenta pendiente sin contraseña ni sesión. `POST /auth/login` detecta ese estado por email, con o sin contraseña, y devuelve `{ pendiente: true, email }` sin otorgar acceso. `POST /auth/activar` recibe email, password y repetirPassword; valida igualdad y longitud (8 a 128 caracteres), guarda un hash scrypt y activa la cuenta con una actualización condicional. Solo una solicitud concurrente puede activarla. Una cuenta activada o inactiva nunca puede usar este endpoint para reemplazar su contraseña.

Este flujo no verifica identidad mediante email ni código: quien conozca el correo de una cuenta pendiente puede activarla. Es el comportamiento solicitado para esta etapa. El registro público fue eliminado.

Los clientes consultan sus datos, mascotas activas y reportes en `/dueno` y `/dueno/mascotas/:id`. El dueño se determina a partir de la sesión. El backend rechaza sus escrituras en `/mascotas` y su acceso a `/admin`.

Prueba: desde backend, `node --require tsx/cjs tests/primer-acceso.cjs`. Usa cuentas temporales y elimina únicamente sus propios datos.

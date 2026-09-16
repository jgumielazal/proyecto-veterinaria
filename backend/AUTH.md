# Usuarios y mascotas (MVP local)

La migración `migrations/003_usuarios_sesiones.sql` agrega usuarios, sesiones y el dueño de cada mascota. Ya fue aplicada a la base local. Para otra instalación, ejecutar las migraciones en orden desde la raíz:

```sh
docker compose up -d
docker compose exec -T postgres psql -U veterinaria -d veterinaria -v ON_ERROR_STOP=1 < backend/migrations/001_crear_mascotas.sql
docker compose exec -T postgres psql -U veterinaria -d veterinaria -v ON_ERROR_STOP=1 < backend/migrations/002_baja_logica_mascotas.sql
docker compose exec -T postgres psql -U veterinaria -d veterinaria -v ON_ERROR_STOP=1 < backend/migrations/003_usuarios_sesiones.sql
```

Arrancar backend con `cd backend && npm start` y frontend en otra terminal con `cd frontend && npm run dev`. Abrir http://localhost:5173. No hacen falta secretos ni dependencias nuevas para uso local.

- POST `/auth/registro` y `/auth/login`: JSON `{ "email": "persona@example.com", "password": "contraseña de al menos 8 caracteres" }`. El registro también inicia sesión.
- GET `/auth/me`: usuario actual.
- POST `/auth/logout`: revoca la sesión.
- Las escrituras requieren el encabezado `X-Requested-With: veterinaria`; el frontend lo envía automáticamente. Desde el frontend las rutas llevan `/api` por el proxy de Vite.
- Cookies HttpOnly y SameSite=Strict; sesiones en PostgreSQL que vencen a los 7 días. Contraseñas con scrypt y sal aleatoria. Se limita registro/login a 20 intentos por IP en 15 minutos (contador en memoria). En el proxy local las solicitudes comparten IP.
- Todas las operaciones de mascotas requieren sesión. El dueño lo determina el backend, nunca el cuerpo enviado por el cliente.
- Las mascotas anteriores se conservan sin dueño y no son accesibles por las cuentas nuevas. No se asignan automáticamente.

Con los tres servicios activos, ejecutar desde la raíz `node backend/tests/auth.cjs`. La prueba usa dos cuentas temporales, comprueba aislamiento y limpia únicamente sus propios datos. No automatiza la interfaz visual.

Esto está configurado para desarrollo local. Para publicarlo se necesita HTTPS, `NODE_ENV=production` (activa la cookie Secure), y un proxy que sirva `/api` hacia el backend; el proxy de Vite es de desarrollo.

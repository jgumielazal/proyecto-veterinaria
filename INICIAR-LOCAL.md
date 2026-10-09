# Cómo iniciar el proyecto en tu Mac

Cada vez que reiniciás la computadora o cerrás las terminales, los servidores locales pueden quedar apagados. Para probar tus cambios, necesitás Docker (PostgreSQL), el backend y el frontend funcionando.

1. Abrí Docker desde Aplicaciones y esperá a que indique que está funcionando. Si macOS dice que falta el ejecutable, necesitás reparar o reinstalar Docker Desktop conservando sus datos.
2. Abrí Terminal y ejecutá:

   ```sh
   cd /Users/juangumiela/mi-proyecto-mascotas
   docker compose up -d
   ```

   Esto inicia la base de datos existente sin borrar los datos. No uses `docker compose down -v`: elimina el volumen de la base de datos.

3. En esa terminal, ejecutá:

   ```sh
   cd /Users/juangumiela/mi-proyecto-mascotas/backend
   npm run dev
   ```

4. Abrí otra ventana o pestaña de Terminal (⌘T) y ejecutá:

   ```sh
   cd /Users/juangumiela/mi-proyecto-mascotas/frontend
   npm run dev
   ```

5. Dejá ambas terminales abiertas y entrá a http://localhost:5173. Los cambios del código se actualizan automáticamente mientras los servidores siguen activos.

Para detener un servidor, presioná Control+C en su terminal. Para volver a iniciarlo, ejecutá otra vez `npm run dev` en su carpeta.

## Comprobar qué está funcionando

- http://localhost:5173: abre la web. Si muestra `ERR_CONNECTION_REFUSED`, revisá la terminal del frontend.
- http://localhost:3001/health: debe devolver `{"status":"ok"}`. Si devuelve `{"status":"error"}`, revisá Docker y ejecutá `docker compose up -d` desde la carpeta del proyecto. Si no conecta, revisá la terminal del backend.
- `docker compose ps`, desde la carpeta del proyecto: muestra el estado de PostgreSQL.

No hace falta reinstalar dependencias ni ejecutar migraciones cada vez que iniciás. Las migraciones se ejecutan cuando los cambios del proyecto lo requieren; las instrucciones están en `backend/migrations/README.md`.

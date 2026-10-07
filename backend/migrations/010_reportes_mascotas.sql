CREATE TABLE reportes_mascotas (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mascota_id INTEGER NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  texto TEXT NOT NULL CHECK (btrim(texto) <> ''),
  fecha DATE
);
CREATE INDEX reportes_mascotas_historial_idx ON reportes_mascotas(mascota_id, fecha DESC, id DESC);
INSERT INTO reportes_mascotas(mascota_id,texto,fecha)
SELECT id,reporte,fecha FROM mascotas WHERE btrim(reporte) <> '';

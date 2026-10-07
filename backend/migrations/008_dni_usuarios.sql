-- El ejecutor aplica esta migración y su registro en una única transacción.
ALTER TABLE usuarios ADD COLUMN dni TEXT;
-- La secuencia de ocho dígitos repetidos alcanza hasta nueve usuarios.
-- Evitar inventar otra secuencia o repetir DNI en bases más grandes.
DO $$ BEGIN
  IF (SELECT count(*) FROM usuarios) > 9 THEN
    RAISE EXCEPTION 'La asignación de DNI ficticios repetidos admite hasta 9 usuarios';
  END IF;
END $$;
WITH ordenados AS (
  SELECT id, row_number() OVER (ORDER BY id) AS posicion FROM usuarios
)
UPDATE usuarios u SET dni = repeat(o.posicion::text, 8)
FROM ordenados o WHERE u.id = o.id;
ALTER TABLE usuarios
  ALTER COLUMN dni SET NOT NULL,
  ADD CONSTRAINT usuarios_dni_formato CHECK (dni ~ '^[0-9]{8}$'),
  ADD CONSTRAINT usuarios_dni_key UNIQUE (dni);

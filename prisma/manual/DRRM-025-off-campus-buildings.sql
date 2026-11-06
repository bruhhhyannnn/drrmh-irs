-- DRRM-025: off-campus buildings. A building is now one of two shapes:
--   Campus:     has a unit, as before. Its campus comes through unit → cluster → campus.
--   Off-campus: no unit. Has the evaluator's campus (who owns it) and a PSGC location.
-- Existing rows all have a unit, so they stay Campus and aren't touched. Safe to re-run.

ALTER TABLE public.buildings ALTER COLUMN unit_id DROP NOT NULL;

ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS campus_id     UUID REFERENCES public.campus (id) ON DELETE NO ACTION,
  ADD COLUMN IF NOT EXISTS region_code   TEXT,
  ADD COLUMN IF NOT EXISTS region_name   TEXT,
  ADD COLUMN IF NOT EXISTS province_code TEXT,
  ADD COLUMN IF NOT EXISTS province_name TEXT,
  ADD COLUMN IF NOT EXISTS city_code     TEXT,
  ADD COLUMN IF NOT EXISTS city_name     TEXT,
  ADD COLUMN IF NOT EXISTS barangay_code TEXT,
  ADD COLUMN IF NOT EXISTS barangay_name TEXT,
  ADD COLUMN IF NOT EXISTS latitude      DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude     DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS location_name TEXT;

ALTER TABLE public.buildings DROP CONSTRAINT IF EXISTS chk_buildings_place;
ALTER TABLE public.buildings ADD CONSTRAINT chk_buildings_place CHECK (
  (
    unit_id IS NOT NULL
    AND campus_id IS NULL
    AND region_code IS NULL
    AND region_name IS NULL
    AND province_code IS NULL
    AND province_name IS NULL
    AND city_code IS NULL
    AND city_name IS NULL
    AND barangay_code IS NULL
    AND barangay_name IS NULL
    AND latitude IS NULL
    AND longitude IS NULL
    AND location_name IS NULL
  )
  OR (
    unit_id IS NULL
    AND campus_id IS NOT NULL
    AND region_code IS NOT NULL
    AND region_name IS NOT NULL
    AND (province_code IS NULL) = (province_name IS NULL)
    AND city_code IS NOT NULL
    AND city_name IS NOT NULL
    AND barangay_code IS NOT NULL
    AND barangay_name IS NOT NULL
    AND (latitude IS NULL) = (longitude IS NULL)
  )
);

-- A second submit of the same new building finds the first, as uq_buildings_unit_name does on campus.
CREATE UNIQUE INDEX IF NOT EXISTS uq_buildings_campus_barangay_name
  ON public.buildings (campus_id, barangay_code, lower(name))
  WHERE unit_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_buildings_campus
  ON public.buildings (campus_id)
  WHERE campus_id IS NOT NULL;

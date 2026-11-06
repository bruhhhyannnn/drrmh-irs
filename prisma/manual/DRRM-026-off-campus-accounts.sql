-- DRRM-026: off-campus accounts. A Super Admin can make an ERT Member account for someone outside
-- UP: it has no campus, cluster, unit or position, and its own profile fields instead. Buildings
-- such an account adds belong to no campus, so only Super Admins see them. Needs
-- DRRM-025-off-campus-buildings.sql first. Safe to re-run.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_off_campus        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS address              TEXT,
  ADD COLUMN IF NOT EXISTS organization         TEXT,
  ADD COLUMN IF NOT EXISTS organization_address TEXT,
  ADD COLUMN IF NOT EXISTS position_title       TEXT;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_users_off_campus;
ALTER TABLE public.users ADD CONSTRAINT chk_users_off_campus CHECK (
  NOT is_off_campus
  OR (campus_id IS NULL AND cluster_id IS NULL AND unit_id IS NULL AND position_id IS NULL)
);

-- An off-campus building may now have no campus (added by an off-campus account).
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

-- No campus counts as one group, so two off-campus accounts can't add the same building twice.
DROP INDEX IF EXISTS public.uq_buildings_campus_barangay_name;
CREATE UNIQUE INDEX uq_buildings_campus_barangay_name
  ON public.buildings (campus_id, barangay_code, lower(name)) NULLS NOT DISTINCT
  WHERE unit_id IS NULL;

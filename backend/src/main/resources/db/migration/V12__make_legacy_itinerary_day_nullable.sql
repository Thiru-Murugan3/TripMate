-- Some deployed databases already recorded V10 before its compatibility
-- adjustment was added. Run the day_id repair under a new Flyway version so
-- those databases also receive it.
UPDATE itinerary_items
SET itinerary_day_id = day_id
WHERE itinerary_day_id IS NULL
  AND day_id IS NOT NULL;

ALTER TABLE itinerary_items
    MODIFY COLUMN day_id BIGINT NULL;

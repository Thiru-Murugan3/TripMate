-- The original TiDB design called the itinerary title "activity". Current
-- TripMate uses "title", but writes both columns for backwards compatibility.
ALTER TABLE itinerary_items
    ADD COLUMN IF NOT EXISTS activity VARCHAR(180) NULL;

UPDATE itinerary_items
SET activity = title
WHERE activity IS NULL
  AND title IS NOT NULL;

ALTER TABLE itinerary_items
    MODIFY COLUMN activity VARCHAR(180) NOT NULL;

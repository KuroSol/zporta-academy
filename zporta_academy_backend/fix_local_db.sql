-- Add missing updated_at column to lessons_lesson table
ALTER TABLE lessons_lesson 
ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);

-- Create index on updated_at
CREATE INDEX lessons_les_updated_50d980_idx ON lessons_lesson(updated_at);

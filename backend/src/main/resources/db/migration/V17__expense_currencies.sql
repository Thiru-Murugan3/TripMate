ALTER TABLE expenses
    ADD COLUMN original_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    ADD COLUMN original_amount DECIMAL(12,2) NULL,
    ADD COLUMN exchange_rate DECIMAL(18,8) NOT NULL DEFAULT 1;
UPDATE expenses SET original_amount = amount;
ALTER TABLE expenses MODIFY COLUMN original_amount DECIMAL(12,2) NOT NULL;

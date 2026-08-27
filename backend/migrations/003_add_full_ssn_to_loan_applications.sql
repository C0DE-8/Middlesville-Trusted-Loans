ALTER TABLE loan_applications
  ADD COLUMN ssn VARCHAR(32) NULL AFTER dependents;

ALTER TABLE loan_applications
  ADD UNIQUE INDEX uniq_loan_applications_email (email);

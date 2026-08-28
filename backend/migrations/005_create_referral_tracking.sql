ALTER TABLE loan_applications
  ADD COLUMN agent_id INT NULL AFTER id,
  ADD COLUMN agent_referral_code VARCHAR(40) NULL AFTER agent_id,
  ADD INDEX idx_loan_applications_agent_id (agent_id),
  ADD CONSTRAINT fk_loan_applications_agent
    FOREIGN KEY (agent_id) REFERENCES agents(id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS referral_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  required_approved_applications INT NOT NULL DEFAULT 5,
  payout_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO referral_settings (id, required_approved_applications, payout_amount)
VALUES (1, 5, 0.00)
ON DUPLICATE KEY UPDATE id = id;

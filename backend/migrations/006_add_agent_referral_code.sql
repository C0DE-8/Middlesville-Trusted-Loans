SET @add_agent_referral_code = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE agents ADD COLUMN referral_code VARCHAR(40) NULL AFTER id',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agents'
    AND COLUMN_NAME = 'referral_code'
);
PREPARE add_agent_referral_code_stmt FROM @add_agent_referral_code;
EXECUTE add_agent_referral_code_stmt;
DEALLOCATE PREPARE add_agent_referral_code_stmt;

UPDATE agents
SET referral_code = CONCAT('AGENT', id)
WHERE referral_code IS NULL OR referral_code = '';

SET @add_agent_referral_code_unique = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE agents ADD UNIQUE INDEX referral_code (referral_code)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agents'
    AND INDEX_NAME = 'referral_code'
);
PREPARE add_agent_referral_code_unique_stmt FROM @add_agent_referral_code_unique;
EXECUTE add_agent_referral_code_unique_stmt;
DEALLOCATE PREPARE add_agent_referral_code_unique_stmt;

ALTER TABLE agents
  MODIFY referral_code VARCHAR(40) NOT NULL;

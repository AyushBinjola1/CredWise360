-- Renames the two built-in demonstration accounts in databases that were seeded earlier.
-- Only rows still carrying the previous demonstration names are touched, so real users are unaffected.
UPDATE users SET name='Ayush' WHERE email='borrower@credwise.test' AND name='Aarav Mehta';
UPDATE users SET name='Ayush Binjola' WHERE email='admin@credwise.test' AND name='Meera Rao';
UPDATE kyc_records SET legal_name='Ayush'
 WHERE legal_name='Aarav Mehta' AND user_id=(SELECT id FROM users WHERE email='borrower@credwise.test');

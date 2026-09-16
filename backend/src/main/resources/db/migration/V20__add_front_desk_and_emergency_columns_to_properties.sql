-- V20: Front-Desk Emergency Contacts & Property Operating Policies

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS emergency_hospital_phone VARCHAR(50) DEFAULT '108',
ADD COLUMN IF NOT EXISTS emergency_police_phone VARCHAR(50) DEFAULT '112',
ADD COLUMN IF NOT EXISTS emergency_electrician_phone VARCHAR(50) DEFAULT '+91 98450 99881',
ADD COLUMN IF NOT EXISTS emergency_plumber_phone VARCHAR(50) DEFAULT '+91 98450 99882',
ADD COLUMN IF NOT EXISTS curfew_time VARCHAR(50) DEFAULT '10:30 PM',
ADD COLUMN IF NOT EXISTS lost_key_penalty_fee NUMERIC(10, 2) DEFAULT 200.00;

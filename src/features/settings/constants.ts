export const CATEGORY_TABLES = { school_types: 'School types', curricula: 'Curricula', grade_levels: 'Grade levels', facilities: 'Facilities', accreditations: 'Accreditations', fee_categories: 'Fee categories' } as const;
export const STAFF_ROLES = [
  ['super_admin', 'Super Admin', 'Full access, including users and roles'],
  ['data_manager', 'Data Manager', 'Adds, edits, verifies and imports schools; manages categories'],
  ['content_manager', 'Content Manager', 'Edits descriptions, translations and images'],
  ['verification_manager', 'Verification Manager', 'Reviews verification and school claims'],
  ['support_admin', 'Support Admin', 'Views users and handles inquiries'],
] as const;

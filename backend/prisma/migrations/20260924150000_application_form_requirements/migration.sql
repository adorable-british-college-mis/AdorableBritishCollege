-- Remove retired scholarship and bursary fields from existing application JSON.
UPDATE "AdmissionApplication"
SET "formData" = jsonb_set(
  "formData",
  '{entry}',
  ("formData"->'entry')
    - 'scholarshipInterest'
    - 'scholarshipNotes'
    - 'bursaryInterest'
    - 'bursaryNotes'
)
WHERE jsonb_typeof("formData"->'entry') = 'object';

-- Applications now use one fixed blended curriculum.
UPDATE "AdmissionApplication"
SET "formData" = jsonb_set(
  "formData",
  '{academic,curriculum}',
  to_jsonb('NIGERIAN_BRITISH_BLEND'::text)
)
WHERE jsonb_typeof("formData"->'academic') = 'object';

-- Convert historical free-text reasons to the new controlled values.
UPDATE "AdmissionApplication"
SET "formData" = jsonb_set(
  "formData",
  '{academic,reasonForLeaving}',
  to_jsonb(
    CASE
      WHEN "formData"#>>'{academic,reasonForLeaving}' IN (
        'ACADEMIC_PROGRESSION', 'RELOCATION', 'CHANGE_OF_CURRICULUM',
        'BOARDING_REQUIREMENT', 'FAMILY_CIRCUMSTANCES',
        'CURRENT_SCHOOL_CLOSURE', 'OTHER'
      ) THEN "formData"#>>'{academic,reasonForLeaving}'
      WHEN lower("formData"#>>'{academic,reasonForLeaving}') LIKE '%progress%' THEN 'ACADEMIC_PROGRESSION'
      WHEN lower("formData"#>>'{academic,reasonForLeaving}') LIKE '%relocat%'
        OR lower("formData"#>>'{academic,reasonForLeaving}') LIKE '%mov%' THEN 'RELOCATION'
      WHEN lower("formData"#>>'{academic,reasonForLeaving}') LIKE '%curriculum%' THEN 'CHANGE_OF_CURRICULUM'
      WHEN lower("formData"#>>'{academic,reasonForLeaving}') LIKE '%board%' THEN 'BOARDING_REQUIREMENT'
      WHEN lower("formData"#>>'{academic,reasonForLeaving}') LIKE '%family%' THEN 'FAMILY_CIRCUMSTANCES'
      WHEN lower("formData"#>>'{academic,reasonForLeaving}') LIKE '%clos%' THEN 'CURRENT_SCHOOL_CLOSURE'
      WHEN coalesce("formData"#>>'{academic,reasonForLeaving}', '') = '' THEN ''
      ELSE 'OTHER'
    END
  )
)
WHERE jsonb_typeof("formData"->'academic') = 'object';

UPDATE "AdmissionApplication"
SET "formVersion" = GREATEST("formVersion", 2);

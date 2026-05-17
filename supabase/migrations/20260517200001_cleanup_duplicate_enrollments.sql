-- Remove enrollments from the archived duplicate course (d948fea5)
-- These students already have an enrollment in the primary course (4711c03e)
DELETE FROM enrollments
WHERE course_id = 'd948fea5-840e-40b5-91f0-6005e81cda55';

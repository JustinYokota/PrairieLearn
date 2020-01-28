-- BLOCK select_course_users
SELECT
    u.user_id,
    u.uid,
    u.name,
    cp.course_role,
    jsonb_agg(jsonb_build_object(
        'id', ci.id,
        'short_name', ci.short_name,
        'course_instance_permission_id', cip.id,
        'course_instance_role', cip.course_instance_role
    ) ORDER BY d.start_date DESC NULLS LAST, d.end_date DESC NULLS LAST, ci.id DESC) FILTER (WHERE cip.course_instance_role IS NOT NULL) AS course_instance_roles
FROM
    course_permissions AS cp
    FULL JOIN course_instance_permissions AS cip ON (cp.user_id = cip.user_id)
    JOIN course_instances AS ci ON ((ci.id = cip.course_instance_id OR cip.course_instance_role IS NULL) AND ci.course_id = $course_id)
    JOIN users AS u ON (u.user_id = cp.user_id OR u.user_id = cip.user_id),
    LATERAL (SELECT min(ar.start_date) AS start_date, max(ar.end_date) AS end_date FROM course_instance_access_rules AS ar WHERE ar.course_instance_id = ci.id) AS d
WHERE
    cp.course_id = $course_id
    OR cip.course_instance_role IS NOT NULL
GROUP BY
    u.user_id, cp.course_role;

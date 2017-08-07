CREATE OR REPLACE FUNCTION
    instance_questions_select_question (
        IN instance_question_id bigint,
        OUT question questions%rowtype
    )
AS $$
BEGIN
    SELECT a.*
    INTO question
    FROM
        instance_questions AS iq
        JOIN questions AS q ON (q.id = iq.question_id)
    WHERE iq.id = instance_question_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'no such instance_question_id: %', instance_question_id; END IF;
END;
$$ LANGUAGE plpgsql VOLATILE;

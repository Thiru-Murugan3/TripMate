-- Terra meters returned entities, not just requests. This counter never resets monthly.
CREATE TABLE tripadvisor_terra_usage (
    id INT NOT NULL PRIMARY KEY,
    reserved_entities BIGINT NOT NULL DEFAULT 0
);
INSERT INTO tripadvisor_terra_usage (id, reserved_entities) VALUES (1, 0);

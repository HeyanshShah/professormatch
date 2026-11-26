// Course code helpers. "cs146", "CS-146", "cs 146 " all become "CS 146".
function normalizeCourseCode(code) {
  const m = String(code || '').trim().toUpperCase().match(/^([A-Z]{2,5})[\s-]?(\d{1,3}[A-Z]?)$/);
  return m ? `${m[1]} ${m[2]}` : null;
}

async function getOrCreateCourse(client, code, departmentId = null) {
  const { rows } = await client.query(
    `INSERT INTO courses (code, department_id) VALUES ($1, $2)
     ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code RETURNING id`, [code, departmentId]);
  return rows[0].id;
}

module.exports = { normalizeCourseCode, getOrCreateCourse };

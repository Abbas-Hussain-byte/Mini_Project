const { supabaseAdmin } = require('../models/supabaseClient');
const { CATEGORY_TO_DEPARTMENT, SEVERITY_DEADLINE_HOURS } = require('../utils/constants');

/**
 * AI-driven department routing
 * Maps complaint category (from YOLOv8/BERT) to the correct city department
 * and creates an assignment record
 */
async function routeToDepartment(complaint) {
  try {
    // 1. Determine the primary category
    const category = complaint.category ||
      (complaint.ai_detected_labels && complaint.ai_detected_labels[0]) ||
      'other';

    // 2. Map category → department code
    const deptCode = CATEGORY_TO_DEPARTMENT[category] || 'GENERAL';

    // 3. Find the department
    const { data: department, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('id, name, code')
      .eq('code', deptCode)
      .single();

    if (deptError || !department) {
      console.warn(`Department not found for code: ${deptCode}, falling back to GENERAL`);
      const { data: generalDept } = await supabaseAdmin
        .from('departments')
        .select('id, name, code')
        .eq('code', 'GENERAL')
        .single();
      if (!generalDept) throw new Error('No fallback department found');
      return await createAssignment(complaint, generalDept, category, 0.5);
    }

    // 4. Calculate routing confidence
    let confidence = 0.7; // default for text-only routing
    if (complaint.ai_analysis?.imageDetections?.length > 0) {
      // Image detection is more reliable
      const maxConf = Math.max(...complaint.ai_analysis.imageDetections.map(d => d.confidence || 0));
      confidence = maxConf;
    }

    // 5. Check if text and image agree
    if (complaint.ai_analysis?.textCategory && complaint.ai_detected_labels?.length > 0) {
      const textDept = CATEGORY_TO_DEPARTMENT[complaint.ai_analysis.textCategory];
      const imageDept = CATEGORY_TO_DEPARTMENT[complaint.ai_detected_labels[0]];
      if (textDept === imageDept) {
        confidence = Math.min(confidence + 0.15, 1.0); // Boost confidence when both agree
      }
    }

    // 6. Create the assignment
    return await createAssignment(complaint, department, category, confidence);
  } catch (err) {
    console.error('Department routing error:', err.message);
    throw err;
  }
}

/**
 * Create a department assignment and update the complaint
 */
async function createAssignment(complaint, department, category, confidence) {
  // Calculate deadline based on severity
  const deadlineHours = SEVERITY_DEADLINE_HOURS[complaint.severity || 'medium'] || 120;
  const deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString();

  // Build assignment reason
  const reason = confidence > 0.8
    ? `High-confidence AI routing: "${category}" → ${department.name}`
    : confidence > 0.6
    ? `AI routing: "${category}" → ${department.name} (confidence: ${(confidence * 100).toFixed(0)}%)`
    : `Low-confidence AI routing: "${category}" → ${department.name}. Manual review recommended.`;

  // Create assignment
  const { data: assignment, error } = await supabaseAdmin
    .from('department_assignments')
    .insert({
      complaint_id: complaint.id,
      department_id: department.id,
      assignment_reason: reason,
      ai_confidence: confidence,
      status: 'pending',
      assigned_by: 'ai_router',
      deadline
    })
    .select()
    .single();

  if (error) throw error;

  // Update complaint with department reference
  await supabaseAdmin
    .from('complaints')
    .update({
      department_id: department.id,
      status: 'assigned',
      updated_at: new Date().toISOString()
    })
    .eq('id', complaint.id);

  console.log(`✅ Complaint ${complaint.id} routed to ${department.name} (confidence: ${(confidence * 100).toFixed(0)}%)`);

  return { assignment, department };
}

module.exports = { routeToDepartment };

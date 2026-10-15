/*
 * Reader-facing names for the corpus question types.
 *
 * The type keys are the pipeline's ("why_usa", "prior_visa_history"). They are
 * stable identifiers and stay in the data; this is only how they read on a
 * chart or in a report. A type missing here falls back to its key with the
 * underscores spaced out, so a rebuilt corpus that adds one still renders.
 */
const LABELS = {
  sponsor_occupation: "Sponsor's job",
  funding_sponsor: "Who is sponsoring you",
  funding_general: "How you will pay",
  universities_applied: "Other universities applied to",
  undergrad_background: "Previous degree",
  which_course: "Which course",
  graduation_year: "When you graduated",
  which_university: "Which university",
  sponsor_income: "Sponsor's income",
  academics_scores: "Grades and test scores",
  why_university: "Why this university",
  funding_loan: "Education loan",
  why_course: "Why this course",
  work_experience: "Work experience",
  family_details: "Family",
  gap_year: "Gap in studies",
  post_grad_plans: "Plans after the degree",
  program_details: "Programme details",
  why_usa: "Why the US",
  prior_visa_history: "Previous visa history",
  scholarship: "Scholarship",
  confirm_plan: "Confirming your plan",
  relatives_in_us: "Relatives in the US",
  university_knowledge: "What you know about the university",
  course_value: "What the course is worth to you",
  professors_research: "Professors and research",
  ties_to_home: "Ties to home",
  business_details: "Family business",
  return_intent: "Coming back home",
  why_choice_other: "Why not another option",
  purpose_of_travel: "Purpose of travel",
  intake_travel: "Intake and travel dates",
  open_ended: "Open question",
  tuition_cost: "Tuition cost",
  job_relevance: "How your job relates",
  accommodation: "Where you will live",
  job_prospects_home: "Jobs back home",
};

export function questionLabel(type) {
  if (!type) return "";
  return LABELS[type] || type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/*
 * How the profile check words each question it asks.
 *
 * The bank's examples are what officers really said, but said mid-interview.
 * "What have you been doing since then?" only makes sense right after "When did
 * you graduate?", and "What are your plans after masters?" assumes a degree the
 * applicant may not be taking. Shown on their own, a round can open with a
 * question that reads as broken.
 *
 * These are the same questions, asked the way an officer would open the topic,
 * and worded for the degree the applicant chose. The bank still decides which
 * questions come up and how often; this only decides how they are asked. A type
 * missing here falls back to the bank's own first example, so a rebuilt corpus
 * that adds a type still shows something.
 */

// The degree being applied for, as it reads after "your" and after "a".
const DEGREE = {
  Bachelor: { your: "bachelor's degree", a: "a bachelor's degree" },
  Masters: { your: "master's degree", a: "a master's degree" },
  MBA: { your: "MBA", a: "an MBA" },
  PhD: { your: "PhD", a: "a PhD" },
};

// What the applicant finished before starting this degree.
const BEFORE = {
  Bachelor: "high school",
  Masters: "your bachelor's degree",
  MBA: "your bachelor's degree",
  PhD: "your previous degree",
};

const PHRASING = {
  sponsor_occupation: "What does your sponsor do for a living?",
  funding_sponsor: "Who is sponsoring your education?",
  funding_general: "How are you going to fund your education?",
  universities_applied: "How many universities did you apply to?",
  undergrad_background: ({ undergrad }) =>
    undergrad
      ? "Tell me about your studies in high school."
      : "Tell me about your undergraduate background.",
  which_course: "What are you going to study?",
  graduation_year: ({ before }) => `When did you finish ${before}?`,
  which_university: "Which university are you going to?",
  sponsor_income: "What is your sponsor's annual income?",
  academics_scores: "What is your GPA?",
  why_university: "Why did you choose this university?",
  funding_loan: "Have you taken a loan for your studies?",
  why_course: ({ undergrad }) =>
    undergrad ? "Why did you choose this major?" : "Why did you choose this program?",
  work_experience: "Do you have any work experience?",
  family_details: "Tell me about your family.",
  gap_year: ({ before }) => `What have you been doing since you finished ${before}?`,
  post_grad_plans: ({ degree }) => `What are your plans after you finish your ${degree.your}?`,
  program_details: ({ undergrad }) =>
    undergrad ? "Tell me about your major." : "Tell me about your program.",
  why_usa: "Why do you want to study in the US?",
  prior_visa_history: "Have you been to the US before?",
  scholarship: "Did you get any scholarship?",
  confirm_plan: ({ degree }) => `So you are going to the US for ${degree.a}?`,
  relatives_in_us: "Do you have any relatives in the US?",
  university_knowledge: "How did you find out about this university?",
  course_value: "What is your study plan?",
  professors_research: ({ undergrad }) =>
    undergrad
      ? "Is there any research at this university that interests you?"
      : "What is your area of research?",
  ties_to_home: "What ties do you have to your home country?",
  business_details: "Does your sponsor run a business? Tell me about it.",
  return_intent: ({ degree }) => `Will you return home after your ${degree.your}?`,
  why_choice_other: "Why did you choose the US over other countries?",
  purpose_of_travel: "What is the purpose of your trip?",
  intake_travel: "When does your program start?",
  open_ended: "Tell me about yourself.",
  tuition_cost: "How much will your studies cost, and how will you pay for them?",
  job_relevance: "How is your work experience related to what you will study?",
  accommodation: "Where will you live in the US?",
  job_prospects_home: ({ degree }) => `What job do you want after your ${degree.your}?`,
};

/**
 * The question to show and score for one round row: a bank row carries its
 * `question_type` and the raw `question` it would otherwise fall back to.
 */
export function askAs(row, degreeLevel) {
  const phrase = PHRASING[row.question_type];
  if (!phrase) return row.question;
  if (typeof phrase === "string") return phrase;
  return phrase({
    degree: DEGREE[degreeLevel] || { your: "degree", a: "a degree" },
    before: BEFORE[degreeLevel] || "your previous studies",
    undergrad: degreeLevel === "Bachelor",
  });
}

/*
 * Sample answers for the admin "Fill with test data" button on /check-profile.
 *
 * This exists to make the scoring path quick to exercise by hand: the evaluator
 * needs eleven profile fields and three written answers before it will accept a
 * submission, and retyping them for every test is the slowest part of checking
 * a change end to end.
 *
 * The answers are keyed by the corpus's own question_type rather than by
 * position, because the three questions on screen change every round and are
 * drawn from the bank in frequency order. Keying by position would put a
 * funding answer under "When did you graduate?" on round two.
 *
 * They are written as a plausible applicant would write them - specific, with
 * real numbers - rather than as "test test test". A grounded evaluator scoring
 * placeholder text tells you nothing about whether the report is any good, and
 * reviewing report quality is most of what this button gets used for.
 */

// One coherent applicant. The fields are the evaluator's own, and the values
// are chosen to exercise the interesting paths: a consulate the corpus covers
// (so comparables come back), a postgraduate degree (so the undergraduate-major
// field is shown rather than hidden), and a GPA on the 10-point scale the
// Indian half of the corpus uses.
export const TEST_PROFILE = {
  consulate_city: "Hyderabad",
  consulate_country: "India",
  university: "Arizona State University",
  course: "MS in Computer Science",
  major: "Computer Science and Engineering",
  degree_level: "Masters",
  gpa: "8.4",
  gpa_scale: "10",
  work_experience: "2 years as a backend developer at Infosys, Hyderabad",
  funding_source: "Father's savings and a USD 18,000 education loan from SBI",
  attempt_number: "1",
};

// Keyed by the corpus question_type. Anything not listed here falls back to
// GENERIC_ANSWER, so a rebuilt corpus that adds types still fills every box
// instead of leaving one blank and failing validation.
export const TEST_ANSWERS = {
  // Funding - the cluster officers press hardest on, so these carry the
  // numbers that make the answers checkable against each other.
  funding_sponsor:
    "My father is sponsoring me. He has saved for this since I finished my " +
    "twelfth standard, and we have also taken an education loan from SBI.",
  funding_general:
    "The first year is USD 32,000 including living costs. My father is " +
    "covering USD 14,000 from savings and the remaining USD 18,000 is an " +
    "education loan from SBI against our house in Hyderabad.",
  funding_loan:
    "An education loan of USD 18,000 from State Bank of India, secured " +
    "against our family home. The sanction letter is dated March this year.",
  sponsor_occupation:
    "He runs a textile wholesale business in Hyderabad that he started in " +
    "2004. He supplies cotton fabric to about fifteen retail shops.",
  sponsor_income:
    "His net income last year was around 22 lakh rupees, which is roughly " +
    "USD 26,000. That is what our filed returns show.",
  tuition_cost:
    "Tuition is USD 23,400 a year and I have budgeted about USD 9,000 for " +
    "living costs in Tempe, so USD 32,400 for the first year.",
  scholarship:
    "I received a USD 4,000 merit scholarship from the department, applied " +
    "against tuition in the first year.",
  business_details:
    "It is a wholesale textile business, about fifteen regular retail " +
    "clients, run from a shop in Begum Bazaar that we own.",

  // Academics and background.
  undergrad_background:
    "I did my B.Tech in Computer Science and Engineering at JNTU Hyderabad " +
    "and graduated in 2021 with 8.4 out of 10.",
  graduation_year:
    "I graduated in June 2021, and I have been working since that August.",
  academics_scores:
    "8.4 out of 10 in my B.Tech. My GRE is 318 with a 4.0 in analytical " +
    "writing, and TOEFL 104.",
  gap_year:
    "There is no gap. I joined Infosys two months after I graduated and have " +
    "been there since.",

  // Work.
  work_experience:
    "Two years at Infosys as a backend developer, working on payment " +
    "reconciliation services in Java and Spring for a retail banking client.",
  job_relevance:
    "I have been writing distributed backend services for two years, and the " +
    "gap I keep hitting is the systems theory behind them - which is exactly " +
    "what the ASU program's distributed systems track covers.",

  // University and course.
  which_university: "Arizona State University, in Tempe.",
  why_university:
    "ASU's Fulton school has a distributed systems group under Prof. Zhang " +
    "doing the consistency work I want to learn, and their MS is coursework " +
    "heavy with a capstone, which suits someone coming from industry.",
  university_knowledge:
    "It is in Tempe, Arizona. The MS in Computer Science is at the Ira A. " +
    "Fulton Schools of Engineering, and it is a 30-credit program I expect to " +
    "finish in four semesters.",
  universities_applied:
    "I applied to five - ASU, NC State, UT Dallas, SUNY Buffalo and " +
    "Northeastern. I was admitted to ASU, UT Dallas and Buffalo.",
  accommodation:
    "I will share an off-campus apartment in Tempe with two other students " +
    "for the first semester, about USD 600 a month for my share.",

  which_course: "MS in Computer Science, with a focus on distributed systems.",
  why_course:
    "Two years of building backend services showed me I can make them work " +
    "but cannot reason about why they fail under load. The distributed " +
    "systems coursework is the part I cannot pick up on the job.",
  program_details:
    "30 credits over four semesters. Core courses in algorithms and " +
    "operating systems, then electives in distributed systems and cloud " +
    "computing, and a capstone project in the final semester.",
  course_value:
    "It moves me from implementing services to designing them. In India that " +
    "is the difference between a developer role and an architect role, and it " +
    "is the step my current employer promotes people into.",
  professors_research:
    "Prof. Zhang's group works on consistency models for geo-distributed " +
    "stores. I read their 2024 paper on bounded staleness and it is close to " +
    "a problem I hit at work.",
  intake_travel:
    "Fall 2026 intake. Classes start on 20 August and I plan to fly out in " +
    "the first week of August.",

  // Family and ties.
  family_details:
    "My father runs the textile business, my mother is a school teacher, and " +
    "my younger sister is in her second year of B.Com. All three are in " +
    "Hyderabad.",
  relatives_in_us:
    "No. I have a cousin in Canada, but nobody in the United States.",
  ties_to_home:
    "My parents and my sister are all in Hyderabad, and the family business " +
    "and our house are there. I am the only son and I am expected back.",

  // Intent and plans.
  post_grad_plans:
    "I will use the one year of OPT to work with a US cloud infrastructure " +
    "company, then come back to India. AWS, Google and Microsoft all have " +
    "large engineering centres in Hyderabad and they hire for exactly this.",
  return_intent:
    "My family, the business and the house are in Hyderabad, and the roles I " +
    "want are being hired for there. I plan to return after OPT.",
  job_prospects_home:
    "Hyderabad has the India engineering centres for AWS, Microsoft and " +
    "Google. A US master's in distributed systems is what those teams ask for " +
    "in their senior engineer postings.",
  why_usa:
    "Indian master's programs in CS are mostly research-track and taught by " +
    "faculty without industry systems experience. The coursework-plus-capstone " +
    "structure and the scale of systems US programs teach against do not exist " +
    "here.",
  why_choice_other:
    "I looked at Germany, but the programs I wanted were taught in German, " +
    "and the distributed systems faculty I want to learn from are in the US.",
  purpose_of_travel:
    "To do a master's in computer science at Arizona State University, " +
    "starting in the Fall 2026 semester.",
  confirm_plan:
    "Yes - two years of study at ASU, a year of OPT, then back to Hyderabad.",

  prior_visa_history:
    "This is my first application. I have never applied for a US visa before " +
    "and have never been refused one.",
  open_ended:
    "I want to study distributed systems properly, work in the field for a " +
    "year, and bring that back to the engineering centres in Hyderabad.",
};

// For a question type the fixture does not know. Deliberately specific enough
// to pass the evaluator's "did they actually answer" reading, and deliberately
// generic enough to sit under any question.
export const GENERIC_ANSWER =
  "I am doing an MS in Computer Science at Arizona State University, funded " +
  "by my father's savings and an SBI education loan, and I intend to return " +
  "to Hyderabad after my OPT year.";

// The answer for one question on screen. `question_type` is absent on the
// page's fallback pool, so the type is optional and the generic answer covers
// it.
export function testAnswerFor(questionType) {
  return TEST_ANSWERS[questionType] || GENERIC_ANSWER;
}

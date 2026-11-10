/*
 * Reader-facing (Russian) names for the corpus question types.
 *
 * The type keys are the pipeline's ("why_usa", "prior_visa_history"). They are
 * stable identifiers and stay in the data; this is only how they read on a
 * chart or in a report. A type missing here falls back to its key with the
 * underscores spaced out, so a rebuilt corpus that adds one still renders.
 */
const LABELS = {
  sponsor_occupation: "Работа спонсора",
  funding_sponsor: "Кто ваш спонсор",
  funding_general: "Как вы будете платить",
  universities_applied: "Куда ещё вы подавали",
  undergrad_background: "Предыдущее образование",
  which_course: "Какая программа",
  graduation_year: "Когда вы окончили учёбу",
  which_university: "Какой университет",
  sponsor_income: "Доход спонсора",
  academics_scores: "Оценки и баллы тестов",
  why_university: "Почему этот университет",
  funding_loan: "Кредит на обучение",
  why_course: "Почему эта программа",
  work_experience: "Опыт работы",
  family_details: "Семья",
  gap_year: "Перерыв в учёбе",
  post_grad_plans: "Планы после учёбы",
  program_details: "Подробности программы",
  why_usa: "Почему США",
  prior_visa_history: "Прошлые визы",
  scholarship: "Стипендия",
  confirm_plan: "Подтверждение плана",
  relatives_in_us: "Родственники в США",
  university_knowledge: "Что вы знаете об университете",
  course_value: "Что вам даст программа",
  professors_research: "Профессора и исследования",
  ties_to_home: "Связи с родиной",
  business_details: "Семейный бизнес",
  return_intent: "Возвращение домой",
  why_choice_other: "Почему не другой вариант",
  purpose_of_travel: "Цель поездки",
  intake_travel: "Начало учёбы и даты поездки",
  open_ended: "Открытый вопрос",
  tuition_cost: "Стоимость обучения",
  job_relevance: "Связь работы с учёбой",
  accommodation: "Где вы будете жить",
  job_prospects_home: "Работа на родине",
};

export function questionLabel(type) {
  if (!type) return "";
  return LABELS[type] || type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

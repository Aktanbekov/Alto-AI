"""Canonicalize officer turns into question types.

Officer turns are not all questions: greetings, document requests, biometrics
and the verdict itself are procedural and must not pollute question-type stats.
Rules are ordered — the first match wins, so specific patterns come first.

Stems below are written as `word\\w*` fragments rather than `\\bword\\b`, because
the corpus mixes "university"/"univ"/"uni" and "fund"/"funding"/"funded"; a
trailing `\\b` on a stem would never match the longer form.
"""

from __future__ import annotations

import re

# --------------------------------------------------------------- fragments --
UNIV = r"(?:univ\w*|college\w*|school\w*|uni\b|campus\w*)"
COURSE = r"(?:course\w*|program\w*|programme\w*|major\w*|degree\w*|specializ\w*|" \
         r"specialis\w*|stream\w*|masters?\b|ms\b|mba\b|phd\b|bachelor\w*|subject\w*)"
FAMILY = r"(?:father\w*|mother\w*|dad\b|mom\b|papa\b|parent\w*|brother\w*|sister\w*|" \
         r"sibling\w*|uncle\w*|aunt\w*|guardian\w*|husband\w*|wife\b|spouse\w*|cousin\w*)"
# Third-person referents: officers switch to "he/she/they" after naming a parent.
KIN_OR_PRONOUN = r"(?:" + FAMILY + r"|he\b|she\b|they\b|his\b|her\b|their\b|him\b)"
# Study fields, for "why computer engineering?" style turns that name no
# course/degree word at all.
FIELD = r"(?:engineer\w*|computer\w*|\bcs\b|\bit\b|information (?:tech\w*|system\w*|science)|" \
        r"data (?:science|analytic\w*)|business\w*|management\w*|finance\w*|account\w*|" \
        r"market\w*|econom\w*|nurs\w*|pharma\w*|biotech\w*|biolog\w*|chemi\w*|physic\w*|" \
        r"math\w*|statistic\w*|analytic\w*|cyber\w*|network\w*|software\w*|mechanic\w*|" \
        r"electric\w*|electronic\w*|civil\b|industrial\w*|architect\w*|aero\w*|" \
        r"psycholog\w*|public health|health\w*|law\b|design\w*|art\w*|hospitality\w*|" \
        r"supply chain|robotic\w*|\bai\b|machine learning|\bml\b)"
SPONSOR = r"(?:spons\w*|fund\w*|financ\w*|pay\w*|bear\w*|cover\w*|support\w*)"
US = r"(?:usa?\b|u\.s\.a?\b|america\w*|united states|states\b)"
YOU = r"(?:you|u|ur|your)\b"

# Procedural turn types (excluded from question-type analysis).
PROCEDURAL = {
    "greeting",
    "document_request",
    "biometrics",
    "verdict_approved",
    "verdict_rejected",
    "verdict_221g",
    "closing",
    "non_verbal",
}

_RULES: list[tuple[str, str]] = [
    # ---------------------------------------------------------- procedural --
    ("verdict_221g", r"221\s*-?\s*g|administrative processing|blue (?:slip|paper|form)|"
                     r"need(?:s)? (?:some )?more (?:time|documents|information)"),
    (
        "verdict_rejected",
        r"(?:cannot|can'?t|unable to|not able to|won'?t be able to) (?:issue|approve|grant|give)|"
        r"your visa (?:is|has been|was) (?:denied|refused|rejected|not approved)|"
        r"(?:i am|i'?m) (?:sorry|unable|afraid)\b.{0,50}(?:visa|application|qualify)|"
        r"214\s*-?\s*\(?b\)?|(?:white|yellow|pink) (?:slip|paper|form)|"
        r"you (?:are|'re) not (?:eligible|qualified)|reappl\w*",
    ),
    (
        "verdict_approved",
        r"visa (?:is|has been|'s|was) (?:approved|granted|issued)|(?:i\s?'?\s?m|i\s?am) (?:approving|accepting)|"
        r"your visa is (?:approved|granted|issued|done)|(?:collect|pick ?up|get) (?:your|the) passport|"
        r"passport (?:will be|in|after|within) \b|congratulations\b.{0,40}(?:visa|approved|admit)|"
        r"welcome to (?:the )?(?:usa?|united states)|have a (?:safe|good|nice|great) (?:trip|journey|flight|stay)|"
        r"enjoy your (?:studies|stay|time)|(?:all the )?best of luck\b|good luck\b.{0,25}(?:studies|there|us)|"
        r"you(?:'re| are) (?:approved|good to go|all set)|approved\b",
    ),
    ("biometrics", r"(?:place|put|scan|remove|lift)\b.{0,35}(?:hand|finger|thumb)\w*|fingerprint\w*|"
                   r"scanner\b|on the glass\b|(?:four|4) fingers\b"),
    (
        "document_request",
        r"(?:pass|hand|give|show|provide|share|may i (?:see|have)|can i (?:see|have)|let me see)\b"
        r".{0,45}(?:i-?20\b|passport\w*|document\w*|ds-?160|sevis\w*|paper\w*|transcript\w*|"
        r"marksheet\w*|mark sheet|appointment letter|admission letter|offer letter|"
        r"bank statement\w*|score\w*|certificate\w*)|"
        r"(?:i-?20|passport)\b.{0,15}(?:and|&|,)\s*(?:passport|i-?20|ds-?160)|"
        # handling instructions and passport retention
        r"(?:hold|place|keep|put)\b.{0,25}(?:i-?20|passport)\b.{0,25}(?:glass|scanner|through|against)|"
        r"(?:i am|i'?m|we are|we'?re) keeping your passport|"
        r"(?:take|collect) (?:your|back your) i-?20",
    ),
    # Greeting only when the turn is *short* — a long turn starting with
    # "Good morning, pass me your I-20" is a document request, and the rule
    # order above already claimed it.
    ("greeting", r"^\W{0,3}(?:very\s+)?(?:hi|hello|hey|good\s*(?:morning|afternoon|evening|day)|"
                 r"namaste|namaskar|assalom\w*|salom\w*|morning|afternoon)\b[\s\w,.!?'\-–—]{0,28}$|"
                 r"^\W*how are (?:you|u)(?: doing| today| this morning)?\b[\s\w,.!?']{0,20}$|"
                 r"^\W*(?:i(?:'m| am) (?:good|fine|doing|great)|me too|you too|and you)\b[\s\w,.!?']{0,20}$|"
                 r"^\W*(?:next|come forward|sit down|have a seat|please come)\b"),
    ("closing", r"^\W*(?:thank you|thanks|thank u|that(?:'s| is) (?:all|it)|you (?:can|may) (?:go|leave)|"
                r"done|ok(?:ay)?|alright|sure|great|nice|fine|you too|same to you)[\s,.!?]*$"),
    ("non_verbal", r"^\W*(?:no (?:response|reply|answer|comment)|silence|silent|smil\w*|nod\w*|"
                   r"typ(?:ing|ed|es)\b|look\w*\b.{0,30}(?:screen|computer|monitor|i-?20)|"
                   r"check\w*\b.{0,25}(?:screen|computer|system)|"
                   r"(?:reading|read)\b.{0,25}(?:i-?20|document|paper|screen))\W*$|"
                   # narration of the officer's actions or appearance, not speech
                   r"(?:scroll\w*|typ(?:ing|ed|es)\b|busy in typing|keyboard\b)|"
                   r"^\W*(?:counter|window)\b.{0,25}(?:no|#|\d)|"
                   r"^\W*(?:american|indian|white|black|asian|young|old|middle[- ]aged|tall|fat|"
                   r"bald|blonde?)\b.{0,40}(?:lady|guy|man|woman|male|female|officer|gentleman)|"
                   r"^\W*(?:vo|officer|she|he) was a\b|use the sanitizer"),
    # ------------------------------------------------------ funding cluster --
    ("sponsor_income", r"(?:annual|yearly|monthly|per year|per annum|per month)\b.{0,25}"
                       r"(?:income\w*|salary\b|salaries|package\w*|turnover\w*|earning\w*|revenue\w*)|"
                       r"(?:income\w*|salary\b|turnover\w*|earning\w*)\b.{0,25}"
                       r"(?:annual|yearly|monthly|per year|per annum|of your|father|mother|parent|sponsor)|"
                       r"how much\b.{0,35}(?:earn\w*|income\w*|salary\b|make\b|pay\w*)|"
                       r"\bitr\b|tax return\w*|income tax\b|"
                       # "what is your father's income", "what is his salary"
                       + KIN_OR_PRONOUN + r"\b.{0,25}(?:income\w*|salary\b|earning\w*|turnover\w*|package\w*)"),
    ("sponsor_occupation", r"what (?:does|do|is|are)\b.{0,30}" + FAMILY + r".{0,20}(?:do\b|doing\b|work\w*|"
                           r"job\b|business\w*|occupation\w*|profession\w*)|"
                           + FAMILY + r"(?:'s)?\b.{0,20}(?:occupation\w*|profession\w*|job\b|work\w*|business\w*|"
                           r"company\w*|designation\w*)|"
                           r"what (?:do|does|are|is) (?:he|she|they)\b.{0,20}do(?:ing)?\b|"
                           r"what (?:do|does) (?:they|he|she)\b|"
                           r"(?:where|which company)\b.{0,20}(?:does|do)\b.{0,20}" + FAMILY),
    ("funding_loan", r"loan\w*|collateral\w*|mortgage\w*|(?:bank|education(?:al)?) loan"),
    ("scholarship", r"scholarship\w*|assistantship\w*|fellowship\w*|waiver\w*|"
                    r"(?:ta|ra|gta|gra)ship\b|tuition waiver|any (?:aid|grant)\w*|"
                    r"(?:funding|aid|money)\b.{0,25}from (?:the )?" + UNIV),
    ("funding_sponsor", r"who(?:'s| is| are| will be)?\b.{0,35}" + SPONSOR + r"|"
                        r"spons\w*\b|who will (?:pay|fund|bear|finance|support)|"
                        r"who(?:'s| is)? (?:going to|gonna) (?:pay|fund|bear|sponsor|finance)"),
    ("tuition_cost", r"(?:tuition\w*|total (?:cost|fee|expense)\w*|cost of attendance|\bcoa\b)|"
                     r"how (?:much|expensive)\b.{0,35}(?:cost\w*|fee\w*|tuition\w*|expense\w*|program|course|study)|"
                     r"fee\w*\b.{0,25}(?:per|year|semester|total|annual)|"
                     r"what(?:'s| is) (?:the|your) (?:total )?(?:cost|fee|budget|expense)"),
    ("funding_general", r"fund\w*|financ\w*|how (?:will|are|do) you\b.{0,20}(?:pay|afford|manage|finance)|"
                        r"bank (?:balance|statement\w*|account\w*)|savings?\b|liquid (?:cash|fund\w*|asset\w*)|"
                        r"how much (?:money|cash)\b|what about (?:your )?(?:money|expenses)"),
    # ------------------------------------------------- university / program --
    ("why_university", r"why\b.{0,30}(?:this|that|the)?\s*" + UNIV + r"|"
                       r"why\b.{0,20}(?:choose|choosing|chose|select\w*|pick\w*|opt\w*|prefer\w*|go(?:ing)? (?:to|for))"
                       r"\b.{0,30}" + UNIV + r"|"
                       r"why not\b.{0,30}(?:another|other|any other|a better|different)\b.{0,20}" + UNIV + r"|"
                       r"what (?:made|attracted) you\b.{0,25}" + UNIV),
    ("why_course", r"why\b.{0,30}(?:this|that|the)?\s*" + COURSE + r"|"
                   r"why\b.{0,20}(?:choose|choosing|chose|select\w*|pick\w*|opt\w*|prefer\w*|pursu\w*)\b"
                   r".{0,30}" + COURSE + r"|"
                   r"why\b.{0,25}(?:switch\w*|chang\w*|shift\w*)\b.{0,25}(?:field|" + COURSE + r")|"
                   r"why\b.{0,15}(?:masters?|ms|mba|phd)\b.{0,15}(?:now|again|at this)|"
                   r"why do you want to (?:study|do|pursue)\b|"
                   # "Why computer engineering?" — names the field, not the degree
                   r"^\W*why\b.{0,15}" + FIELD),
    ("why_usa", r"why\b.{0,25}" + US + r"|why not\b.{0,30}(?:india\b|your (?:own )?country|here\b|home\b|"
                r"canada\b|germany\b|uk\b|australia\b|europe\b)|why (?:study|go)\b.{0,15}abroad\b|"
                r"why (?:are|do) you (?:want to )?(?:go|going|study)\b.{0,20}(?:abroad|overseas)"),
    ("universities_applied", r"how many\b.{0,30}(?:" + UNIV + r"|application\w*|appl(?:y|ied|ications)|"
                            r"admit\w*|acceptance\w*|offer\w*|rejection\w*|place\w*)|"
                            r"(?:which|what) other\b.{0,25}(?:" + UNIV + r"|admit\w*|offer\w*)|"
                            r"other (?:admit\w*|offer\w*|acceptance\w*|option\w*|" + UNIV + r")|"
                            r"any (?:other )?admit\w*|name them\b|did you apply\b.{0,30}(?:elsewhere|other)|"
                            r"(?:got|have|received) (?:any )?(?:admit\w*|reject\w*|offer\w*)"),
    ("which_university", r"which\b.{0,20}" + UNIV + r"|where (?:are you|you|will you be)\b.{0,25}"
                         r"(?:going|studying|study|admitted|planning|headed|heading)|"
                         r"name of (?:your |the )?" + UNIV + r"|what(?:'s| is) (?:the name of )?your " + UNIV + r"|"
                         r"where\b.{0,15}(?:did you get|do you have) (?:your )?admit"),
    ("which_course", r"which\b.{0,20}" + COURSE + r"|what (?:are you|will you be|course|program|major)\b"
                     r".{0,25}(?:study\w*|pursu\w*|doing|do)|"
                     r"what(?:'s| is) your (?:" + COURSE + r")|any specializ\w*|"
                     r"what (?:do|will) you (?:want to )?(?:study|specialize)"),
    ("program_details", COURSE + r"\b.{0,30}(?:content\w*|structure\w*|detail\w*|about|duration\w*|"
                        r"long\b|many\b|credit\w*|semester\w*|syllab\w*|curriculum\w*)|"
                        r"tell me\b.{0,25}(?:about|regarding)\b.{0,20}(?:" + COURSE + r"|curriculum\w*)|"
                        r"what (?:will|do) you (?:learn|study|take)\b|core (?:subject\w*|course\w*)|"
                        r"how long is\b.{0,25}(?:" + COURSE + r")|\bstem\b|"
                        r"(?:subject\w*|course\w*)\b.{0,20}(?:interest\w*|like|prefer)"),
    ("university_knowledge", r"where is\b.{0,30}(?:" + UNIV + r"|it\b)\b.{0,15}(?:located|situated)?|"
                             r"which (?:state|city|part)\b|rank\w*|how did you (?:find|hear|know|come to know)\b|"
                             r"what do you know about\b|population\b|weather\b|climate\b|"
                             r"(?:tell me )?about (?:the )?" + UNIV + r"\b.{0,20}(?:location|city|state)"),
    ("professors_research", r"professor\w*|faculty\b|research\w*|advisor\w*|publication\w*|thesis\b|"
                            r"\blabs?\b|paper\w*\b.{0,20}publish|supervisor\w*"),
    # ------------------------------------------------------------ academics --
    ("graduation_year", r"when did (?:you|u)\b.{0,30}(?:graduat\w*|complet\w*|finish\w*|pass(?:ed)? out|done)|"
                        r"(?:year|batch) of (?:graduation|passing|completion)|"
                        r"which year\b.{0,25}(?:graduat\w*|complet\w*|finish\w*|pass)|"
                        r"when (?:was|did)\b.{0,20}(?:your )?(?:graduation|convocation)|"
                        r"^\W*which year\W*$"),
    ("academics_scores", r"\b(?:gpa|cgpa|percentage|marks?|grades?|score\w*|backlog\w*|arrear\w*|"
                         r"gre|gmat|toefl|ielts|duolingo|dulingo|det|sat|act|pte)\b"),
    ("undergrad_background", r"(?:under\s?grad\w*|undergraduate\w*|bachelor\w*|\bug\b|"
                             r"previous (?:degree|education|stud\w*)|prior (?:degree|education))|"
                             r"what did (?:you|u)\b.{0,30}(?:study|studied|do|done)\b.{0,25}"
                             r"(?:bachelor\w*|under\s?grad\w*|before|previous|earlier)|"
                             r"where did (?:you|u)\b.{0,30}(?:do|study|complete|finish)\b.{0,25}"
                             r"(?:bachelor\w*|under\s?grad\w*|degree|graduation)|"
                             r"what(?:'s| is) your (?:academic |educational )?background|"
                             r"tell me about your (?:education|academics|studies|background)"),
    ("gap_year", r"\bgaps?\b|what (?:were|have|are) you (?:been )?doing\b|"
                 r"what are you doing (?:now|currently|these days|nowadays|right now)|"
                 r"since (?:your )?(?:graduation|you graduated|then)|"
                 r"why\b.{0,20}(?:the |such a |so long a |this )?(?:break|gap)\b|"
                 r"what have you done\b.{0,25}(?:after|since)"),
    # ----------------------------------------------------------------- work --
    ("work_experience", r"work\w*\b.{0,30}(?:experience\w*|where|company\w*|currently|now|job\b|since|"
                        r"long|year\w*)|"
                        r"where do (?:you|u) work|what(?:'s| is) your (?:job|role|designation|company|profile)|"
                        r"current (?:job|employer|company|role|position)|"
                        r"how (?:long|many years)\b.{0,25}work\w*|"
                        r"your (?:company|employer|organization|organisation|firm)\b|"
                        r"what do (?:you|u) do\b(?!.{0,25}" + FAMILY + r")|"
                        r"are (?:you|u)\b.{0,20}work\w*|do (?:you|u) (?:have a |any )?(?:job|work)\b|"
                        r"what (?:are|were) your (?:roles?|responsibilit\w*|duties)|"
                        r"^\W*any (?:work )?experience\W*$|do you have any experience"),
    # "What will this course do for you" — distinct from asking what the course
    # contains (program_details) and from post-graduation plans.
    ("course_value", r"(?:how|what)\b.{0,30}(?:course\w*|program\w*|degree\w*|masters?\b|it\b|this\b)\b"
                     r".{0,30}(?:help\w*|benefit\w*|useful|use to you|add value|contribut\w*)|"
                     r"what (?:skills?|knowledge|value)\b.{0,30}(?:gain|learn|get|acquire)|"
                     r"study plan\b|what (?:classes|courses|subjects)\b.{0,25}(?:tak\w*|stud\w*|enroll\w*)|"
                     r"how (?:will|does) (?:it|this|the course)\b.{0,25}(?:help|benefit)"),
    ("business_details", r"(?:which|what) (?:kind|type|sort) of business|what business\b|"
                         r"business\b.{0,25}(?:about|type|kind|nature|turnover|since|how (?:long|old))|"
                         r"(?:is it|it'?s)\b.{0,15}(?:public|private|government|govt)\b|"
                         r"(?:government|govt|private|public) (?:job|sector|employee|company)\b|"
                         r"(?:own|family|his|her|their) business\b"),
    ("job_relevance", r"how (?:is|does|are)\b.{0,35}(?:relat\w*|relevan\w*|connect\w*|help\w*|link\w*)|"
                      r"why (?:leave|quit|leaving|quitting|resign\w*)\b.{0,25}(?:job|work|company)|"
                      r"why (?:study|go back)\b.{0,25}(?:now|after work)|"
                      r"(?:is|was) your work related\b"),
    # ------------------------------------------------------ intent / return --
    ("post_grad_plans", r"(?:plans?|planning)\b.{0,35}(?:after|post|once you|graduat\w*|complet\w*)|"
                        r"what (?:will|do|would) you (?:do|plan to do)\b.{0,30}"
                        r"(?:after|post|graduat\w*|complet\w*|finish\w*)|"
                        r"after (?:your |the )?(?:graduation|degree|ms\b|mba\b|phd\b|studies|course|program)|"
                        r"future plans?|long[- ]?term (?:plan\w*|goal\w*)|career (?:plan\w*|goal\w*|path)|"
                        r"what do you want to (?:be|become|achieve)|where do you see yourself|"
                        r"^\W*(?:what|and)\b.{0,10}after\b.{0,25}(?:masters?|ms\b|mba\b|phd\b|"
                        r"graduation|degree|studies|course|that)"),
    ("return_intent", r"(?:come|go|return)(?:ing)? back\b|will you (?:return|come back)|"
                      r"stay (?:back |on )?in (?:the )?" + US + r"|\bopt\b|\bh-?1-?b\b|"
                      r"work (?:in|there|at)\b.{0,20}" + US + r"|green ?card\b|immigrat\w*|"
                      r"what if you (?:don'?t|do not|dont) (?:come|go) back|settle\w*\b.{0,20}" + US),
    ("ties_to_home", r"\bties\b|why (?:would|will|should) you (?:come|go|return) back|"
                     r"propert\w*|family business|who (?:is|will be|stays) (?:in|back|at)\b.{0,25}"
                     r"(?:india|home|your country|pakistan|nepal|bangladesh|uzbekistan)|"
                     r"asset\w*|land\b|any reason to (?:come|go) back"),
    ("job_prospects_home", r"(?:job\w*|career\w*|opportunit\w*|salar\w*|scope\b|placement\w*|market\w*)\b"
                           r".{0,35}(?:back (?:home|in)|home country|in india|your country|here\b)|"
                           r"what (?:kind of |type of )?job\b.{0,30}(?:after|back|there)|"
                           r"can'?t you (?:find|get)\b.{0,25}(?:job|work)\b"),
    # ------------------------------------------------------ family / ties US --
    ("relatives_in_us", r"(?:relative\w*|famil\w*|friend\w*|anyone|anybody|someone|somebody|"
                        + FAMILY + r")\b.{0,30}(?:in (?:the )?" + US + r"|there\b)|"
                        r"do you (?:know|have) any(?:one|body)\b|"
                        r"any(?:one|body)\b.{0,25}(?:in|from) (?:the )?" + US),
    ("family_details", FAMILY + r"|how many (?:member\w*|people)\b.{0,20}famil\w*|"
                       r"famil\w*\b.{0,20}(?:member\w*|size|background)|marital\b|married\b|"
                       r"children\b|kids\b|tell me about your family"),
    # --------------------------------------------------- history / logistics --
    ("prior_visa_history", r"(?:previous\w*|earlier|before|prior|last time|again|refus\w*|reject\w*|denied)\b"
                           r".{0,35}visa\b|visa\b.{0,30}(?:refus\w*|reject\w*|denied|attempt\w*|before|earlier)|"
                           r"have you (?:ever )?(?:been|travel\w*|visited|gone)\b.{0,25}"
                           r"(?:abroad|" + US + r"|outside|another country)|"
                           r"first time\b|why (?:were|was|did)\b.{0,25}(?:refused|rejected|denied)|"
                           r"what(?:'s| is| has) changed\b|any other visa\b|"
                           r"(?:are|were|have) you\b.{0,20}(?:refus\w*|reject\w*|denied)\b"),
    ("intake_travel", r"(?:when|which)\b.{0,25}(?:intake\w*|semester\w*|term\b|classes? (?:start|begin)|"
                      r"travel\w*|fly\w*|leav\w*|depart\w*|join\w*)|start date|"
                      r"when (?:are|do) you (?:planning to )?(?:go|leave|travel|fly)|"
                      r"\b(?:fall|spring|summer|winter) (?:20)?\d\d\b"),
    ("accommodation", r"(?:stay\w*|live\w*|accommodation\w*|housing\b|dorm\w*|apartment\w*|room\w*|hostel\w*)"
                      r"\b.{0,25}(?:where|there|plan\w*|arrange\w*)|where will you (?:stay|live)|"
                      r"(?:on|off)[- ]campus\b"),
    ("english_proficiency", r"how (?:is|are) your english|speak english|waiv\w*\b.{0,25}english|"
                            r"english (?:test|score|proficiency)"),
    ("open_ended", r"tell me about (?:yourself|your ?self|you\b)|introduce yourself|"
                   r"any (?:questions?|thing else|other questions?)|do you have any questions?|"
                   r"(?:anything|something) else\b|what else\b"),
    # -------------------------------------------------- broader fallbacks --
    # These sit last on purpose: looser phrasings that must not outrank the
    # specific rules above (first match wins).
    ("purpose_of_travel", r"what(?:'s| is)?\s*(?:the|your)\s*purpose\b|"
                          r"purpose of (?:your )?(?:visit|travel|trip|going|study)"),
    ("sponsor_occupation", r"what (?:do|does)? ?(?:he|she|they)\b.{0,20}do\b|"
                           r"what (?:are|is) (?:he|she|they)\b|"
                           r"which company\b.{0,25}" + FAMILY + r"|"
                           + FAMILY + r"\b.{0,20}(?:company|firm|employer)"),
    ("work_experience", r"how many years?\b.{0,25}(?:experience\w*|work\w*|job\b)|"
                        r"which company\b.{0,30}(?:you|u)\b.{0,20}work\w*|"
                        r"have you done any\b.{0,20}(?:internship\w*|work|job)"),
    ("program_details", r"what (?:are|were|is)\b.{0,20}the\b.{0,20}(?:subject\w*|course\w*|paper\w*|module\w*)|"
                        r"what (?:will|do) you\b.{0,25}(?:learn|study)\b"),
    ("universities_applied", r"what (?:are|were)\b.{0,20}the\b.{0,20}" + UNIV),
    ("gap_year", r"what did (?:you|u) do\b.{0,30}(?:after|since|post)\b"),
    ("sponsor_income", r"^\W*income\b|^\W*(?:his|her|their) income\b"),
    # "so you are going to X" — officer confirming destination/program back.
    ("confirm_plan", r"^\W*(?:so\s+)?(?:you(?:'re| are)|are you)\b.{0,15}(?:going|heading|planning)\b"),
    ("why_choice_other", r"why (?:did|do) you (?:choose|chose|select|pick|prefer|want)\b"),
]

_COMPILED: list[tuple[str, re.Pattern[str]]] = [
    (label, re.compile(pattern, re.IGNORECASE)) for label, pattern in _RULES
]

OTHER = "other"


def classify(turn_text: str) -> str:
    """Return the canonical type for one officer turn (first matching rule)."""
    text = turn_text.strip()
    if not text:
        return OTHER
    for label, pattern in _COMPILED:
        if pattern.search(text):
            return label
    return OTHER


def is_question_type(label: str) -> bool:
    """True for evaluative question types (excludes procedural turns and other)."""
    return label not in PROCEDURAL and label != OTHER


ALL_QUESTION_TYPES = [label for label, _ in _RULES if label not in PROCEDURAL]

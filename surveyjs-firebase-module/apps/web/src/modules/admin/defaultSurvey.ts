import type { SurveyJsJson } from "@/contracts";

export const defaultSurveySchema: SurveyJsJson = {
  title: "New community survey",
  description: "Tell us about your experience.",
  showProgressBar: "top",
  progressBarType: "pages",
  checkErrorsMode: "onValueChanged",
  pages: [
    {
      name: "about-you",
      title: "About your experience",
      elements: [
        {
          type: "radiogroup",
          name: "respondent_role",
          title: "Which best describes you?",
          isRequired: true,
          choices: ["Player", "Parent or guardian", "Coach", "Volunteer"],
        },
        {
          type: "radiogroup",
          name: "program",
          title: "Which program are you responding about?",
          isRequired: true,
          choices: ["Girls lacrosse", "Boys lacrosse", "Both programs"],
        },
      ],
    },
    {
      name: "feedback",
      title: "Program feedback",
      elements: [
        {
          type: "rating",
          name: "overall_experience",
          title: "How would you rate the overall experience?",
          isRequired: true,
          rateMin: 1,
          rateMax: 5,
          minRateDescription: "Needs improvement",
          maxRateDescription: "Excellent",
        },
        {
          type: "comment",
          name: "boys_program_feedback",
          title: "What would most improve the boys program?",
          visibleIf: "{program} = 'Boys lacrosse' or {program} = 'Both programs'",
          maxLength: 1500,
        },
        {
          type: "comment",
          name: "girls_program_feedback",
          title: "What would most improve the girls program?",
          visibleIf: "{program} = 'Girls lacrosse' or {program} = 'Both programs'",
          maxLength: 1500,
        },
      ],
    },
    {
      name: "priorities",
      title: "Priorities",
      elements: [
        {
          type: "checkbox",
          name: "top_priorities",
          title: "Which areas should receive the most attention? Select up to three.",
          isRequired: true,
          maxSelectedChoices: 3,
          choices: [
            "Player development",
            "Coach development",
            "Parent education",
            "Communication",
            "Volunteer recruitment",
            "Program affordability",
          ],
        },
        {
          type: "comment",
          name: "additional_feedback",
          title: "Anything else you would like the board to know?",
          maxLength: 2000,
        },
      ],
    },
  ],
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const QUIZ_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string" },
          },
          correctAnswer: {
            type: "integer",
            minimum: 0,
            maximum: 3,
          },
          explanation: { type: "string" },
        },
        required: ["prompt", "options", "correctAnswer", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

const extractJsonText = payload => {
  if (!payload) return null;

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputItems = Array.isArray(payload.output) ? payload.output : [];
  for (const item of outputItems) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const block of content) {
      if (typeof block.text === "string" && block.text.trim()) {
        return block.text.trim();
      }
    }
  }

  return null;
};

const sanitizeAiQuizQuestions = questions =>
  questions
    .filter(question => question?.prompt && Array.isArray(question.options))
    .map(question => ({
      prompt: question.prompt.trim(),
      options: question.options.map(option => String(option).trim()).slice(0, 4),
      correctAnswer: Number(question.correctAnswer),
      explanation: String(question.explanation || "").trim(),
    }))
    .filter(
      question =>
        question.options.length === 4 &&
        question.correctAnswer >= 0 &&
        question.correctAnswer < question.options.length,
    )
    .slice(0, 3);

export const generateQuizWithOpenAI = async ({
  topic,
  materialText,
  sourceLabel,
}) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !materialText?.trim()) {
    return null;
  }

  const model = process.env.OPENAI_QUIZ_MODEL || "gpt-5.4-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You generate accurate multiple-choice quiz questions for collaborative study groups. Use only the provided study material. Return exactly three questions, each with four options, one correct answer index, and a short explanation.",
          },
          {
            role: "user",
            content: `Topic: ${topic}\nSource label: ${sourceLabel || "session material"}\nStudy material:\n${materialText}`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "study_session_quiz",
            strict: true,
            schema: QUIZ_SCHEMA,
          },
        },
        store: false,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const outputText = extractJsonText(payload);
    if (!outputText) {
      return null;
    }

    const parsed = JSON.parse(outputText);
    const questions = sanitizeAiQuizQuestions(parsed.questions || []);
    if (questions.length < 3) {
      return null;
    }

    return questions;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

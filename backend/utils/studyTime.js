export const STUDY_TIME_VALUES = [
  "morning",
  "afternoon",
  "evening",
  "night",
  "midnight",
];

export const STUDY_TIME_WINDOWS = {
  morning: [6, 7, 8, 9, 10, 11, 12],
  afternoon: [12, 13, 14, 15, 16, 17],
  evening: [17, 18, 19, 20, 21],
  night: [21, 22, 23, 0],
  midnight: [0, 1, 2, 3, 4, 5, 6],
};

export const normalizeStudyTime = value =>
  (value || "").toString().trim().toLowerCase();

export const isValidStudyTime = value =>
  STUDY_TIME_VALUES.includes(normalizeStudyTime(value));

export const assertValidStudyTime = value => {
  const normalized = normalizeStudyTime(value);
  if (!isValidStudyTime(normalized)) {
    throw new Error("Study time must be one of: morning, afternoon, evening, night, midnight");
  }
  return normalized;
};

const buildNextDayDate = hour => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date;
};

export const buildStudyTimeOptions = studyTime => {
  const normalized = assertValidStudyTime(studyTime || "evening");
  return (STUDY_TIME_WINDOWS[normalized] || STUDY_TIME_WINDOWS.evening).map(hour => {
    const value = buildNextDayDate(hour);
    return {
      label: value.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
      value,
      votes: [],
    };
  });
};

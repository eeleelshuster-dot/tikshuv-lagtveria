export const formatError = (error: any): string => {
  if (!error) return "אירעה שגיאה לא ידועה.";
  
  const errorString = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
  
  const technicalKeywords = [
    "schema cache",
    "enum",
    "invalid input value",
    "relation does not exist",
    "column does not exist",
    "syntax error",
    "duplicate key value",
    "PostgREST",
    "database",
    "RLS"
  ];

  for (const keyword of technicalKeywords) {
    if (errorString.toLowerCase().includes(keyword.toLowerCase())) {
      return "אירעה שגיאה פנימית. אנא פנה למנהל המערכת.";
    }
  }

  // Return original error if it seems safe (likely a user validation error)
  return errorString;
};

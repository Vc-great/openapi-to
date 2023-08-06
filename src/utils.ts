import prettier from "prettier";

export const prettierFile = (content: string): string => {
  let result = content;
  try {
    result = prettier.format(content, {
      singleQuote: true,
      printWidth: 120,
      parser: "typescript",
      tabWidth: 4,
    });
  } catch (error) {
    console.log("->prettier error :", error);
  }
  return result;
};

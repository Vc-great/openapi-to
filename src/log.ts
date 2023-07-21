import chalk from "chalk";

export const infoLog = (log: string) => {
  const color = "white";
  const type = `[${color.toUpperCase()}]`;
  console.log(`${chalk[color](type)} ${log}`);
};

export const errorLog = (log: string) => {
  const color = "red";
  const type = `[${color.toUpperCase()}]`;
  console.log(`${chalk[color](type)} ${log}`);
};
export const warnLog = (log: string) => {
  const color = "yellow";
  const type = `[${color.toUpperCase()}]`;
  console.log(`${chalk[color](type)} ${log}`);
};
export const successLog = (log: string) => {
  const color = "green";
  const type = `[${color.toUpperCase()}]`;
  console.log(`${chalk[color](type)} ${log}`);
};

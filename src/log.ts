import chalk from "chalk";

export const infoLog = (log: string) => {
  const type = chalk.white("[SUCCESS]");
  console.log(type + log);
};

export const errorLog = (log: string) => {
  const type = chalk.red("[SUCCESS]");
  console.log(type + log);
};
export const warnLog = (log: string) => {
  const type = chalk.yellow("[SUCCESS]");
  console.log(type + log);
};
export const successLog = (log: string) => {
  const type = chalk.green("[SUCCESS]");
  console.log(type + log);
};

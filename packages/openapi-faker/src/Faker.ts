export class Faker {
  get number() {
    const str = "faker.number";
    return {
      int: () => str + `.int()`,
    };
  }

  get string() {
    const str = "faker.string";
    return {
      alpha: () => str + `.alpha()`,
    };
  }

  get datatype() {
    const str = "faker.datatype";
    return {
      boolean: () => str + `.boolean()`,
    };
  }

  get helpers() {
    const head = `faker.helpers`;
    return {
      multiple: (functionName: string) =>
        head +
        `.multiple(()=>${functionName}, {
        count: 10,
      })`,
    };
  }
}

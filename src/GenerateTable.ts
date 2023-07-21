import { ApiData, GenerateCode } from "./types";

export class GenerateTable implements GenerateCode {
  run(apiItem: ApiData) {
    return {
      tableData: "tableData",
    };
  }
}

import { GenerateCode, ApiData } from "./types";

export class GenerateForm implements GenerateCode {
  run(apiItem: ApiData) {
    return {
      formData: "formData",
    };
  }
}

export const requestObjectExpected =
  "/** uploads an image */\n" +
  "const UploadImageBodyRequest = {\n" +
  "    /**Additional data to pass to server*/\n" +
  "    additionalMetadata: '',\n" +
  "    /**file to upload*/\n" +
  "    file: '',\n" +
  "};\n" +
  "/** Update an existing pet */\n" +
  "const UpdateBodyRequest = {\n" +
  "    /***/\n" +
  "    id: 0,\n" +
  "    /***/\n" +
  "    category: '',\n" +
  "    /***/\n" +
  "    name: '',\n" +
  "    /***/\n" +
  "    photoUrls: [],\n" +
  "    /***/\n" +
  "    tags: [],\n" +
  "    /**pet status in the store*/\n" +
  "    status: '',\n" +
  "};\n" +
  "/** Add a new pet to the store */\n" +
  "const CreateBodyRequest = UpdateBodyRequest;\n" +
  "const FindByStatusQueryRequest = {\n" +
  "    /** Status values that need to be considered for filter */\n" +
  "    status: '',\n" +
  "};\n" +
  "const FindByTagsQueryRequest = {\n" +
  "    /** Tags to filter by */\n" +
  "    tags: '',\n" +
  "};\n" +
  "\n" +
  "/** Updates a pet in the store with form data */\n" +
  "const PetIdBodyRequest = {\n" +
  "    /**Updated name of the pet*/\n" +
  "    name: '',\n" +
  "    /**Updated status of the pet*/\n" +
  "    status: '',\n" +
  "};\n";

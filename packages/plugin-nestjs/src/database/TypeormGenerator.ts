import { DATE_ENUM } from "@openapi-to/core";

import _ from "lodash";
import { Scope } from "ts-morph";

import { Pagination } from "../domainGenerator/Pagination.ts";
import { NestjsGenerator } from "../NestjsGenerator.ts";

import type {
  ClassDeclarationStructure,
  ImportDeclarationStructure,
  MethodDeclarationStructure,
  OptionalKind,
} from "ts-morph";
import type { Config, ImportStatementsOmitKind } from "../types.ts";
import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

export class TypeormGenerator extends NestjsGenerator {

  get mapperName(): string {
    return `${_.upperFirst(this.openapi.currentTagName)}Mappers`;
  }

  get repositoryFindName(): string {
    const pagination = new Pagination(this.openapi.parameter?.parameters);
    const isArrayForResponse =
      this.openapi.response?.successResponse?.type === "array";

    if (pagination.hasPagination) {
      return "findAndCount";
    }

    if (isArrayForResponse) {
      return "find";
    }

    return "findOne";
  }

  get findMethodBody(): string {
    const hasDate = _.chain(this.openapi.parameter?.parametersOfQuery)
      .filter((item) => DATE_ENUM.includes(_.get(item, "schema.format", "")))
      .value();

    //todo Array<OpenAPIParameterObject>
    const hasPagination = _.chain(this.openapi.parameter?.parametersOfQuery)
      .some(
        (item: OpenAPIV3.ParameterObject | OpenAPIV3_1.ParameterObject) =>
          item.name === "pageNo" || item.name === "pageSize",
      )
      .value();

    // user/:id  findOne
    if (this.openapi.parameter?.hasPathParameters) {
      const where = `{${_.chain(this.openapi.parameter.parametersOfPath)
        .map((item) => `${item.name}:query.${item.name}`)
        .join(",\n")
        .value()}`;
      return `const newEntity = await this.${this.repositoryName}.${this.repositoryFindName}({ where:${where} });
    return plainToInstance(FindOneUserVo, newEntity, {
      exposeDefaultValues: true,
    });`;
    }

    const where = `{${_.chain(this.openapi.parameter?.parametersOfQuery)
      .filter(
        (item) =>
          !["order", "sort_by", "pageNo", "pageSize"].includes(item.name),
      )
      .map((item) => `${item.name}:query.${item.name}`)
      .join(",\n")
      .value()}}`;

    const hasOrder = _.some(
      this.openapi.parameter?.parametersOfQuery,
      (item) => item.name === "order",
    );
    const orderValue = `query.order.reduce(obj,(item)=>{
      obj[item] = query.sort_by
      return obj;
    },{})`;

    return `
    const [data, total] = await this.${this.repositoryName}.${this.repositoryFindName}({
      where:${where},
        ${hasPagination ? "skip: (query.pageNo - 1) * query.pageSize," : ""}
        ${hasPagination ? "take: query.pageSize," : ""}
        ${hasOrder ? `order:${orderValue}` : ""}
    });

    return plainToInstance(
      ${this.openapi.response?.successResponse?.refName},
      { data, total },
      {
        exposeDefaultValues: true,
      },
    );`;
  }

  get createMethodBody(): string {
    return `const newEntity = ${this.mapperName}.toPersistence(data);

    const savedEntity = await this.${this.repositoryName}.save(newEntity);

    return plainToInstance(${this.responseVoName}, savedEntity, {
      excludeExtraneousValues: true,
    });`;
  }

  get updateMethodBody(): string {
    const pathOption = _.chain(this.openapi.parameter?.parametersOfPath)
      .map((item) => item.name)
      .join(",")
      .value();

    return `const detail = await this.${this.repositoryName}.findOneBy({ ${pathOption} });
    if (!detail) {
      throw new NotFoundException(\`id \${id} not found\`);
    }

    const savedEntity = await this.${this.repositoryName}.save(
      ${this.mapperName}.toPersistence(_.assign(detail, data)),
    );
    return plainToInstance(FindOneUserVo, savedEntity, {
      excludeExtraneousValues: true,
    });`;
  }

  get deleteMethodBody(): string {
    const pathOption = _.chain(this.openapi.parameter?.parametersOfPath)
      .map((item) => item.name)
      .join(",")
      .value();
    return `return this.${this.repositoryName}.softRemove(_.assign(new ${this.entityName}(), { ${pathOption} }));`;
  }

  get generateModule(): string {
    return `import { Module } from '@nestjs/common';
import { UserRepository } from './users.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '@/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    {
      provide: UserRepository,
      useClass: UserRepository,
    },
  ],
  exports: [UserRepository],
})
export class UserPersistenceModule {}
`;
  }

  get generateMapper(): string {
    return `import { ${this.entityName} } from '${this.entityModuleSpecifier}';
import _ from 'lodash';

export class ${this.mapperName} {

  static toPersistence(data: any): ${this.entityName} {
    return _.assign(new ${this.entityName}(), data);
  }
}`;
  }

  build(): void {
    _.forEach(this.openapi.pathGroupByTag, (pathGroup, tag) => {
      const methodsStatements = _.chain(pathGroup)
        .map(({ path, method, tag }) => {
          this.operation = this.openapi.setCurrentOperation(path, method, tag);
          return this.generatorMethod();
        })
        .value();

      this.ast.createSourceFile(this.repositoryFilePath, {
        statements: [
          ...this.generateImport(),
          this.generatorClass(methodsStatements),
        ],
      });

      this.ast.createSourceFile(
        this.repositoryModuleFilePath,
        this.generateModule,
      );

      this.ast.createSourceFile(
        this.repositoryMapperFilePath,
        this.generateMapper,
      );
    });
  }

  generateImport(): Array<ImportDeclarationStructure> {
    const nestjsTypeorm: ImportStatementsOmitKind = {
      namedImports: ["InjectRepository"],
      moduleSpecifier: '@nestjs/typeorm',
    };

    const typeorm: ImportStatementsOmitKind = {
      namedImports: ["Repository"],
      moduleSpecifier: 'typeorm',
    };

    const mapper: ImportStatementsOmitKind = {
      namedImports: [this.mapperName],
      moduleSpecifier: `./${this.mapperName}`,
    };

    const entity: ImportStatementsOmitKind = {
      namedImports: [this.entityName],
      moduleSpecifier: this.entityModuleSpecifier,
    };

    const injectableImportStatement: ImportStatementsOmitKind = {
      namedImports: [
        ...this.injectableImportStatement.namedImports,
        "NotFoundException",
      ],
      moduleSpecifier: this.injectableImportStatement.moduleSpecifier,
    };

    const statements = _.chain([] as Array<ImportStatementsOmitKind>)
      .push(injectableImportStatement)
      .push(nestjsTypeorm)
      .push(entity)
      .push(mapper)
      .push(typeorm)
      .push(this.transformerImportStatement)
      .concat(this.domainImportStatements)
      .filter(Boolean)
      .value();

    return this.ast.generateImportStatements(statements);
  }

  generatorClass(
    methodsStatements: OptionalKind<MethodDeclarationStructure>[],
  ): ClassDeclarationStructure {
    const statements = {
      name: this.repositoryClassName,
      isExported: true,
      decorators: [
        {
          name: "Injectable",
        },
      ],
      docs: [],
      ctors: [
        {
          parameters: [
            {
              isReadonly: true,
              scope: Scope.Private,
              name: this.repositoryName,
              type: `Repository<${this.entityName}>`,
              decorators: [
                {
                  name: "InjectRepository",
                  arguments: [this.entityName],
                },
              ],
            },
          ],
        },
      ],
      methods: methodsStatements,
    };
    return this.ast.generateClassStatements(statements);
  }

  generatorMethod(): MethodDeclarationStructure {
    const statement = {
      name: this.methodName,
      decorators: [],
      parameters: this.generatorMethodParameters(),
      returnType: this.generatorReturnType(),
      docs: [],
      statements: this.generatorMethodBody(),
      isAsync: true,
    };

    return this.ast.generateMethodStatements(statement);
  }

  generatorMethodBody(): string {
    const method = this.operation?.method;

    switch (method) {
      case "get":
        return this.findMethodBody;
      case "post":
        return this.createMethodBody;
      case "put":
        return this.updateMethodBody;
      case "delete":
        return this.deleteMethodBody;
      //todo patch
      default:
        return "";
    }
  }
}

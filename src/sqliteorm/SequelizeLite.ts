import sqlite3, { Database } from "better-sqlite3"

export class SequelizeLite {
  protected database: Database
  public constructor(protected path: string) {
    this.database = new sqlite3(path)
    this.database.defaultSafeIntegers(true)
  }
  public define<T extends ModelDefinition>(tableName: string, modelDef: T, additionalDef: Partial<ModelToAdditional<T>> = {}) {
    const model = new ModelLite<T>(this.database, tableName, modelDef, additionalDef)
    return model
  }
  public dropTable(tableName: string) {
    this.database.prepare(`DROP TABLE IF EXISTS ${tableName}`).run()
  }
}

export class ModelLite<T extends ModelDefinition> {

  protected insertColumns: string | null = null
  protected insertQuestions: string | null = null

  public constructor(
    protected database: Database,
    protected tableName: string,
    public modelDef: T,
    protected additionalDef: Partial<ModelToAdditional<T>> = {}
  ) {
    this.init()
  }
  protected init() {
    const columns = Object.entries(this.modelDef).map(([key, value]) => {
      const additionalInfo = this.additionalDef[key] ?? []
      let columnType = ""
      let notNull = false
      switch (value) {
        case DataTypesLite.INTEGER:
          notNull = true
        case DataTypesLite.INTEGER_NULLABLE:
          columnType = "INTEGER"
          break
        case DataTypesLite.BIGINT:
          notNull = true
        case DataTypesLite.BIGINT_NULLABLE:
          columnType = "BIGINT" // Same as INTEGER btw
          break
        case DataTypesLite.STRING_ARRAY:
        case DataTypesLite.STRING:
          notNull = true
        case DataTypesLite.STRING_NULLABLE:
          columnType = "TEXT" // Same as VARCHAR...
          break
        case DataTypesLite.DATE:
          notNull = true
        case DataTypesLite.DATE_NULLABLE:
          columnType = "BIGINT" // UTC Timestamp
          break
        default:
          throw new Error(`DataTypes ${value} not implemented!`)
      }
      if (additionalInfo.indexOf(AdditionalDef.PRIMARY_KEY) >= 0) {
        columnType += " PRIMARY KEY"
      }
      if (notNull) {
        columnType += " NOT NULL"
      }
      return `${key} ${columnType}`
    })
    const sql = /*sql*/`CREATE TABLE IF NOT EXISTS ${this.tableName} (
      ${columns.join(",")}
    )`
    this.database.prepare(sql).run()
  }
  /**
   * Find one element from database
   * @param condition Condition to find 
   * @param params Additional params for sqlite
   * @returns `Found element` or `null` if not found
   */
  public findOne<C extends Partial<T>>(condition: ModelToJSObject<C> | null = null, params: Partial<Omit<ManyParams<T>, "limit">> = {}) {
    const result = this.findMany(condition, { ...params, limit: 1 })
    if (result.length <= 0) {
      return null
    }
    return result[0] ?? null
  }
  /**
   * Find all elements from database with condition
   * @param condition Condition to find
   * @param params Additional params for sqlite
   * @returns `Found element`[]
   */
  public findMany<C extends Partial<T>>(condition: ModelToJSObject<C> | null = null, params: Partial<ManyParams<T>> = {}) {
    const postfix = this.makePostfixSQL(params)
    if (condition == null) {
      const result = this.database.prepare(/*sql*/`SELECT * FROM ${this.tableName}${postfix}`).all()
      return result.map((item) => this.convertDBToJS(item))
    }
    const queryCondition = this.convertRawJSToDB<C>(this.modelDef as unknown as C, condition)

    const query = Object.keys(queryCondition).map((key) => `${key} = ?`).join(` ${(params.queryAsOR ?? false) ? "OR" : "AND"} `)
    const result = this.database.prepare(/*sql*/`
      SELECT * FROM ${this.tableName} WHERE ${query}${postfix}
    `).all(...Object.values(queryCondition)) as ModelToDBObject<T>[]

    return result.map((item) => this.convertDBToJS(item))
  }
  public findManySQL(querySQL: string, sqlParams: unknown[], options: Partial<ManyParams<T>> = {}) {
    const postfix = this.makePostfixSQL(options)
    const result = this.database.prepare(/*sql*/`
      SELECT * FROM ${this.tableName} WHERE ${querySQL}${postfix}
    `).all(...sqlParams) as ModelToDBObject<T>[];

    return result.map((item) => this.convertDBToJS(item))
  }
  /**
   * Find all elements without condition
   * @param params Additional params for sqlite
   * @returns `Found element`[]
   */
  public findAll(params: Partial<ManyParams<T>> = {}) {
    return this.findMany(null, params)
  }
  public insertOne(data: ModelToJSObject<T>) {
    const insertData = this.convertJSToDB(data)

    let columns = this.insertColumns
    if (columns == null) {
      columns = Object.keys(insertData).join(",")
      this.insertColumns = columns
    }
    let values = this.insertQuestions
    if (values == null) {
      values = Object.keys(insertData).map(() => "?").join(",")
      this.insertQuestions = values
    }

    this.database.prepare(/*sql*/`
      INSERT OR REPLACE INTO ${this.tableName} (${columns}) VALUES (${values})
    `).run(...Object.values(insertData))
  }
  public insertMany(data: Array<ModelToJSObject<T>>) {
    if (data.length <= 0) {
      return
    }
    const firstData = this.convertJSToDB(data[0]!!)
    let columns = this.insertColumns
    if (columns == null) {
      columns = Object.keys(firstData).join(",")
      this.insertColumns = columns
    }
    let values = this.insertQuestions
    if (values == null) {
      values = Object.keys(firstData).map(() => "?").join(",")
      this.insertQuestions = values
    }

    const insert = this.database.prepare(/*sql*/`
      INSERT OR REPLACE INTO ${this.tableName} (
        ${columns}
      ) VALUES (
        ${values}
      )
    `)
    const result = this.database.transaction((innerData: Array<ModelToJSObject<T>>) => {
      for (const item of innerData) {
        const insertItem = this.convertJSToDB(item)
        insert.run(...Object.values(insertItem))
      }
    })(data)
  }
  public updateOne<C extends Partial<T>, D extends Partial<T>>(condition: ModelToJSObject<C>, updateData: ModelToJSObject<D>) {
    if (Object.keys(condition).length <= 0) {
      throw new Error("Condition is empty!")
    }
    const queryCondition = this.convertRawJSToDB<C>(this.modelDef as unknown as C, condition)
    const queryUpdateData = this.convertRawJSToDB<D>(this.modelDef as unknown as D, updateData)

    const query = Object.keys(queryCondition).map((key) => `${key} = ?`).join(" AND ")
    const update = Object.keys(queryUpdateData).map((key) => `${key} = ?`).join(",")
    this.database.prepare(/*sql*/`
      UPDATE ${this.tableName} SET ${update} WHERE ${query}
    `).run(...Object.values(queryUpdateData).concat(Object.values(queryCondition)))
  }

  public updateMany(modifiers: Array<{ condition: ModelToJSObject<Partial<T>>, updateTo: ModelToJSObject<Partial<T>> }>) {
    this.database.transaction((innerData: Array<{ condition: ModelToJSObject<Partial<T>>, updateTo: ModelToJSObject<Partial<T>> }>) => {
      for (const { condition, updateTo } of innerData) {
        const queryCondition = this.convertRawJSToDB<Partial<T>>(this.modelDef as unknown as Partial<T>, condition)
        const queryUpdateData = this.convertRawJSToDB<Partial<T>>(this.modelDef as unknown as Partial<T>, updateTo)

        const query = Object.keys(queryCondition).map((key) => `${key} = ?`).join(" AND ")
        const update = Object.keys(queryUpdateData).map((key) => `${key} = ?`).join(",")

        const prepareFn = this.database.prepare(/*sql*/`
          UPDATE ${this.tableName} SET ${update} WHERE ${query}
        `)
        prepareFn.run(...Object.values(queryUpdateData).concat(Object.values(queryCondition)))
      }
    })(modifiers)
  }

  protected convertDBToJS(data: ModelToDBObject<T>) {
    const result: ModelToJSObject<T> = {} as any
    for (const entry of Object.entries(data)) {
      const key = entry[0] as keyof T
      const value = entry[1]
      if (value == null) {
        result[key] = null as any
        continue
      }

      switch (this.modelDef[key]) {
        case DataTypesLite.INTEGER:
        case DataTypesLite.INTEGER_NULLABLE:
          result[key] = Number(value) as any
          break
        case DataTypesLite.BIGINT:
        case DataTypesLite.BIGINT_NULLABLE:
          result[key] = BigInt(value) as any
          break
        case DataTypesLite.STRING:
        case DataTypesLite.STRING_NULLABLE:
          result[key] = value
          break
        case DataTypesLite.STRING_ARRAY:
          const valueStr = value as string | null
          if (valueStr == null || valueStr.length <= 0) {
            result[key] = [] as any
          } else if (valueStr.startsWith("[")) {
            result[key] = JSON.parse(value) as (any[] | null) ?? ([] as any)
          } else {
            result[key] = valueStr.split(",") as any
          }
          break
        case DataTypesLite.DATE:
        case DataTypesLite.DATE_NULLABLE:
          result[key] = new Date(Number(value)) as any
          break
        default:
          throw new Error(`DataTypes ${this.modelDef[key]} not implemented!`)
      }
    }
    return result
  }

  protected convertRawJSToDB<V extends Partial<T>>(modelDef: V, data: ModelToJSObject<V>) {
    const result: ModelToDBObject<V> = {} as any
    for (const entry of Object.entries(data)) {
      const key = entry[0] as keyof V
      const value = entry[1] as any
      if (value == null) {
        result[key] = null as any // Force-put
        continue
      }

      switch (modelDef[key]) {
        case DataTypesLite.INTEGER:
        case DataTypesLite.INTEGER_NULLABLE:
          result[key] = Number(value) as any
          break
        case DataTypesLite.BIGINT:
        case DataTypesLite.BIGINT_NULLABLE:
          result[key] = BigInt(value) as any
          break
        case DataTypesLite.STRING:
        case DataTypesLite.STRING_NULLABLE:
          result[key] = value
          break
        case DataTypesLite.STRING_ARRAY:
          result[key] = (value as string[]).join(",") as any
          break
        case DataTypesLite.DATE:
        case DataTypesLite.DATE_NULLABLE:
          result[key] = Number(value) as any
          break
        default:
          throw new Error(`DataTypes ${modelDef[key]} not implemented!`)
      }
    }
    return result
  }

  protected convertJSToDB(data: ModelToJSObject<T>) {
    return this.convertRawJSToDB(this.modelDef, data)
  }

  protected makePostfixSQL(params: Partial<ManyParams<T>>) {
    let result = ""
    if (params.orderBy != null && params.orderBy.length > 0) {
      const orderQuery = params.orderBy.map((item) => `${String(item.columnName)} ${item.order ?? "ASC"}`).join(",")
      result += ` ORDER BY ${orderQuery}`
    }
    if (params.limit != null && params.limit >= 1) {
      result += ` LIMIT ${params.limit}`
    }
    return result
  }
}

export enum DataTypesLite {
  INTEGER_NULLABLE,
  INTEGER,
  BIGINT_NULLABLE,
  BIGINT,
  STRING_NULLABLE,
  STRING,
  STRING_ARRAY,
  DATE_NULLABLE,
  DATE,
}

export enum AdditionalDef {
  PRIMARY_KEY,
}

export type ModelDefinition = {
  [key: string]: DataTypesLite | undefined
}

export interface ManyParams<T extends ModelDefinition> {
  limit: number,
  orderBy: Array<{ columnName: keyof T, order?: "ASC" | "DESC" }>,
  queryAsOR: boolean,
}

type ModelToAdditional<T extends ModelDefinition> = Partial<{ [key in keyof T]: AdditionalDef[] }>

export type ModelToJSObject<T extends ModelDefinition> = { [key in keyof T]: DataTypeToJSType<T[key]> }

export type ModelToDBObject<T extends ModelDefinition> = { [key in keyof T]: DataTypeToDBType<T[key]> }

export type DefinedModelToJSObject<T> = T extends ModelLite<infer U> ? ModelToJSObject<U> : never

type DataTypeToJSType<T> =
  T extends undefined ? never :
  T extends DataTypesLite.INTEGER_NULLABLE ? number | null :
  T extends DataTypesLite.INTEGER ? number :
  T extends DataTypesLite.BIGINT_NULLABLE ? bigint | null :
  T extends DataTypesLite.BIGINT ? bigint :
  T extends DataTypesLite.STRING_NULLABLE ? string | null :
  T extends DataTypesLite.STRING ? string :
  T extends DataTypesLite.STRING_ARRAY ? string[] :
  T extends DataTypesLite.DATE_NULLABLE ? Date | null :
  T extends DataTypesLite.DATE ? Date : never

type DataTypeToDBType<T> =
  T extends undefined ? never :
  T extends DataTypesLite.INTEGER_NULLABLE ? bigint | null :
  T extends DataTypesLite.INTEGER ? bigint :
  T extends DataTypesLite.BIGINT_NULLABLE ? bigint | null :
  T extends DataTypesLite.BIGINT ? bigint :
  T extends DataTypesLite.STRING_NULLABLE ? string | null :
  T extends DataTypesLite.STRING ? string :
  T extends DataTypesLite.DATE_NULLABLE ? bigint | null :
  T extends DataTypesLite.DATE ? bigint : never

type JSTypeToDBType<T> =
  T extends undefined ? never :
  T extends string[] ? string :
  T extends number | null ? bigint | null :
  T extends number ? bigint :
  T extends Date | null ? bigint | null :
  T extends Date ? bigint :
  T

type StrongPartial<T> = Pick<T, keyof T>
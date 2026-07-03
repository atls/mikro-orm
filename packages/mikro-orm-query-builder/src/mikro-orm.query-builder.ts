import type { QBFilterQuery } from '@mikro-orm/postgresql'
import type { QueryBuilder }  from '@mikro-orm/postgresql'

import { Query }              from '@atls/query-types'
import set                    from 'lodash.set'

type ConditionQuery<TConditions> = {
  conditions?: TConditions
  operator?: Query.Operator
}

type ConditionExtractor<TConditions, TValue = unknown> = {
  key: string
  extract: (conditions: TConditions) => TValue | undefined
}

type EqualityCondition<TValue> = { eq?: { value: TValue } }

type InclusionCondition<TValue> = { in?: { values: Array<TValue> } }

type ExistenceCondition = { exists?: { value: boolean } }

type ContainsCondition = { contains?: { value: string } }

type IdConditions = EqualityCondition<string> & ExistenceCondition & InclusionCondition<string>

type DateConditions = EqualityCondition<Date> & ExistenceCondition

type StringConditions = ContainsCondition & EqualityCondition<string> & InclusionCondition<string>

type NumberConditions = EqualityCondition<number> & InclusionCondition<number>

const toFilterQuery = <T extends object>(value: object): QBFilterQuery<T> =>
  value as QBFilterQuery<T>

export class MikroORMQueryBuilder<T extends object> {
  #take?: number

  constructor(private readonly qb: QueryBuilder<T>) {}

  order(order?: Query.Order): MikroORMQueryBuilder<T> {
    if (order) {
      this.qb.orderBy({
        [order.field]: order.direction === Query.OrderDirection.ASC ? 'ASC' : 'DESC',
      })
    }

    return this
  }

  pager(pager?: Query.Pager): MikroORMQueryBuilder<T> {
    if (pager?.take) {
      this.#take = pager.take + 1

      this.qb.limit(this.#take, pager.offset || 0)
    }

    return this
  }

  search(fields?: Array<Query.SearchField>, value?: string): MikroORMQueryBuilder<T> {
    if (value && fields && fields.length > 0) {
      this.qb.andWhere(
        toFilterQuery<T>({
          $or: fields.map((field) =>
            set({}, field.path, {
              $ilike: value,
            })),
        })
      )
    }

    return this
  }

  id(field: string, query?: Query.IDType): MikroORMQueryBuilder<T> {
    this.#applyConditions<IdConditions>(field, query, [
      { key: '$eq', extract: ({ eq }: IdConditions): string | undefined => eq?.value },
      {
        key: '$in',
        extract: ({ in: inCondition }: IdConditions): Array<string> | undefined =>
          inCondition?.values,
      },
      { key: '$exists', extract: ({ exists }: IdConditions): boolean | undefined => exists?.value },
    ])

    return this
  }

  date(field: string, query?: Query.DateType): MikroORMQueryBuilder<T> {
    this.#applyConditions<DateConditions>(field, query, [
      { key: '$eq', extract: ({ eq }: DateConditions): Date | undefined => eq?.value },
      {
        key: '$exists',
        extract: ({ exists }: DateConditions): boolean | undefined => exists?.value,
      },
    ])

    return this
  }

  string(field: string, query?: Query.StringType): MikroORMQueryBuilder<T> {
    this.#applyConditions<StringConditions>(field, query, [
      { key: '$eq', extract: ({ eq }: StringConditions): string | undefined => eq?.value },
      {
        key: '$in',
        extract: ({ in: inCondition }: StringConditions): Array<string> | undefined =>
          inCondition?.values,
      },
      {
        key: '$ilike',
        extract: ({ contains }: StringConditions): string | undefined => contains?.value,
      },
    ])

    return this
  }

  number(field: string, query?: Query.NumberType): MikroORMQueryBuilder<T> {
    this.#applyConditions<NumberConditions>(field, query, [
      { key: '$eq', extract: ({ eq }: NumberConditions): number | undefined => eq?.value },
      {
        key: '$in',
        extract: ({ in: inCondition }: NumberConditions): Array<number> | undefined =>
          inCondition?.values,
      },
    ])

    return this
  }

  async execute(): Promise<[Array<T>, boolean]> {
    const result = await this.qb.getResultList()

    if (!this.#take) {
      return [result, false]
    }

    return [result.slice(0, this.#take - 1), result.length >= this.#take]
  }

  #applyConditions<TConditions extends object>(
    field: string,
    query: ConditionQuery<TConditions> | undefined,
    extractors: Array<ConditionExtractor<TConditions>>
  ): void {
    const conditions = query?.conditions

    if (!field || !conditions) {
      return
    }

    const collected = extractors.reduce<Record<string, unknown>>((result, { key, extract }) => {
      const value = extract(conditions)

      return value === undefined ? result : { ...result, [key]: value }
    }, {})

    const keys = Object.keys(collected)

    if (keys.length === 0) {
      return
    }

    if (keys.length === 1) {
      const [singleKey] = keys

      this.qb.andWhere(toFilterQuery<T>(set({}, field, { [singleKey]: collected[singleKey] })))

      return
    }

    const operator = (query.operator || Query.Operator.AND) === Query.Operator.AND ? '$and' : '$or'

    this.qb.andWhere(
      toFilterQuery<T>(
        set({}, field, {
          [operator]: keys.map((key) => ({ [key]: collected[key] })),
        })
      )
    )
  }
}

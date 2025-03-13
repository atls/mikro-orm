import type { QueryBuilder } from '@mikro-orm/postgresql'

import { Query }             from '@atls/query-types'
import set                   from 'lodash.set'

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

      this.qb.limit(this.#take, pager?.offset || 0)
    }

    return this
  }

  search(fields?: Array<Query.SearchField>, value?: string): MikroORMQueryBuilder<T> {
    if (value && fields && fields.length > 0) {
      this.qb.andWhere({
        $or: fields.map((field) =>
          set({}, field.path, {
            $ilike: value,
          })),
      })
    }

    return this
  }

  id(field: string, query?: Query.IDType): MikroORMQueryBuilder<T> {
    if (field && query?.conditions && Object.keys(query.conditions).length > 0) {
      const queries: { $eq?: string; $in?: Array<string>; $exists?: boolean } = {}

      if (query.conditions.eq) {
        queries.$eq = query.conditions.eq.value
      }

      if (query.conditions.in) {
        queries.$in = query.conditions.in.values
      }

      if (query.conditions.exists) {
        queries.$exists = query.conditions.exists.value
      }

      if (Object.keys(queries).length === 1) {
        this.qb.andWhere(
          set(
            {},
            field,
            Object.keys(queries).reduce(
              (result, key) => ({
                ...result,
                [key]: queries[key as keyof typeof queries],
              }),
              {}
            )
          )
        )
      } else if (Object.keys(queries).length > 1) {
        const operator =
          (query.operator || Query.Operator.AND) === Query.Operator.AND ? '$and' : '$or'

        this.qb.andWhere(
          set({}, field, {
            [operator]: Object.keys(queries).map((key) => ({
              [key]: queries[key as keyof typeof queries],
            })),
          })
        )
      }
    }

    return this
  }

  date(field: string, query?: Query.DateType): MikroORMQueryBuilder<T> {
    if (field && query?.conditions && Object.keys(query.conditions).length > 0) {
      const queries: { $eq?: Date; $exists?: boolean } = {}

      if (query.conditions.eq) {
        queries.$eq = query.conditions.eq.value
      }

      if (query.conditions.exists) {
        queries.$exists = query.conditions.exists.value
      }

      if (Object.keys(queries).length === 1) {
        this.qb.andWhere(
          set(
            {},
            field,
            Object.keys(queries).reduce(
              (result, key) => ({
                ...result,
                [key]: queries[key as keyof typeof queries],
              }),
              {}
            )
          )
        )
      } else if (Object.keys(queries).length > 1) {
        const operator =
          (query.operator || Query.Operator.AND) === Query.Operator.AND ? '$and' : '$or'

        this.qb.andWhere(
          set({}, field, {
            [operator]: Object.keys(queries).map((key) => ({
              [key]: queries[key as keyof typeof queries],
            })),
          })
        )
      }
    }

    return this
  }

  string(field: string, query?: Query.StringType): MikroORMQueryBuilder<T> {
    if (field && query?.conditions && Object.keys(query.conditions).length > 0) {
      const queries: { $eq?: string; $in?: Array<string>; $ilike?: string } = {}

      if (query.conditions.eq) {
        queries.$eq = query.conditions.eq.value
      }

      if (query.conditions.in) {
        queries.$in = query.conditions.in.values
      }

      if (query.conditions.contains) {
        queries.$ilike = query.conditions.contains.value
      }

      if (Object.keys(queries).length === 1) {
        this.qb.andWhere(
          set(
            {},
            field,
            Object.keys(queries).reduce(
              (result, key) => ({
                ...result,
                [key]: queries[key as keyof typeof queries],
              }),
              {}
            )
          )
        )
      } else if (Object.keys(queries).length > 1) {
        const operator =
          (query.operator || Query.Operator.AND) === Query.Operator.AND ? '$and' : '$or'

        this.qb.andWhere(
          set({}, field, {
            [operator]: Object.keys(queries).map((key) => ({
              [key]: queries[key as keyof typeof queries],
            })),
          })
        )
      }
    }

    return this
  }

  number(field: string, query?: Query.NumberType): MikroORMQueryBuilder<T> {
    if (field && query?.conditions && Object.keys(query.conditions).length > 0) {
      const queries: { $eq?: number; $in?: Array<number> } = {}

      if (query.conditions.eq) {
        queries.$eq = query.conditions.eq.value
      }

      if (query.conditions.in) {
        queries.$in = query.conditions.in.values
      }

      if (Object.keys(queries).length === 1) {
        this.qb.andWhere(
          set(
            {},
            field,
            Object.keys(queries).reduce(
              (result, key) => ({
                ...result,
                [key]: queries[key as keyof typeof queries],
              }),
              {}
            )
          )
        )
      } else if (Object.keys(queries).length > 1) {
        const operator =
          (query.operator || Query.Operator.AND) === Query.Operator.AND ? '$and' : '$or'

        this.qb.andWhere(
          set({}, field, {
            [operator]: Object.keys(queries).map((key) => ({
              [key]: queries[key as keyof typeof queries],
            })),
          })
        )
      }
    }

    return this
  }

  async execute(): Promise<[Array<T>, boolean]> {
    const result = await this.qb.getResultList()

    if (!this.#take) {
      return [result, false]
    }

    return [result.slice(0, this.#take - 1), result.length >= this.#take]
  }
}

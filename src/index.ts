import { Left } from 'fp-ts/lib/Either'
import { Predicate } from 'fp-ts/lib/function'

declare global {
  interface Array<T> {
    _A: T
  }
}

export type mixed = object | number | string | boolean | symbol | undefined | null

export interface ContextEntry {
  readonly key: string
  readonly type: Decoder<any, any>
}
export type Context = Array<ContextEntry>
export interface ValidationError {
  readonly value: mixed
  readonly context: Context
}

export const isLeft = <A>(v: Validation<A>): v is Left<VError, A> => v instanceof Left
export const isRight = <A>(v: Validation<A>): v is A => !(v instanceof Left)
export const fold = <A, U>(v: Validation<A>, l: (l: VError) => U, f: (v: A) => U): U => (isLeft(v) ? l(v.value) : f(v))
export const chain = <A, U>(v: Validation<A>, f: (v: A) => Validation<U>): Validation<U> =>
  isLeft(v) ? (v as any) : f(v)
export const map = <A, U>(v: Validation<A>, f: (v: A) => U): U => (isLeft(v) ? (v as any) : f(v))

export type Validation<A> = Left<VError, A> | A
export type Is<A> = (m: mixed) => m is A
export type Validate<I, A> = (i: I, key: string | number, decoder: Decoder<any, any>) => Validation<A>
export type Decode<I, A> = (i: I) => Validation<A>
export type Encode<A, O> = (a: A) => O
export type Any = Type<any, any, any>
export type Mixed = Type<any, any, mixed>
export type TypeOf<RT extends Any> = RT['_A']
export type InputOf<RT extends Any> = RT['_I']
export type OutputOf<RT extends Any> = RT['_O']

export interface Decoder<I, A> {
  readonly name: string
  readonly validate: Validate<I, A>
  readonly decode: Decode<I, A>
}

export interface Encoder<A, O> {
  readonly encode: Encode<A, O>
}

/**
 * Laws:
 * 1. T.decode(x).fold(() => x, T.serialize) = x
 * 2. T.decode(T.serialize(x)) = right(x)
 *
 * where `T` is a runtime type
 */
export class Type<A, O = A, I = mixed> implements Decoder<I, A>, Encoder<A, O> {
  // prettier-ignore
  readonly '_A': A
  // prettier-ignore
  readonly '_O': O
  // prettier-ignore
  readonly '_I': I
  constructor(
    /** a unique name for this runtime type */
    readonly name: string,
    /** a custom type guard */
    readonly is: Is<A>,
    /** succeeds if a value of type I can be decoded to a value of type A */
    readonly validate: Validate<I, A>,
    /** converts a value of type A to a value of type O */
    readonly encode: Encode<A, O>
  ) {}
  pipe<B>(ab: Type<B, A, A>, name?: string): Type<B, O, I> {
    return new Type(
      name || `pipe(${this.name}, ${ab.name})`,
      ab.is,
      (i, c, decoder) => {
        const validation = this.validate(i, c, decoder)
        if (isLeft(validation)) {
          return validation as any
        } else {
          return ab.validate(validation, c, decoder)
        }
      },
      this.encode === identity && ab.encode === identity ? (identity as any) : b => this.encode(ab.encode(b))
    )
  }
  asDecoder(): Decoder<I, A> {
    return this
  }
  asEncoder(): Encoder<A, O> {
    return this
  }
  /** a version of `validate` with a default context */
  decode(i: I): Validation<A> {
    return this.validate(i, '', this)
  }
}

export const identity = <A>(a: A): A => a

export const getFunctionName = (f: Function): string =>
  (f as any).displayName || (f as any).name || `<function${f.length}>`

export interface VError {
  value: mixed
  key: string
  type: Decoder<any, any>
  children: VErrors
}
export type VErrors = Array<VError>

export const failures = <T>(value: mixed, key: string, type: Decoder<any, any>, errors: VErrors): Validation<T> =>
  failure(value, key, type, errors)

export const failureError = (value: mixed, key: string, type: Decoder<any, any>, children: VErrors = []): VError => ({
  value,
  type,
  key,
  children
})

export const failure = <T>(value: mixed, key: string, type: Decoder<any, any>, children: VErrors = []): Validation<T> =>
  new Left({ value, key, type, children })

export const success = <T>(value: T): Validation<T> => value

//
// basic types
//

export class NullType extends Type<null> {
  readonly _tag: 'NullType' = 'NullType'
  constructor() {
    super(
      'null',
      (m): m is null => m === null,
      (m, c, decoder) => (this.is(m) ? m : failure(m, String(c), decoder)),
      identity
    )
  }
}

/** @alias `null` */
export const nullType: NullType = new NullType()

export class UndefinedType extends Type<undefined> {
  readonly _tag: 'UndefinedType' = 'UndefinedType'
  constructor() {
    super(
      'undefined',
      (m): m is undefined => m === void 0,
      (m, c, decoder) => (this.is(m) ? m : failure(m, String(c), decoder)),
      identity
    )
  }
}

const undefinedType: UndefinedType = new UndefinedType()

export class AnyType extends Type<any> {
  readonly _tag: 'AnyType' = 'AnyType'
  constructor() {
    super('any', (_): _ is any => true, success, identity)
  }
}

export const any: AnyType = new AnyType()

export class NeverType extends Type<never> {
  readonly _tag: 'NeverType' = 'NeverType'
  constructor() {
    super(
      'never',
      (_): _ is never => false,
      (m, c, decoder) => failure(m, String(c), decoder),
      () => {
        throw new Error('cannot serialize never')
      }
    )
  }
}

export const never: NeverType = new NeverType()

export class StringType extends Type<string> {
  readonly _tag: 'StringType' = 'StringType'
  constructor() {
    super(
      'string',
      (m): m is string => typeof m === 'string',
      (m, c, decoder) => (this.is(m) ? m : failure(m, String(c), decoder)),
      identity
    )
  }
}

export const string: StringType = new StringType()

export class NumberType extends Type<number> {
  readonly _tag: 'NumberType' = 'NumberType'
  constructor() {
    super(
      'number',
      (m): m is number => typeof m === 'number',
      (m, c, decoder) => (this.is(m) ? m : failure(m, String(c), decoder)),
      identity
    )
  }
}

export const number: NumberType = new NumberType()

export class BooleanType extends Type<boolean> {
  readonly _tag: 'BooleanType' = 'BooleanType'
  constructor() {
    super(
      'boolean',
      (m): m is boolean => typeof m === 'boolean',
      (m, c, decoder) => (this.is(m) ? m : failure(m, String(c), decoder)),
      identity
    )
  }
}

export const boolean: BooleanType = new BooleanType()

export class AnyArrayType extends Type<Array<mixed>> {
  readonly _tag: 'AnyArrayType' = 'AnyArrayType'
  constructor() {
    super('Array', Array.isArray, (m, c, decoder) => (this.is(m) ? m : failure(m, String(c), decoder)), identity)
  }
}

const arrayType: AnyArrayType = new AnyArrayType()

export class AnyDictionaryType extends Type<{ [key: string]: mixed }> {
  readonly _tag: 'AnyDictionaryType' = 'AnyDictionaryType'
  constructor() {
    super(
      'Dictionary',
      (m): m is { [key: string]: mixed } => m !== null && typeof m === 'object',
      (m, c, decoder) => (this.is(m) ? m : failure(m, String(c), decoder)),
      identity
    )
  }
}

export const Dictionary: AnyDictionaryType = new AnyDictionaryType()

export class ObjectType extends Type<object> {
  readonly _tag: 'ObjectType' = 'ObjectType'
  constructor() {
    super('object', Dictionary.is, Dictionary.validate, identity)
  }
}

export const object: ObjectType = new ObjectType()

export class FunctionType extends Type<Function> {
  readonly _tag: 'FunctionType' = 'FunctionType'
  constructor() {
    super(
      'Function',
      (m): m is Function => typeof m === 'function',
      (m, c, decoder) => (this.is(m) ? m : failure(m, String(c), decoder)),
      identity
    )
  }
}

export const Function: FunctionType = new FunctionType()

//
// refinements
//

export class RefinementType<RT extends Any, A = any, O = A, I = mixed> extends Type<A, O, I> {
  readonly _tag: 'RefinementType' = 'RefinementType'
  constructor(
    name: string,
    is: RefinementType<RT, A, O, I>['is'],
    validate: RefinementType<RT, A, O, I>['validate'],
    serialize: RefinementType<RT, A, O, I>['encode'],
    readonly type: RT,
    readonly predicate: Predicate<A>
  ) {
    super(name, is, validate, serialize)
  }
}

export const refinement = <RT extends Any>(
  type: RT,
  predicate: Predicate<TypeOf<RT>>,
  name: string = `(${type.name} | ${getFunctionName(predicate)})`
): RefinementType<RT, TypeOf<RT>, OutputOf<RT>, InputOf<RT>> =>
  new RefinementType(
    name,
    (m): m is TypeOf<RT> => type.is(m) && predicate(m),
    (i, c, decoder) => {
      const validation = type.validate(i, c, decoder)
      if (isLeft(validation)) {
        return validation
      } else {
        return predicate(validation) ? validation : failure(validation, String(c), decoder)
      }
    },
    type.encode,
    type,
    predicate
  )

export const Integer = refinement(number, n => n % 1 === 0, 'Integer')

//
// literals
//

export class LiteralType<V extends string | number | boolean> extends Type<V> {
  readonly _tag: 'LiteralType' = 'LiteralType'
  constructor(
    name: string,
    is: LiteralType<V>['is'],
    validate: LiteralType<V>['validate'],
    serialize: LiteralType<V>['encode'],
    readonly value: V
  ) {
    super(name, is, validate, serialize)
  }
}

export const literal = <V extends string | number | boolean>(
  value: V,
  name: string = JSON.stringify(value)
): LiteralType<V> => {
  const is = (m: mixed): m is V => m === value
  return new LiteralType(name, is, (m, c, decoder) => (is(m) ? value : failure(m, String(c), decoder)), identity, value)
}

//
// keyof
//

export class KeyofType<D extends { [key: string]: mixed }> extends Type<keyof D> {
  readonly _tag: 'KeyofType' = 'KeyofType'
  constructor(
    name: string,
    is: KeyofType<D>['is'],
    validate: KeyofType<D>['validate'],
    serialize: KeyofType<D>['encode'],
    readonly keys: D
  ) {
    super(name, is, validate, serialize)
  }
}

export const keyof = <D extends { [key: string]: mixed }>(
  keys: D,
  name: string = `(keyof ${JSON.stringify(Object.keys(keys))})`
): KeyofType<D> => {
  const is = (m: mixed): m is keyof D => string.is(m) && keys.hasOwnProperty(m)
  return new KeyofType(name, is, (m, c, decoder) => (is(m) ? m : failure(m, String(c), decoder)), identity, keys)
}

//
// recursive types
//

export class RecursiveType<RT extends Any, A = any, O = A, I = mixed> extends Type<A, O, I> {
  readonly _tag: 'RecursiveType' = 'RecursiveType'
  constructor(
    name: string,
    is: RecursiveType<RT, A, O, I>['is'],
    validate: RecursiveType<RT, A, O, I>['validate'],
    serialize: RecursiveType<RT, A, O, I>['encode'],
    private runDefinition: () => RT
  ) {
    super(name, is, validate, serialize)
  }
  get type(): RT {
    return this.runDefinition()
  }
}

export const recursion = <A, O = A, I = mixed, RT extends Type<A, O, I> = Type<A, O, I>>(
  name: string,
  definition: (self: RT) => RT
): RecursiveType<RT, A, O, I> => {
  let cache: RT
  const runDefinition = (): RT => {
    if (!cache) {
      cache = definition(Self)
    }
    return cache
  }
  const Self: any = new RecursiveType<RT, A, O, I>(
    name,
    (m): m is A => runDefinition().is(m),
    (m, c, decoder) => {
      const T = runDefinition()
      return T.validate(m, c, decoder)
    },
    a => runDefinition().encode(a),
    runDefinition
  )
  return Self
}

//
// arrays
//

export class ArrayType<RT extends Any, A = any, O = A, I = mixed> extends Type<A, O, I> {
  readonly _tag: 'ArrayType' = 'ArrayType'
  constructor(
    name: string,
    is: ArrayType<RT, A, O, I>['is'],
    validate: ArrayType<RT, A, O, I>['validate'],
    serialize: ArrayType<RT, A, O, I>['encode'],
    readonly type: RT
  ) {
    super(name, is, validate, serialize)
  }
}

export const array = <RT extends Mixed>(
  type: RT,
  name: string = `Array<${type.name}>`
): ArrayType<RT, Array<TypeOf<RT>>, Array<OutputOf<RT>>, mixed> =>
  new ArrayType(
    name,
    (m): m is Array<TypeOf<RT>> => arrayType.is(m) && m.every(type.is),
    (m, c, decoder) => {
      const arrayValidation = arrayType.validate(m, c, decoder)
      if (isLeft(arrayValidation)) {
        return arrayValidation
      } else {
        const xs = arrayValidation
        const len = xs.length
        let a: Array<TypeOf<RT>> = xs
        const errors: VErrors = []
        for (let i = 0; i < len; i++) {
          const x = xs[i]
          const validation = type.validate(x, i, type)
          if (isLeft(validation)) {
            errors.push(validation.value)
          } else {
            if (validation !== x) {
              if (a === validation) {
                a = xs.slice()
              }
              a[i] = validation
            }
          }
        }
        return errors.length ? failures(m, String(c), decoder, errors) : a
      }
    },
    type.encode === identity ? identity : a => a.map(type.encode),
    type
  )

//
// interfaces
//

export class InterfaceType<P extends AnyProps, A = any, O = A, I = mixed> extends Type<A, O, I> {
  readonly _tag: 'InterfaceType' = 'InterfaceType'
  constructor(
    name: string,
    is: InterfaceType<P, A, O, I>['is'],
    validate: InterfaceType<P, A, O, I>['validate'],
    serialize: InterfaceType<P, A, O, I>['encode'],
    readonly props: P
  ) {
    super(name, is, validate, serialize)
  }
}

export interface AnyProps {
  [key: string]: Any
}

const getNameFromProps = (props: Props): string =>
  `{ ${Object.keys(props)
    .map(k => `${k}: ${props[k].name}`)
    .join(', ')} }`

const useIdentity = (props: Props): boolean => {
  for (const k in props) {
    if (props[k].encode !== identity) {
      return false
    }
  }
  return true
}

export type TypeOfProps<P extends AnyProps> = { [K in keyof P]: TypeOf<P[K]> }

export type OutputOfProps<P extends AnyProps> = { [K in keyof P]: OutputOf<P[K]> }

export interface Props {
  [key: string]: Mixed
}

/** @alias `interface` */
export const type = <P extends Props>(
  props: P,
  name: string = getNameFromProps(props)
): InterfaceType<P, { [K in keyof P]: TypeOf<P[K]> }, { [K in keyof P]: OutputOf<P[K]> }, mixed> => {
  const flatPropsKeys = Object.keys(props)
  const flatPropsTypes = flatPropsKeys.map(key => props[key])
  const len = flatPropsKeys.length
  return new InterfaceType(
    name,
    (m): m is TypeOfProps<P> => {
      if (!Dictionary.is(m)) {
        return false
      }
      for (const k in props) {
        if (!props[k].is(m[k])) {
          return false
        }
      }
      return true
    },
    (m, c, decoder) => {
      const dictionaryValidation = Dictionary.validate(m, c, decoder)
      if (isLeft(dictionaryValidation)) {
        return dictionaryValidation
      } else {
        const o = dictionaryValidation
        let a = o
        const errors: VErrors = []
        for (let i = 0; i < len; i++) {
          const k = flatPropsKeys[i]
          const type = flatPropsTypes[i]
          const ok = o[k]
          const validation = type.validate(ok, k, type)
          if (isLeft(validation)) {
            errors.push(validation.value)
          } else {
            if (validation !== ok) {
              if (a === o) {
                a = { ...o }
              }
              a[k] = validation
            }
          }
        }
        return errors.length ? failures(m, String(c), decoder, errors) : (a as any)
      }
    },
    useIdentity(props)
      ? identity
      : a => {
          const s: { [x: string]: any } = { ...(a as any) }
          for (let i = 0; i < len; i++) {
            const k = flatPropsKeys[i]
            const type = flatPropsTypes[i]
            s[k] = type.encode(a[k])
          }
          return s as any
        },
    props
  )
}
//
// partials
//

export class PartialType<P extends AnyProps, A = any, O = A, I = mixed> extends Type<A, O, I> {
  readonly _tag: 'PartialType' = 'PartialType'
  constructor(
    name: string,
    is: PartialType<P, A, O, I>['is'],
    validate: PartialType<P, A, O, I>['validate'],
    serialize: PartialType<P, A, O, I>['encode'],
    readonly props: P
  ) {
    super(name, is, validate, serialize)
  }
}

export type TypeOfPartialProps<P extends AnyProps> = { [K in keyof P]?: TypeOf<P[K]> }

export type OutputOfPartialProps<P extends AnyProps> = { [K in keyof P]?: OutputOf<P[K]> }

export const partial = <P extends Props>(
  props: P,
  name: string = `PartialType<${getNameFromProps(props)}>`
): PartialType<P, { [K in keyof P]?: TypeOf<P[K]> }, { [K in keyof P]?: OutputOf<P[K]> }, mixed> => {
  const partials: Props = {}
  for (const k in props) {
    partials[k] = union([props[k], undefinedType])
  }
  const partial = type(partials)
  return new PartialType(
    name,
    partial.is as any,
    partial.validate as any,
    useIdentity(props)
      ? identity
      : a => {
          const s: { [key: string]: any } = {}
          for (const k in props) {
            const ak = a[k]
            if (ak !== undefined) {
              s[k] = props[k].encode(ak)
            }
          }
          return s as any
        },
    props
  )
}

//
// dictionaries
//

export class DictionaryType<D extends Any, C extends Any, A = any, O = A, I = mixed> extends Type<A, O, I> {
  readonly _tag: 'DictionaryType' = 'DictionaryType'
  constructor(
    name: string,
    is: DictionaryType<D, C, A, O, I>['is'],
    validate: DictionaryType<D, C, A, O, I>['validate'],
    serialize: DictionaryType<D, C, A, O, I>['encode'],
    readonly domain: D,
    readonly codomain: C
  ) {
    super(name, is, validate, serialize)
  }
}

export type TypeOfDictionary<D extends Any, C extends Any> = { [K in TypeOf<D>]: TypeOf<C> }

export type OutputOfDictionary<D extends Any, C extends Any> = { [K in OutputOf<D>]: OutputOf<C> }

export const dictionary = <D extends Mixed, C extends Mixed>(
  domain: D,
  codomain: C,
  name: string = `{ [K in ${domain.name}]: ${codomain.name} }`
): DictionaryType<D, C, { [K in TypeOf<D>]: TypeOf<C> }, { [K in OutputOf<D>]: OutputOf<C> }, mixed> =>
  new DictionaryType(
    name,
    (m): m is TypeOfDictionary<D, C> =>
      Dictionary.is(m) && Object.keys(m).every(k => domain.is(k) && codomain.is(m[k])),
    (m, c, decoder) => {
      const dictionaryValidation = Dictionary.validate(m, c, decoder)
      if (isLeft(dictionaryValidation)) {
        return dictionaryValidation
      } else {
        const o = dictionaryValidation
        const a: { [key: string]: any } = {}
        const errors: VErrors = []
        let changed = false
        for (let k in o) {
          const ok = o[k]
          const domainValidation = domain.validate(k, k, domain)
          const codomainValidation = codomain.validate(ok, k, codomain)
          if (isLeft(domainValidation)) {
            errors.push(domainValidation.value)
          } else {
            const vk = domainValidation
            changed = changed || vk !== k
            k = vk
          }
          if (isLeft(codomainValidation)) {
            errors.push(codomainValidation.value)
          } else {
            const vok = codomainValidation
            changed = changed || vok !== ok
            a[k] = vok
          }
        }
        return errors.length ? failures(m, String(c), decoder, errors) : ((changed ? a : o) as any)
      }
    },
    domain.encode === identity && codomain.encode === identity
      ? identity
      : a => {
          const s: { [key: string]: any } = {}
          for (const k in a) {
            s[String(domain.encode(k))] = codomain.encode(a[k])
          }
          return s as any
        },
    domain,
    codomain
  )

//
// unions
//

export class UnionType<RTS extends Array<Any>, A = any, O = A, I = mixed> extends Type<A, O, I> {
  readonly _tag: 'UnionType' = 'UnionType'
  constructor(
    name: string,
    is: UnionType<RTS, A, O, I>['is'],
    validate: UnionType<RTS, A, O, I>['validate'],
    serialize: UnionType<RTS, A, O, I>['encode'],
    readonly types: RTS
  ) {
    super(name, is, validate, serialize)
  }
}

export const union = <RTS extends Array<Mixed>>(
  types: RTS,
  name: string = `(${types.map(type => type.name).join(' | ')})`
): UnionType<RTS, TypeOf<RTS['_A']>, OutputOf<RTS['_A']>, mixed> => {
  const len = types.length
  return new UnionType(
    name,
    (m): m is TypeOf<RTS['_A']> => types.some(type => type.is(m)),
    (m, c, decoder) => {
      const errors: VErrors = []
      for (let i = 0; i < len; i++) {
        const type = types[i]
        const validation = type.validate(m, i, type)
        if (isLeft(validation)) {
          errors.push(validation.value)
        } else {
          return validation
        }
      }
      return failures(m, String(c), decoder, errors)
    },
    types.every(type => type.encode === identity)
      ? identity
      : a => {
          let i = 0
          for (; i < len - 1; i++) {
            const type = types[i]
            if (type.is(a)) {
              return type.encode(a)
            }
          }
          return types[i].encode(a)
        },
    types
  )
}

//
// intersections
//

export class IntersectionType<RTS extends Array<Any>, A = any, O = A, I = mixed> extends Type<A, O, I> {
  readonly _tag: 'IntersectionType' = 'IntersectionType'
  constructor(
    name: string,
    is: IntersectionType<RTS, A, O, I>['is'],
    validate: IntersectionType<RTS, A, O, I>['validate'],
    serialize: IntersectionType<RTS, A, O, I>['encode'],
    readonly types: RTS
  ) {
    super(name, is, validate, serialize)
  }
}

export function intersection<A extends Mixed, B extends Mixed, C extends Mixed, D extends Mixed, E extends Mixed>(
  types: [A, B, C, D, E],
  name?: string
): IntersectionType<
  [A, B, C, D, E],
  TypeOf<A> & TypeOf<B> & TypeOf<C> & TypeOf<D> & TypeOf<E>,
  OutputOf<A> & OutputOf<B> & OutputOf<C> & OutputOf<D> & OutputOf<E>,
  mixed
>
export function intersection<A extends Mixed, B extends Mixed, C extends Mixed, D extends Mixed>(
  types: [A, B, C, D],
  name?: string
): IntersectionType<
  [A, B, C, D],
  TypeOf<A> & TypeOf<B> & TypeOf<C> & TypeOf<D>,
  OutputOf<A> & OutputOf<B> & OutputOf<C> & OutputOf<D>,
  mixed
>
export function intersection<A extends Mixed, B extends Mixed, C extends Mixed>(
  types: [A, B, C],
  name?: string
): IntersectionType<[A, B, C], TypeOf<A> & TypeOf<B> & TypeOf<C>, OutputOf<A> & OutputOf<B> & OutputOf<C>, mixed>
export function intersection<A extends Mixed, B extends Mixed>(
  types: [A, B],
  name?: string
): IntersectionType<[A, B], TypeOf<A> & TypeOf<B>, OutputOf<A> & OutputOf<B>, mixed>
export function intersection<A extends Mixed>(
  types: [A],
  name?: string
): IntersectionType<[A], TypeOf<A>, OutputOf<A>, mixed>
export function intersection<RTS extends Array<Mixed>>(
  types: RTS,
  name: string = `(${types.map(type => type.name).join(' & ')})`
): IntersectionType<RTS, any, any, mixed> {
  const len = types.length
  return new IntersectionType(
    name,
    (m): m is any => types.every(type => type.is(m)),
    (m, c, decoder) => {
      let a = m
      const errors: VErrors = []
      for (let i = 0; i < len; i++) {
        const type = types[i]
        const validation = type.validate(a, i, type)
        if (isLeft(validation)) {
          errors.push(...validation.value.children)
        } else {
          a = validation
        }
      }
      return errors.length ? failures(m, String(c), decoder, errors) : a
    },
    types.every(type => type.encode === identity)
      ? identity
      : a => {
          let s = a
          for (let i = 0; i < len; i++) {
            const type = types[i]
            s = type.encode(s)
          }
          return s
        },
    types
  )
}

//
// tuples
//

export class TupleType<RTS extends Array<Any>, A = any, O = A, I = mixed> extends Type<A, O, I> {
  readonly _tag: 'TupleType' = 'TupleType'
  constructor(
    name: string,
    is: TupleType<RTS, A, O, I>['is'],
    validate: TupleType<RTS, A, O, I>['validate'],
    serialize: TupleType<RTS, A, O, I>['encode'],
    readonly types: RTS
  ) {
    super(name, is, validate, serialize)
  }
}

export function tuple<A extends Mixed, B extends Mixed, C extends Mixed, D extends Mixed, E extends Mixed>(
  types: [A, B, C, D, E],
  name?: string
): TupleType<
  [A, B, C, D, E],
  [TypeOf<A>, TypeOf<B>, TypeOf<C>, TypeOf<D>, TypeOf<E>],
  [OutputOf<A>, OutputOf<B>, OutputOf<C>, OutputOf<D>, OutputOf<E>],
  mixed
>
export function tuple<A extends Mixed, B extends Mixed, C extends Mixed, D extends Mixed>(
  types: [A, B, C, D],
  name?: string
): TupleType<
  [A, B, C, D],
  [TypeOf<A>, TypeOf<B>, TypeOf<C>, TypeOf<D>],
  [OutputOf<A>, OutputOf<B>, OutputOf<C>, OutputOf<D>],
  mixed
>
export function tuple<A extends Mixed, B extends Mixed, C extends Mixed>(
  types: [A, B, C],
  name?: string
): TupleType<[A, B, C], [TypeOf<A>, TypeOf<B>, TypeOf<C>], [OutputOf<A>, OutputOf<B>, OutputOf<C>], mixed>
export function tuple<A extends Mixed, B extends Mixed>(
  types: [A, B],
  name?: string
): TupleType<[A, B], [TypeOf<A>, TypeOf<B>], [OutputOf<A>, OutputOf<B>], mixed>
export function tuple<A extends Mixed>(types: [A], name?: string): TupleType<[A], [TypeOf<A>], [OutputOf<A>], mixed>
export function tuple<RTS extends Array<Mixed>>(
  types: RTS,
  name: string = `[${types.map(type => type.name).join(', ')}]`
): TupleType<RTS, any, any, mixed> {
  const len = types.length
  return new TupleType(
    name,
    (m): m is any => arrayType.is(m) && m.length === len && types.every((type, i) => type.is(m[i])),
    (m, c, decoder) => {
      const arrayValidation = arrayType.validate(m, c, arrayType)
      if (isLeft(arrayValidation)) {
        return arrayValidation
      } else {
        const as = arrayValidation
        let t: Array<any> = as
        const errors: VErrors = []
        for (let i = 0; i < len; i++) {
          const a = as[i]
          const type = types[i]
          const validation = type.validate(a, i, type)
          if (isLeft(validation)) {
            errors.push(validation.value)
          } else {
            if (validation !== a) {
              if (t === as) {
                t = as.slice()
              }
              t[i] = validation
            }
          }
        }
        if (as.length > len) {
          errors.push(failureError(as[len], String(len), never))
        }
        return errors.length ? failures(m, String(c), decoder, errors) : t
      }
    },
    types.every(type => type.encode === identity) ? identity : a => types.map((type, i) => type.encode(a[i])),
    types
  )
}

//
// readonly objects
//

export class ReadonlyType<RT extends Any, A = any, O = A, I = mixed> extends Type<A, O, I> {
  readonly _tag: 'ReadonlyType' = 'ReadonlyType'
  constructor(
    name: string,
    is: ReadonlyType<RT, A, O, I>['is'],
    validate: ReadonlyType<RT, A, O, I>['validate'],
    serialize: ReadonlyType<RT, A, O, I>['encode'],
    readonly type: RT
  ) {
    super(name, is, validate, serialize)
  }
}

export const readonly = <RT extends Mixed>(
  type: RT,
  name: string = `Readonly<${type.name}>`
): ReadonlyType<RT, Readonly<TypeOf<RT>>, Readonly<OutputOf<RT>>, mixed> =>
  new ReadonlyType(
    name,
    type.is,
    (m, c, decoder) => {
      const res = type.validate(m, c, decoder)
      if (isLeft(res)) {
        return res
      } else {
        if (process.env.NODE_ENV !== 'production') {
          return Object.freeze(res)
        }
        return res
      }
    },
    type.encode === identity ? identity : type.encode,
    type
  )

//
// readonly arrays
//

export class ReadonlyArrayType<RT extends Any, A = any, O = A, I = mixed> extends Type<A, O, I> {
  readonly _tag: 'ReadonlyArrayType' = 'ReadonlyArrayType'
  constructor(
    name: string,
    is: ReadonlyArrayType<RT, A, O, I>['is'],
    validate: ReadonlyArrayType<RT, A, O, I>['validate'],
    serialize: ReadonlyArrayType<RT, A, O, I>['encode'],
    readonly type: RT
  ) {
    super(name, is, validate, serialize)
  }
}

export const readonlyArray = <RT extends Mixed>(
  type: RT,
  name: string = `ReadonlyArray<${type.name}>`
): ReadonlyArrayType<RT, ReadonlyArray<TypeOf<RT>>, ReadonlyArray<OutputOf<RT>>, mixed> => {
  const arrayType = array(type)
  return new ReadonlyArrayType(
    name,
    arrayType.is as any,
    (m, c, decoder) => {
      const res = arrayType.validate(m, c, decoder)
      if (isLeft(res)) {
        return res
      } else {
        if (process.env.NODE_ENV !== 'production') {
          return Object.freeze(res)
        } else {
          return res as any
        }
      }
    },
    arrayType.encode as any,
    type
  )
}

//
// strict interfaces
//

export class StrictType<P extends AnyProps, A = any, O = A, I = mixed> extends Type<A, O, I> {
  readonly _tag: 'StrictType' = 'StrictType'
  constructor(
    name: string,
    is: StrictType<P, A, O, I>['is'],
    validate: StrictType<P, A, O, I>['validate'],
    serialize: StrictType<P, A, O, I>['encode'],
    readonly props: P
  ) {
    super(name, is, validate, serialize)
  }
}

/** Specifies that only the given interface properties are allowed */
export const strict = <P extends Props>(
  props: P,
  name: string = `StrictType<${getNameFromProps(props)}>`
): StrictType<P, { [K in keyof P]: TypeOf<P[K]> }, { [K in keyof P]: OutputOf<P[K]> }, mixed> => {
  const loose = type(props)
  return new StrictType(
    name,
    (m): m is TypeOfProps<P> => loose.is(m) && Object.getOwnPropertyNames(m).every(k => props.hasOwnProperty(k)),
    (m, c, decoder) => {
      const looseValidation = loose.validate(m, c, loose)
      if (isLeft(looseValidation)) {
        return looseValidation
      } else {
        const o = looseValidation
        const keys = Object.getOwnPropertyNames(o)
        const len = keys.length
        const errors: VErrors = []
        for (let i = 0; i < len; i++) {
          const key = keys[i]
          if (!props.hasOwnProperty(key)) {
            errors.push(failureError(o[key], String(key), never))
          }
        }
        return errors.length ? failures(m, String(''), decoder, errors) : o
      }
    },
    loose.encode,
    props
  )
}

//
// tagged unions
//

export type TaggedProps<Tag extends string> = { [K in Tag]: LiteralType<any> }
export interface TaggedRefinement<Tag extends string, A, O = A> extends RefinementType<Tagged<Tag>, A, O> {}
export interface TaggedUnion<Tag extends string, A, O = A> extends UnionType<Array<Tagged<Tag>>, A, O> {}
export type TaggedIntersectionArgument<Tag extends string> =
  | [Tagged<Tag>]
  | [Tagged<Tag>, Mixed]
  | [Mixed, Tagged<Tag>]
  | [Tagged<Tag>, Mixed, Mixed]
  | [Mixed, Tagged<Tag>, Mixed]
  | [Mixed, Mixed, Tagged<Tag>]
  | [Tagged<Tag>, Mixed, Mixed, Mixed]
  | [Mixed, Tagged<Tag>, Mixed, Mixed]
  | [Mixed, Mixed, Tagged<Tag>, Mixed]
  | [Mixed, Mixed, Mixed, Tagged<Tag>]
  | [Tagged<Tag>, Mixed, Mixed, Mixed, Mixed]
  | [Mixed, Tagged<Tag>, Mixed, Mixed, Mixed]
  | [Mixed, Mixed, Tagged<Tag>, Mixed, Mixed]
  | [Mixed, Mixed, Mixed, Tagged<Tag>, Mixed]
  | [Mixed, Mixed, Mixed, Mixed, Tagged<Tag>]
export interface TaggedIntersection<Tag extends string, A, O = A>
  extends IntersectionType<TaggedIntersectionArgument<Tag>, A, O> {}
export type Tagged<Tag extends string, A = any, O = A> =
  | InterfaceType<TaggedProps<Tag>, A, O>
  | StrictType<TaggedProps<Tag>, A, O>
  | TaggedRefinement<Tag, A, O>
  | TaggedUnion<Tag, A, O>
  | TaggedIntersection<Tag, A, O>

const isTagged = <Tag extends string>(tag: Tag): ((type: Mixed) => type is Tagged<Tag>) => {
  const f = (type: Mixed): type is Tagged<Tag> => {
    if (type instanceof InterfaceType || type instanceof StrictType) {
      return type.props.hasOwnProperty(tag)
    } else if (type instanceof IntersectionType) {
      return type.types.some(f)
    } else if (type instanceof UnionType) {
      return type.types.every(f)
    } else if (type instanceof RefinementType) {
      return f(type.type)
    } else {
      return false
    }
  }
  return f
}

const findTagged = <Tag extends string>(tag: Tag, types: TaggedIntersectionArgument<Tag>): Tagged<Tag> => {
  const len = types.length
  const is = isTagged(tag)
  let i = 0
  for (; i < len - 1; i++) {
    const type = types[i]
    if (is(type)) {
      return type
    }
  }
  return types[i] as any
}

const getTagValue = <Tag extends string>(tag: Tag): ((type: Tagged<Tag>) => string) => {
  const f = (type: Tagged<Tag>): string => {
    switch (type._tag) {
      case 'InterfaceType':
      case 'StrictType':
        return type.props[tag].value
      case 'IntersectionType':
        return f(findTagged(tag, type.types))
      case 'UnionType':
        return f(type.types[0])
      case 'RefinementType':
        return f(type.type)
    }
  }
  return f
}

export const taggedUnion = <Tag extends string, RTS extends Array<Tagged<Tag>>>(
  tag: Tag,
  types: RTS,
  name: string = `(${types.map(type => type.name).join(' | ')})`
): UnionType<RTS, TypeOf<RTS['_A']>, OutputOf<RTS['_A']>, mixed> => {
  const tagValue2Index: { [key: string]: number } = {}
  const tagValues: { [key: string]: null } = {}
  const len = types.length
  const get = getTagValue(tag)
  for (let i = 0; i < len; i++) {
    const value = get(types[i])
    tagValue2Index[value] = i
    tagValues[value] = null
  }
  const TagValue = keyof(tagValues)
  return new UnionType<RTS, TypeOf<RTS['_A']>, OutputOf<RTS['_A']>, mixed>(
    name,
    (v): v is TypeOf<RTS['_A']> => {
      if (!Dictionary.is(v)) {
        return false
      }
      const tagValue = v[tag]
      return TagValue.is(tagValue) && types[tagValue2Index[tagValue]].is(v)
    },
    (s, c, decoder) => {
      const dictionaryValidation = Dictionary.validate(s, c, decoder)
      if (isLeft(dictionaryValidation)) {
        return dictionaryValidation
      } else {
        const d = dictionaryValidation
        const tagValueValidation = TagValue.validate(d[tag], tag, TagValue)
        if (isLeft(tagValueValidation)) {
          return failure(d[tag], String(' '), decoder, [tagValueValidation.value])
        } else {
          const tagValue = tagValueValidation
          const i = tagValue2Index[tagValue]
          const type = types[i]
          return type.validate(d, c, type)
        }
      }
    },
    types.every(type => type.encode === identity) ? identity : a => types[tagValue2Index[a[tag] as any]].encode(a),
    types
  )
}

export { nullType as null, undefinedType as undefined, arrayType as Array, type as interface }

import { Reporter } from './Reporter'
import { Context, getFunctionName, ValidationError, VError } from './index'
import * as arrays from 'fp-ts/lib/Array'
import { compose } from 'fp-ts/lib/function'

function stringify(v: any): string {
  return typeof v === 'function' ? getFunctionName(v) : JSON.stringify(v)
}

function getContextPath(context: Context): string {
  return context.map(({ key, type }) => `${key}: ${type.name}`).join('/')
}

function getMessage(v: any, context: Context): string {
  return `Invalid value ${stringify(v)} supplied to ${getContextPath(context)}`
}

export function failure(es: Array<ValidationError>): Array<string> {
  return es.map(e => getMessage(e.value, e.context))
}

export function success(): Array<string> {
  return ['No errors!']
}

export const convertError = (x: VError): ValidationError[] => {
  if (x.children.length > 0) {
    return arrays.array.chain(x.children, child =>
      convertError(child).map<ValidationError>(error => {
        const context: Context = arrays.cons({ key: x.key, type: x.type }, error.context)
        return { value: error.value, context }
      })
    )
  } else {
    return [{ value: x.value, context: [{ key: x.key, type: x.type }] }]
  }
}
export const PathReporter: Reporter<Array<string>> = {
  report: validation => validation.fold(compose(failure, convertError), success)
}

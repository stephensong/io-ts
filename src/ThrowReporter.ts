import { Reporter } from './Reporter'
import { PathReporter } from './PathReporter'
import { isLeft } from '.'

export const ThrowReporter: Reporter<void> = {
  report: validation => {
    if (isLeft(validation)) {
      throw PathReporter.report(validation).join('\n')
    }
  }
}

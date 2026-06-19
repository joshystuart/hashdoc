import katex from 'katex';
import 'katex/dist/katex.min.css';

export function renderMath(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    displayMode,
    trust: false,
    throwOnError: true,
    output: 'htmlAndMathml',
  });
}
